import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

// GET /api/users/[id] - Get a single user (Admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: {
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
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = targetUser;

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 }
    );
  }
}

// PATCH /api/users/[id] - Update a user (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { firstName, lastName, email, role, password, isActive, showIds, customPermissions } = body;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update username if first or last name changed
    if (firstName || lastName) {
      const newFirstName = firstName || existingUser.firstName;
      const newLastName = lastName || existingUser.lastName;
      const newUsername = `${newFirstName.toLowerCase()}.${newLastName.toLowerCase()}`.replace(/\s+/g, "");
      
      // Check if new username conflicts with another user
      if (newUsername !== existingUser.username) {
        const conflict = await prisma.user.findUnique({
          where: { username: newUsername },
        });

        if (conflict) {
          return NextResponse.json(
            { error: "A user with this name already exists" },
            { status: 400 }
          );
        }

        updateData.username = newUsername;
      }
    }

    // Hash new password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    // Update show access if provided
    if (showIds !== undefined) {
      // Delete existing show access
      await prisma.showAccess.deleteMany({
        where: { userId: id },
      });

      // Create new show access
      if (showIds.length > 0) {
        // Get the user's role to determine canEdit permission
        const userRole = role !== undefined ? role : existingUser.role;
        const canEdit = userRole === 'ADMIN' || userRole === 'COORDINATOR';
        
        await prisma.showAccess.createMany({
          data: showIds.map((showId: string) => ({
            userId: id,
            showId,
            canEdit,
          })),
        });
      }
    }

    // Update custom permissions if provided
    if (customPermissions !== undefined) {
      // Delete existing custom permissions
      await prisma.userPermission.deleteMany({
        where: { userId: id },
      });

      // Create new custom permissions
      if (customPermissions.length > 0) {
        await prisma.userPermission.createMany({
          data: customPermissions.map((perm: { permissionId: string, granted: boolean }) => ({
            userId: id,
            permissionId: perm.permissionId,
            granted: perm.granted,
          })),
        });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
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
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    return NextResponse.json(userWithoutPassword);
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Delete a user (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    if (user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Don't allow deleting yourself
    if (id === user.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    // Delete user (cascade will delete related records)
    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      { error: "Failed to delete user" },
      { status: 500 }
    );
  }
}
