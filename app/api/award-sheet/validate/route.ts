import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

// POST - Validate if a shot exists in award sheet
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { shotName } = body;

    if (!shotName) {
      return NextResponse.json(
        { error: 'Shot name is required' },
        { status: 400 }
      );
    }

    const shot = await prisma.awardSheet.findFirst({
      where: { shotName },
    });

    if (!shot) {
      return NextResponse.json({
        valid: false,
        message: `Shot "${shotName}" not found in Award Sheet. Please add it first.`,
      });
    }

    return NextResponse.json({
      valid: true,
      showName: shot.showName,
      shotName: shot.shotName,
    });
  } catch (error) {
    console.error('Error validating shot:', error);
    return NextResponse.json(
      { error: 'Failed to validate shot' },
      { status: 500 }
    );
  }
}
