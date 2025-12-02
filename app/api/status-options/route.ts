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
    console.log('POST /api/status-options - Creating status:', body);
    
    // Check if status with same name already exists
    const existing = await prisma.statusOption.findFirst({
      where: { statusName: body.name }
    });
    
    if (existing) {
      return NextResponse.json(
        { error: `Status "${body.name}" already exists. ${existing.isActive ? 'It is currently active.' : 'It exists but is inactive - you can reactivate it from the list.'}` },
        { status: 400 }
      );
    }
    
    const statusOption = await prisma.statusOption.create({
      data: {
        statusName: body.name,
        colorCode: body.color,
        statusOrder: body.order,
        isActive: body.isActive ?? true,
      },
    });
    
    console.log('Status option created:', statusOption);
    return NextResponse.json(statusOption, { status: 201 });
  } catch (error: any) {
    console.error('Error creating status option:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: `Status with this name already exists` },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create status option', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
