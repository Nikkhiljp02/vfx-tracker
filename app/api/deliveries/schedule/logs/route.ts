import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Get execution logs for a schedule or all logs
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const logs = await prisma.scheduleExecutionLog.findMany({
      where: scheduleId ? { scheduleId } : undefined,
      include: {
        schedule: {
          select: {
            scheduleType: true,
            dateOption: true,
            scheduledTime: true,
          },
        },
      },
      orderBy: { executedAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error("Error fetching execution logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch execution logs" },
      { status: 500 }
    );
  }
}

// DELETE - Clear old logs
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");
    const olderThanDays = parseInt(searchParams.get("olderThanDays") || "30");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    await prisma.scheduleExecutionLog.deleteMany({
      where: {
        scheduleId: scheduleId || undefined,
        executedAt: { lt: cutoffDate },
      },
    });

    return NextResponse.json({ success: true, message: "Logs cleared" });
  } catch (error) {
    console.error("Error clearing logs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to clear logs" },
      { status: 500 }
    );
  }
}
