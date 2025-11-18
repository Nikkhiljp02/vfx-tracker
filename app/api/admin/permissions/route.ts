import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Sample permission structure - in production, this would come from database
const DEFAULT_PERMISSIONS = [
  // Shows
  { id: "shows.view", name: "View Shows", description: "View show details", category: "Shows" },
  { id: "shows.create", name: "Create Shows", description: "Create new shows", category: "Shows" },
  { id: "shows.edit", name: "Edit Shows", description: "Modify show details", category: "Shows" },
  { id: "shows.delete", name: "Delete Shows", description: "Remove shows", category: "Shows" },
  
  // Shots
  { id: "shots.view", name: "View Shots", description: "View shot details", category: "Shots" },
  { id: "shots.create", name: "Create Shots", description: "Create new shots", category: "Shots" },
  { id: "shots.edit", name: "Edit Shots", description: "Modify shot details", category: "Shots" },
  { id: "shots.delete", name: "Delete Shots", description: "Remove shots", category: "Shots" },
  { id: "shots.import", name: "Import Shots", description: "Bulk import shots", category: "Shots" },
  
  // Tasks
  { id: "tasks.view", name: "View Tasks", description: "View task details", category: "Tasks" },
  { id: "tasks.create", name: "Create Tasks", description: "Create new tasks", category: "Tasks" },
  { id: "tasks.edit", name: "Edit Tasks", description: "Modify task details", category: "Tasks" },
  { id: "tasks.delete", name: "Delete Tasks", description: "Remove tasks", category: "Tasks" },
  
  // Users
  { id: "users.view", name: "View Users", description: "View user profiles", category: "Users" },
  { id: "users.create", name: "Create Users", description: "Create new users", category: "Users" },
  { id: "users.edit", name: "Edit Users", description: "Modify user details", category: "Users" },
  { id: "users.delete", name: "Delete Users", description: "Remove users", category: "Users" },
  
  // Deliveries
  { id: "deliveries.view", name: "View Deliveries", description: "View delivery schedules", category: "Deliveries" },
  { id: "deliveries.create", name: "Create Deliveries", description: "Create delivery schedules", category: "Deliveries" },
  { id: "deliveries.edit", name: "Edit Deliveries", description: "Modify delivery schedules", category: "Deliveries" },
  { id: "deliveries.delete", name: "Delete Deliveries", description: "Remove delivery schedules", category: "Deliveries" },
  
  // Resources
  { id: "resources.view", name: "View Resources", description: "View resource allocations", category: "Resources" },
  { id: "resources.create", name: "Create Resources", description: "Create resource allocations", category: "Resources" },
  { id: "resources.edit", name: "Edit Resources", description: "Modify resource allocations", category: "Resources" },
  { id: "resources.delete", name: "Delete Resources", description: "Remove resource allocations", category: "Resources" },
  
  // Settings
  { id: "settings.view", name: "View Settings", description: "View system settings", category: "Settings" },
  { id: "settings.edit", name: "Edit Settings", description: "Modify system settings", category: "Settings" },
  { id: "permissions.manage", name: "Manage Permissions", description: "Modify user permissions", category: "Settings" },
];

// Default permission matrix by role
const DEFAULT_MATRIX = {
  ADMIN: Object.fromEntries(DEFAULT_PERMISSIONS.map(p => [p.id, true])),
  COORDINATOR: {
    "shows.view": true,
    "shows.create": true,
    "shows.edit": true,
    "shots.view": true,
    "shots.create": true,
    "shots.edit": true,
    "shots.delete": true,
    "shots.import": true,
    "tasks.view": true,
    "tasks.create": true,
    "tasks.edit": true,
    "tasks.delete": true,
    "users.view": true,
    "deliveries.view": true,
    "deliveries.create": true,
    "deliveries.edit": true,
    "deliveries.delete": true,
    "resources.view": true,
    "resources.create": true,
    "resources.edit": true,
  },
  MANAGER: {
    "shows.view": true,
    "shows.edit": true,
    "shots.view": true,
    "shots.create": true,
    "shots.edit": true,
    "tasks.view": true,
    "tasks.create": true,
    "tasks.edit": true,
    "tasks.delete": true,
    "users.view": true,
    "deliveries.view": true,
    "deliveries.create": true,
    "deliveries.edit": true,
    "resources.view": true,
    "resources.edit": true,
  },
  PRODUCER: {
    "shows.view": true,
    "shows.edit": true,
    "shots.view": true,
    "shots.create": true,
    "shots.edit": true,
    "tasks.view": true,
    "tasks.create": true,
    "tasks.edit": true,
    "users.view": true,
    "deliveries.view": true,
    "deliveries.create": true,
    "deliveries.edit": true,
    "deliveries.delete": true,
    "resources.view": true,
  },
  DEPARTMENT: {
    "shows.view": true,
    "shots.view": true,
    "shots.edit": true,
    "tasks.view": true,
    "tasks.create": true,
    "tasks.edit": true,
    "users.view": true,
    "deliveries.view": true,
    "resources.view": true,
  },
  RESOURCE: {
    "shows.view": true,
    "shots.view": true,
    "tasks.view": true,
    "users.view": true,
    "resources.view": true,
    "resources.create": true,
    "resources.edit": true,
    "resources.delete": true,
  },
  VIEWER: {
    "shows.view": true,
    "shots.view": true,
    "tasks.view": true,
    "users.view": true,
    "deliveries.view": true,
    "resources.view": true,
  },
};

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

    // In production, you would fetch actual permissions from database:
    // const permissions = await prisma.permission.findMany();
    // const userPermissions = await prisma.userPermission.findMany({
    //   include: { permission: true, user: true }
    // });

    return NextResponse.json({
      permissions: DEFAULT_PERMISSIONS,
      matrix: DEFAULT_MATRIX,
    });
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return NextResponse.json(
      { error: "Failed to fetch permissions" },
      { status: 500 }
    );
  }
}

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
    const { role, permissionId, enabled } = body;

    // Prevent modifying admin role
    if (role === "ADMIN") {
      return NextResponse.json(
        { error: "Cannot modify ADMIN permissions" },
        { status: 400 }
      );
    }

    // In production, update the database:
    // if (enabled) {
    //   // Add permission for all users with this role
    //   const usersWithRole = await prisma.user.findMany({ where: { role } });
    //   const permission = await prisma.permission.findUnique({
    //     where: { id: permissionId }
    //   });
    //   
    //   for (const user of usersWithRole) {
    //     await prisma.userPermission.upsert({
    //       where: {
    //         userId_permissionId: {
    //           userId: user.id,
    //           permissionId: permission.id,
    //         }
    //       },
    //       create: { userId: user.id, permissionId: permission.id },
    //       update: {},
    //     });
    //   }
    // } else {
    //   // Remove permission for all users with this role
    //   const usersWithRole = await prisma.user.findMany({ where: { role } });
    //   await prisma.userPermission.deleteMany({
    //     where: {
    //       userId: { in: usersWithRole.map(u => u.id) },
    //       permissionId: permissionId,
    //     }
    //   });
    // }

    console.log(`Permission ${permissionId} ${enabled ? "enabled" : "disabled"} for role ${role}`);

    return NextResponse.json({
      message: "Permission updated successfully",
      note: "In production, this would update the database",
    });
  } catch (error) {
    console.error("Error updating permission:", error);
    return NextResponse.json(
      { error: "Failed to update permission" },
      { status: 500 }
    );
  }
}
