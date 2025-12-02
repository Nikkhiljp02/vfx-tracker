import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    console.log('PUT /api/status-options/[id] - Updating status:', { id, body });

    // Support both field name formats
    const updateData: any = {};
    if (body.statusName !== undefined || body.name !== undefined) {
      updateData.statusName = body.statusName || body.name;
    }
    if (body.colorCode !== undefined || body.color !== undefined) {
      updateData.colorCode = body.colorCode || body.color;
    }
    if (body.statusOrder !== undefined || body.order !== undefined) {
      updateData.statusOrder = body.statusOrder ?? body.order;
    }
    if (body.isActive !== undefined) {
      updateData.isActive = body.isActive;
    }

    console.log('Update data:', updateData);

    const statusOption = await prisma.statusOption.update({
      where: { id },
      data: updateData,
    });

    console.log('Status updated:', statusOption);
    return NextResponse.json(statusOption);
  } catch (error) {
    console.error('Error updating status option:', error);
    return NextResponse.json(
      { error: 'Failed to update status option', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const statusOption = await prisma.statusOption.update({
      where: { id },
      data: {
        isActive: body.isActive,
      },
    });

    return NextResponse.json(statusOption);
  } catch (error) {
    console.error('Error toggling status option:', error);
    return NextResponse.json(
      { error: 'Failed to toggle status option' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('DELETE /api/status-options/[id] - Deactivating status:', id);

    // Soft delete by setting isActive to false
    const statusOption = await prisma.statusOption.update({
      where: { id },
      data: { isActive: false },
    });

    console.log('Status deactivated:', statusOption);
    return NextResponse.json(statusOption);
  } catch (error) {
    console.error('Error deleting status option:', error);
    return NextResponse.json(
      { error: 'Failed to delete status option', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
