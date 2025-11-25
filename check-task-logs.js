const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTaskLogs() {
  try {
    console.log('Checking Task activity logs...\n');
    
    const taskLogs = await prisma.activityLog.findMany({
      where: { entityType: 'Task' },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    if (taskLogs.length === 0) {
      console.log('No Task activity logs found.');
    } else {
      console.log(`Found ${taskLogs.length} Task activity logs:\n`);
      taskLogs.forEach((log, index) => {
        console.log(`${index + 1}. Log ID: ${log.id}`);
        console.log(`   Action: ${log.actionType}`);
        console.log(`   Field: ${log.fieldName || 'N/A'}`);
        console.log(`   Old Value: ${log.oldValue || 'N/A'}`);
        console.log(`   New Value: ${log.newValue || 'N/A'}`);
        console.log(`   Is Reversed: ${log.isReversed}`);
        console.log(`   Timestamp: ${log.timestamp}`);
        console.log(`   User: ${log.userName}`);
        if (log.fullEntityData) {
          console.log(`   Full Data: ${log.fullEntityData}`);
        }
        console.log('');
      });
    }
  } catch (error) {
    console.error('Error checking task logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTaskLogs();
