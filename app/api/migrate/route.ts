import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
  try {
    console.log('Running database migrations...');
    
    // Run migrations
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy');
    
    console.log('Migration output:', stdout);
    if (stderr) console.error('Migration errors:', stderr);
    
    return NextResponse.json({
      success: true,
      message: 'Database migrations completed successfully',
      output: stdout,
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
