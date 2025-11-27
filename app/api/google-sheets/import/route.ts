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
  const startTime = Date.now();
  try {
    console.log('[Google Sheets Import] Starting import...');
    
    // Run auth and settings queries in parallel
    const [session, settings] = await Promise.all([
      getAuth(),
      prisma.systemSettings.findFirst({ where: { key: 'google_sheets' } })
    ]);

    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const username = (session.user as any).username;

    if (!settings) {
      return NextResponse.json(
        { error: 'No Google Sheet configured. Please set up the Sheet ID in Admin > Settings > Google Sheets.' },
        { status: 400 }
      );
    }

    const { spreadsheetId } = JSON.parse(settings.value);
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'No Google Sheet ID configured.' },
        { status: 400 }
      );
    }

    // Get user with tokens
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
    console.log('[Google Sheets Import] Detected', changes.length, 'changes in', Date.now() - startTime, 'ms');

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        changes: [],
        totalDetected: 0,
        totalApplied: 0,
      });
    }

    // Get all current tasks in one query for AWF logic
    const taskIds = changes.map(c => c.taskId);
    const currentTasks = await prisma.task.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, status: true, deliveredVersion: true, deliveredDate: true }
    });
    const taskMap = new Map(currentTasks.map(t => [t.id, t]));

    // Prepare batch updates with AWF logic
    const updatePromises: Promise<any>[] = [];
    const activityLogData: any[] = [];
    const appliedChanges: any[] = [];
    
    for (const change of changes) {
      const currentTask = taskMap.get(change.taskId);
      if (!currentTask) continue;

      const updateData = { ...change.updates };

      // Handle AWF version increment logic
      if (updateData.status === 'AWF' && currentTask.status !== 'AWF') {
        updateData.deliveredVersion = incrementVersion(currentTask.deliveredVersion);
        updateData.deliveredDate = new Date();
      }

      // Queue the update
      updatePromises.push(
        prisma.task.update({
          where: { id: change.taskId },
          data: updateData,
        })
      );

      // Prepare activity log
      activityLogData.push({
        actionType: 'UPDATE',
        entityType: 'Task',
        entityId: change.taskId,
        userId: user.id,
        userName: username,
        fieldName: 'multiple',
        oldValue: JSON.stringify({ status: currentTask.status }),
        newValue: JSON.stringify({ source: 'Google Sheets Import', changes: updateData }),
      });

      appliedChanges.push({ taskId: change.taskId, updates: change.updates });
    }

    // Execute all updates in parallel (batched)
    const BATCH_SIZE = 20;
    for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
      await Promise.all(updatePromises.slice(i, i + BATCH_SIZE));
    }
    console.log('[Google Sheets Import] Updates complete in', Date.now() - startTime, 'ms');

    // Batch create activity logs (non-blocking)
    prisma.activityLog.createMany({ data: activityLogData }).catch(err => 
      console.error('[Google Sheets Import] Activity log error:', err)
    );

    // Save refreshed tokens if changed (non-blocking)
    const refreshedCredentials = auth.credentials;
    if (refreshedCredentials?.access_token !== tokens.access_token) {
      prisma.userPreferences.update({
        where: { userId: user.id },
        data: { googleTokens: JSON.stringify(refreshedCredentials) },
      }).catch(err => console.error('[Google Sheets Import] Token save error:', err));
    }

    console.log('[Google Sheets Import] Total time:', Date.now() - startTime, 'ms');

    return NextResponse.json({
      success: true,
      changes: appliedChanges,
      totalDetected: changes.length,
      totalApplied: appliedChanges.length,
    });
  } catch (error: any) {
    console.error('[Google Sheets Import] Error:', error);
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json({ error: 'Google authorization expired. Please reconnect.' }, { status: 401 });
    }
    if (error.code === 404) {
      return NextResponse.json({ error: 'Google Sheet not found.' }, { status: 404 });
    }
    if (error.code === 403) {
      return NextResponse.json({ error: 'No permission to read the Google Sheet.' }, { status: 403 });
    }

    return NextResponse.json({ error: error.message || 'Failed to import from Google Sheets' }, { status: 500 });
  }
}
