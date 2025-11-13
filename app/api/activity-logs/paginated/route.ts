import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getPaginationParams, calculatePagination, getPrismaSkipTake } from '@/lib/pagination';

// GET activity logs with pagination and filtering
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pagination = getPaginationParams(searchParams);
    const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);

    // Filters
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const actionType = searchParams.get('actionType');
    const searchQuery = searchParams.get('search');

    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;
    if (actionType) where.actionType = actionType;
    
    // Search across multiple fields
    if (searchQuery) {
      where.OR = [
        { entityType: { contains: searchQuery, mode: 'insensitive' } },
        { entityId: { contains: searchQuery, mode: 'insensitive' } },
        { actionType: { contains: searchQuery, mode: 'insensitive' } },
        { fieldName: { contains: searchQuery, mode: 'insensitive' } },
        { oldValue: { contains: searchQuery, mode: 'insensitive' } },
        { newValue: { contains: searchQuery, mode: 'insensitive' } },
        { userName: { contains: searchQuery, mode: 'insensitive' } },
      ];
    }

    // Get total count
    const totalCount = await prisma.activityLog.count({ where });

    // Get paginated logs
    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: {
        timestamp: 'desc',
      },
      skip,
      take,
    });

    const paginationMeta = calculatePagination(totalCount, pagination.page, pagination.limit);

    return NextResponse.json({
      data: logs,
      pagination: paginationMeta,
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
  }
}
