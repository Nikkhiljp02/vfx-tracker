import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackLoginAttempt, parseUserAgent } from "@/lib/session-tracking";

// POST /api/auth/track-login - Track login and create session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, username, sessionToken } = body;

    if (!userId || !username || !sessionToken) {
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

    // Create or update session record
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const existingSession = await prisma.session.findUnique({
      where: { sessionToken },
    });

    if (existingSession) {
      // Update existing session
      await prisma.session.update({
        where: { sessionToken },
        data: {
          lastActivity: new Date(),
          ipAddress,
          userAgent,
          browser,
          os,
          deviceType,
          isActive: true,
          expires,
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
