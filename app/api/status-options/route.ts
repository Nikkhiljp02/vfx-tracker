import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Cache for 5 minutes (status options rarely change)
export const revalidate = 300;

// GET all status options
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    
    const statuses = await prisma.statusOption.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: {
        statusOrder: 'asc',
      },
    });
    return NextResponse.json(statuses, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching status options:', error);
    return NextResponse.json({ error: 'Failed to fetch status options' }, { status: 500 });
  }
}

// POST create new status option
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const statusOption = await prisma.statusOption.create({
      data: {
        statusName: body.name,
        colorCode: body.color,
        statusOrder: body.order,
        isActive: body.isActive ?? true,
      },
    });
    
    return NextResponse.json(statusOption, { status: 201 });
  } catch (error) {
    console.error('Error creating status option:', error);
    return NextResponse.json(
      { error: 'Failed to create status option' },
      { status: 500 }
    );
  }
}
