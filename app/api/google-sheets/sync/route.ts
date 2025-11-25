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

    if (!user?.preferences?.filterState) {
      console.log('[Google Sheets Sync] No tokens found');
      return NextResponse.json(
        { error: 'Google Sheets not connected. Please authorize first.' },
        { status: 400 }
      );
    }

    console.log('[Google Sheets Sync] Tokens found, parsing...');

    // Parse tokens
    const tokens = JSON.parse(user.preferences.filterState);
    console.log('[Google Sheets Sync] Setting credentials...');
    
    const auth = setCredentials(getGoogleAuth(), tokens);
    console.log('[Google Sheets Sync] Credentials set');

    // Get body data
    const { spreadsheetId, shows } = await req.json();
    console.log('[Google Sheets Sync] Request data - spreadsheetId:', spreadsheetId, 'shows count:', shows?.length);

    // Sync to Google Sheets
    console.log('[Google Sheets Sync] Calling syncToGoogleSheets...');
    const newSpreadsheetId = await syncToGoogleSheets(auth, spreadsheetId, shows);
    console.log('[Google Sheets Sync] Sync complete, spreadsheet ID:', newSpreadsheetId);

    // Store spreadsheet ID in preferences
    await prisma.userPreferences.update({
      where: { userId: user.id },
      data: {
        sortState: newSpreadsheetId, // Temporary storage
      },
    });

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
