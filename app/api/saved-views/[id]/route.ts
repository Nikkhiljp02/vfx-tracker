import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// PATCH - Update saved view
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const body = await request.json();
    const { name, filters, isPublic, isQuickFilter } = body;

    // Check ownership
    const view = await prisma.savedView.findUnique({
      where: { id: params.id }
    });

    if (!view || view.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    }

    const updated = await prisma.savedView.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(filters && { filters: JSON.stringify(filters) }),
        ...(isPublic !== undefined && { isPublic }),
        ...(isQuickFilter !== undefined && { isQuickFilter })
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating saved view:', error);
    return NextResponse.json({ error: 'Failed to update view' }, { status: 500 });
  }
}

// DELETE - Delete saved view
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;

    // Check ownership
    const view = await prisma.savedView.findUnique({
      where: { id: params.id }
    });

    if (!view || view.createdBy !== session.user.id) {
      return NextResponse.json({ error: 'Not found or unauthorized' }, { status: 404 });
    }

    await prisma.savedView.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting saved view:', error);
    return NextResponse.json({ error: 'Failed to delete view' }, { status: 500 });
  }
}
