import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET single resource member
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
    
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    const member = await prisma.resourceMember.findUnique({
      where: { id },
      include: {
        allocations: {
          orderBy: { allocationDate: 'asc' }
        }
      }
    });

    if (!member) {
      return NextResponse.json({ error: 'Resource member not found' }, { status: 404 });
    }

    return NextResponse.json(member);
  } catch (error) {
    console.error('Error fetching resource member:', error);
    return NextResponse.json({ error: 'Failed to fetch resource member' }, { status: 500 });
  }
}

// PUT update resource member
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
    
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { empId, empName, designation, reportingTo, department, shift, isActive } = body;

    // Check if empId is being changed and if it conflicts
    if (empId) {
      const existing = await prisma.resourceMember.findFirst({
        where: {
          empId,
          id: { not: id }
        }
      });

      if (existing) {
        return NextResponse.json(
          { error: 'Employee ID already exists' },
          { status: 409 }
        );
      }
    }

    const member = await prisma.resourceMember.update({
      where: { id },
      data: {
        ...(empId && { empId }),
        ...(empName && { empName }),
        ...(designation && { designation }),
        ...(reportingTo !== undefined && { reportingTo }),
        ...(department && { department }),
        ...(shift && { shift }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    return NextResponse.json(member);
  } catch (error) {
    console.error('Error updating resource member:', error);
    return NextResponse.json({ error: 'Failed to update resource member' }, { status: 500 });
  }
}

// DELETE resource member
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
    
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    await prisma.resourceMember.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting resource member:', error);
    return NextResponse.json({ error: 'Failed to delete resource member' }, { status: 500 });
  }
}
