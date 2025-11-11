import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET all departments
export async function GET() {
  try {
    const departments = await prisma.department.findMany({
      where: { isActive: true },
      orderBy: {
        deptName: 'asc',
      },
    });
    return NextResponse.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
  }
}
