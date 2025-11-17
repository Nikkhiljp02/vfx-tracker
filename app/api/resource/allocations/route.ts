import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET allocations (with filtering by date range, resource, show, shot)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden - Resource access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get('resourceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const showName = searchParams.get('showName');
    const shotName = searchParams.get('shotName');

    const where: any = {};
    if (resourceId) where.resourceId = resourceId;
    if (showName) where.showName = showName;
    if (shotName) where.shotName = shotName;
    if (startDate || endDate) {
      where.allocationDate = {};
      if (startDate) where.allocationDate.gte = new Date(startDate);
      if (endDate) where.allocationDate.lte = new Date(endDate);
    }

    const allocations = await prisma.resourceAllocation.findMany({
      where,
      include: {
        resource: {
          select: {
            empId: true,
            empName: true,
            department: true,
          }
        }
      },
      orderBy: [
        { allocationDate: 'asc' },
        { resourceId: 'asc' }
      ],
    });

    return NextResponse.json(allocations);
  } catch (error) {
    console.error('Error fetching allocations:', error);
    return NextResponse.json({ error: 'Failed to fetch allocations' }, { status: 500 });
  }
}

// POST create new allocation (with validation)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden - Resource access required' }, { status: 403 });
    }

    const body = await request.json();
    const { resourceId, showName, shotName, allocationDate, manDays, isLeave, isIdle, isWeekendWorking, notes } = body;

    if (!resourceId || !allocationDate) {
      return NextResponse.json(
        { error: 'Resource ID and Allocation Date are required' },
        { status: 400 }
      );
    }

    if (!isLeave && !isIdle && (!showName || !shotName)) {
      return NextResponse.json(
        { error: 'Show Name and Shot Name are required for active allocations' },
        { status: 400 }
      );
    }

    // Validate manDays range
    const mdValue = parseFloat(manDays);
    if (isNaN(mdValue) || mdValue < 0 || mdValue > 1.0) {
      return NextResponse.json(
        { error: 'Man Days must be between 0 and 1.0' },
        { status: 400 }
      );
    }

    // Check total MD for the day doesn't exceed 1.0
    const dateObj = new Date(allocationDate);
    const existingAllocations = await prisma.resourceAllocation.findMany({
      where: {
        resourceId,
        allocationDate: dateObj
      }
    });

    const totalMD = existingAllocations.reduce((sum, a) => sum + a.manDays, 0);
    if (totalMD + mdValue > 1.0) {
      return NextResponse.json(
        { error: `Total allocation for ${dateObj.toLocaleDateString()} would exceed 1.0 MD (current: ${totalMD}, adding: ${mdValue})` },
        { status: 400 }
      );
    }

    // Check shot count (warning if >4, but allow)
    const activeShotsCount = existingAllocations.filter(a => !a.isLeave && !a.isIdle).length;
    let warning = null;
    if (!isLeave && !isIdle && activeShotsCount >= 4) {
      warning = `This resource is already allocated to ${activeShotsCount} shots on this date`;
    }

    const allocation = await prisma.resourceAllocation.create({
      data: {
        resourceId,
        showName: showName || '',
        shotName: shotName || '',
        allocationDate: dateObj,
        manDays: mdValue,
        isLeave: isLeave || false,
        isIdle: isIdle || false,
        isWeekendWorking: isWeekendWorking || false,
        notes,
        createdBy: user.id,
      },
    });

    return NextResponse.json({ ...allocation, warning }, { status: 201 });
  } catch (error) {
    console.error('Error creating allocation:', error);
    return NextResponse.json({ error: 'Failed to create allocation' }, { status: 500 });
  }
}
