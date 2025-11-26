import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// Check if user has Google Sheets connected
export async function GET(req: NextRequest) {
  try {
    // Get current user session
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    // Get user with preferences
    const user = await prisma.user.findUnique({
      where: { username: (session.user as any).username || '' },
      include: { preferences: true },
    });

    if (!user || !user.preferences?.filterState) {
      return NextResponse.json({ connected: false });
    }

    // Check if Google tokens exist
    try {
      const tokens = JSON.parse(user.preferences.filterState);
      const hasTokens = tokens.access_token || tokens.refresh_token;
      
      // Get spreadsheet ID from sortState (stored after first sync)
      // Handle string "null" from database
      const rawSpreadsheetId = user.preferences.sortState;
      const spreadsheetId = (rawSpreadsheetId && rawSpreadsheetId !== 'null') ? rawSpreadsheetId : null;
      const spreadsheetUrl = spreadsheetId 
        ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
        : null;
      
      console.log('[Google Sheets Status] Raw sortState:', rawSpreadsheetId, 'Clean spreadsheetId:', spreadsheetId);
      
      return NextResponse.json({ 
        connected: !!hasTokens,
        spreadsheetUrl,
        spreadsheetId
      });
    } catch (error) {
      return NextResponse.json({ connected: false });
    }
  } catch (error) {
    console.error('Error checking Google Sheets status:', error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}
