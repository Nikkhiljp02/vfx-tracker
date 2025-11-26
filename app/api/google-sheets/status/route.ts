import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// Check Google Sheets connection status
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ connected: false }, { status: 401 });
    }

    // Get user with preferences
    const user = await prisma.user.findUnique({
      where: { username: (session.user as any).username || '' },
      include: { preferences: true },
    });

    if (!user?.preferences?.googleTokens) {
      return NextResponse.json({ connected: false });
    }

    // Check if Google tokens exist and are valid
    try {
      const tokens = JSON.parse(user.preferences.googleTokens);
      const hasTokens = tokens.access_token || tokens.refresh_token;
      
      if (!hasTokens) {
        return NextResponse.json({ connected: false });
      }

      // Get system spreadsheet ID from admin settings
      let spreadsheetUrl = null;
      let spreadsheetId = null;
      
      const settings = await prisma.systemSettings.findFirst({
        where: { key: 'google_sheets' }
      });

      if (settings) {
        const data = JSON.parse(settings.value);
        spreadsheetId = data.spreadsheetId || null;
        spreadsheetUrl = spreadsheetId 
          ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
          : null;
      }

      return NextResponse.json({ 
        connected: true,
        spreadsheetUrl,
        spreadsheetId,
        hasSheetConfigured: !!spreadsheetId
      });
    } catch (error) {
      return NextResponse.json({ connected: false });
    }
  } catch (error) {
    console.error('[Google Sheets Status] Error:', error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}
