import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// PUT - Update award sheet entry (Next.js 15+ compatible)
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = await context.params;
    const body = await request.json();
    const { showName, shotName, customFields } = body;

    const shot = await prisma.awardSheet.update({
      where: { id: params.id },
      data: {
        showName,
        shotName,
        customFields: JSON.stringify(customFields || {}),
      },
    });

    return NextResponse.json({
      ...shot,
      customFields: JSON.parse(shot.customFields),
    });
  } catch (error) {
    console.error('Error updating award sheet entry:', error);
    return NextResponse.json(
      { error: 'Failed to update award sheet entry' },
      { status: 500 }
    );
  }
}

// DELETE - Delete award sheet entry
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = await context.params;
    
    await prisma.awardSheet.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting award sheet entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete award sheet entry' },
      { status: 500 }
    );
  }
}
