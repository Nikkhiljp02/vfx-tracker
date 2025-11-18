import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Helper function to parse User-Agent
function parseUserAgent(userAgent: string | null) {
  if (!userAgent) return { browser: "Unknown", os: "Unknown", deviceType: "desktop" };

  const ua = userAgent.toLowerCase();
  
  // Browser detection
  let browser = "Unknown";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("opera") || ua.includes("opr/")) browser = "Opera";

  // OS detection
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  // Device type detection
  let deviceType = "desktop";
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
    deviceType = "mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "tablet";
  }

  return { browser, os, deviceType };
}

// GET /api/admin/sessions - Get all active sessions
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = req.nextUrl.searchParams;
    const includeInactive = searchParams.get("includeInactive") === "true";
    const userId = searchParams.get("userId");

    const where: any = {};
    if (!includeInactive) where.isActive = true;
    if (userId) where.userId = userId;

    const sessions = await prisma.session.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            role: true,
            email: true,
          },
        },
      },
      orderBy: { lastActivity: "desc" },
    });

    // Calculate session duration and add status
    const enrichedSessions = sessions.map((s) => {
      const now = new Date();
      const duration = now.getTime() - new Date(s.createdAt).getTime();
      const isExpired = new Date(s.expires) < now;
      const lastActivityMinutes = Math.floor(
        (now.getTime() - new Date(s.lastActivity).getTime()) / 60000
      );

      return {
        ...s,
        duration: Math.floor(duration / 60000), // minutes
        isExpired,
        lastActivityMinutes,
        status: s.loggedOutAt
          ? "logged-out"
          : isExpired
          ? "expired"
          : lastActivityMinutes > 30
          ? "idle"
          : "active",
      };
    });

    return NextResponse.json(enrichedSessions);
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

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
