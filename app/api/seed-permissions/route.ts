import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    // Check if permissions already exist
    const existingCount = await prisma.permission.count();
    if (existingCount > 0) {
      return NextResponse.json({
        success: false,
        message: `Permissions already seeded (${existingCount} permissions exist)`,
      });
    }

    // Seed Default Permissions
    const permissions = [
      // Shows permissions
      { name: 'shows.create', description: 'Create new shows', category: 'shows', action: 'create' },
      { name: 'shows.read', description: 'View shows', category: 'shows', action: 'read' },
      { name: 'shows.update', description: 'Edit shows', category: 'shows', action: 'update' },
      { name: 'shows.delete', description: 'Delete shows', category: 'shows', action: 'delete' },
      
      // Shots permissions
      { name: 'shots.create', description: 'Create new shots', category: 'shots', action: 'create' },
      { name: 'shots.read', description: 'View shots', category: 'shots', action: 'read' },
      { name: 'shots.update', description: 'Edit shots', category: 'shots', action: 'update' },
      { name: 'shots.delete', description: 'Delete shots', category: 'shots', action: 'delete' },
      
      // Tasks permissions
      { name: 'tasks.create', description: 'Create tasks', category: 'tasks', action: 'create' },
      { name: 'tasks.read', description: 'View tasks', category: 'tasks', action: 'read' },
      { name: 'tasks.update', description: 'Update task status', category: 'tasks', action: 'update' },
      { name: 'tasks.delete', description: 'Delete tasks', category: 'tasks', action: 'delete' },
      
      // Deliveries permissions
      { name: 'deliveries.read', description: 'View deliveries', category: 'deliveries', action: 'read' },
      { name: 'deliveries.send', description: 'Send delivery lists', category: 'deliveries', action: 'create' },
      { name: 'deliveries.schedule', description: 'Schedule deliveries', category: 'deliveries', action: 'manage' },
      
      // Users permissions (admin only)
      { name: 'users.create', description: 'Create new users', category: 'users', action: 'create' },
      { name: 'users.read', description: 'View users', category: 'users', action: 'read' },
      { name: 'users.update', description: 'Edit users', category: 'users', action: 'update' },
      { name: 'users.delete', description: 'Delete users', category: 'users', action: 'delete' },
      { name: 'users.manage', description: 'Full user management', category: 'users', action: 'manage' },
      
      // Admin permissions
      { name: 'admin.full', description: 'Full administrative access', category: 'admin', action: 'manage' },
    ];

    // Create all permissions
    for (const permission of permissions) {
      await prisma.permission.create({
        data: permission,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully seeded ${permissions.length} permissions`,
      permissions: permissions.map(p => p.name),
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}
