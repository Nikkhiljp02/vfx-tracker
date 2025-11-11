import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper function to get current IST time from internet
async function getInternetTime(): Promise<Date> {
  try {
    // Use WorldTimeAPI to get accurate IST time
    const response = await fetch("https://worldtimeapi.org/api/timezone/Asia/Kolkata", {
      cache: "no-store",
      signal: AbortSignal.timeout(3000), // 3 second timeout
    });
    
    if (!response.ok) {
      throw new Error("Failed to fetch internet time");
    }

    const data = await response.json();
    return new Date(data.datetime);
  } catch (error) {
    // Silently fallback to system time if API fails (don't log error)
    // This is expected to fail occasionally due to network issues
    return new Date();
  }
}

// Helper function to format time as HH:MM in IST
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

// Helper function to execute delivery
async function executeDelivery(schedule: any): Promise<{ 
  success: boolean; 
  error?: string; 
  deliveryCount?: number;
  dateRange?: string;
}> {
  try {
    // Prepare date parameters based on schedule configuration
    let dateParams: any = {};
    let dateRangeStr = "";
    const today = new Date().toISOString().split("T")[0];

    if (schedule.dateOption === "today") {
      dateParams = { date: today };
      dateRangeStr = today;
    } else if (schedule.dateOption === "upcoming") {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const toDate = nextWeek.toISOString().split("T")[0];
      dateParams = { fromDate: today, toDate };
      dateRangeStr = `${today} to ${toDate}`;
    } else if (schedule.dateOption === "specific") {
      if (!schedule.specificDate) {
        return { success: false, error: "Missing specific date" };
      }
      dateParams = { date: schedule.specificDate };
      dateRangeStr = schedule.specificDate;
    } else if (schedule.dateOption === "custom") {
      if (!schedule.customFrom || !schedule.customTo) {
        return { success: false, error: "Missing custom date range" };
      }
      dateParams = { fromDate: schedule.customFrom, toDate: schedule.customTo };
      dateRangeStr = `${schedule.customFrom} to ${schedule.customTo}`;
    }

    // Build URL for export API
    const params = new URLSearchParams(dateParams);
    params.append("sendDirectly", schedule.sendDirectly.toString());

    // Call the export API internally
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/deliveries/export?${params}`, {
      method: "POST",
    });

    if (!response.ok) {
      const result = await response.json();
      return { success: false, error: result.error || "Failed to send delivery" };
    }

    const result = await response.json();
    return { 
      success: true, 
      deliveryCount: result.deliveryCount,
      dateRange: dateRangeStr
    };
  } catch (error: any) {
    console.error("Error executing delivery:", error);
    return { success: false, error: error.message || "Internal error" };
  }
}

// GET - Check and execute due schedules
export async function GET() {
  try {
    // Get current UTC time from internet
    const currentTime = await getInternetTime();
    const currentTimeStr = formatTime(currentTime);
    const currentDateStr = currentTime.toISOString().split("T")[0];

    // Find all active schedules
    const schedules = await prisma.deliverySchedule.findMany({
      where: { isActive: true },
    });

    const executedSchedules: any[] = [];
    const errors: any[] = [];

    for (const schedule of schedules) {
      // Check if schedule time matches current time (within same minute)
      if (schedule.scheduledTime === currentTimeStr) {
        // For ONE_TIME schedules, check if already executed today
        if (schedule.scheduleType === "ONE_TIME") {
          if (schedule.lastExecuted) {
            const lastExecDate = new Date(schedule.lastExecuted).toISOString().split("T")[0];
            if (lastExecDate === currentDateStr) {
              // Already executed today, skip
              continue;
            }
          }
        }

        // For DAILY schedules, check if already executed in the last hour
        if (schedule.scheduleType === "DAILY") {
          if (schedule.lastExecuted) {
            const hoursSinceExec = (currentTime.getTime() - new Date(schedule.lastExecuted).getTime()) / (1000 * 60 * 60);
            if (hoursSinceExec < 1) {
              // Executed less than 1 hour ago, skip to prevent duplicates
              continue;
            }
          }
        }

        // Execute delivery
        const result = await executeDelivery(schedule);

        if (result.success) {
          // Create execution log
          await prisma.scheduleExecutionLog.create({
            data: {
              scheduleId: schedule.id,
              status: "success",
              dateOption: schedule.dateOption,
              dateRange: result.dateRange,
              deliveryCount: result.deliveryCount,
              sendDirectly: schedule.sendDirectly,
            },
          });

          // Update schedule with last execution info
          await prisma.deliverySchedule.update({
            where: { id: schedule.id },
            data: { 
              lastExecuted: currentTime,
              lastStatus: "success",
              lastError: null,
              executionCount: { increment: 1 },
            },
          });

          executedSchedules.push({
            id: schedule.id,
            scheduleType: schedule.scheduleType,
            dateOption: schedule.dateOption,
          });

          // For ONE_TIME schedules, deactivate after execution
          if (schedule.scheduleType === "ONE_TIME") {
            await prisma.deliverySchedule.update({
              where: { id: schedule.id },
              data: { isActive: false },
            });
          }
        } else {
          // Create error log
          await prisma.scheduleExecutionLog.create({
            data: {
              scheduleId: schedule.id,
              status: "failed",
              dateOption: schedule.dateOption,
              errorMessage: result.error,
              sendDirectly: schedule.sendDirectly,
            },
          });

          // Update schedule with error info
          await prisma.deliverySchedule.update({
            where: { id: schedule.id },
            data: {
              lastExecuted: currentTime,
              lastStatus: "failed",
              lastError: result.error,
              executionCount: { increment: 1 },
            },
          });

          errors.push({
            id: schedule.id,
            error: result.error,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      currentTime: currentTimeStr,
      executedCount: executedSchedules.length,
      executed: executedSchedules,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error checking schedules:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check schedules" },
      { status: 500 }
    );
  }
}
