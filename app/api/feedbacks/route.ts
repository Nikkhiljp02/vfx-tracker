import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET all feedbacks
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const feedbacks = await prisma.feedback.findMany({
      orderBy: {
        feedbackDate: 'desc',
      },
    });

    return NextResponse.json(feedbacks);
  } catch (error) {
    console.error('Error fetching feedbacks:', error);
    return NextResponse.json({ error: 'Failed to fetch feedbacks' }, { status: 500 });
  }
}

// POST create new feedback
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const {
      showName,
      shotName,
      shotTag,
      version,
      department,
      status,
      feedbackNotes,
      feedbackDate,
    } = body;

    // Validate required fields
    if (!showName || !shotName || !shotTag || !version || !department || !status) {
      return NextResponse.json(
        { error: 'Show, Shot, Tag, Version, Department, and Status are required' },
        { status: 400 }
      );
    }

    // Validate status - only C APP, C KB, AWF allowed
    if (!['C APP', 'C KB', 'AWF'].includes(status)) {
      return NextResponse.json(
        { error: 'Status must be C APP, C KB, or AWF' },
        { status: 400 }
      );
    }

    // Auto-detect lead name from task
    const task = await prisma.task.findFirst({
      where: {
        shot: {
          shotName: shotName,
          shotTag: shotTag,
          show: {
            showName: showName,
          },
        },
        department: department,
      },
      include: {
        shot: {
          include: {
            show: true,
          },
        },
      },
    });

    const leadName = task?.leadName || null;
    const taskId = task?.id || null;

    // Create feedback
    const feedback = await prisma.feedback.create({
      data: {
        showName,
        shotName,
        shotTag,
        version,
        department,
        leadName,
        status,
        feedbackNotes: feedbackNotes || null,
        feedbackDate: feedbackDate ? new Date(feedbackDate) : new Date(),
        taskId,
        createdBy: user.id,
      },
    });

    // Log feedback creation
    try {
      await prisma.activityLog.create({
        data: {
          entityType: 'Feedback',
          entityId: feedback.id,
          actionType: 'CREATE',
          fieldName: null,
          oldValue: null,
          newValue: JSON.stringify({
            showName: feedback.showName,
            shotName: feedback.shotName,
            shotTag: feedback.shotTag,
            version: feedback.version,
            department: feedback.department,
            leadName: feedback.leadName,
            status: feedback.status,
            feedbackNotes: feedback.feedbackNotes,
            feedbackDate: feedback.feedbackDate.toISOString(),
          }),
          userName: user.username || user.email || 'System',
          userId: user.id,
        },
      });
    } catch (logError) {
      console.error('Failed to create activity log:', logError);
    }

    // Update task status if task exists
    if (taskId) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status },
      });
    }

    return NextResponse.json(feedback, { status: 201 });
  } catch (error) {
    console.error('Error creating feedback:', error);
    return NextResponse.json({ error: 'Failed to create feedback' }, { status: 500 });
  }
}
