import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// In a production app, store these in a database or encrypted config
// For demo purposes, we'll return mock settings
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

    // In production, load from database or secure config
    const settings = {
      email: {
        host: process.env.SMTP_HOST || "",
        port: process.env.SMTP_PORT || "587",
        user: process.env.SMTP_USER || "",
        from: process.env.SMTP_FROM || "",
        // Never return the password
      },
    };

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
