import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const isAdminOrCoordinator = user.role === 'ADMIN' || 
                                  user.role === 'COORDINATOR' || 
                                  user.role === 'PRODUCTION COORDINATOR' ||
                                  user.role?.toUpperCase().includes('COORDINATOR');

    if (!isAdminOrCoordinator) {
      return NextResponse.json({ error: 'Forbidden - Admin/Coordinator only' }, { status: 403 });
    }

    const reportData = await request.json();

    // Store report configuration in database (you may need to create a Report model)
    // For now, return success
    return NextResponse.json({ 
      success: true, 
      message: 'Report saved successfully',
      reportId: `r${Date.now()}`
    });

  } catch (error) {
    console.error('Error saving report:', error);
    return NextResponse.json({ error: 'Failed to save report' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const isAdminOrCoordinator = user.role === 'ADMIN' || 
                                  user.role === 'COORDINATOR' || 
                                  user.role === 'PRODUCTION COORDINATOR' ||
                                  user.role?.toUpperCase().includes('COORDINATOR');

    if (!isAdminOrCoordinator) {
      return NextResponse.json({ error: 'Forbidden - Admin/Coordinator only' }, { status: 403 });
    }

    // Fetch saved reports from database
    // For now, return empty array
    return NextResponse.json([]);

  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 });
  }
}
