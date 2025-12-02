import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Cache for permission checks (short-lived, per-request optimization)
const permissionCache = new Map<string, boolean>();

// Helper function to check if user can edit a task - optimized
async function canUserEditTask(userId: string, userRole: string, taskId: string, showId?: string): Promise<boolean> {
  // Admin and Coordinator can edit all tasks
  if (userRole === 'ADMIN' || userRole === 'COORDINATOR') {
    return true;
  }

  const cacheKey = `${userId}-${showId || taskId}`;
  if (permissionCache.has(cacheKey)) {
    return permissionCache.get(cacheKey)!;
  }

  let targetShowId = showId;
  
  // If showId not provided, get it from task
  if (!targetShowId) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { shot: { select: { showId: true } } },
    });
    if (!task) return false;
    targetShowId = task.shot.showId;
  }

  // Check if user has edit access to the show
  const showAccess = await prisma.showAccess.findFirst({
    where: { userId, showId: targetShowId, canEdit: true },
    select: { id: true },
  });

  const canEdit = !!showAccess;
  permissionCache.set(cacheKey, canEdit);
  return canEdit;
}

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

// Helper function to validate status transition
// For core statuses, enforce workflow rules. For custom statuses, allow any transition.
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  // Core workflow statuses
  const coreStatuses = ['YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB', 'OMIT', 'HOLD'];
  
  // Allowed transitions for core workflow
  const allowedTransitions: Record<string, string[]> = {
    'YTS': ['WIP', 'Int App', 'AWF', 'OMIT', 'HOLD'],
    'WIP': ['Int App', 'AWF', 'OMIT', 'HOLD'],
    'Int App': ['AWF', 'OMIT', 'HOLD'],
    'AWF': ['C APP', 'C KB', 'OMIT', 'HOLD'],
    'C APP': ['C KB', 'OMIT', 'HOLD'],
    'C KB': ['AWF', 'OMIT', 'HOLD'],
    'OMIT': ['YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB', 'HOLD'],
    'HOLD': ['YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB'],
  };

  // If transitioning FROM or TO a custom status (not core), allow it
  // This enables custom statuses like "Int KB" to work seamlessly
  if (!coreStatuses.includes(currentStatus) || !coreStatuses.includes(newStatus)) {
    return true;
  }

  // For core-to-core transitions, enforce the workflow rules
  return allowedTransitions[currentStatus]?.includes(newStatus) || false;
}

// GET single task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = await prisma.task.findUnique({
      where: { id },
      include: { shot: { include: { show: true } } },
    });

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PUT update task - OPTIMIZED for speed
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  try {
    // Parse request body and get params in parallel with auth
    const [session, { id }, body] = await Promise.all([
      auth(),
      params,
      request.json()
    ]);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const {
      status,
      leadName,
      dependencies,
      bidMds,
      internalEta,
      clientEta,
      deliveredVersion,
      deliveredDate,
    } = body;

    // Get current task (needed for validation and AWF logic)
    const currentTask = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        leadName: true,
        bidMds: true,
        internalEta: true,
        clientEta: true,
        deliveredVersion: true,
        deliveredDate: true,
        isInternal: true,
        shot: { select: { showId: true } }
      }
    });

    if (!currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check permission using cached showId
    const canEdit = await canUserEditTask(user.id, user.role, id, currentTask.shot.showId);
    if (!canEdit) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate internal task status
    if (currentTask.isInternal && status && (status === 'AWF' || status === 'C APP')) {
      return NextResponse.json(
        { error: 'Internal tasks cannot be marked as AWF or C APP' },
        { status: 400 }
      );
    }

    // Validate status transition
    if (status && status !== currentTask.status && !isValidStatusTransition(currentTask.status, status)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${currentTask.status} to ${status}` },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (leadName !== undefined) updateData.leadName = leadName;
    if (bidMds !== undefined) updateData.bidMds = bidMds;
    if (internalEta !== undefined) updateData.internalEta = internalEta ? new Date(internalEta) : null;
    if (clientEta !== undefined) updateData.clientEta = clientEta ? new Date(clientEta) : null;

    // Handle AWF status change - ALWAYS auto increment version when transitioning TO AWF
    // This triggers on: YTS→AWF, WIP→AWF, Int App→AWF, C KB→AWF (redelivery)
    if (status === 'AWF' && currentTask.status !== 'AWF') {
      updateData.status = status;
      // Always auto-increment version - ignore any provided deliveredVersion
      updateData.deliveredVersion = incrementVersion(currentTask.deliveredVersion);
      // Always set delivered date to now - ignore any provided deliveredDate
      updateData.deliveredDate = new Date();
      console.log('[Task Update] AWF transition: version', currentTask.deliveredVersion, '→', updateData.deliveredVersion);
    } else if (status) {
      updateData.status = status;
      // Only allow manual version/date updates when NOT transitioning to AWF
      if (deliveredVersion !== undefined) updateData.deliveredVersion = deliveredVersion;
      if (deliveredDate !== undefined) updateData.deliveredDate = deliveredDate ? new Date(deliveredDate) : null;
    } else {
      // No status change - allow manual version/date updates
      if (deliveredVersion !== undefined) updateData.deliveredVersion = deliveredVersion;
      if (deliveredDate !== undefined) updateData.deliveredDate = deliveredDate ? new Date(deliveredDate) : null;
    }

    // Execute update
    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { shot: { include: { show: true } } },
    });

    console.log('[Task Update] Completed in', Date.now() - startTime, 'ms');

    // Fire-and-forget: Activity logging (non-blocking)
    setImmediate(async () => {
      try {
        const logs: any[] = [];
        const fields = ['status', 'leadName', 'bidMds', 'internalEta', 'clientEta', 'deliveredVersion', 'deliveredDate'];
        
        for (const field of fields) {
          const oldVal = (currentTask as any)[field];
          const newVal = (task as any)[field];
          const oldStr = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
          const newStr = newVal instanceof Date ? newVal.toISOString() : newVal;
          
          if (oldStr !== newStr) {
            logs.push({
              entityType: 'Task',
              entityId: id,
              actionType: 'UPDATE',
              fieldName: field,
              oldValue: oldStr != null ? String(oldStr) : null,
              newValue: newStr != null ? String(newStr) : null,
              userName: user.username || 'System',
            });
          }
        }
        
        if (logs.length > 0) {
          await prisma.activityLog.createMany({ data: logs });
        }
      } catch (err) {
        console.error('Activity log error:', err);
      }
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE task (with permission check)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const { id } = await params;

    // Check if user has permission to delete this task
    const canEdit = await canUserEditTask(user.id, user.role, id);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to delete this task' },
        { status: 403 }
      );
    }
    
    // Fetch complete task with relations BEFORE deletion
    const taskToDelete = await prisma.task.findUnique({
      where: { id },
      include: {
        shot: {
          include: {
            show: true,
          },
        },
      },
    });

    if (!taskToDelete) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Backup complete entity before deletion
    try {
      // @ts-ignore - ActivityLog model will be available after prisma generate
      await prisma.activityLog.create({
        data: {
          entityType: 'Task',
          entityId: id,
          actionType: 'DELETE',
          fieldName: null,
          oldValue: null,
          newValue: null,
          fullEntityData: JSON.stringify(taskToDelete),
          userName: 'System',
        },
      });
    } catch (logError) {
      console.error('Failed to create deletion activity log:', logError);
    }

    // Now perform the actual deletion
    await prisma.task.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
