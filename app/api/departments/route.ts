import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cache for 5 minutes (departments rarely change)
export const revalidate = 300;

// GET all departments
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeInactive = searchParams.get('includeInactive') === 'true';
    
    const departments = await prisma.department.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: {
        deptName: 'asc',
      },
    });
    return NextResponse.json(departments, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    return NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
  }
}
