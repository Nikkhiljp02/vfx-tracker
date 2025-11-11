import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST /api/shots/bulk-delete - Delete multiple shots with full backup (with permission check)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const { shotIds } = await request.json();

    if (!shotIds || !Array.isArray(shotIds) || shotIds.length === 0) {
      return NextResponse.json(
        { error: 'shotIds array is required' },
        { status: 400 }
      );
    }

    // Fetch all shots with complete relations BEFORE deletion
    const shotsToDelete = await prisma.shot.findMany({
      where: { id: { in: shotIds } },
      include: {
        show: true,
        tasks: {
          include: {
            shot: true,
          },
        },
        parentShot: true,
        childShots: true,
      },
    });

    if (shotsToDelete.length === 0) {
      return NextResponse.json(
        { error: 'No shots found to delete' },
        { status: 404 }
      );
    }

    // Check if user has permission to delete all these shots
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      const uniqueShowIds = [...new Set(shotsToDelete.map(shot => shot.showId))];
      
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
            { error: 'Forbidden - You do not have permission to delete shots from one or more shows in this selection' },
            { status: 403 }
          );
        }
      }
    }

    let totalTasksDeleted = 0;
    const activityLogEntries: any[] = [];

    // Backup all entities before deletion
    for (const shot of shotsToDelete) {
      totalTasksDeleted += shot.tasks.length;

      // Log shot deletion
      activityLogEntries.push({
        entityType: 'Shot',
        entityId: shot.id,
        actionType: 'DELETE',
        fieldName: null,
        oldValue: null,
        newValue: null,
        fullEntityData: JSON.stringify(shot),
        userName: 'System',
      });

      // Log each cascaded task deletion
      for (const task of shot.tasks) {
        activityLogEntries.push({
          entityType: 'Task',
          entityId: task.id,
          actionType: 'DELETE',
          fieldName: 'cascadeFrom',
          oldValue: `Shot: ${shot.shotName}`,
          newValue: null,
          fullEntityData: JSON.stringify(task),
          userName: 'System',
        });
      }
    }

    try {
      // Create all activity log entries in one transaction
      await prisma.activityLog.createMany({
        data: activityLogEntries,
      });
    } catch (logError) {
      console.error('Failed to create bulk deletion activity logs:', logError);
      // Continue with deletion even if logging fails
    }

    // Perform the actual bulk deletion (cascade will handle tasks)
    await prisma.shot.deleteMany({
      where: { id: { in: shotIds } },
    });

    return NextResponse.json({
      message: `Successfully deleted ${shotsToDelete.length} shot(s)`,
      deletedShots: shotsToDelete.length,
      deletedTasks: totalTasksDeleted,
      shotNames: shotsToDelete.map(s => s.shotName),
    });
  } catch (error) {
    console.error('Error bulk deleting shots:', error);
    return NextResponse.json(
      { error: 'Failed to delete shots' },
      { status: 500 }
    );
  }
}
