const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function addSampleData() {
  try {
    console.log('Adding sample data...\n');
    
    // Create a sample show
    const show = await prisma.show.create({
      data: {
        showName: 'Sample Show',
        status: 'Active',
        departments: JSON.stringify(['Comp', 'Paint', 'Roto', 'MMRA']),
        clientName: 'Sample Client',
        createdDate: new Date(),
      }
    });
    console.log(`✓ Created show: ${show.showName}`);
    
    // Create sample shots
    const shots = [];
    for (let i = 1; i <= 5; i++) {
      const shot = await prisma.shot.create({
        data: {
          shotName: `SH${String(i).padStart(3, '0')}`,
          showId: show.id,
          shotTag: 'Fresh',
          episode: 'EP01',
          sequence: 'SEQ01',
          frames: 100,
          turnover: 'TO01',
          createdDate: new Date(),
        }
      });
      shots.push(shot);
      console.log(`✓ Created shot: ${shot.shotName}`);
    }
    
    // Create sample tasks for each shot
    const departments = ['Comp', 'Paint', 'Roto', 'MMRA'];
    const statuses = ['YTS', 'WIP', 'Int App', 'AWF', 'C APP'];
    
    let taskCount = 0;
    for (const shot of shots) {
      for (const dept of departments) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const internalEta = new Date();
        internalEta.setDate(internalEta.getDate() + Math.floor(Math.random() * 14));
        
        const clientEta = new Date(internalEta);
        clientEta.setDate(clientEta.getDate() + 2);
        
        await prisma.task.create({
          data: {
            shotId: shot.id,
            department: dept,
            status: status,
            isInternal: false,
            internalEta: internalEta,
            clientEta: clientEta,
            leadName: ['John Doe', 'Jane Smith', 'Bob Johnson'][Math.floor(Math.random() * 3)],
            bidMds: parseFloat((Math.random() * 5 + 1).toFixed(1)),
            deliveredVersion: status === 'C APP' || status === 'C KB' ? `v${Math.floor(Math.random() * 5) + 1}` : null,
          }
        });
        taskCount++;
      }
    }
    console.log(`✓ Created ${taskCount} tasks`);
    
    console.log('\n✓ Sample data added successfully!');
    console.log('\nYou can now:');
    console.log('1. View the data in your application');
    console.log('2. Add more shows/shots through the Tracker view');
    console.log('3. Test the Feedback feature');
    
  } catch (error) {
    console.error('❌ Error adding sample data:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addSampleData();
