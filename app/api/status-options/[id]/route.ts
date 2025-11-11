import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const statusOption = await prisma.statusOption.update({
      where: { id },
      data: {
        statusName: body.name,
        colorCode: body.color,
        statusOrder: body.order,
        isActive: body.isActive,
      },
    });

    return NextResponse.json(statusOption);
  } catch (error) {
    console.error('Error updating status option:', error);
    return NextResponse.json(
      { error: 'Failed to update status option' },
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

    // Soft delete by setting isActive to false
    const statusOption = await prisma.statusOption.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(statusOption);
  } catch (error) {
    console.error('Error deleting status option:', error);
    return NextResponse.json(
      { error: 'Failed to delete status option' },
      { status: 500 }
    );
  }
}
