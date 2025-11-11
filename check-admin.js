const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAdminUsers() {
  try {
    console.log('\n🔍 Checking all users in database...\n');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true
      },
      orderBy: { role: 'asc' }
    });

    if (users.length === 0) {
      console.log('❌ No users found in database!');
      console.log('\n💡 You may need to run: npx prisma db seed');
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. Username: ${user.username}`);
        console.log(`   Name: ${user.firstName} ${user.lastName}`);
        console.log(`   Role: ${user.role} ${user.role === 'ADMIN' ? '👑' : user.role === 'COORDINATOR' ? '📋' : '👁️'}`);
        console.log(`   Created: ${user.createdAt.toLocaleDateString()}`);
        console.log('');
      });

      const adminUsers = users.filter(u => u.role === 'ADMIN');
      console.log(`\n📊 Total Users: ${users.length}`);
      console.log(`👑 Admin Users: ${adminUsers.length}`);
      
      if (adminUsers.length > 0) {
        console.log('\n✅ Admin account(s) found:');
        adminUsers.forEach(admin => {
          console.log(`   - Username: ${admin.username}`);
          console.log(`     Name: ${admin.firstName} ${admin.lastName}`);
        });
        console.log('\n💡 Default password for seeded users is usually: "password123"');
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdminUsers();
