import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET user preferences
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;

    const preferences = await prisma.userPreferences.findUnique({
      where: { userId: user.id },
    });

    if (!preferences) {
      // Return default preferences if none exist
      return NextResponse.json({
        tableColumns: JSON.stringify([]),
        filterState: JSON.stringify({}),
        sortState: JSON.stringify({}),
        theme: "light",
      });
    }

    return NextResponse.json({
      tableColumns: preferences.tableColumns,
      filterState: preferences.filterState,
      sortState: preferences.sortState,
      theme: preferences.theme,
    });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    );
  }
}

// POST/PUT save user preferences
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const body = await request.json();
    const { tableColumns, filterState, sortState, theme } = body;

    const preferences = await prisma.userPreferences.upsert({
      where: { userId: user.id },
      update: {
        ...(tableColumns !== undefined && { tableColumns: JSON.stringify(tableColumns) }),
        ...(filterState !== undefined && { filterState: JSON.stringify(filterState) }),
        ...(sortState !== undefined && { sortState: JSON.stringify(sortState) }),
        ...(theme !== undefined && { theme }),
      },
      create: {
        userId: user.id,
        tableColumns: tableColumns ? JSON.stringify(tableColumns) : "[]",
        filterState: filterState ? JSON.stringify(filterState) : "{}",
        sortState: sortState ? JSON.stringify(sortState) : "{}",
        theme: theme || "light",
      },
    });

    return NextResponse.json({
      tableColumns: preferences.tableColumns,
      filterState: preferences.filterState,
      sortState: preferences.sortState,
      theme: preferences.theme,
    });
  } catch (error) {
    console.error("Error saving preferences:", error);
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 }
    );
  }
}
