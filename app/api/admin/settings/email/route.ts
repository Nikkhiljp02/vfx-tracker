import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function PUT(req: NextRequest) {
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
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = body;

    // In production, you would:
    // 1. Validate the input
    // 2. Encrypt sensitive data (password)
    // 3. Store in database or update .env file programmatically
    // 4. Possibly restart services to pick up new config

    // For now, just acknowledge the settings
    console.log("Email settings update requested:", {
      host: smtpHost,
      port: smtpPort,
      user: smtpUser,
      from: smtpFrom,
      // Don't log password
    });

    // NOTE: In a real app, you'd store this in a SystemSettings table:
    // await prisma.systemSettings.upsert({
    //   where: { key: 'smtp_config' },
    //   update: {
    //     value: JSON.stringify({
    //       host: smtpHost,
    //       port: smtpPort,
    //       user: smtpUser,
    //       pass: encrypt(smtpPass), // Use encryption!
    //       from: smtpFrom,
    //     }),
    //   },
    //   create: { ... }
    // });

    return NextResponse.json({
      message: "Settings saved successfully",
      note: "In production, these would be stored in database",
    });
  } catch (error) {
    console.error("Error saving email settings:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
