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
    
    // Only ADMIN can export logs
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType");
    const actionType = searchParams.get("actionType");
    const search = searchParams.get("search");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // Build where clause
    const where: any = {};
    
    if (entityType) where.entityType = entityType;
    if (actionType) where.actionType = actionType;
    if (search) {
      where.OR = [
        { userName: { contains: search, mode: 'insensitive' } },
        { entityId: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.timestamp.lte = end;
      }
    }

    // Fetch logs
    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000, // Limit to 10k records for export
    });

    // Generate CSV
    const csvHeaders = [
      "Timestamp",
      "User",
      "Action Type",
      "Entity Type",
      "Entity ID",
      "Field Name",
      "Old Value",
      "New Value",
      "Is Reversed",
    ];

    const csvRows = logs.map((log) => [
      new Date(log.timestamp).toISOString(),
      log.userName || "System",
      log.actionType,
      log.entityType,
      log.entityId,
      log.fieldName || "",
      log.oldValue || "",
      log.newValue || "",
      log.isReversed ? "Yes" : "No",
    ]);

    const csv = [
      csvHeaders.join(","),
      ...csvRows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="activity-logs-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting logs:", error);
    return NextResponse.json(
      { error: "Failed to export logs" },
      { status: 500 }
    );
  }
}
