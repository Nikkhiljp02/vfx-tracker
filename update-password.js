const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updatePassword() {
  const hash = await bcrypt.hash('password123', 10);
  console.log('Generated hash:', hash);
  
  await prisma.user.update({
    where: { username: 'system.administrator' },
    data: { password: hash }
  });
  
  console.log('✅ Password updated to: password123');
  await prisma.$disconnect();
}

updatePassword().catch(console.error);
