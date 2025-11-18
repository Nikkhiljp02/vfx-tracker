import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/admin/sessions/history - Get login history
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
    const userId = searchParams.get("userId");
    const onlySuspicious = searchParams.get("suspicious") === "true";
    const onlyFailed = searchParams.get("failed") === "true";
    const limit = parseInt(searchParams.get("limit") || "100");
    const page = parseInt(searchParams.get("page") || "1");

    const where: any = {};
    if (userId) where.userId = userId;
    if (onlySuspicious) where.isSuspicious = true;
    if (onlyFailed) where.loginSuccess = false;

    const [total, history] = await Promise.all([
      prisma.loginHistory.count({ where }),
      prisma.loginHistory.findMany({
        where,
        orderBy: { loginAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      history,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching login history:", error);
    return NextResponse.json(
      { error: "Failed to fetch login history" },
      { status: 500 }
    );
  }
}

// POST /api/admin/sessions/history - Create login history entry
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      userId,
      username,
      ipAddress,
      userAgent,
      loginSuccess,
      failureReason,
    } = body;

    if (!userId || !username) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Parse user agent
    const parseUserAgent = (ua: string | null) => {
      if (!ua) return { browser: null, os: null, deviceType: null };
      const userAgentLower = ua.toLowerCase();
      
      let browser = "Unknown";
      if (userAgentLower.includes("edg/")) browser = "Edge";
      else if (userAgentLower.includes("chrome/")) browser = "Chrome";
      else if (userAgentLower.includes("firefox/")) browser = "Firefox";
      else if (userAgentLower.includes("safari/") && !userAgentLower.includes("chrome")) browser = "Safari";

      let os = "Unknown";
      if (userAgentLower.includes("windows")) os = "Windows";
      else if (userAgentLower.includes("mac")) os = "macOS";
      else if (userAgentLower.includes("linux")) os = "Linux";
      else if (userAgentLower.includes("android")) os = "Android";
      else if (userAgentLower.includes("iphone") || userAgentLower.includes("ipad")) os = "iOS";

      let deviceType = "desktop";
      if (userAgentLower.includes("mobile")) deviceType = "mobile";
      else if (userAgentLower.includes("tablet") || userAgentLower.includes("ipad")) deviceType = "tablet";

      return { browser, os, deviceType };
    };

    const { browser, os, deviceType } = parseUserAgent(userAgent);

    // Detect suspicious login patterns
    const suspicionFlags: string[] = [];
    let isSuspicious = false;

    if (loginSuccess) {
      // Check for suspicious patterns
      const recentLogins = await prisma.loginHistory.findMany({
        where: {
          userId,
          loginSuccess: true,
          loginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        },
        orderBy: { loginAt: "desc" },
        take: 5,
      });

      // Different IP within short time
      if (recentLogins.length > 0) {
        const lastLogin = recentLogins[0];
        const timeDiff = Date.now() - new Date(lastLogin.loginAt).getTime();
        
        if (lastLogin.ipAddress && ipAddress && lastLogin.ipAddress !== ipAddress && timeDiff < 30 * 60 * 1000) {
          suspicionFlags.push("ip-change");
          isSuspicious = true;
        }

        // Different device/OS
        if (lastLogin.os && os && lastLogin.os !== os && timeDiff < 60 * 60 * 1000) {
          suspicionFlags.push("os-change");
          isSuspicious = true;
        }
      }

      // Multiple logins in short time
      if (recentLogins.length >= 5) {
        const firstLogin = recentLogins[recentLogins.length - 1];
        const timeSpan = Date.now() - new Date(firstLogin.loginAt).getTime();
        if (timeSpan < 15 * 60 * 1000) { // 5 logins in 15 minutes
          suspicionFlags.push("rapid-logins");
          isSuspicious = true;
        }
      }
    } else {
      // Check for brute force attempts
      const recentFailed = await prisma.loginHistory.findMany({
        where: {
          username,
          loginSuccess: false,
          loginAt: { gte: new Date(Date.now() - 15 * 60 * 1000) }, // Last 15 minutes
        },
      });

      if (recentFailed.length >= 3) {
        suspicionFlags.push("brute-force");
        isSuspicious = true;
      }
    }

    const loginHistory = await prisma.loginHistory.create({
      data: {
        userId,
        username,
        ipAddress,
        userAgent,
        browser,
        os,
        deviceType,
        loginSuccess,
        failureReason,
        isSuspicious,
        suspicionFlags: suspicionFlags.length > 0 ? JSON.stringify(suspicionFlags) : null,
      },
    });

    return NextResponse.json(loginHistory, { status: 201 });
  } catch (error) {
    console.error("Error creating login history:", error);
    return NextResponse.json(
      { error: "Failed to create login history" },
      { status: 500 }
    );
  }
}
