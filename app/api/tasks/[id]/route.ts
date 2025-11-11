import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Helper function to check if user can edit a task
async function canUserEditTask(userId: string, userRole: string, taskId: string): Promise<boolean> {
  // Admin and Coordinator can edit all tasks
  if (userRole === 'ADMIN' || userRole === 'COORDINATOR') {
    return true;
  }

  // Get the task with show information
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      shot: {
        select: {
          showId: true,
        },
      },
    },
  });

  if (!task) return false;

  // Check if user has edit access to the show
  const showAccess = await prisma.showAccess.findFirst({
    where: {
      userId,
      showId: task.shot.showId,
      canEdit: true,
    },
  });

  return !!showAccess;
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
function isValidStatusTransition(currentStatus: string, newStatus: string): boolean {
  const allowedTransitions: Record<string, string[]> = {
    'YTS': ['WIP', 'Int App', 'AWF', 'OMIT', 'HOLD'], // Can skip to Int App or AWF directly
    'WIP': ['Int App', 'AWF', 'OMIT', 'HOLD'],
    'Int App': ['AWF', 'OMIT', 'HOLD'],
    'AWF': ['C APP', 'C KB', 'OMIT', 'HOLD'],
    'C APP': ['C KB', 'OMIT', 'HOLD'], // Can go to C KB (client kickback), OMIT, or HOLD
    'C KB': ['AWF', 'OMIT', 'HOLD'], // After kickback, can mark as AWF again (version increment)
    'OMIT': ['YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB', 'HOLD'], // OMIT is reversible - can go to any status
    'HOLD': ['YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB'], // Can resume to previous state
  };

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
      include: {
        shot: {
          include: {
            show: true,
          },
        },
      },
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

// PUT update task (with permission check)
export async function PUT(
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

    // Check if user has permission to edit this task
    const canEdit = await canUserEditTask(user.id, user.role, id);
    if (!canEdit) {
      return NextResponse.json(
        { error: 'Forbidden - You do not have permission to edit this task' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      status,
      leadName,
      dependencies,
      bidMds,
      internalEta,
      clientEta,
      deliveredVersion,
    } = body;

    // Get current task to validate status transition
    const currentTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Validate status transition if status is being changed
    if (status && status !== currentTask.status) {
      if (!isValidStatusTransition(currentTask.status, status)) {
        return NextResponse.json(
          { error: `Invalid status transition from ${currentTask.status} to ${status}` },
          { status: 400 }
        );
      }
    }

    const updateData: any = {
      ...(leadName !== undefined && { leadName }),
      ...(bidMds !== undefined && { bidMds }),
      ...(internalEta !== undefined && { internalEta: internalEta ? new Date(internalEta) : null }),
      ...(clientEta !== undefined && { clientEta: clientEta ? new Date(clientEta) : null }),
    };

    // Handle status change to AWF - auto increment version and set delivered date
    // This happens when going from any status to AWF (including C KB -> AWF for kickback redelivery)
    if (status === 'AWF' && currentTask.status !== 'AWF') {
      updateData.status = status;
      updateData.deliveredVersion = deliveredVersion || incrementVersion(currentTask.deliveredVersion);
      updateData.deliveredDate = new Date();
    } else if (status) {
      updateData.status = status;
    }

    // Allow manual version update
    if (deliveredVersion !== undefined) {
      updateData.deliveredVersion = deliveredVersion;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        shot: {
          include: {
            show: true,
          },
        },
      },
    });

    // Log all changes to activity log
    const fieldsToLog = [
      { field: 'status', oldValue: currentTask.status, newValue: task.status },
      { field: 'leadName', oldValue: currentTask.leadName, newValue: task.leadName },
      { field: 'bidMds', oldValue: currentTask.bidMds, newValue: task.bidMds },
      { field: 'internalEta', oldValue: currentTask.internalEta?.toISOString(), newValue: task.internalEta?.toISOString() },
      { field: 'clientEta', oldValue: currentTask.clientEta?.toISOString(), newValue: task.clientEta?.toISOString() },
      { field: 'deliveredVersion', oldValue: currentTask.deliveredVersion, newValue: task.deliveredVersion },
      { field: 'deliveredDate', oldValue: currentTask.deliveredDate?.toISOString(), newValue: task.deliveredDate?.toISOString() },
    ];

    // Create activity logs for changed fields
    for (const { field, oldValue, newValue } of fieldsToLog) {
      if (oldValue !== newValue) {
        try {
          // @ts-ignore - ActivityLog model will be available after prisma generate
          await prisma.activityLog.create({
            data: {
              entityType: 'Task',
              entityId: id,
              actionType: 'UPDATE',
              fieldName: field,
              oldValue: oldValue != null ? String(oldValue) : null,
              newValue: newValue != null ? String(newValue) : null,
              userName: 'System',
            },
          });
        } catch (logError) {
          console.error('Failed to create activity log:', logError);
          // Don't fail the request if logging fails
        }
      }
    }

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
