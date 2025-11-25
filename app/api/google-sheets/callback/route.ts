import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// Handle OAuth callback and store tokens
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('Google authorization failed')}`, req.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('No authorization code received')}`, req.url)
      );
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Get current user session
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('Not authenticated')}`, req.url)
      );
    }

    // Store tokens in user preferences (encrypted in production)
    const user = await prisma.user.findUnique({
      where: { username: (session.user as any).username || '' },
      include: { preferences: true },
    });

    if (!user) {
      return NextResponse.redirect(
        new URL(`/?error=${encodeURIComponent('User not found')}`, req.url)
      );
    }

    // Store Google tokens in preferences
    const googleTokens = JSON.stringify(tokens);
    
    if (user.preferences) {
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: {
          filterState: googleTokens, // Temporary storage, should use separate field
        },
      });
    } else {
      await prisma.userPreferences.create({
        data: {
          userId: user.id,
          filterState: googleTokens,
        },
      });
    }

    // Redirect back to app with success
    return NextResponse.redirect(
      new URL('/?google_sheets=connected', req.url)
    );
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent('Failed to connect Google Sheets')}`, req.url)
    );
  }
}
