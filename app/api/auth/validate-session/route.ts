import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/auth/validate-session - Check if current session is still active in database
export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ valid: false, reason: "no-session" }, { status: 401 });
    }

    const user = session.user as any;

    // Check if user has any active sessions in database
    const activeSessions = await prisma.session.count({
      where: {
        userId: user.id,
        isActive: true,
        expires: { gt: new Date() },
      },
    });

    if (activeSessions === 0) {
      return NextResponse.json({ 
        valid: false, 
        reason: "force-logout",
        message: "Your session has been terminated by an administrator" 
      }, { status: 401 });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("Error validating session:", error);
    return NextResponse.json({ 
      valid: false, 
      reason: "error",
      message: "Error validating session" 
    }, { status: 500 });
  }
}
