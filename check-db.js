const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  try {
    console.log('Checking database connection...\n');
    
    // Check shows
    const shows = await prisma.show.count();
    console.log(`Shows: ${shows}`);
    
    // Check shots
    const shots = await prisma.shot.count();
    console.log(`Shots: ${shots}`);
    
    // Check tasks
    const tasks = await prisma.task.count();
    console.log(`Tasks: ${tasks}`);
    
    // Check users
    const users = await prisma.user.count();
    console.log(`Users: ${users}`);
    
    // Check departments
    const departments = await prisma.department.count();
    console.log(`Departments: ${departments}`);
    
    // Check status options
    const statusOptions = await prisma.statusOption.count();
    console.log(`Status Options: ${statusOptions}`);
    
    // Check feedbacks
    const feedbacks = await prisma.feedback.count();
    console.log(`Feedbacks: ${feedbacks}`);
    
    console.log('\n✓ Database connected successfully!');
    
    if (shows === 0 && shots === 0 && tasks === 0) {
      console.log('\n⚠️  Database is empty. You need to add shows, shots, and tasks.');
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
