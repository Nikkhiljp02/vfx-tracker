import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

// GET /api/users - List all users (Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        showAccess: {
          include: {
            show: {
              select: {
                id: true,
                showName: true,
              },
            },
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// POST /api/users - Create a new user (Admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { firstName, lastName, email, role, password, showIds, customPermissions } = body;

    // Validate required fields
    if (!firstName || !lastName || !role || !password) {
      return NextResponse.json(
        { error: "firstName, lastName, role, and password are required" },
        { status: 400 }
      );
    }

    // Generate username from first and last name (firstname.lastname)
    const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`.replace(/\s+/g, "");

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this name already exists. Please use a different name." },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with show access and custom permissions
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        firstName,
        lastName,
        email,
        role,
        isActive: true,
        createdBy: user.id,
        showAccess: showIds && showIds.length > 0
          ? {
              create: showIds.map((showId: string) => ({
                showId,
                canEdit: role === 'ADMIN' || role === 'COORDINATOR',
              })),
            }
          : undefined,
        permissions: customPermissions && customPermissions.length > 0
          ? {
              create: customPermissions.map((perm: { permissionId: string, granted: boolean }) => ({
                permissionId: perm.permissionId,
                granted: perm.granted,
              })),
            }
          : undefined,
      },
      include: {
        showAccess: {
          include: {
            show: true,
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(userWithoutPassword, { status: 201 });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
