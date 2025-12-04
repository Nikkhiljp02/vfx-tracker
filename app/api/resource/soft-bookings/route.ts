import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET all soft bookings
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const showName = searchParams.get('showName');
    const department = searchParams.get('department');
    const status = searchParams.get('status');

    const where: any = {};
    if (showName) where.showName = showName;
    if (department) where.department = department;
    if (status) where.status = status;

    const bookings = await prisma.softBooking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(bookings);
  } catch (error) {
    console.error('Error fetching soft bookings:', error);
    return NextResponse.json({ error: 'Failed to fetch soft bookings' }, { status: 500 });
  }
}

// POST create new soft booking
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
      notes,
    } = body;

    // Validate required fields
    if (!showName || !managerName || !department || !manDays || !startDate || !endDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate split percentages if enabled
    if (splitEnabled) {
      const total = (srPercentage || 0) + (midPercentage || 0) + (jrPercentage || 0);
      if (Math.abs(total - 100) > 0.01) {
        return NextResponse.json({ error: 'Split percentages must total 100%' }, { status: 400 });
      }
    }

    const booking = await prisma.softBooking.create({
      data: {
        showName,
        managerName,
        department,
        manDays: parseFloat(manDays.toString()),
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        splitEnabled: splitEnabled || false,
        srPercentage: splitEnabled ? (srPercentage || 0) : null,
        midPercentage: splitEnabled ? (midPercentage || 0) : null,
        jrPercentage: splitEnabled ? (jrPercentage || 0) : null,
        notes,
        createdBy: user.id,
        status: 'Pending',
      },
    });

    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Error creating soft booking:', error);
    return NextResponse.json({ error: 'Failed to create soft booking' }, { status: 500 });
  }
}
