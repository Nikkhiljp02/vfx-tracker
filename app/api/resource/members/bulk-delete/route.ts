import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST bulk delete resource members
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    // Only ADMIN can bulk delete
    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { ids } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'IDs array is required' },
        { status: 400 }
      );
    }

    // Delete members (cascade will delete allocations)
    const result = await prisma.resourceMember.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });

    return NextResponse.json({ 
      success: true, 
      deleted: result.count,
      message: `${result.count} members deleted successfully` 
    });
  } catch (error) {
    console.error('Error bulk deleting resource members:', error);
    return NextResponse.json({ error: 'Failed to delete resource members' }, { status: 500 });
  }
}
