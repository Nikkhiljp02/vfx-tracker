import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getPaginationParams, calculatePagination, getPrismaSkipTake, getCursorPaginationParams } from '@/lib/pagination';

// GET all shots (filtered by user show access) with pagination support
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('showId');
    const shotTag = searchParams.get('shotTag');
    const useCursor = searchParams.get('cursor') !== null;

    const where: any = {};
    if (shotTag) where.shotTag = shotTag;

    // Admin can see all shots
    if (user.role === 'ADMIN') {
      if (showId) where.showId = showId;
    } else {
      // Non-admin users only see shots from their accessible shows
      const userShowAccess = await prisma.showAccess.findMany({
        where: { userId: user.id },
        select: { showId: true },
      });

      const accessibleShowIds = userShowAccess.map((access) => access.showId);

      if (showId) {
        // Check if requested show is accessible
        if (!accessibleShowIds.includes(showId)) {
          return NextResponse.json({ error: 'Forbidden - No access to this show' }, { status: 403 });
        }
        where.showId = showId;
      } else {
        // Filter by accessible shows
        where.showId = { in: accessibleShowIds };
      }
    }

    // Cursor-based pagination (for infinite scroll)
    if (useCursor) {
      const { cursor, limit } = getCursorPaginationParams(searchParams);
      
      const shots = await prisma.shot.findMany({
        where,
        take: limit + 1, // Get one extra to check if there's more
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          show: true,
          tasks: {
            include: {
              shot: {
                include: {
                  show: true,
                },
              },
            },
          },
          parentShot: true,
        },
        orderBy: {
          createdDate: 'desc',
        },
      });

      const hasMore = shots.length > limit;
      const data = hasMore ? shots.slice(0, -1) : shots;
      const nextCursor = hasMore ? shots[shots.length - 2].id : null;

      return NextResponse.json({
        data,
        nextCursor,
        hasMore,
      });
    }

    // Offset-based pagination (for page numbers)
    const pagination = getPaginationParams(searchParams);
    const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);

    // Get total count for pagination metadata
    const totalCount = await prisma.shot.count({ where });

    const shots = await prisma.shot.findMany({
      where,
      skip,
      take,
      include: {
        show: true,
        tasks: {
          include: {
            shot: {
              include: {
                show: true,
              },
            },
          },
        },
        parentShot: true,
      },
      orderBy: pagination.orderBy === 'createdDate' 
        ? { createdDate: pagination.orderDirection }
        : { updatedDate: pagination.orderDirection },
    });

    const paginationMeta = calculatePagination(totalCount, pagination.page, pagination.limit);

    return NextResponse.json({
      data: shots,
      pagination: paginationMeta,
    });
  } catch (error) {
    console.error('Error fetching shots:', error);
    return NextResponse.json({ error: 'Failed to fetch shots' }, { status: 500 });
  }
}

// POST create new shot (with access check)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const { showId, shotName, episode, sequence, turnover, frames, shotTag, parentShotId, scopeOfWork, remark, tasks } = body;

    if (!showId || !shotName) {
      return NextResponse.json(
        { error: 'Show ID and shot name are required' },
        { status: 400 }
      );
    }

    // Check if user has access to this show
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR') {
      const hasAccess = await prisma.showAccess.findFirst({
        where: {
          userId: user.id,
          showId,
          canEdit: true,
        },
      });

      if (!hasAccess) {
        return NextResponse.json(
          { error: 'Forbidden - You do not have edit access to this show' },
          { status: 403 }
        );
      }
    }

    // Create shot with tasks in a transaction
    const shot = await prisma.shot.create({
      data: {
        showId,
        shotName,
        episode: episode || null,
        sequence: sequence || null,
        turnover: turnover || null,
        frames: frames ? parseInt(frames) : null,
        shotTag: shotTag || 'Fresh',
        parentShotId: parentShotId || null,
        scopeOfWork: scopeOfWork || '',
        remark: remark || null,
        tasks: {
          create: tasks || [],
        },
      },
      include: {
        tasks: true,
        show: true,
      },
    });

    return NextResponse.json(shot, { status: 201 });
  } catch (error) {
    console.error('Error creating shot:', error);
    return NextResponse.json({ error: 'Failed to create shot' }, { status: 500 });
  }
}
