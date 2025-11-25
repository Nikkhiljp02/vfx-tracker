import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST undo an activity log entry
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const { activityLogId } = body;

    if (!activityLogId) {
      return NextResponse.json({ error: 'Activity log ID is required' }, { status: 400 });
    }

    // Fetch the activity log entry
    const activityLog = await prisma.activityLog.findUnique({
      where: { id: activityLogId },
    });

    if (!activityLog) {
      return NextResponse.json({ error: 'Activity log not found' }, { status: 404 });
    }

    if (activityLog.isReversed) {
      return NextResponse.json({ error: 'This change has already been undone' }, { status: 400 });
    }

    let undoResult: any = null;

    // Handle different entity types and actions
    switch (activityLog.entityType) {
      case 'Feedback':
        undoResult = await undoFeedbackAction(activityLog, user);
        break;
      
      case 'Task':
        undoResult = await undoTaskAction(activityLog, user);
        break;
      
      case 'Shot':
        undoResult = await undoShotAction(activityLog, user);
        break;
      
      case 'Show':
        undoResult = await undoShowAction(activityLog, user);
        break;
      
      default:
        return NextResponse.json(
          { error: `Undo not supported for entity type: ${activityLog.entityType}` },
          { status: 400 }
        );
    }

    // Mark the original activity log as reversed
    await prisma.activityLog.update({
      where: { id: activityLogId },
      data: { isReversed: true },
    });

    return NextResponse.json({
      success: true,
      message: 'Action undone successfully',
      result: undoResult,
    });
  } catch (error) {
    console.error('Error undoing action:', error);
    return NextResponse.json({ error: 'Failed to undo action' }, { status: 500 });
  }
}

// Undo Feedback actions
async function undoFeedbackAction(activityLog: any, user: any) {
  const { actionType, entityId, fieldName, oldValue, fullEntityData } = activityLog;

  switch (actionType) {
    case 'CREATE':
      // Delete the created feedback
      const deletedFeedback = await prisma.feedback.findUnique({
        where: { id: entityId },
      });
      
      if (deletedFeedback) {
        await prisma.feedback.delete({
          where: { id: entityId },
        });

        // Log the undo action
        await prisma.activityLog.create({
          data: {
            entityType: 'Feedback',
            entityId: entityId,
            actionType: 'DELETE',
            fieldName: 'undo_create',
            oldValue: `Undo: ${oldValue || 'Feedback creation'}`,
            newValue: 'Deleted via undo',
            fullEntityData: JSON.stringify(deletedFeedback),
            userName: user.username || user.email || 'System',
            userId: user.id,
          },
        });

        return { action: 'deleted', feedback: deletedFeedback };
      }
      break;

    case 'UPDATE':
      // Restore the old value
      if (fieldName && oldValue !== null) {
        const updateData: any = {};
        
        // Parse the old value based on field type
        if (fieldName === 'feedbackDate') {
          updateData[fieldName] = oldValue ? new Date(oldValue) : null;
        } else {
          updateData[fieldName] = oldValue;
        }

        const restoredFeedback = await prisma.feedback.update({
          where: { id: entityId },
          data: updateData,
        });

        // Log the undo action
        await prisma.activityLog.create({
          data: {
            entityType: 'Feedback',
            entityId: entityId,
            actionType: 'UPDATE',
            fieldName: `undo_${fieldName}`,
            oldValue: activityLog.newValue,
            newValue: oldValue,
            fullEntityData: JSON.stringify({ undoAction: true, field: fieldName }),
            userName: user.username || user.email || 'System',
            userId: user.id,
          },
        });

        return { action: 'restored', field: fieldName, value: oldValue, feedback: restoredFeedback };
      }
      break;

    case 'DELETE':
      // Recreate the deleted feedback
      if (fullEntityData) {
        const feedbackData = JSON.parse(fullEntityData);
        const { id, createdAt, updatedAt, ...restData } = feedbackData;

        const recreatedFeedback = await prisma.feedback.create({
          data: {
            ...restData,
            feedbackDate: restData.feedbackDate ? new Date(restData.feedbackDate) : new Date(),
          },
        });

        // Log the undo action
        await prisma.activityLog.create({
          data: {
            entityType: 'Feedback',
            entityId: recreatedFeedback.id,
            actionType: 'CREATE',
            fieldName: 'undo_delete',
            oldValue: null,
            newValue: 'Restored via undo',
            fullEntityData: JSON.stringify(recreatedFeedback),
            userName: user.username || user.email || 'System',
            userId: user.id,
          },
        });

        return { action: 'restored', feedback: recreatedFeedback };
      }
      break;
  }

  return { action: 'no_action' };
}

// Undo Task actions
async function undoTaskAction(activityLog: any, user: any) {
  const { actionType, entityId, fieldName, oldValue } = activityLog;

  if (actionType === 'UPDATE' && fieldName === 'status' && oldValue) {
    const task = await prisma.task.update({
      where: { id: entityId },
      data: { status: oldValue },
    });

    // Log the undo action
    await prisma.activityLog.create({
      data: {
        entityType: 'Task',
        entityId: entityId,
        actionType: 'UPDATE',
        fieldName: 'undo_status',
        oldValue: activityLog.newValue,
        newValue: oldValue,
        fullEntityData: JSON.stringify({ undoAction: true }),
        userName: user.username || user.email || 'System',
        userId: user.id,
      },
    });

    return { action: 'restored', field: 'status', value: oldValue, task };
  }

  return { action: 'no_action' };
}

// Undo Shot actions
async function undoShotAction(activityLog: any, user: any) {
  const { actionType, entityId, fieldName, oldValue, fullEntityData } = activityLog;

  switch (actionType) {
    case 'UPDATE':
      if (fieldName && oldValue !== null) {
        const updateData: any = { [fieldName]: oldValue };
        
        const restoredShot = await prisma.shot.update({
          where: { id: entityId },
          data: updateData,
        });

        await prisma.activityLog.create({
          data: {
            entityType: 'Shot',
            entityId: entityId,
            actionType: 'UPDATE',
            fieldName: `undo_${fieldName}`,
            oldValue: activityLog.newValue,
            newValue: oldValue,
            userName: user.username || user.email || 'System',
            userId: user.id,
          },
        });

        return { action: 'restored', field: fieldName, value: oldValue, shot: restoredShot };
      }
      break;

    case 'DELETE':
      if (fullEntityData) {
        const shotData = JSON.parse(fullEntityData);
        const { id, createdDate, updatedDate, ...restData } = shotData;

        const recreatedShot = await prisma.shot.create({
          data: restData,
        });

        await prisma.activityLog.create({
          data: {
            entityType: 'Shot',
            entityId: recreatedShot.id,
            actionType: 'CREATE',
            fieldName: 'undo_delete',
            oldValue: null,
            newValue: 'Restored via undo',
            fullEntityData: JSON.stringify(recreatedShot),
            userName: user.username || user.email || 'System',
            userId: user.id,
          },
        });

        return { action: 'restored', shot: recreatedShot };
      }
      break;
  }

  return { action: 'no_action' };
}

// Undo Show actions
async function undoShowAction(activityLog: any, user: any) {
  const { actionType, entityId, fieldName, oldValue, fullEntityData } = activityLog;

  switch (actionType) {
    case 'UPDATE':
      if (fieldName && oldValue !== null) {
        const updateData: any = { [fieldName]: oldValue };
        
        const restoredShow = await prisma.show.update({
          where: { id: entityId },
          data: updateData,
        });

        await prisma.activityLog.create({
          data: {
            entityType: 'Show',
            entityId: entityId,
            actionType: 'UPDATE',
            fieldName: `undo_${fieldName}`,
            oldValue: activityLog.newValue,
            newValue: oldValue,
            userName: user.username || user.email || 'System',
            userId: user.id,
          },
        });

        return { action: 'restored', field: fieldName, value: oldValue, show: restoredShow };
      }
      break;

    case 'DELETE':
      if (fullEntityData) {
        const showData = JSON.parse(fullEntityData);
        const { id, createdDate, updatedDate, ...restData } = showData;

        const recreatedShow = await prisma.show.create({
          data: {
            ...restData,
            createdDate: new Date(),
            updatedDate: new Date(),
          },
        });

        await prisma.activityLog.create({
          data: {
            entityType: 'Show',
            entityId: recreatedShow.id,
            actionType: 'CREATE',
            fieldName: 'undo_delete',
            oldValue: null,
            newValue: 'Restored via undo',
            fullEntityData: JSON.stringify(recreatedShow),
            userName: user.username || user.email || 'System',
            userId: user.id,
          },
        });

        return { action: 'restored', show: recreatedShow };
      }
      break;
  }

  return { action: 'no_action' };
}
