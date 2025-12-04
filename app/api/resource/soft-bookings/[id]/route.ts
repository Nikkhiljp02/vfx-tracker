import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET single soft booking
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
    const booking = await prisma.softBooking.findUnique({
      where: { id },
    });

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Error fetching soft booking:', error);
    return NextResponse.json({ error: 'Failed to fetch soft booking' }, { status: 500 });
  }
}

// PUT update soft booking
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
    const {
      showName,
      managerName,
      department,
      manDays,
      startDate,
      endDate,
      splitEnabled,
      srPercentage,
      midPercentage,
      jrPercentage,
      status,
      notes,
    } = body;

    // Validate split percentages if enabled
    if (splitEnabled) {
      const total = (srPercentage || 0) + (midPercentage || 0) + (jrPercentage || 0);
      if (Math.abs(total - 100) > 0.01) {
        return NextResponse.json({ error: 'Split percentages must total 100%' }, { status: 400 });
      }
    }

    const booking = await prisma.softBooking.update({
      where: { id },
      data: {
        showName,
        managerName,
        department,
        manDays: manDays ? parseFloat(manDays.toString()) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        splitEnabled,
        srPercentage: splitEnabled ? (srPercentage || 0) : null,
        midPercentage: splitEnabled ? (midPercentage || 0) : null,
        jrPercentage: splitEnabled ? (jrPercentage || 0) : null,
        status,
        notes,
      },
    });

    return NextResponse.json(booking);
  } catch (error) {
    console.error('Error updating soft booking:', error);
    return NextResponse.json({ error: 'Failed to update soft booking' }, { status: 500 });
  }
}

// DELETE soft booking
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
    await prisma.softBooking.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting soft booking:', error);
    return NextResponse.json({ error: 'Failed to delete soft booking' }, { status: 500 });
  }
}
