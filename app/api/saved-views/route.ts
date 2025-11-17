import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - Fetch saved views
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const viewType = searchParams.get('viewType') || 'resource';

    // Get user's own views + public views
    const views = await prisma.savedView.findMany({
      where: {
        viewType,
        OR: [
          { createdBy: session.user.id },
          { isPublic: true }
        ]
      },
      orderBy: [
        { isQuickFilter: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json(views);
  } catch (error) {
    console.error('Error fetching saved views:', error);
    return NextResponse.json({ error: 'Failed to fetch views' }, { status: 500 });
  }
}

// POST - Create new saved view
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, viewType, filters, isPublic, isQuickFilter } = body;

    if (!name || !filters) {
      return NextResponse.json({ error: 'Name and filters are required' }, { status: 400 });
    }

    const view = await prisma.savedView.create({
      data: {
        name,
        viewType: viewType || 'resource',
        filters: JSON.stringify(filters),
        isPublic: isPublic || false,
        isQuickFilter: isQuickFilter || false,
        createdBy: session.user.id
      }
    });

    return NextResponse.json(view);
  } catch (error) {
    console.error('Error creating saved view:', error);
    return NextResponse.json({ error: 'Failed to create view' }, { status: 500 });
  }
}
