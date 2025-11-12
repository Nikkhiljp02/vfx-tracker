import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET all shows (filtered by user access)
export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;

    // Admin, Coordinator, and Production Coordinator can see all shows with edit access
    const isAdminOrCoordinator = user.role === 'ADMIN' || 
                                  user.role === 'COORDINATOR' || 
                                  user.role === 'PRODUCTION COORDINATOR' ||
                                  user.role?.toUpperCase().includes('COORDINATOR');

    if (isAdminOrCoordinator) {
      const shows = await prisma.show.findMany({
        include: {
          shots: {
            include: {
              tasks: true,
            },
          },
        },
        orderBy: {
          createdDate: 'desc',
        },
      });
      
      // Add canEdit: true for all shows for admins/coordinators
      const showsWithPermissions = shows.map(show => ({
        ...show,
        canEdit: true,
      }));
      
      return NextResponse.json(showsWithPermissions);
    }

    // Non-admin users only see shows they have access to
    const userShowAccess = await prisma.showAccess.findMany({
      where: { userId: user.id },
      include: { show: {
        include: {
          shots: {
            include: {
              tasks: true,
            },
          },
        },
      }},
    });

    // Map shows with their canEdit permission
    const showsWithPermissions = userShowAccess.map(access => ({
      ...access.show,
      canEdit: access.canEdit,
    }));

    // Sort by creation date descending
    showsWithPermissions.sort((a, b) => 
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
    );

    return NextResponse.json(showsWithPermissions);
  } catch (error) {
    console.error('Error fetching shows:', error);
    return NextResponse.json({ error: 'Failed to fetch shows' }, { status: 500 });
  }
}

// POST create new show (Admin or Coordinator only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;

    // Check permission - only ADMIN and COORDINATOR can create shows
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      return NextResponse.json(
        { error: 'Forbidden - Only Admin or Coordinator can create shows' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { showName, clientName, status, departments, notes } = body;

    if (!showName || !departments) {
      return NextResponse.json(
        { error: 'Show name and departments are required' },
        { status: 400 }
      );
    }

    const show = await prisma.show.create({
      data: {
        showName,
        clientName: clientName || '',
        status: status || 'Active',
        departments: JSON.stringify(departments),
        notes: notes || '',
      },
    });

    return NextResponse.json(show, { status: 201 });
  } catch (error) {
    console.error('Error creating show:', error);
    return NextResponse.json({ error: 'Failed to create show' }, { status: 500 });
  }
}
