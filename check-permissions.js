const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPermissions() {
  try {
    // Find user nikhil.patil
    const user = await prisma.user.findUnique({
      where: { username: 'nikhil.patil' }
    });

    if (!user) {
      console.log('❌ User nikhil.patil not found');
      return;
    }

    console.log('✅ User found:');
    console.log(`   ID: ${user.id}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Role: ${user.role}`);
    console.log('');

    // Check ShowAccess permissions
    const showAccess = await prisma.showAccess.findMany({
      where: { userId: user.id },
      include: { show: true }
    });

    console.log(`📋 ShowAccess records: ${showAccess.length}`);
    console.log('');

    if (showAccess.length === 0) {
      console.log('⚠️  No ShowAccess records found for this user!');
    } else {
      showAccess.forEach((access, index) => {
        console.log(`${index + 1}. Show: ${access.show.showName}`);
        console.log(`   canEdit: ${access.canEdit} ${access.canEdit ? '✏️ (CAN EDIT)' : '👁️ (VIEW ONLY)'}`);
        console.log('');
      });
    }

    // Summary
    const canEditCount = showAccess.filter(a => a.canEdit).length;
    const viewOnlyCount = showAccess.filter(a => !a.canEdit).length;
    
    console.log('=================================');
    console.log('SUMMARY:');
    console.log(`Total Shows: ${showAccess.length}`);
    console.log(`Can Edit: ${canEditCount}`);
    console.log(`View Only: ${viewOnlyCount}`);
    console.log('=================================');

    if (canEditCount > 0) {
      console.log('');
      console.log('⚠️  WARNING: User has EDIT permission on some shows!');
      console.log('   This is why they can update tasks.');
      console.log('');
      console.log('To make this user VIEW-ONLY for all shows, run:');
      console.log('   node fix-permissions.js');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPermissions();
