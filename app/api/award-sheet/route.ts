import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// Disable dynamic rendering for faster responses
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET - Fetch all award sheet entries
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const showName = searchParams.get('showName');
    const limit = searchParams.get('limit');
    const skip = searchParams.get('skip');

    const where: any = {};
    if (showName) where.showName = showName;

    const [shots, total] = await Promise.all([
      prisma.awardSheet.findMany({
        where,
        select: {
          id: true,
          showName: true,
          shotName: true,
          customFields: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [
          { showName: 'asc' },
          { shotName: 'asc' },
        ],
        ...(limit && { take: parseInt(limit) }),
        ...(skip && { skip: parseInt(skip) }),
      }),
      prisma.awardSheet.count({ where }),
    ]);

    // Parse JSON strings back to objects
    const parsedShots = shots.map(shot => ({
      ...shot,
      customFields: JSON.parse(shot.customFields),
    }));

    return NextResponse.json({ 
      shots: parsedShots,
      total,
      hasMore: skip && limit ? parseInt(skip) + parseInt(limit) < total : false
    }, {
      headers: {
        'Cache-Control': 'no-store, must-revalidate',
        'Pragma': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error fetching award sheet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch award sheet' },
      { status: 500 }
    );
  }
}

// POST - Create new award sheet entry
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
    const { showName, shotName, customFields } = body;

    if (!showName || !shotName) {
      return NextResponse.json(
        { error: 'Show name and shot name are required' },
        { status: 400 }
      );
    }

    const shot = await prisma.awardSheet.create({
      data: {
        showName,
        shotName,
        customFields: JSON.stringify(customFields || {}),
      },
    });

    return NextResponse.json({
      ...shot,
      customFields: JSON.parse(shot.customFields),
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating award sheet entry:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Shot already exists in award sheet' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create award sheet entry' },
      { status: 500 }
    );
  }
}
