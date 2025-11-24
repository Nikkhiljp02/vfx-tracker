// Diagnostic script - check database connection
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function diagnose() {
  console.log('=== Database Connection Diagnostic ===\n');
  
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Database URL:', process.env.DATABASE_URL ? 
    (process.env.DATABASE_URL.includes('postgresql') ? 'PostgreSQL (Supabase)' : 'SQLite (Local)') 
    : 'NOT SET');
  console.log('Direct URL:', process.env.DIRECT_URL ? 'SET' : 'NOT SET');
  console.log('\n');

  try {
    console.log('Attempting to connect to database...\n');
    
    const [shows, shots, tasks, users] = await Promise.all([
      prisma.show.count(),
      prisma.shot.count(),
      prisma.task.count(),
      prisma.user.count(),
    ]);

    console.log('✅ Database connected successfully!\n');
    console.log('Data counts:');
    console.log(`  Shows: ${shows}`);
    console.log(`  Shots: ${shots}`);
    console.log(`  Tasks: ${tasks}`);
    console.log(`  Users: ${users}`);

    if (shows === 0) {
      console.log('\n⚠️  Warning: No shows in database');
      console.log('   Action needed: Add data through the UI or seed script');
    }

  } catch (error) {
    console.error('❌ Database connection FAILED!\n');
    console.error('Error:', error.message);
    console.error('\nPossible causes:');
    console.error('  1. DATABASE_URL not set correctly');
    console.error('  2. Database server is down');
    console.error('  3. Network/firewall issues');
    console.error('  4. Missing migrations in production database');
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
