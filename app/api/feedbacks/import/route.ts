import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST bulk import feedbacks from Excel
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const { feedbacks } = body;

    if (!Array.isArray(feedbacks) || feedbacks.length === 0) {
      return NextResponse.json(
        { error: 'Feedbacks array is required' },
        { status: 400 }
      );
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [] as string[],
    };

    for (const feedbackData of feedbacks) {
      try {
        const {
          showName,
          shotName,
          shotTag,
          version,
          department,
          status,
          feedbackNotes,
          feedbackDate,
        } = feedbackData;

        // Validate required fields
        if (!showName || !shotName || !shotTag || !version || !department || !status) {
          results.errors.push(
            `Missing required fields for ${showName} - ${shotName} - ${department}`
          );
          continue;
        }

        // Validate status
        if (!['C APP', 'C KB', 'AWF'].includes(status)) {
          results.errors.push(
            `Invalid status "${status}" for ${showName} - ${shotName} - ${department}. Must be C APP, C KB, or AWF.`
          );
          continue;
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

        // Check if feedback already exists
        const existing = await prisma.feedback.findFirst({
          where: {
            showName,
            shotName,
            shotTag,
            department,
            version,
          },
        });

        if (existing) {
          // Update existing feedback
          await prisma.feedback.update({
            where: { id: existing.id },
            data: {
              status,
              feedbackNotes: feedbackNotes || null,
              feedbackDate: feedbackDate ? new Date(feedbackDate) : new Date(),
              leadName,
              taskId,
            },
          });
          results.updated++;
        } else {
          // Create new feedback
          await prisma.feedback.create({
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
          results.created++;
        }

        // Update task status if task exists
        if (taskId) {
          await prisma.task.update({
            where: { id: taskId },
            data: { status },
          });
        }
      } catch (error: any) {
        results.errors.push(
          `Error processing ${feedbackData.showName} - ${feedbackData.shotName}: ${error.message}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      created: results.created,
      updated: results.updated,
      total: feedbacks.length,
      errors: results.errors,
    });
  } catch (error) {
    console.error('Error importing feedbacks:', error);
    return NextResponse.json({ error: 'Failed to import feedbacks' }, { status: 500 });
  }
}
