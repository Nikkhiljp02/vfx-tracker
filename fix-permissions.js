const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPermissions() {
  try {
    // Find user nikhil.patil
    const user = await prisma.user.findUnique({
      where: { username: 'nikhil.patil' }
    });

    if (!user) {
      console.log('❌ User nikhil.patil not found');
      return;
    }

    console.log('✅ User found: nikhil.patil');
    console.log('   Updating all ShowAccess records to canEdit=false...');
    console.log('');

    // Update all ShowAccess records for this user to canEdit=false
    const result = await prisma.showAccess.updateMany({
      where: { userId: user.id },
      data: { canEdit: false }
    });

    console.log(`✅ Updated ${result.count} ShowAccess record(s)`);
    console.log('');
    console.log('🔒 User nikhil.patil is now VIEW-ONLY for all shows!');
    console.log('');
    console.log('Please refresh your browser (Ctrl+Shift+R) to see the changes.');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixPermissions();
