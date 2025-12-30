import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import * as XLSX from 'xlsx';

function parseBooleanLike(value: unknown): boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === '') return null;
    if (['true', 't', 'yes', 'y', '1', 'active'].includes(v)) return true;
    if (['false', 'f', 'no', 'n', '0', 'inactive'].includes(v)) return false;
  }
  return null;
}

type EmployeeType = 'Artist' | 'Lead' | 'Supervisor' | 'Production';

function normalizeEmployeeType(
  raw: unknown,
): { employeeType: EmployeeType; warning?: string } {
  if (raw === null || raw === undefined) {
    return { employeeType: 'Artist' };
  }

  const original = String(raw).trim();
  if (original === '') return { employeeType: 'Artist' };

  const key = original
    .toLowerCase()
    .replace(/[^a-z]/g, '');

  if (['artist', 'art', 'a'].includes(key)) return { employeeType: 'Artist' };
  if (['lead', 'teamlead', 'tl', 'teamleader', 'teamleading'].includes(key)) {
    return { employeeType: 'Lead' };
  }
  if (['supervisor', 'sup', 'super', 'head'].includes(key)) {
    return { employeeType: 'Supervisor' };
  }
  if (['production', 'prod', 'pm', 'producer'].includes(key)) {
    return { employeeType: 'Production' };
  }

  return {
    employeeType: 'Artist',
    warning: `Unrecognized Employee Type "${original}". Defaulted to "Artist". Allowed: Artist, Lead, Supervisor, Production.`,
  };
}

// POST import resource members from Excel
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    
    if (user.role !== 'ADMIN' && user.role !== 'COORDINATOR' && user.role !== 'RESOURCE') {
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
      const employeeTypeRaw = row['Employee Type'] || row['employeeType'] || row['Type'] || 'Artist';
      const normalizedEmployeeType = normalizeEmployeeType(employeeTypeRaw);
      if (normalizedEmployeeType.warning) {
        errors.push(`Row ${rowNum}: ${normalizedEmployeeType.warning}`);
      }
      const activeRaw = row['Active'] ?? row['active'] ?? row['Is Active'] ?? row['isActive'];
      const parsedActive = parseBooleanLike(activeRaw);
      const isActive = parsedActive ?? true;

      members.push({
        empId: String(empId).trim(),
        empName: String(empName).trim(),
        designation: String(designation).trim(),
        reportingTo: reportingTo ? String(reportingTo).trim() : null,
        department: String(department).trim(),
        shift: String(shift).trim(),
        employeeType: normalizedEmployeeType.employeeType,
        isActive,
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
      select: { 
        id: true,
        empId: true,
        isActive: true
      }
    });

    const existingMap = new Map(existingMembers.map(m => [m.empId, m]));
    
    // Separate new members from existing ones
    const newMembers = members.filter(m => !existingMap.has(m.empId));
    const updateMembers = members.filter(m => existingMap.has(m.empId));

    // If there are file duplicates, block the import
    if (duplicates.length > 0) {
      return NextResponse.json({
        error: 'Import validation failed',
        errors,
        preview: members.slice(0, 5),
      }, { status: 400 });
    }

    let created = 0;
    let updated = 0;
    let reactivated = 0;

    // Create new members
    if (newMembers.length > 0) {
      const result = await prisma.resourceMember.createMany({
        data: newMembers,
      });
      created = result.count;
    }

    // Update existing members (reactivate if inactive, update details)
    for (const member of updateMembers) {
      const existing = existingMap.get(member.empId)!;
      await prisma.resourceMember.update({
        where: { id: existing.id },
        data: {
          empName: member.empName,
          designation: member.designation,
          reportingTo: member.reportingTo,
          department: member.department,
          shift: member.shift,
          employeeType: member.employeeType,
          isActive: member.isActive,
        }
      });
      updated++;
      if (!existing.isActive && member.isActive) {
        reactivated++;
      }
    }

    const messages = [];
    if (created > 0) messages.push(`${created} new members created`);
    if (updated > 0) messages.push(`${updated} existing members updated`);
    if (reactivated > 0) messages.push(`${reactivated} inactive members reactivated`);

    return NextResponse.json({
      success: true,
      imported: created,
      updated,
      reactivated,
      total: members.length,
      message: messages.join(', '),
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error importing resource members:', error);
    return NextResponse.json({ error: 'Failed to import resource members' }, { status: 500 });
  }
}
