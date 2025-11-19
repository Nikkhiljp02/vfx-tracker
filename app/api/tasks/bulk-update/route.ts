import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST /api/tasks/bulk-update - Bulk update tasks for multiple shots (with permission check)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const { shotIds, department, updates } = body;

    if (!shotIds || !Array.isArray(shotIds) || shotIds.length === 0) {
      return NextResponse.json(
        { error: 'shotIds array is required' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'updates object is required' },
        { status: 400 }
      );
    }

    // Get all shots to check permissions
    const shots = await prisma.shot.findMany({
      where: { id: { in: shotIds } },
      select: { id: true, showId: true },
    });

    // Check if user has edit access to all shows
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      const uniqueShowIds = [...new Set(shots.map(shot => shot.showId))];
      
      for (const showId of uniqueShowIds) {
        const hasAccess = await prisma.showAccess.findFirst({
          where: {
            userId: user.id,
            showId,
            canEdit: true,
          },
        });

        if (!hasAccess) {
          return NextResponse.json(
            { error: 'Forbidden - You do not have edit access to all selected shows' },
            { status: 403 }
          );
        }
      }
    }

    // If department is specified, update only that department's tasks
    // Otherwise update all tasks in the shots
    const whereClause: any = {
      shotId: { in: shotIds }
    };

    if (department) {
      whereClause.department = department;
    }

    // For deliveredVersion and deliveredDate, only update tasks with AWF, C APP, or C KB status
    if (updates.deliveredVersion !== undefined || updates.deliveredDate !== undefined) {
      whereClause.status = { in: ['AWF', 'C APP', 'C KB'] };
    }

    // Fetch tasks BEFORE updating to capture old values
    const tasksBeforeUpdate = await prisma.task.findMany({
      where: whereClause,
      include: {
        shot: {
          select: {
            shotName: true,
            showId: true
          }
        }
      }
    });

    // Create a map of task ID to old values
    const oldValuesMap = new Map();
    tasksBeforeUpdate.forEach(task => {
      const oldValues: any = {};
      for (const field of Object.keys(updates)) {
        oldValues[field] = (task as any)[field];
      }
      oldValuesMap.set(task.id, oldValues);
    });

    // Perform bulk update
    const result = await prisma.task.updateMany({
      where: whereClause,
      data: {
        ...updates,
        updatedDate: new Date()
      }
    });

    // Create activity logs for each update field with proper old values
    const activityLogs = [];
    for (const task of tasksBeforeUpdate) {
      const oldValues = oldValuesMap.get(task.id);
      for (const [field, newValue] of Object.entries(updates)) {
        const oldValue = oldValues[field];
        
        activityLogs.push({
          entityType: 'Task',
          entityId: task.id,
          actionType: 'UPDATE',
          fieldName: field,
          oldValue: oldValue !== null && oldValue !== undefined
            ? (typeof oldValue === 'object' ? JSON.stringify(oldValue) : String(oldValue))
            : null,
          newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : String(newValue),
          fullEntityData: JSON.stringify(task),
          userName: 'System', // TODO: Replace with actual user when auth is implemented
          timestamp: new Date(),
          isReversed: false
        });
      }
    }

    // Insert activity logs
    if (activityLogs.length > 0) {
      await prisma.activityLog.createMany({
        data: activityLogs
      });
    }

    return NextResponse.json({
      message: 'Bulk update completed successfully',
      updatedCount: result.count,
      tasksUpdated: tasksBeforeUpdate.length
    });
  } catch (error) {
    console.error('Error in bulk update:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk update' },
      { status: 500 }
    );
  }
}
