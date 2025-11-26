import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuth, readFromGoogleSheets, detectSheetChanges } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';

// Helper function to increment version
function incrementVersion(currentVersion: string | null): string {
  if (!currentVersion) return 'v001';
  
  const match = currentVersion.match(/v(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10) + 1;
    return `v${num.toString().padStart(3, '0')}`;
  }
  return 'v001';
}

// Import changes from Google Sheets back to tracker
export async function POST(req: NextRequest) {
  try {
    console.log('[Google Sheets Import] Starting import...');
    
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const username = (session.user as any).username;
    console.log('[Google Sheets Import] User:', username);

    // Get user and their Google tokens
    const user = await prisma.user.findUnique({
      where: { username: username || '' },
      include: { preferences: true },
    });

    if (!user?.preferences?.googleTokens) {
      return NextResponse.json(
        { error: 'Google Sheets not connected. Please connect first.' },
        { status: 400 }
      );
    }

    // Get system spreadsheet ID from admin settings
    const settings = await prisma.systemSettings.findFirst({
      where: { key: 'google_sheets' }
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'No Google Sheet configured. Please set up the Sheet ID in Admin > Settings > Google Sheets.' },
        { status: 400 }
      );
    }

    const { spreadsheetId } = JSON.parse(settings.value);
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'No Google Sheet ID configured. Please set up the Sheet ID in Admin > Settings > Google Sheets.' },
        { status: 400 }
      );
    }

    console.log('[Google Sheets Import] Using spreadsheet:', spreadsheetId);

    // Parse tokens
    const tokens = JSON.parse(user.preferences.googleTokens);
    if (!tokens.access_token && !tokens.refresh_token) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }

    // Set up auth
    const auth = getGoogleAuth();
    auth.setCredentials(tokens);

    // Get shows from request body
    const { shows } = await req.json();

    // Detect changes from Google Sheets
    console.log('[Google Sheets Import] Detecting changes...');
    const changes = await detectSheetChanges(auth, spreadsheetId, shows);
    console.log('[Google Sheets Import] Detected', changes.length, 'changes');

    // Apply changes to database
    const appliedChanges: any[] = [];
    
    for (const change of changes) {
      try {
        // Get current task to check for AWF status change logic
        const currentTask = await prisma.task.findUnique({
          where: { id: change.taskId },
        });

        if (!currentTask) {
          console.log('[Google Sheets Import] Task not found:', change.taskId);
          continue;
        }

        const updateData = { ...change.updates };

        // Handle AWF version increment logic
        // If status is changing TO AWF and current status is NOT AWF
        if (updateData.status === 'AWF' && currentTask.status !== 'AWF') {
          console.log('[Google Sheets Import] AWF status change detected for task:', change.taskId);
          // Auto-increment version
          updateData.deliveredVersion = incrementVersion(currentTask.deliveredVersion);
          // Auto-set delivered date
          updateData.deliveredDate = new Date();
          console.log('[Google Sheets Import] Auto-set version:', updateData.deliveredVersion, 'date:', updateData.deliveredDate);
        }

        // Update task in database
        const updatedTask = await prisma.task.update({
          where: { id: change.taskId },
          data: updateData,
        });

        // Log the change
        await prisma.activityLog.create({
          data: {
            actionType: 'UPDATE',
            entityType: 'Task',
            entityId: change.taskId,
            userId: user.id,
            userName: username,
            fieldName: 'multiple',
            oldValue: JSON.stringify({
              status: currentTask.status,
              deliveredVersion: currentTask.deliveredVersion,
              deliveredDate: currentTask.deliveredDate,
            }),
            newValue: JSON.stringify({
              source: 'Google Sheets Import',
              changes: updateData,
            }),
          },
        });

        appliedChanges.push({
          taskId: change.taskId,
          updates: change.updates,
        });
      } catch (updateError: any) {
        console.error('[Google Sheets Import] Failed to update task:', change.taskId, updateError.message);
      }
    }

    // Save refreshed tokens if they changed
    const refreshedCredentials = auth.credentials;
    if (refreshedCredentials?.access_token !== tokens.access_token) {
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: { googleTokens: JSON.stringify(refreshedCredentials) },
      });
      console.log('[Google Sheets Import] Tokens refreshed and saved');
    }

    console.log('[Google Sheets Import] Applied', appliedChanges.length, 'changes');

    return NextResponse.json({
      success: true,
      changes: appliedChanges,
      totalDetected: changes.length,
      totalApplied: appliedChanges.length,
    });
  } catch (error: any) {
    console.error('[Google Sheets Import] Error:', error);
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Google Sheet not found. Please check the Sheet ID in Admin Settings.' },
        { status: 404 }
      );
    }
    
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'No permission to read the Google Sheet. Make sure you have access.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to import from Google Sheets' },
      { status: 500 }
    );
  }
}
