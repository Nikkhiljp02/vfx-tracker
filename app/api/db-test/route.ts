import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Try to connect and count users
    const userCount = await prisma.user.count();
    
    return NextResponse.json({
      success: true,
      database: 'connected',
      userCount,
      message: userCount === 0 ? 'Database is ready - no users yet' : `Database has ${userCount} users`,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
