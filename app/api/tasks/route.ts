import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET all tasks (with optional filtering)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const shotId = searchParams.get('shotId');
    const department = searchParams.get('department');
    const status = searchParams.get('status');
    const leadName = searchParams.get('leadName');

    const where: any = {};
    if (shotId) where.shotId = shotId;
    if (department) where.department = department;
    if (status) where.status = status;
    if (leadName) where.leadName = leadName;

    const tasks = await prisma.task.findMany({
      where,
      include: {
        shot: {
          include: {
            show: true,
          },
        },
      },
      orderBy: {
        createdDate: 'desc',
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST create new task (with permission check)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const {
      shotId,
      department,
      isInternal,
      status,
      leadName,
      dependencies,
      bidMds,
      internalEta,
      clientEta,
    } = body;

    if (!shotId || !department) {
      return NextResponse.json(
        { error: 'Shot ID and department are required' },
        { status: 400 }
      );
    }

    // Get the shot to find its showId for permission check
    const shot = await prisma.shot.findUnique({
      where: { id: shotId },
      select: { showId: true },
    });

    if (!shot) {
      return NextResponse.json({ error: 'Shot not found' }, { status: 404 });
    }

    // Check if user has permission to create tasks for this shot
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      const hasAccess = await prisma.showAccess.findFirst({
        where: {
          userId: user.id,
          showId: shot.showId,
          canEdit: true,
        },
      });

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden - You do not have permission to create tasks for this shot' },
          { status: 403 }
        );
      }
    }

    const task = await prisma.task.create({
      data: {
        shotId,
        department,
        isInternal: isInternal || false,
        status: status || 'YTS',
        leadName: leadName || null,
        dependencies: dependencies ? JSON.stringify(dependencies) : null,
        bidMds: bidMds || null,
        internalEta: internalEta ? new Date(internalEta) : null,
        clientEta: clientEta ? new Date(clientEta) : null,
      },
      include: {
        shot: {
          include: {
            show: true,
          },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
