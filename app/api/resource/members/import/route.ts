import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import * as XLSX from 'xlsx';

// POST import resource members from Excel
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    if (user.role !== 'ADMIN' && user.role !== 'RESOURCE') {
      return NextResponse.json({ error: 'Forbidden - Resource access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read Excel file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No data found in Excel file' }, { status: 400 });
    }

    // Validate and transform data
    const members: any[] = [];
    const errors: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2; // Excel row (1-indexed + header)

      // Required fields validation
      const empId = row['Emp ID'] || row['empId'] || row['Employee ID'];
      const empName = row['Emp Name'] || row['empName'] || row['Name'];
      const designation = row['Designation'] || row['designation'];
      const department = row['Department'] || row['department'];

      if (!empId || !empName || !designation || !department) {
        errors.push(`Row ${rowNum}: Missing required fields (Emp ID, Emp Name, Designation, Department)`);
        continue;
      }

      // Optional fields
      const reportingTo = row['Reporting To'] || row['reportingTo'] || row['Manager'] || null;
      const shift = row['Shift'] || row['shift'] || 'Day';

      members.push({
        empId: String(empId).trim(),
        empName: String(empName).trim(),
        designation: String(designation).trim(),
        reportingTo: reportingTo ? String(reportingTo).trim() : null,
        department: String(department).trim(),
        shift: String(shift).trim(),
      });
    }

    if (members.length === 0) {
      return NextResponse.json({
        error: 'No valid members found',
        errors,
      }, { status: 400 });
    }

    // Check for duplicate empIds in file
    const empIds = members.map(m => m.empId);
    const duplicates = empIds.filter((id, index) => empIds.indexOf(id) !== index);
    if (duplicates.length > 0) {
      errors.push(`Duplicate Emp IDs in file: ${[...new Set(duplicates)].join(', ')}`);
    }

    // Check for existing empIds in database
    const existingMembers = await prisma.resourceMember.findMany({
      where: {
        empId: { in: empIds }
      },
      select: { empId: true }
    });

    const existingIds = existingMembers.map(m => m.empId);
    if (existingIds.length > 0) {
      errors.push(`Emp IDs already exist in database: ${existingIds.join(', ')}`);
    }

    // If there are blocking errors, return them
    if (duplicates.length > 0 || existingIds.length > 0) {
      return NextResponse.json({
        error: 'Import validation failed',
        errors,
        preview: members.slice(0, 5), // Show first 5 for review
      }, { status: 400 });
    }

    // Create all members (SQLite doesn't support skipDuplicates, but we already checked for duplicates)
    const created = await prisma.resourceMember.createMany({
      data: members,
    });

    return NextResponse.json({
      success: true,
      imported: created.count,
      total: members.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error importing resource members:', error);
    return NextResponse.json({ error: 'Failed to import resource members' }, { status: 500 });
  }
}
