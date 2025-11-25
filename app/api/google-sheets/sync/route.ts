import { NextRequest, NextResponse } from 'next/server';
import { syncToGoogleSheets, setCredentials, getGoogleAuth } from '@/lib/google-sheets';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';

// Sync tracker data to Google Sheets
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user and their Google tokens
    const user = await prisma.user.findUnique({
      where: { username: session.user.name || '' },
      include: { preferences: true },
    });

    if (!user?.preferences?.filterState) {
      return NextResponse.json(
        { error: 'Google Sheets not connected. Please authorize first.' },
        { status: 400 }
      );
    }

    // Parse tokens
    const tokens = JSON.parse(user.preferences.filterState);
    const auth = setCredentials(getGoogleAuth(), tokens);

    // Get body data
    const { spreadsheetId, shows } = await req.json();

    // Sync to Google Sheets
    const newSpreadsheetId = await syncToGoogleSheets(auth, spreadsheetId, shows);

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
