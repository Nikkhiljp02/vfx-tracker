import { NextRequest, NextResponse } from 'next/server';
import { syncToGoogleSheets, setCredentials, getGoogleAuth } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// Sync tracker data to Google Sheets
export async function POST(req: NextRequest) {
  try {
    console.log('[Google Sheets Sync] Starting sync...');
    
    const session = await getAuth();
    if (!session?.user) {
      console.log('[Google Sheets Sync] Not authenticated');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('[Google Sheets Sync] User:', (session.user as any).username);

    // Get user and their Google tokens
    const user = await prisma.user.findUnique({
      where: { username: (session.user as any).username || '' },
      include: { preferences: true },
    });

    if (!user?.preferences?.googleTokens) {
      console.log('[Google Sheets Sync] No tokens found');
      return NextResponse.json(
        { error: 'Google Sheets not connected. Please authorize first.' },
        { status: 400 }
      );
    }

    console.log('[Google Sheets Sync] Tokens found, parsing...');

    // Parse tokens
    let tokens;
    try {
      tokens = JSON.parse(user.preferences.googleTokens);
    } catch (e) {
      console.error('[Google Sheets Sync] Failed to parse tokens:', e);
      return NextResponse.json(
        { error: 'Invalid token format. Please reconnect Google Sheets.' },
        { status: 400 }
      );
    }

    console.log('[Google Sheets Sync] Parsed tokens:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      tokenType: tokens.token_type,
      scope: tokens.scope,
      expiryDate: tokens.expiry_date
    });

    if (!tokens.access_token && !tokens.refresh_token) {
      console.error('[Google Sheets Sync] No valid tokens found');
      return NextResponse.json(
        { error: 'No valid Google tokens found. Please reconnect Google Sheets.' },
        { status: 401 }
      );
    }

    console.log('[Google Sheets Sync] Creating OAuth client...');
    const auth = getGoogleAuth();
    console.log('[Google Sheets Sync] Setting credentials...');
    auth.setCredentials(tokens);
    console.log('[Google Sheets Sync] Credentials set. Auth state:', {
      hasCredentials: !!auth.credentials,
      credentialsKeys: auth.credentials ? Object.keys(auth.credentials) : []
    });

    // Get body data
    const { spreadsheetId: requestSpreadsheetId, shows } = await req.json();
    
    // Use spreadsheet ID from request OR fallback to stored ID in preferences
    // Handle string "null" from database or request
    const rawSpreadsheetId = requestSpreadsheetId || user.preferences.sortState;
    const spreadsheetId = (rawSpreadsheetId && rawSpreadsheetId !== 'null') ? rawSpreadsheetId : null;
    console.log('[Google Sheets Sync] Request spreadsheet ID:', requestSpreadsheetId);
    console.log('[Google Sheets Sync] Stored spreadsheet ID:', user.preferences.sortState);
    console.log('[Google Sheets Sync] Raw spreadsheet ID:', rawSpreadsheetId);
    console.log('[Google Sheets Sync] Final spreadsheet ID:', spreadsheetId, 'Type:', typeof spreadsheetId);
    console.log('[Google Sheets Sync] Shows count:', shows?.length);

    // Sync to Google Sheets
    console.log('[Google Sheets Sync] Calling syncToGoogleSheets...');
    const newSpreadsheetId = await syncToGoogleSheets(auth, spreadsheetId, shows);
    console.log('[Google Sheets Sync] Sync complete, spreadsheet ID:', newSpreadsheetId);

    // Save refreshed tokens if they were updated
    const refreshedCredentials = auth.credentials;
    if (refreshedCredentials && (
      refreshedCredentials.access_token !== tokens.access_token ||
      refreshedCredentials.refresh_token !== tokens.refresh_token
    )) {
      console.log('[Google Sheets Sync] Tokens were refreshed, saving with spreadsheet ID:', newSpreadsheetId);
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: {
          googleTokens: JSON.stringify(refreshedCredentials),
          sortState: newSpreadsheetId, // Store spreadsheet ID
        },
      });
    } else {
      // Always store spreadsheet ID
      console.log('[Google Sheets Sync] Saving spreadsheet ID to database:', newSpreadsheetId);
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: {
          sortState: newSpreadsheetId,
        },
      });
    }
    console.log('[Google Sheets Sync] Spreadsheet ID saved successfully');

    return NextResponse.json({
      success: true,
      spreadsheetId: newSpreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${newSpreadsheetId}`,
    });
  } catch (error: any) {
    console.error('Error syncing to Google Sheets:', error);
    
    // Check if token expired
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to sync to Google Sheets', details: error.message },
      { status: 500 }
    );
  }
}
