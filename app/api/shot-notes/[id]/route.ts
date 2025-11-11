import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE /api/shot-notes/[id] - Delete a note
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    await prisma.shotNote.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting shot note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}

// PUT /api/shot-notes/[id] - Update a note
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    const body = await request.json();
    const { content, mentions, attachments } = body;

    const note = await prisma.shotNote.update({
      where: { id: params.id },
      data: {
        content,
        mentions: mentions ? JSON.stringify(mentions) : null,
        attachments: attachments ? JSON.stringify(attachments) : null,
        isEdited: true,
      },
    });

    return NextResponse.json({
      ...note,
      mentions: note.mentions ? JSON.parse(note.mentions) : null,
      attachments: note.attachments ? JSON.parse(note.attachments) : null,
    });
  } catch (error) {
    console.error('Error updating shot note:', error);
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}
