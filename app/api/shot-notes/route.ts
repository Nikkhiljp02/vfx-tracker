import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/shot-notes?shotId=xxx - Get all notes for a shot
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shotId = searchParams.get('shotId');

    if (!shotId) {
      return NextResponse.json(
        { error: 'shotId is required' },
        { status: 400 }
      );
    }

    const notes = await prisma.shotNote.findMany({
      where: { shotId },
      orderBy: { createdDate: 'desc' },
    });

    // Parse JSON fields
    const parsedNotes = notes.map((note: any) => ({
      ...note,
      mentions: note.mentions ? JSON.parse(note.mentions) : null,
      attachments: note.attachments ? JSON.parse(note.attachments) : null,
    }));

    return NextResponse.json(parsedNotes);
  } catch (error) {
    console.error('Error fetching shot notes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

// POST /api/shot-notes - Create a new note
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { shotId, content, mentions, attachments, userName } = body;

    if (!shotId || !content) {
      return NextResponse.json(
        { error: 'shotId and content are required' },
        { status: 400 }
      );
    }

    const note = await prisma.shotNote.create({
      data: {
        shotId,
        content,
        mentions: mentions ? JSON.stringify(mentions) : null,
        attachments: attachments ? JSON.stringify(attachments) : null,
        userName: userName || 'User',
      },
    });

    // Return parsed note
    return NextResponse.json({
      ...note,
      mentions: note.mentions ? JSON.parse(note.mentions) : null,
      attachments: note.attachments ? JSON.parse(note.attachments) : null,
    });
  } catch (error) {
    console.error('Error creating shot note:', error);
    return NextResponse.json(
      { error: 'Failed to create note' },
      { status: 500 }
    );
  }
}
