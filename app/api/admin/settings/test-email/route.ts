import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

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
    const { smtpHost, smtpPort, smtpUser, smtpPass, smtpFrom } = body;

    // Validate required fields
    if (!smtpHost || !smtpPort || !smtpUser || !smtpFrom) {
      return NextResponse.json(
        { message: "Missing required SMTP configuration" },
        { status: 400 }
      );
    }

    // In production, you would use nodemailer to test the connection:
    // const nodemailer = require('nodemailer');
    // const transporter = nodemailer.createTransport({
    //   host: smtpHost,
    //   port: parseInt(smtpPort),
    //   secure: smtpPort === '465',
    //   auth: { user: smtpUser, pass: smtpPass },
    // });
    //
    // await transporter.verify();
    // await transporter.sendMail({
    //   from: smtpFrom,
    //   to: user.email,
    //   subject: 'Test Email from VFX Tracker',
    //   text: 'If you received this, your email settings are configured correctly!',
    // });

    // For now, simulate a successful test
    return NextResponse.json({
      message: `Test email would be sent from ${smtpHost}:${smtpPort} to ${user.email}`,
      note: "Install nodemailer package to enable actual email sending",
    });
  } catch (error) {
    console.error("Error testing email:", error);
    return NextResponse.json(
      { message: "Failed to test email connection: " + (error as Error).message },
      { status: 500 }
    );
  }
}
