const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllViewerPermissions() {
  try {
    console.log('\n🔧 Fixing permissions for all VIEWER users...\n');
    
    // Find all VIEWER users
    const viewerUsers = await prisma.user.findMany({
      where: { role: 'VIEWER' },
      select: { id: true, username: true, firstName: true, lastName: true }
    });

    if (viewerUsers.length === 0) {
      console.log('ℹ️  No VIEWER users found.');
      await prisma.$disconnect();
      return;
    }

    console.log(`📋 Found ${viewerUsers.length} VIEWER user(s):`);
    viewerUsers.forEach(user => {
      console.log(`   - ${user.username} (${user.firstName} ${user.lastName})`);
    });
    console.log('');

    // Update all ShowAccess records for VIEWER users to canEdit: false
    const result = await prisma.showAccess.updateMany({
      where: {
        userId: {
          in: viewerUsers.map(u => u.id)
        }
      },
      data: {
        canEdit: false
      }
    });

    console.log(`✅ Updated ${result.count} ShowAccess record(s)\n`);
    
    if (result.count > 0) {
      console.log('✅ All VIEWER users now have VIEW-ONLY access.');
      console.log('💡 They will see "👁️ View Only" in their profile.');
      console.log('');
      console.log('🔄 Please refresh browser (Ctrl+Shift+R) to see changes.');
    } else {
      console.log('ℹ️  No ShowAccess records needed updating.');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllViewerPermissions();
