import { prisma } from "@/lib/prisma";

export interface SessionTrackingData {
  userId: string;
  username: string;
  ipAddress?: string;
  userAgent?: string;
  loginSuccess: boolean;
  failureReason?: string;
}

export function parseUserAgent(userAgent: string | null) {
  if (!userAgent) return { browser: null, os: null, deviceType: null };
  
  const ua = userAgent.toLowerCase();
  
  let browser = "Unknown";
  if (ua.includes("edg/")) browser = "Edge";
  else if (ua.includes("chrome/")) browser = "Chrome";
  else if (ua.includes("firefox/")) browser = "Firefox";
  else if (ua.includes("safari/") && !ua.includes("chrome")) browser = "Safari";
  else if (ua.includes("opera") || ua.includes("opr/")) browser = "Opera";

  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac os")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("iphone") || ua.includes("ipad")) os = "iOS";

  let deviceType = "desktop";
  if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android")) {
    deviceType = "mobile";
  } else if (ua.includes("tablet") || ua.includes("ipad")) {
    deviceType = "tablet";
  }

  return { browser, os, deviceType };
}

export async function trackLoginAttempt(data: SessionTrackingData) {
  try {
    const { browser, os, deviceType } = parseUserAgent(data.userAgent || null);

    // Detect suspicious login patterns
    const suspicionFlags: string[] = [];
    let isSuspicious = false;

    if (data.loginSuccess) {
      // Check for suspicious patterns
      const recentLogins = await prisma.loginHistory.findMany({
        where: {
          userId: data.userId,
          loginSuccess: true,
          loginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Last 24 hours
        },
        orderBy: { loginAt: "desc" },
        take: 5,
      });

      if (recentLogins.length > 0) {
        const lastLogin = recentLogins[0];
        const timeDiff = Date.now() - new Date(lastLogin.loginAt).getTime();
        
        // Different IP within short time
        if (lastLogin.ipAddress && data.ipAddress && 
            lastLogin.ipAddress !== data.ipAddress && 
            timeDiff < 30 * 60 * 1000) {
          suspicionFlags.push("ip-change");
          isSuspicious = true;
        }

        // Different OS
        if (lastLogin.os && os && lastLogin.os !== os && timeDiff < 60 * 60 * 1000) {
          suspicionFlags.push("os-change");
          isSuspicious = true;
        }
      }

      // Multiple logins in short time
      if (recentLogins.length >= 5) {
        const firstLogin = recentLogins[recentLogins.length - 1];
        const timeSpan = Date.now() - new Date(firstLogin.loginAt).getTime();
        if (timeSpan < 15 * 60 * 1000) {
          suspicionFlags.push("rapid-logins");
          isSuspicious = true;
        }
      }
    } else {
      // Check for brute force attempts
      const recentFailed = await prisma.loginHistory.findMany({
        where: {
          username: data.username,
          loginSuccess: false,
          loginAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        },
      });

      if (recentFailed.length >= 3) {
        suspicionFlags.push("brute-force");
        isSuspicious = true;
      }
    }

    // Create login history record
    await prisma.loginHistory.create({
      data: {
        userId: data.userId,
        username: data.username,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        browser,
        os,
        deviceType,
        loginSuccess: data.loginSuccess,
        failureReason: data.failureReason || null,
        isSuspicious,
        suspicionFlags: suspicionFlags.length > 0 ? JSON.stringify(suspicionFlags) : null,
      },
    });

    return { isSuspicious, suspicionFlags };
  } catch (error) {
    console.error("Error tracking login attempt:", error);
    return { isSuspicious: false, suspicionFlags: [] };
  }
}

export async function updateSessionActivity(sessionToken: string, ipAddress?: string, userAgent?: string) {
  try {
    const { browser, os, deviceType } = parseUserAgent(userAgent || null);

    await prisma.session.updateMany({
      where: { sessionToken, isActive: true },
      data: {
        lastActivity: new Date(),
        ...(ipAddress && !await hasIpAddress(sessionToken) && { ipAddress }),
        ...(userAgent && !await hasUserAgent(sessionToken) && { userAgent, browser, os, deviceType }),
      },
    });
  } catch (error) {
    console.error("Error updating session activity:", error);
  }
}

async function hasIpAddress(sessionToken: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    select: { ipAddress: true },
  });
  return !!session?.ipAddress;
}

async function hasUserAgent(sessionToken: string): Promise<boolean> {
  const session = await prisma.session.findUnique({
    where: { sessionToken },
    select: { userAgent: true },
  });
  return !!session?.userAgent;
}
