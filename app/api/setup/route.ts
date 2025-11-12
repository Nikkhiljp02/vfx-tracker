import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// This is a one-time setup endpoint to create the admin user
export async function POST() {
  try {
    // Check if any users exist
    const userCount = await prisma.user.count();
    
    if (userCount > 0) {
      return NextResponse.json(
        { message: 'Database already has users. Setup already completed.' },
        { status: 400 }
      );
    }

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@vfxtracker.com',
        password: hashedPassword,
        role: 'ADMIN',
        firstName: 'Admin',
        lastName: 'User',
      },
    });

    // Create default status options
    const statusOptions = [
      { statusName: 'YTS', colorCode: '#808080', statusOrder: 1 },
      { statusName: 'WIP', colorCode: '#FFA500', statusOrder: 2 },
      { statusName: 'Int App', colorCode: '#4169E1', statusOrder: 3 },
      { statusName: 'AWF', colorCode: '#9370DB', statusOrder: 4 },
      { statusName: 'C APP', colorCode: '#32CD32', statusOrder: 5 },
      { statusName: 'C KB', colorCode: '#DC143C', statusOrder: 6 },
      { statusName: 'OMIT', colorCode: '#696969', statusOrder: 7 },
      { statusName: 'HOLD', colorCode: '#FF8C00', statusOrder: 8 },
    ];

    for (const status of statusOptions) {
      await prisma.statusOption.create({ data: status });
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully!',
      credentials: {
        username: 'admin',
        password: 'admin123',
      },
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Failed to create admin user', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
