import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET single feedback
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const feedback = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    return NextResponse.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

// PUT update feedback
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
    const body = await request.json();
    const { status, feedbackNotes, version, department, leadName, shotTag, feedbackDate } = body;

    // Fetch current feedback before update
    const currentFeedback = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!currentFeedback) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    // Validate status if provided
    if (status && !['C APP', 'C KB', 'AWF'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be C APP, C KB, or AWF' },
        { status: 400 }
      );
    }

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (feedbackNotes !== undefined) updateData.feedbackNotes = feedbackNotes;
    if (version !== undefined) updateData.version = version;
    if (department !== undefined) updateData.department = department;
    if (leadName !== undefined) updateData.leadName = leadName;
    if (shotTag !== undefined) updateData.shotTag = shotTag;
    if (feedbackDate !== undefined) updateData.feedbackDate = feedbackDate ? new Date(feedbackDate) : null;

    const feedback = await prisma.feedback.update({
      where: { id },
      data: updateData,
    });

    // Log all changes to activity log
    const fieldsToLog = [
      { field: 'status', oldValue: currentFeedback.status, newValue: feedback.status },
      { field: 'feedbackNotes', oldValue: currentFeedback.feedbackNotes, newValue: feedback.feedbackNotes },
      { field: 'version', oldValue: currentFeedback.version, newValue: feedback.version },
      { field: 'department', oldValue: currentFeedback.department, newValue: feedback.department },
      { field: 'leadName', oldValue: currentFeedback.leadName, newValue: feedback.leadName },
      { field: 'shotTag', oldValue: currentFeedback.shotTag, newValue: feedback.shotTag },
      { field: 'feedbackDate', oldValue: currentFeedback.feedbackDate?.toISOString(), newValue: feedback.feedbackDate?.toISOString() },
    ];

    // Create activity logs for changed fields with context
    for (const { field, oldValue, newValue } of fieldsToLog) {
      if (oldValue !== newValue) {
        try {
          await prisma.activityLog.create({
            data: {
              entityType: 'Feedback',
              entityId: id,
              actionType: 'UPDATE',
              fieldName: field,
              oldValue: oldValue != null ? String(oldValue) : null,
              newValue: newValue != null ? String(newValue) : null,
              fullEntityData: JSON.stringify({
                showName: feedback.showName,
                shotName: feedback.shotName,
                shotTag: feedback.shotTag,
                department: feedback.department,
                version: feedback.version,
                field: field,
                context: `Show: ${feedback.showName} | Shot: ${feedback.shotName} (${feedback.shotTag}) | ${field}: ${oldValue} → ${newValue}`,
              }),
              userName: user.username || user.email || 'System',
              userId: user.id,
            },
          });
        } catch (logError) {
          console.error('Failed to create activity log:', logError);
          // Don't fail the request if logging fails
        }
      }
    }

    // Update task status if task is linked and log the change
    if (feedback.taskId && status && currentFeedback.status !== status) {
      const currentTask = await prisma.task.findUnique({
        where: { id: feedback.taskId },
        include: {
          shot: {
            include: {
              show: true,
            },
          },
        },
      });

      if (currentTask && currentTask.status !== status) {
        await prisma.task.update({
          where: { id: feedback.taskId },
          data: { status },
        });

        // Log task status change caused by feedback
        try {
          await prisma.activityLog.create({
            data: {
              entityType: 'Task',
              entityId: feedback.taskId,
              actionType: 'UPDATE',
              fieldName: 'status',
              oldValue: currentTask.status,
              newValue: status,
              fullEntityData: JSON.stringify({
                reason: 'Changed by Feedback Update',
                feedbackId: feedback.id,
                showName: currentTask.shot.show.showName,
                shotName: currentTask.shot.shotName,
                department: currentTask.department,
                previousStatus: currentTask.status,
                newStatus: status,
              }),
              userName: user.username || user.email || 'System',
              userId: user.id,
            },
          });
        } catch (logError) {
          console.error('Failed to log task status change:', logError);
        }
      }
    }

    return NextResponse.json(feedback);
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}

// DELETE feedback
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

    // Fetch complete feedback before deletion
    const feedbackToDelete = await prisma.feedback.findUnique({
      where: { id },
    });

    if (!feedbackToDelete) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    // Log deletion before actually deleting with context
    try {
      await prisma.activityLog.create({
        data: {
          entityType: 'Feedback',
          entityId: id,
          actionType: 'DELETE',
          fieldName: null,
          oldValue: `Show: ${feedbackToDelete.showName} | Shot: ${feedbackToDelete.shotName} (${feedbackToDelete.shotTag}) | Version: ${feedbackToDelete.version} | Dept: ${feedbackToDelete.department}`,
          newValue: null,
          fullEntityData: JSON.stringify(feedbackToDelete),
          userName: user.username || user.email || 'System',
          userId: user.id,
        },
      });
    } catch (logError) {
      console.error('Failed to create deletion activity log:', logError);
    }

    await prisma.feedback.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Feedback deleted successfully' });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}
