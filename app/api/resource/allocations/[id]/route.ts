import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET single allocation
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

    const allocation = await prisma.resourceAllocation.findUnique({
      where: { id },
      include: {
        resource: true
      }
    });

    if (!allocation) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    return NextResponse.json(allocation);
  } catch (error) {
    console.error('Error fetching allocation:', error);
    return NextResponse.json({ error: 'Failed to fetch allocation' }, { status: 500 });
  }
}

// PUT update allocation
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
    const { showName, shotName, allocationDate, manDays, isLeave, isIdle, notes } = body;

    // Get existing allocation
    const existing = await prisma.resourceAllocation.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
    }

    // Validate manDays if provided
    let mdValue = existing.manDays;
    if (manDays !== undefined) {
      mdValue = parseFloat(manDays);
      if (isNaN(mdValue) || mdValue < 0 || mdValue > 1.0) {
        return NextResponse.json(
          { error: 'Man Days must be between 0 and 1.0' },
          { status: 400 }
        );
      }
    }

    // Check total MD for the day if date or manDays changed
    const dateObj = allocationDate ? new Date(allocationDate) : existing.allocationDate;
    if (allocationDate || manDays !== undefined) {
      const existingAllocations = await prisma.resourceAllocation.findMany({
        where: {
          resourceId: existing.resourceId,
          allocationDate: dateObj,
          id: { not: id }
        }
      });

      const totalMD = existingAllocations.reduce((sum, a) => sum + a.manDays, 0);
      if (totalMD + mdValue > 1.0) {
        return NextResponse.json(
          { error: `Total allocation for ${dateObj.toLocaleDateString()} would exceed 1.0 MD (current: ${totalMD}, adding: ${mdValue})` },
          { status: 400 }
        );
      }
    }

    const allocation = await prisma.resourceAllocation.update({
      where: { id },
      data: {
        ...(showName !== undefined && { showName }),
        ...(shotName !== undefined && { shotName }),
        ...(allocationDate && { allocationDate: dateObj }),
        ...(manDays !== undefined && { manDays: mdValue }),
        ...(isLeave !== undefined && { isLeave }),
        ...(isIdle !== undefined && { isIdle }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(allocation);
  } catch (error) {
    console.error('Error updating allocation:', error);
    return NextResponse.json({ error: 'Failed to update allocation' }, { status: 500 });
  }
}

// DELETE allocation
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

    await prisma.resourceAllocation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting allocation:', error);
    return NextResponse.json({ error: 'Failed to delete allocation' }, { status: 500 });
  }
}
