import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-sheets';

// Initiate Google OAuth flow
export async function GET(req: NextRequest) {
  try {
    const authUrl = getAuthUrl();
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    );
  }
}
