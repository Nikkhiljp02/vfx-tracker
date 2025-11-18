import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// GET all resource members (with optional filtering)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    // Only ADMIN and RESOURCE roles can access
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden - Resource access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const department = searchParams.get('department');
    const isActive = searchParams.get('isActive');

    const where: any = {};
    if (department) where.department = department;
    if (isActive !== null) where.isActive = isActive === 'true';

    const members = await prisma.resourceMember.findMany({
      where,
      orderBy: [
        { department: 'asc' },
        { empName: 'asc' }
      ],
      select: {
        id: true,
        empId: true,
        empName: true,
        designation: true,
        reportingTo: true,
        department: true,
        shift: true,
        isActive: true,
        createdDate: true,
        updatedDate: true,
      }
    });

    return NextResponse.json(members, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      }
    });
  } catch (error) {
    console.error('Error fetching resource members:', error);
    return NextResponse.json({ error: 'Failed to fetch resource members' }, { status: 500 });
  }
}

// POST create new resource member
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    // Only ADMIN and RESOURCE roles can create
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden - Resource access required' }, { status: 403 });
    }

    const body = await request.json();
    const { empId, empName, designation, reportingTo, department, shift } = body;

    if (!empId || !empName || !designation || !department) {
      return NextResponse.json(
        { error: 'Emp ID, Emp Name, Designation, and Department are required' },
        { status: 400 }
      );
    }

    // Check for duplicate empId
    const existing = await prisma.resourceMember.findUnique({
      where: { empId }
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Employee ID already exists' },
        { status: 409 }
      );
    }

    const member = await prisma.resourceMember.create({
      data: {
        empId,
        empName,
        designation,
        reportingTo,
        department,
        shift: shift || 'Day',
      },
    });

    return NextResponse.json(member, { status: 201 });
  } catch (error) {
    console.error('Error creating resource member:', error);
    return NextResponse.json({ error: 'Failed to create resource member' }, { status: 500 });
  }
}
