import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST validate allocation before creating/updating
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { resourceId, allocationDate, manDays, excludeId } = body;

    if (!resourceId || !allocationDate || manDays === undefined) {
      return NextResponse.json(
        { error: 'Resource ID, Allocation Date, and Man Days are required' },
        { status: 400 }
      );
    }

    // Validate manDays range
    const mdValue = parseFloat(manDays);
    if (isNaN(mdValue) || mdValue < 0 || mdValue > 1.0) {
      return NextResponse.json(
        { valid: false, error: 'Man Days must be between 0 and 1.0' },
        { status: 200 }
      );
    }

    // Check total MD for the day
    const dateObj = new Date(allocationDate);
    const where: any = {
      resourceId,
      allocationDate: dateObj
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const existingAllocations = await prisma.resourceAllocation.findMany({
      where,
      select: {
        manDays: true,
        showName: true,
        shotName: true,
        isLeave: true,
        isIdle: true,
      }
    });

    const totalMD = existingAllocations.reduce((sum, a) => sum + a.manDays, 0);
    const newTotal = totalMD + mdValue;

    if (newTotal > 1.0) {
      return NextResponse.json({
        valid: false,
        error: `Total allocation would exceed 1.0 MD`,
        currentTotal: totalMD,
        attemptedAdd: mdValue,
        wouldBe: newTotal,
        remaining: Math.max(0, 1.0 - totalMD),
      });
    }

    // Check shot count
    const activeShotsCount = existingAllocations.filter(a => !a.isLeave && !a.isIdle).length;
    let warning = null;
    if (activeShotsCount >= 4) {
      warning = `Resource is already allocated to ${activeShotsCount} shots on ${dateObj.toLocaleDateString()}`;
    }

    return NextResponse.json({
      valid: true,
      currentTotal: totalMD,
      newTotal,
      remaining: 1.0 - newTotal,
      activeShotsCount,
      warning,
      allocations: existingAllocations.map(a => ({
        show: a.showName,
        shot: a.shotName,
        md: a.manDays,
        isLeave: a.isLeave,
        isIdle: a.isIdle,
      }))
    });
  } catch (error) {
    console.error('Error validating allocation:', error);
    return NextResponse.json({ error: 'Failed to validate allocation' }, { status: 500 });
  }
}
