import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// System settings stored in a simple key-value format
// For now, we'll use a special "system" user preferences entry

// GET - Load Google Sheets settings
export async function GET(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get system settings (stored in a special record)
    const settings = await prisma.systemSettings.findFirst({
      where: { key: 'google_sheets' }
    });

    if (!settings) {
      return NextResponse.json({
        spreadsheetId: '',
        spreadsheetUrl: ''
      });
    }

    const data = JSON.parse(settings.value);
    return NextResponse.json({
      spreadsheetId: data.spreadsheetId || '',
      spreadsheetUrl: data.spreadsheetId 
        ? `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`
        : ''
    });
  } catch (error) {
    console.error('Error loading Google Sheets settings:', error);
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

// PUT - Save Google Sheets settings
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { spreadsheetId } = await req.json();

    // Validate spreadsheet ID format (basic check)
    if (spreadsheetId && !/^[a-zA-Z0-9-_]+$/.test(spreadsheetId)) {
      return NextResponse.json({ error: 'Invalid spreadsheet ID format' }, { status: 400 });
    }

    // Upsert system settings
    await prisma.systemSettings.upsert({
      where: { key: 'google_sheets' },
      update: {
        value: JSON.stringify({ spreadsheetId }),
        updatedAt: new Date()
      },
      create: {
        key: 'google_sheets',
        value: JSON.stringify({ spreadsheetId })
      }
    });

    return NextResponse.json({ 
      success: true,
      spreadsheetId,
      spreadsheetUrl: spreadsheetId 
        ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
        : ''
    });
  } catch (error) {
    console.error('Error saving Google Sheets settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
