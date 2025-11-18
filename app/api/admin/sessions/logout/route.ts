import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/admin/sessions/logout - Force logout a session
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { sessionId, sessionToken } = body;

    console.log("Force logout called:", { sessionId, sessionToken, adminUser: user.username });

    if (!sessionId && !sessionToken) {
      return NextResponse.json(
        { error: "Session ID or token required" },
        { status: 400 }
      );
    }

    const where = sessionId ? { id: sessionId } : { sessionToken };

    // Update session to mark as logged out
    const updatedSession = await prisma.session.update({
      where,
      data: {
        isActive: false,
        loggedOutAt: new Date(),
        loggedOutBy: user.id,
      },
    });

    console.log("Session logged out:", updatedSession.id);

    // Log the admin action
    await prisma.activityLog.create({
      data: {
        entityType: "Session",
        entityId: updatedSession.id,
        actionType: "UPDATE",
        fieldName: "forceLogout",
        oldValue: "active",
        newValue: "logged-out",
        userName: user.username,
        userId: user.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Session logged out successfully",
    });
  } catch (error) {
    console.error("Error logging out session:", error);
    return NextResponse.json(
      { error: "Failed to logout session" },
      { status: 500 }
    );
  }
}
