import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;

    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const header = [
      'Emp ID',
      'Emp Name',
      'Designation',
      'Reporting To',
      'Department',
      'Shift',
      'Employee Type',
      'Active',
    ];

    const sample = [
      'EMP001',
      'John Doe',
      'Senior Artist',
      'Lead Name',
      'Roto',
      'Day',
      'Artist',
      'TRUE',
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, sample]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const body = new Uint8Array(buffer);

    return new NextResponse(body, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="employee_roster_template.xlsx"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Error generating roster template:', error);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
