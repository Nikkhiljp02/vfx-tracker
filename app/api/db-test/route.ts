import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check environment variables
    const hasDbUrl = !!process.env.DATABASE_URL;
    const hasDirectUrl = !!process.env.DIRECT_URL;
    
    // Try to connect and count users
    const userCount = await prisma.user.count();
    
    // Try to fetch the admin user
    const adminUser = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        email: true,
      }
    });
    
    // Check status options
    const statusCount = await prisma.statusOption.count();
    
    return NextResponse.json({
      success: true,
      database: 'connected',
      environment: {
        hasDatabaseUrl: hasDbUrl,
        hasDirectUrl: hasDirectUrl,
        nodeEnv: process.env.NODE_ENV,
      },
      data: {
        userCount,
        statusOptionsCount: statusCount,
        adminUserExists: !!adminUser,
        adminUserDetails: adminUser ? {
          username: adminUser.username,
          name: `${adminUser.firstName} ${adminUser.lastName}`,
          role: adminUser.role,
          isActive: adminUser.isActive,
          hasEmail: !!adminUser.email,
        } : null,
      },
      message: userCount === 0 
        ? 'Database is connected but empty - run setup' 
        : `Database is working! ${userCount} users found`,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      database: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    }, { status: 500 });
  }
}
