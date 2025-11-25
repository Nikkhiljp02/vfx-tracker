import { NextRequest, NextResponse } from 'next/server';
import { detectSheetChanges, setCredentials, getGoogleAuth } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// Read changes from Google Sheets and apply to tracker
export async function POST(req: NextRequest) {
  try {
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user and their Google tokens
    const user = await prisma.user.findUnique({
      where: { username: (session.user as any).username || '' },
      include: { preferences: true },
    });

    if (!user?.preferences?.filterState) {
      return NextResponse.json(
        { error: 'Google Sheets not connected' },
        { status: 400 }
      );
    }

    if (!user?.preferences?.sortState) {
      return NextResponse.json(
        { error: 'No spreadsheet ID found' },
        { status: 400 }
      );
    }

    // Parse tokens and spreadsheet ID
    const tokens = JSON.parse(user.preferences.filterState);
    const spreadsheetId = user.preferences.sortState;
    const auth = setCredentials(getGoogleAuth(), tokens);

    // Get current shows data
    const { shows } = await req.json();

    // Detect changes from Google Sheets
    const changes = await detectSheetChanges(auth, spreadsheetId, shows);

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected',
        changes: [],
      });
    }

    // Apply changes to database
    const results = await Promise.allSettled(
      changes.map(async (change) => {
        return prisma.task.update({
          where: { id: change.taskId },
          data: change.changes,
        });
      })
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    // Log activity
    for (const change of changes) {
      const fieldChanges = Object.keys(change.changes);
      for (const field of fieldChanges) {
        await prisma.activityLog.create({
          data: {
            entityType: 'Task',
            entityId: change.taskId,
            actionType: 'UPDATE',
            fieldName: field,
            oldValue: '', // Would need to fetch old value
            newValue: JSON.stringify(change.changes[field]),
            userName: (session.user as any).username || 'Google Sheets Sync',
            userId: user.id,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Applied ${succeeded} changes from Google Sheets`,
      changes,
      stats: { succeeded, failed },
    });
  } catch (error: any) {
    console.error('Error importing from Google Sheets:', error);
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to import from Google Sheets', details: error.message },
      { status: 500 }
    );
  }
}
