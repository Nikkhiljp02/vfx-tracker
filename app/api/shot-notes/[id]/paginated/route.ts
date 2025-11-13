import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import { getPaginationParams, calculatePagination, getPrismaSkipTake } from '@/lib/pagination';

// GET shot notes with lazy loading pagination
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: shotId } = await params;
    const { searchParams } = new URL(request.url);
    const pagination = getPaginationParams(searchParams);
    const { skip, take } = getPrismaSkipTake(pagination.page, pagination.limit);

    // Get total count
    const totalCount = await prisma.shotNote.count({
      where: { shotId },
    });

    // Get paginated notes
    const notes = await prisma.shotNote.findMany({
      where: { shotId },
      orderBy: {
        createdDate: 'desc',
      },
      skip,
      take,
    });

    const paginationMeta = calculatePagination(totalCount, pagination.page, pagination.limit);

    return NextResponse.json({
      data: notes,
      pagination: paginationMeta,
    });
  } catch (error) {
    console.error('Error fetching shot notes:', error);
    return NextResponse.json({ error: 'Failed to fetch shot notes' }, { status: 500 });
  }
}
