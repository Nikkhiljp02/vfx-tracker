import { NextRequest, NextResponse } from 'next/server';
import { detectSheetChanges, setCredentials, getGoogleAuth } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// Read changes from Google Sheets and apply to tracker
export async function POST(req: NextRequest) {
  try {
    console.log('[Google Sheets Import] Starting import...');
    
    const session = await getAuth();
    if (!session?.user) {
      console.log('[Google Sheets Import] Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('[Google Sheets Import] User:', (session.user as any).username);

    // Get user and their Google tokens
    const user = await prisma.user.findUnique({
      where: { username: (session.user as any).username || '' },
      include: { preferences: true },
    });

    console.log('[Google Sheets Import] User found:', !!user, 'Has tokens:', !!user?.preferences?.googleTokens);

    // Check if googleTokens is string "null" or missing
    const rawGoogleTokens = user?.preferences?.googleTokens;
    if (!rawGoogleTokens || rawGoogleTokens === 'null') {
      console.log('[Google Sheets Import] No tokens stored or string null');
      return NextResponse.json(
        { error: 'Google Sheets not connected. Please connect first.' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await req.json();
    const { shows, spreadsheetId: requestSpreadsheetId } = body;

    // Get spreadsheet ID from request or user preferences
    // Handle string "null" from database
    const rawSpreadsheetId = requestSpreadsheetId || user.preferences?.sortState;
    const spreadsheetId = (rawSpreadsheetId && rawSpreadsheetId !== 'null') ? rawSpreadsheetId : null;
    console.log('[Google Sheets Import] Spreadsheet ID from request:', requestSpreadsheetId);
    console.log('[Google Sheets Import] Spreadsheet ID from preferences:', user.preferences?.sortState);
    console.log('[Google Sheets Import] Using spreadsheet ID:', spreadsheetId);

    if (!spreadsheetId) {
      console.log('[Google Sheets Import] No spreadsheet ID found');
      return NextResponse.json(
        { error: 'No spreadsheet ID found. Please sync to sheets first.' },
        { status: 400 }
      );
    }

    // Parse tokens
    let tokens;
    try {
      console.log('[Google Sheets Import] Raw googleTokens:', rawGoogleTokens?.substring(0, 100));
      tokens = JSON.parse(rawGoogleTokens);
      console.log('[Google Sheets Import] Tokens parsed, keys:', Object.keys(tokens || {}));
      console.log('[Google Sheets Import] has access_token:', !!tokens?.access_token, 'has refresh_token:', !!tokens?.refresh_token);
    } catch (parseError) {
      console.error('[Google Sheets Import] Failed to parse tokens:', parseError);
      return NextResponse.json(
        { error: 'Invalid Google credentials. Please reconnect to Google Sheets.' },
        { status: 400 }
      );
    }

    if (!tokens?.access_token && !tokens?.refresh_token) {
      console.log('[Google Sheets Import] No valid tokens found');
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect to Google Sheets.' },
        { status: 400 }
      );
    }

    const auth = getGoogleAuth();
    auth.setCredentials(tokens);

    console.log('[Google Sheets Import] Detecting changes from sheet...');
    // Detect changes from Google Sheets
    const changes = await detectSheetChanges(auth, spreadsheetId, shows);
    console.log('[Google Sheets Import] Detected', changes.length, 'changes');

    // Save refreshed tokens if they were updated
    const refreshedCredentials = auth.credentials;
    if (refreshedCredentials && (
      refreshedCredentials.access_token !== tokens.access_token ||
      refreshedCredentials.refresh_token !== tokens.refresh_token
    )) {
      console.log('[Google Sheets Import] Tokens were refreshed, saving...');
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: {
          googleTokens: JSON.stringify(refreshedCredentials),
        },
      });
    }

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected',
        changes: [],
      });
    }

    // Apply changes to database
    const results = await Promise.allSettled(
      changes.map(async (change) => {
        return prisma.task.update({
          where: { id: change.taskId },
          data: change.changes,
        });
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // Log activity
    for (const change of changes) {
      const fieldChanges = Object.keys(change.changes);
      for (const field of fieldChanges) {
        await prisma.activityLog.create({
          data: {
            entityType: 'Task',
            entityId: change.taskId,
            actionType: 'UPDATE',
            fieldName: field,
            oldValue: '', // Would need to fetch old value
            newValue: JSON.stringify(change.changes[field]),
            userName: (session.user as any).username || 'Google Sheets Sync',
            userId: user.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Applied ${succeeded} changes from Google Sheets`,
      changes,
      stats: { succeeded, failed },
    });
  } catch (error: any) {
    console.error('Error importing from Google Sheets:', error);
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to import from Google Sheets', details: error.message },
      { status: 500 }
    );
  }
}
