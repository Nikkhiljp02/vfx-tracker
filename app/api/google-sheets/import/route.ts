import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuth, readFromGoogleSheets, detectSheetChanges } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// Import changes from Google Sheets back to tracker
export async function POST(req: NextRequest) {
  try {
    console.log('[Google Sheets Import] Starting import...');
    
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const username = (session.user as any).username;
    console.log('[Google Sheets Import] User:', username);

    // Get user and their Google tokens
    const user = await prisma.user.findUnique({
      where: { username: username || '' },
      include: { preferences: true },
    });

    if (!user?.preferences?.googleTokens) {
      return NextResponse.json(
        { error: 'Google Sheets not connected. Please connect first.' },
        { status: 400 }
      );
    }

    // Get system spreadsheet ID from admin settings
    const settings = await prisma.systemSettings.findFirst({
      where: { key: 'google_sheets' }
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'No Google Sheet configured. Please set up the Sheet ID in Admin > Settings > Google Sheets.' },
        { status: 400 }
      );
    }

    const { spreadsheetId } = JSON.parse(settings.value);
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'No Google Sheet ID configured. Please set up the Sheet ID in Admin > Settings > Google Sheets.' },
        { status: 400 }
      );
    }

    console.log('[Google Sheets Import] Using spreadsheet:', spreadsheetId);

    // Parse tokens
    const tokens = JSON.parse(user.preferences.googleTokens);
    if (!tokens.access_token && !tokens.refresh_token) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }

    // Set up auth
    const auth = getGoogleAuth();
    auth.setCredentials(tokens);

    // Get shows from request body
    const { shows } = await req.json();

    // Detect changes from Google Sheets
    console.log('[Google Sheets Import] Detecting changes...');
    const changes = await detectSheetChanges(auth, spreadsheetId, shows);
    console.log('[Google Sheets Import] Detected', changes.length, 'changes');

    // Apply changes to database
    const appliedChanges: any[] = [];
    
    for (const change of changes) {
      try {
        // Update task in database
        const updatedTask = await prisma.task.update({
          where: { id: change.taskId },
          data: change.updates,
        });

        // Log the change
        await prisma.activityLog.create({
          data: {
            action: 'TASK_UPDATED',
            entityType: 'TASK',
            entityId: change.taskId,
            userId: user.id,
            details: JSON.stringify({
              source: 'Google Sheets Import',
              changes: change.updates,
            }),
          },
        });

        appliedChanges.push({
          taskId: change.taskId,
          updates: change.updates,
        });
      } catch (updateError: any) {
        console.error('[Google Sheets Import] Failed to update task:', change.taskId, updateError.message);
      }
    }

    // Save refreshed tokens if they changed
    const refreshedCredentials = auth.credentials;
    if (refreshedCredentials?.access_token !== tokens.access_token) {
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: { googleTokens: JSON.stringify(refreshedCredentials) },
      });
      console.log('[Google Sheets Import] Tokens refreshed and saved');
    }

    console.log('[Google Sheets Import] Applied', appliedChanges.length, 'changes');

    return NextResponse.json({
      success: true,
      changes: appliedChanges,
      totalDetected: changes.length,
      totalApplied: appliedChanges.length,
    });
  } catch (error: any) {
    console.error('[Google Sheets Import] Error:', error);
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Google Sheet not found. Please check the Sheet ID in Admin Settings.' },
        { status: 404 }
      );
    }
    
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'No permission to read the Google Sheet. Make sure you have access.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to import from Google Sheets' },
      { status: 500 }
    );
  }
}
