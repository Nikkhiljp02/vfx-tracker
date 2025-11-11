import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET single shot
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shot = await prisma.shot.findUnique({
      where: { id },
      include: {
        show: true,
        tasks: true,
        parentShot: true,
        childShots: true,
      },
    });

    if (!shot) {
      return NextResponse.json({ error: 'Shot not found' }, { status: 404 });
    }

    return NextResponse.json(shot);
  } catch (error) {
    console.error('Error fetching shot:', error);
    return NextResponse.json({ error: 'Failed to fetch shot' }, { status: 500 });
  }
}

// PUT update shot (with permission check)
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
    const { shotName, episode, sequence, turnover, frames, shotTag, scopeOfWork, remark } = body;

    // Get current shot for logging and permission check
    const currentShot = await prisma.shot.findUnique({
      where: { id },
    });

    if (!currentShot) {
      return NextResponse.json({ error: 'Shot not found' }, { status: 404 });
    }

    // Check if user has permission to edit this shot
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      const hasAccess = await prisma.showAccess.findFirst({
        where: {
          userId: user.id,
          showId: currentShot.showId,
          canEdit: true,
        },
      });

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden - You do not have permission to edit this shot' },
          { status: 403 }
        );
      }
    }

    const shot = await prisma.shot.update({
      where: { id },
      data: {
        ...(shotName && { shotName }),
        ...(episode !== undefined && { episode }),
        ...(sequence !== undefined && { sequence }),
        ...(turnover !== undefined && { turnover }),
        ...(frames !== undefined && { frames: frames ? parseInt(frames) : null }),
        ...(shotTag && { shotTag }),
        ...(scopeOfWork !== undefined && { scopeOfWork }),
        ...(remark !== undefined && { remark }),
      },
      include: {
        tasks: true,
        show: true,
      },
    });

    // Log changes to activity log
    const fieldsToLog = [
      { field: 'shotName', oldValue: currentShot.shotName, newValue: shot.shotName },
      { field: 'episode', oldValue: currentShot.episode, newValue: shot.episode },
      { field: 'sequence', oldValue: currentShot.sequence, newValue: shot.sequence },
      { field: 'turnover', oldValue: currentShot.turnover, newValue: shot.turnover },
      { field: 'frames', oldValue: currentShot.frames, newValue: shot.frames },
      { field: 'shotTag', oldValue: currentShot.shotTag, newValue: shot.shotTag },
      { field: 'scopeOfWork', oldValue: currentShot.scopeOfWork, newValue: shot.scopeOfWork },
      { field: 'remark', oldValue: currentShot.remark, newValue: shot.remark },
    ];

    for (const { field, oldValue, newValue } of fieldsToLog) {
      if (oldValue !== newValue) {
        try {
          // @ts-ignore - ActivityLog model will be available after prisma generate
          await prisma.activityLog.create({
            data: {
              entityType: 'Shot',
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
        }
      }
    }

    return NextResponse.json(shot);
  } catch (error) {
    console.error('Error updating shot:', error);
    return NextResponse.json({ error: 'Failed to update shot' }, { status: 500 });
  }
}

// DELETE shot (with permission check)
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
    
    // Fetch complete shot with all relations BEFORE deletion
    const shotToDelete = await prisma.shot.findUnique({
      where: { id },
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

    if (!shotToDelete) {
      return NextResponse.json({ error: 'Shot not found' }, { status: 404 });
    }

    // Check if user has permission to delete this shot
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      const hasAccess = await prisma.showAccess.findFirst({
        where: {
          userId: user.id,
          showId: shotToDelete.showId,
          canEdit: true,
        },
      });

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden - You do not have permission to delete this shot' },
          { status: 403 }
        );
      }
    }

    // Backup complete entity before deletion
    try {
      // @ts-ignore - ActivityLog model will be available after prisma generate
      await prisma.activityLog.create({
        data: {
          entityType: 'Shot',
          entityId: id,
          actionType: 'DELETE',
          fieldName: null,
          oldValue: null,
          newValue: null,
          fullEntityData: JSON.stringify(shotToDelete), // Store complete entity
          userName: 'System',
        },
      });

      // Also log each task deletion (cascade)
      for (const task of shotToDelete.tasks) {
        // @ts-ignore
        await prisma.activityLog.create({
          data: {
            entityType: 'Task',
            entityId: task.id,
            actionType: 'DELETE',
            fieldName: 'cascadeFrom',
            oldValue: `Shot: ${shotToDelete.shotName}`,
            newValue: null,
            fullEntityData: JSON.stringify(task),
            userName: 'System',
          },
        });
      }
    } catch (logError) {
      console.error('Failed to create deletion activity log:', logError);
    }

    // Now perform the actual deletion (cascade will handle tasks)
    await prisma.shot.delete({
      where: { id },
    });

    return NextResponse.json({ 
      message: 'Shot deleted successfully',
      deletedTasks: shotToDelete.tasks.length 
    });
  } catch (error) {
    console.error('Error deleting shot:', error);
    return NextResponse.json({ error: 'Failed to delete shot' }, { status: 500 });
  }
}
