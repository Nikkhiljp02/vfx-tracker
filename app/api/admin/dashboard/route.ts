import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    
    // Only ADMIN can access dashboard stats
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    // Fetch all statistics in parallel
    const [
      usersStats,
      showsStats,
      shotsStats,
      tasksStats,
      resourcesStats,
      recentActivity,
    ] = await Promise.all([
      // Users statistics
      prisma.user.groupBy({
        by: ['role', 'isActive'],
        _count: true,
      }),

      // Shows statistics
      prisma.show.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Shots statistics with date ranges
      Promise.all([
        prisma.shot.count(),
        prisma.shot.count({
          where: {
            createdDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        prisma.shot.count({
          where: {
            createdDate: {
              gte: new Date(new Date().setDate(new Date().getDate() - 7)),
            },
          },
        }),
        prisma.shot.count({
          where: {
            createdDate: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            },
          },
        }),
      ]),

      // Tasks statistics
      prisma.task.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Resources statistics
      Promise.all([
        prisma.resourceMember.count(),
        prisma.resourceMember.count({ where: { isActive: true } }),
        prisma.resourceAllocation.count({
          where: {
            allocationDate: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        }),
      ]),

      // Recent activity logs
      prisma.activityLog.findMany({
        take: 20,
        orderBy: {
          timestamp: 'desc',
        },
        select: {
          id: true,
          actionType: true,
          entityType: true,
          userName: true,
          timestamp: true,
          fieldName: true,
        },
      }),
    ]);

    // Process users stats
    const users = {
      total: usersStats.reduce((acc, stat) => acc + stat._count, 0),
      active: usersStats.filter(stat => stat.isActive).reduce((acc, stat) => acc + stat._count, 0),
      admins: usersStats.find(stat => stat.role === 'ADMIN')?._count || 0,
      inactive: usersStats.filter(stat => !stat.isActive).reduce((acc, stat) => acc + stat._count, 0),
    };

    // Process shows stats
    const shows = {
      total: showsStats.reduce((acc, stat) => acc + stat._count, 0),
      active: showsStats.find(stat => stat.status === 'Active')?._count || 0,
      completed: showsStats.find(stat => stat.status === 'Completed')?._count || 0,
      onHold: showsStats.find(stat => stat.status === 'On Hold')?._count || 0,
    };

    // Process shots stats
    const shots = {
      total: shotsStats[0],
      today: shotsStats[1],
      thisWeek: shotsStats[2],
      thisMonth: shotsStats[3],
    };

    // Process tasks stats
    const tasks = {
      total: tasksStats.reduce((acc, stat) => acc + stat._count, 0),
      yts: tasksStats.find(stat => stat.status === 'YTS')?._count || 0,
      wip: tasksStats.find(stat => stat.status === 'WIP')?._count || 0,
      completed: tasksStats.filter(stat => ['C APP', 'C KB'].includes(stat.status)).reduce((acc, stat) => acc + stat._count, 0),
    };

    // Process resources stats
    const resources = {
      total: resourcesStats[0],
      active: resourcesStats[1],
      allocated: resourcesStats[2],
      available: resourcesStats[1] - resourcesStats[2],
    };

    // Format recent activity
    const formattedActivity = recentActivity.map(log => {
      const action = log.actionType === 'CREATE' ? 'created' : 
                     log.actionType === 'UPDATE' ? 'updated' : 
                     log.actionType === 'DELETE' ? 'deleted' : 'modified';
      
      let entity = log.entityType.toLowerCase();
      if (log.fieldName) {
        entity = `${entity} (${log.fieldName})`;
      }

      const timestamp = new Date(log.timestamp);
      const now = new Date();
      const diffMs = now.getTime() - timestamp.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo = '';
      if (diffMins < 1) timeAgo = 'Just now';
      else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
      else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
      else timeAgo = `${diffDays}d ago`;

      return {
        id: log.id,
        action,
        user: log.userName || 'Unknown',
        timestamp: timeAgo,
        entity,
      };
    });

    // System stats (mock data for now - can be enhanced)
    const system = {
      uptime: '99.9%',
      dbSize: '125 MB', // Can be calculated from actual DB
      lastBackup: 'Today',
      apiCalls: Math.floor(Math.random() * 50000) + 10000, // Mock API calls
    };

    return NextResponse.json({
      users,
      shows,
      shots,
      tasks,
      resources,
      system,
      recentActivity: formattedActivity,
    });

  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard statistics" },
      { status: 500 }
    );
  }
}
