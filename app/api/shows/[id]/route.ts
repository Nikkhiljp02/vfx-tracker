import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET single show (with access check)
export async function GET(
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

    // Admin can see any show
    if (user.role !== 'ADMIN') {
      // Check if user has access to this show
      const hasAccess = await prisma.showAccess.findFirst({
        where: {
          userId: user.id,
          showId: id,
        },
      });

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden - You do not have access to this show' },
          { status: 403 }
        );
      }
    }

    const show = await prisma.show.findUnique({
      where: { id },
      include: {
        shots: {
          include: {
            tasks: true,
          },
        },
      },
    });

    if (!show) {
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }

    return NextResponse.json(show);
  } catch (error) {
    console.error('Error fetching show:', error);
    return NextResponse.json({ error: 'Failed to fetch show' }, { status: 500 });
  }
}

// PUT update show (with access check)
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

    // Check access permissions
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      // Check if user has edit access to this show
      const hasAccess = await prisma.showAccess.findFirst({
        where: {
          userId: user.id,
          showId: id,
          canEdit: true,
        },
      });

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden - You do not have edit access to this show' },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const { showName, clientName, status, departments, notes } = body;

    const show = await prisma.show.update({
      where: { id },
      data: {
        ...(showName && { showName }),
        ...(clientName !== undefined && { clientName }),
        ...(status && { status }),
        ...(departments && { departments: JSON.stringify(departments) }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(show);
  } catch (error) {
    console.error('Error updating show:', error);
    return NextResponse.json({ error: 'Failed to update show' }, { status: 500 });
  }
}

// DELETE show (Admin or Coordinator only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('DELETE /api/shows/[id] - Starting');
    const session = await auth();

    if (!session?.user) {
      console.log('DELETE failed: No session');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    console.log('DELETE request by user:', { id: user.id, email: user.email, role: user.role });

    // Only Admin or Coordinator can delete shows
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      console.log('DELETE failed: Insufficient permissions', user.role);
      return NextResponse.json(
        { error: 'Forbidden - Only Admin or Coordinator can delete shows' },
        { status: 403 }
      );
    }

    const { id } = await params;
    console.log('Attempting to delete show:', id);
    
    // Fetch complete show with all relations BEFORE deletion
    const showToDelete = await prisma.show.findUnique({
      where: { id },
      include: {
        shots: {
          include: {
            tasks: true,
            parentShot: true,
            childShots: true,
          },
        },
      },
    });

    if (!showToDelete) {
      console.log('DELETE failed: Show not found', id);
      return NextResponse.json({ error: 'Show not found' }, { status: 404 });
    }

    console.log('Found show to delete:', {
      id: showToDelete.id,
      name: showToDelete.showName,
      shotsCount: showToDelete.shots.length,
      tasksCount: showToDelete.shots.reduce((sum, shot) => sum + shot.tasks.length, 0)
    });

    // Count all entities that will be deleted
    const totalTasks = showToDelete.shots.reduce((sum, shot) => sum + shot.tasks.length, 0);
    const totalShots = showToDelete.shots.length;

    // Backup complete entity before deletion
    try {
      console.log('Creating activity logs for deletion...');
      // @ts-ignore - ActivityLog model will be available after prisma generate
      await prisma.activityLog.create({
        data: {
          entityType: 'Show',
          entityId: id,
          actionType: 'DELETE',
          fieldName: null,
          oldValue: null,
          newValue: null,
          fullEntityData: JSON.stringify(showToDelete), // Store complete show with all shots and tasks
          userName: 'System',
        },
      });

      // Log each shot deletion (cascade)
      for (const shot of showToDelete.shots) {
        // @ts-ignore
        await prisma.activityLog.create({
          data: {
            entityType: 'Shot',
            entityId: shot.id,
            actionType: 'DELETE',
            fieldName: 'cascadeFrom',
            oldValue: `Show: ${showToDelete.showName}`,
            newValue: null,
            fullEntityData: JSON.stringify(shot),
            userName: 'System',
          },
        });

        // Log each task deletion within the shot
        for (const task of shot.tasks) {
          // @ts-ignore
          await prisma.activityLog.create({
            data: {
              entityType: 'Task',
              entityId: task.id,
              actionType: 'DELETE',
              fieldName: 'cascadeFrom',
              oldValue: `Show: ${showToDelete.showName} > Shot: ${shot.shotName}`,
              newValue: null,
              fullEntityData: JSON.stringify(task),
              userName: 'System',
            },
          });
        }
      }
    } catch (logError) {
      console.error('Failed to create deletion activity logs:', logError);
    }

    // Now perform the actual deletion (cascade will handle shots and tasks)
    console.log('Performing actual database deletion...');
    await prisma.show.delete({
      where: { id },
    });

    console.log('Show deleted successfully:', {
      id,
      deletedShots: totalShots,
      deletedTasks: totalTasks
    });

    return NextResponse.json({ 
      message: 'Show deleted successfully',
      deletedShots: totalShots,
      deletedTasks: totalTasks
    });
  } catch (error) {
    console.error('Error deleting show:', error);
    return NextResponse.json({ 
      error: 'Failed to delete show',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
