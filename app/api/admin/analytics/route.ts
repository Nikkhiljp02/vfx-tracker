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
    
    // Only ADMIN can access analytics
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30");
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Fetch analytics data in parallel
    const [
      userActivity,
      shotProgress,
      departmentWorkload,
      topUsers,
      completionTrends,
    ] = await Promise.all([
      // User activity over time
      prisma.activityLog.groupBy({
        by: ['timestamp'],
        where: {
          timestamp: {
            gte: startDate,
          },
        },
        _count: true,
      }),

      // Shot status distribution
      prisma.task.groupBy({
        by: ['status'],
        _count: true,
      }),

      // Department workload
      prisma.task.groupBy({
        by: ['department'],
        _count: true,
      }),

      // Top users by activity
      prisma.activityLog.groupBy({
        by: ['userName'],
        where: {
          timestamp: {
            gte: startDate,
          },
          userName: {
            not: null,
          },
        },
        _count: true,
        orderBy: {
          _count: {
            userName: 'desc',
          },
        },
        take: 10,
      }),

      // Completion trends (tasks completed per week)
      prisma.task.findMany({
        where: {
          status: {
            in: ['C APP', 'C KB'],
          },
          updatedDate: {
            gte: startDate,
          },
        },
        select: {
          updatedDate: true,
        },
      }),
    ]);

    // Process user activity by day
    const activityByDay = userActivity.reduce((acc: any, log) => {
      const date = new Date(log.timestamp).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + log._count;
      return acc;
    }, {});

    const formattedUserActivity = Object.entries(activityByDay).map(([date, count]) => ({
      date,
      count: count as number,
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Process shot progress
    const formattedShotProgress = shotProgress.map(item => ({
      status: item.status,
      count: item._count,
    }));

    // Process department workload
    const formattedDepartmentWorkload = departmentWorkload.map(item => ({
      department: item.department,
      tasks: item._count,
    })).sort((a, b) => b.tasks - a.tasks);

    // Process top users
    const formattedTopUsers = topUsers.map(item => ({
      user: item.userName || 'Unknown',
      actions: item._count,
    }));

    // Process completion trends by week
    const completionByWeek: { [key: string]: number } = {};
    completionTrends.forEach(task => {
      const date = new Date(task.updatedDate);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      completionByWeek[weekKey] = (completionByWeek[weekKey] || 0) + 1;
    });

    const formattedCompletionTrends = Object.entries(completionByWeek)
      .map(([week, completed]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        completed: completed as number,
      }))
      .sort((a, b) => a.week.localeCompare(b.week));

    return NextResponse.json({
      userActivity: formattedUserActivity,
      shotProgress: formattedShotProgress,
      departmentWorkload: formattedDepartmentWorkload,
      topUsers: formattedTopUsers,
      completionTrends: formattedCompletionTrends,
    });

  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
