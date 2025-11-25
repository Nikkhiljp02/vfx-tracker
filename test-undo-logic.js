const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUndoButtonLogic() {
  try {
    console.log('Testing undo button logic for recent logs...\n');
    
    const logs = await prisma.activityLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    logs.forEach((log, index) => {
      console.log(`\n${index + 1}. Log ID: ${log.id}`);
      console.log(`   Entity: ${log.entityType} | Action: ${log.actionType}`);
      console.log(`   Field: ${log.fieldName || 'N/A'}`);
      console.log(`   User: ${log.userName}`);
      console.log(`   Timestamp: ${log.timestamp}`);
      
      // Test the exact conditions from the UI
      const condition1 = !log.isReversed;
      const condition2 = !log.fieldName?.startsWith('undo_');
      const condition3 = log.actionType === 'CREATE' || log.actionType === 'UPDATE' || log.actionType === 'DELETE';
      
      console.log(`\n   Condition Checks:`);
      console.log(`   - !isReversed: ${condition1} (isReversed=${log.isReversed})`);
      console.log(`   - !fieldName.startsWith('undo_'): ${condition2} (fieldName='${log.fieldName || ''}')`);
      console.log(`   - actionType is CREATE/UPDATE/DELETE: ${condition3} (actionType='${log.actionType}')`);
      
      const shouldShowUndo = condition1 && condition2 && condition3;
      console.log(`\n   ✨ SHOULD SHOW UNDO BUTTON: ${shouldShowUndo ? 'YES ✅' : 'NO ❌'}`);
      
      if (!shouldShowUndo && log.entityType === 'Task' && log.actionType === 'UPDATE') {
        console.log(`   ⚠️  WARNING: This is a Task UPDATE but undo button won't show!`);
        console.log(`   ⚠️  Reason: ${!condition1 ? 'Already reversed' : !condition2 ? 'Undo field' : 'Unknown'}`);
      }
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testUndoButtonLogic();
