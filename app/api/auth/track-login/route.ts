import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackLoginAttempt, parseUserAgent } from "@/lib/session-tracking";

// POST /api/auth/track-login - Track login and create session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, username } = body;

    if (!userId || !username) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get request info
    const ipAddress = req.headers.get("x-forwarded-for") || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    // Parse user agent
    const { browser, os, deviceType } = parseUserAgent(userAgent);

    // Track login attempt in login history
    await trackLoginAttempt(userId, username, true, ipAddress, userAgent);

    // Generate a unique session token
    const sessionToken = `${userId}-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Check if user has an existing active session from same device
    const existingSessions = await prisma.session.findMany({
      where: {
        userId,
        isActive: true,
        userAgent,
      },
    });

    if (existingSessions.length > 0) {
      // Update the most recent session
      await prisma.session.update({
        where: { id: existingSessions[0].id },
        data: {
          lastActivity: new Date(),
          ipAddress,
          expires,
          sessionToken,
        },
      });
    } else {
      // Create new session
      await prisma.session.create({
        data: {
          userId,
          sessionToken,
          expires,
          lastActivity: new Date(),
          ipAddress,
          userAgent,
          browser,
          os,
          deviceType,
          isActive: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking login:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
