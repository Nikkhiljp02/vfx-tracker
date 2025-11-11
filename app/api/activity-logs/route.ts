import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/activity-logs - Fetch all activity logs with optional filters
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const entityType = searchParams.get('entityType');
    const entityId = searchParams.get('entityId');
    const limit = parseInt(searchParams.get('limit') || '100');

    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (entityId) where.entityId = entityId;

    // @ts-ignore - ActivityLog model will be available after prisma generate
    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    // Enrich logs with related entity information for better searchability
    const enrichedLogs = await Promise.all(
      logs.map(async (log: any) => {
        let relatedEntityName = null;
        let relatedShotName = null;
        let relatedShowName = null;

        try {
          // For Task logs, fetch shot and show names
          if (log.entityType === 'Task') {
            const task = await prisma.task.findUnique({
              where: { id: log.entityId },
              include: {
                shot: {
                  include: {
                    show: true,
                  },
                },
              },
            });
            if (task) {
              relatedEntityName = task.department;
              relatedShotName = task.shot?.shotName;
              relatedShowName = task.shot?.show?.showName;
            }
          }
          // For Shot logs, fetch shot and show names
          else if (log.entityType === 'Shot') {
            const shot = await prisma.shot.findUnique({
              where: { id: log.entityId },
              include: {
                show: true,
              },
            });
            if (shot) {
              relatedEntityName = shot.shotName;
              relatedShowName = shot.show?.showName;
            }
          }
          // For Show logs, fetch show name
          else if (log.entityType === 'Show') {
            const show = await prisma.show.findUnique({
              where: { id: log.entityId },
            });
            if (show) {
              relatedEntityName = show.showName;
            }
          }
        } catch (error) {
          // Entity might be deleted, skip enrichment
          console.log(`Could not enrich log ${log.id}:`, error);
        }

        return {
          ...log,
          relatedEntityName,
          relatedShotName,
          relatedShowName,
        };
      })
    );

    return NextResponse.json(enrichedLogs);
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    // Return empty array instead of error to prevent UI crash
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/activity-logs - Create a new activity log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      entityType,
      entityId,
      actionType,
      fieldName,
      oldValue,
      newValue,
      userName,
    } = body;

    if (!entityType || !entityId || !actionType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // @ts-ignore - ActivityLog model will be available after prisma generate
    const log = await prisma.activityLog.create({
      data: {
        entityType,
        entityId,
        actionType,
        fieldName: fieldName || null,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
        userName: userName || 'System',
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error('Error creating activity log:', error);
    return NextResponse.json(
      { error: 'Failed to create activity log' },
      { status: 500 }
    );
  }
}
