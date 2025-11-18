import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { trackLoginAttempt, parseUserAgent } from "@/lib/session-tracking";

// POST /api/auth/track-login - Track login and create session
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, username } = body;

    console.log("Track-login called:", { userId, username });

    if (!userId || !username) {
      console.log("Missing required fields");
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get request info
    const ipAddress = req.headers.get("x-forwarded-for") || 
                     req.headers.get("x-real-ip") || 
                     "unknown";
    const userAgent = req.headers.get("user-agent") || "";

    console.log("Request info:", { ipAddress, userAgent });

    // Parse user agent
    const { browser, os, deviceType } = parseUserAgent(userAgent);
    console.log("Parsed user agent:", { browser, os, deviceType });

    // Track login attempt in login history
    console.log("Tracking login attempt...");
    await trackLoginAttempt(userId, username, true, ipAddress, userAgent);
    console.log("Login attempt tracked");

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

    console.log("Existing sessions found:", existingSessions.length);

    if (existingSessions.length > 0) {
      // Update the most recent session
      console.log("Updating existing session:", existingSessions[0].id);
      await prisma.session.update({
        where: { id: existingSessions[0].id },
        data: {
          lastActivity: new Date(),
          ipAddress,
          expires,
          sessionToken,
        },
      });
      console.log("Session updated");
    } else {
      // Create new session
      console.log("Creating new session...");
      const newSession = await prisma.session.create({
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
      console.log("Session created:", newSession.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error tracking login:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
