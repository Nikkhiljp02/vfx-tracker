import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - List all schedules with execution logs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get("includeCompleted") === "true";

    const schedules = await prisma.deliverySchedule.findMany({
      where: includeCompleted ? undefined : {
        OR: [
          { isActive: true },
          { scheduleType: "DAILY" },
        ],
      },
      include: {
        executionLogs: {
          orderBy: { executedAt: "desc" },
          take: 5, // Last 5 executions
        },
      },
      orderBy: [
        { isActive: "desc" },
        { scheduledTime: "asc" },
      ],
    });

    return NextResponse.json({ success: true, schedules });
  } catch (error) {
    console.error("Error fetching schedules:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch schedules" },
      { status: 500 }
    );
  }
}

// POST - Create new schedule
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      scheduleType,
      dateOption,
      specificDate,
      customFrom,
      customTo,
      scheduledTime,
      sendDirectly,
    } = body;

    // Validation
    if (!scheduleType || !dateOption || !scheduledTime) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!["ONE_TIME", "DAILY"].includes(scheduleType)) {
      return NextResponse.json(
        { success: false, error: "Invalid schedule type" },
        { status: 400 }
      );
    }

    if (!["today", "upcoming", "specific", "custom"].includes(dateOption)) {
      return NextResponse.json(
        { success: false, error: "Invalid date option" },
        { status: 400 }
      );
    }

    // Create schedule
    const schedule = await prisma.deliverySchedule.create({
      data: {
        scheduleType,
        dateOption,
        specificDate: specificDate || null,
        customFrom: customFrom || null,
        customTo: customTo || null,
        scheduledTime,
        sendDirectly: sendDirectly !== false, // Default to true
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error("Error creating schedule:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create schedule" },
      { status: 500 }
    );
  }
}

// DELETE - Remove schedule or clear completed schedules
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const clearCompleted = searchParams.get("clearCompleted") === "true";

    if (clearCompleted) {
      // Delete all inactive one-time schedules
      await prisma.deliverySchedule.deleteMany({
        where: {
          isActive: false,
          scheduleType: "ONE_TIME",
        },
      });
      return NextResponse.json({ success: true, message: "Completed schedules cleared" });
    }

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Schedule ID required" },
        { status: 400 }
      );
    }

    await prisma.deliverySchedule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting schedule:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete schedule" },
      { status: 500 }
    );
  }
}

// PATCH - Toggle active status
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, isActive } = body;

    if (!id || isActive === undefined) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const schedule = await prisma.deliverySchedule.update({
      where: { id },
      data: { isActive },
    });

    return NextResponse.json({ success: true, schedule });
  } catch (error) {
    console.error("Error updating schedule:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update schedule" },
      { status: 500 }
    );
  }
}
