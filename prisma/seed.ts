import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed Status Options
  const statuses = [
    { statusName: 'YTS', statusOrder: 1, colorCode: '#9CA3AF' }, // gray
    { statusName: 'WIP', statusOrder: 2, colorCode: '#3B82F6' }, // blue
    { statusName: 'Int App', statusOrder: 3, colorCode: '#10B981' }, // green
    { statusName: 'AWF', statusOrder: 4, colorCode: '#F59E0B' }, // amber
    { statusName: 'C APP', statusOrder: 5, colorCode: '#22C55E' }, // green
    { statusName: 'C KB', statusOrder: 6, colorCode: '#EF4444' }, // red
    { statusName: 'OMIT', statusOrder: 7, colorCode: '#6B7280' }, // gray
    { statusName: 'HOLD', statusOrder: 8, colorCode: '#8B5CF6' }, // purple
  ];

  for (const status of statuses) {
    await prisma.statusOption.upsert({
      where: { statusName: status.statusName },
      update: {},
      create: status,
    });
  }

  console.log('✓ Status options seeded');

  // Seed Departments
  const departments = [
    { deptName: 'Comp' },
    { deptName: 'Paint' },
    { deptName: 'Roto' },
    { deptName: 'MMRA' },
  ];

  for (const dept of departments) {
    await prisma.department.upsert({
      where: { deptName: dept.deptName },
      update: {},
      create: dept,
    });
  }

  console.log('✓ Departments seeded');

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

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { name: permission.name },
      update: {},
      create: permission,
    });
  }

  console.log('✓ Permissions seeded');

  // Seed Default Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      firstName: 'System',
      lastName: 'Administrator',
      email: 'admin@vfxtracker.local',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('✓ Default admin user created (username: admin, password: admin123)');
  console.log('✓ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
