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
      
      return NextResponse.json({ 
        connected: !!hasTokens,
        spreadsheetUrl: null // Could be stored separately if needed
      });
    } catch (error) {
      return NextResponse.json({ connected: false });
    }
  } catch (error) {
    console.error('Error checking Google Sheets status:', error);
    return NextResponse.json({ connected: false }, { status: 500 });
  }
}
