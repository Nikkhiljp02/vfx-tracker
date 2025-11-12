import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    // Try to connect to database
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: "User not found",
        username 
      });
    }

    // Check password
    const passwordMatch = await bcrypt.compare(password, user.password);

    return NextResponse.json({
      success: true,
      userExists: !!user,
      passwordMatch,
      userActive: user.isActive,
      userRole: user.role,
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    }, { status: 500 });
  }
}
