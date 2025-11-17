import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';
import * as XLSX from 'xlsx';

interface ConflictData {
  row: any;
  existing: any[];
  suggested: any;
  rowNum: number;
}

// POST import resource allocations from Excel
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
    const isPreview = formData.get('preview') === 'true';
    const mergeStrategy = formData.get('mergeStrategy') as 'replace' | 'add' | 'skip' || 'replace';

    console.log('Import API called - Preview mode:', isPreview, 'Merge strategy:', mergeStrategy);

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
    const validRows: any[] = [];
    const conflicts: ConflictData[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    for (let i = 0; i < data.length; i++) {
      const row: any = data[i];
      const rowNum = i + 2; // Excel row (1-indexed + header)

      // Required fields validation
      const empId = row['Emp ID'] || row['empId'] || row['Employee ID'];
      const action = row['Action'] || row['action'] || 'NEW';
      const showName = row['Show Name'] || row['showName'] || row['Show'] || '';
      const shotName = row['Shot Name'] || row['shotName'] || row['Shot'] || '';
      const startDate = row['Start Date'] || row['startDate'];
      const endDate = row['End Date'] || row['endDate'];
      const totalMD = row['Total MD'] || row['totalMD'] || row['Man Days'] || row['manDays'] || row['MD'] || 0;

      if (!empId) {
        errors.push(`Row ${rowNum}: Missing Emp ID`);
        continue;
      }

      if (!startDate || !endDate) {
        errors.push(`Row ${rowNum}: Missing Start Date or End Date`);
        continue;
      }

      // Find resource member by empId
      const member = await prisma.resourceMember.findUnique({
        where: { empId: String(empId).trim() }
      });

      if (!member) {
        errors.push(`Row ${rowNum}: Employee ${empId} not found`);
        continue;
      }

      // Parse dates
      let start: Date;
      let end: Date;
      
      try {
        // Handle Excel date serial numbers
        if (typeof startDate === 'number') {
          const parsedStart = XLSX.SSF.parse_date_code(startDate);
          start = new Date(parsedStart.y, parsedStart.m - 1, parsedStart.d);
        } else {
          start = new Date(startDate);
        }

        if (typeof endDate === 'number') {
          const parsedEnd = XLSX.SSF.parse_date_code(endDate);
          end = new Date(parsedEnd.y, parsedEnd.m - 1, parsedEnd.d);
        } else {
          end = new Date(endDate);
        }
      } catch (e) {
        errors.push(`Row ${rowNum}: Invalid date format`);
        continue;
      }

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        errors.push(`Row ${rowNum}: Invalid dates`);
        continue;
      }

      if (end < start) {
        errors.push(`Row ${rowNum}: End Date cannot be before Start Date`);
        continue;
      }

      // Calculate days and per-day MD
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const totalMDValue = parseFloat(totalMD);
      
      if (isNaN(totalMDValue) || totalMDValue < 0) {
        errors.push(`Row ${rowNum}: Total MD must be a positive number`);
        continue;
      }

      const perDayMD = totalMDValue / days;
      
      if (perDayMD > 1.0) {
        errors.push(`Row ${rowNum}: Per-day MD (${perDayMD.toFixed(2)}) exceeds 1.0. Total MD ${totalMDValue} / ${days} days = ${perDayMD.toFixed(2)}`);
        continue;
      }

      // Check for leave/idle flags
      const isLeave = row['Is Leave'] === true || row['isLeave'] === true || String(row['Leave']).toLowerCase() === 'yes';
      const isIdle = row['Is Idle'] === true || row['isIdle'] === true || String(row['Idle']).toLowerCase() === 'yes';
      const notes = row['Notes'] || row['notes'] || null;

      // Check for conflicts with existing allocations
      const existing = await prisma.resourceAllocation.findMany({
        where: {
          resourceId: member.id,
          allocationDate: {
            gte: start,
            lte: end,
          }
        }
      });

      const rowData = {
        empId: member.empId,
        empName: member.empName,
        showName: String(showName).trim(),
        shotName: String(shotName).trim(),
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        days,
        totalMD: totalMDValue,
        manDays: perDayMD,
        isLeave,
        isIdle,
        notes,
        action: String(action).toUpperCase(),
        resourceId: member.id,
      };

      if (existing.length > 0 && action.toUpperCase() !== 'NEW') {
        conflicts.push({
          row: rowData,
          existing: existing.map(e => ({
            showName: e.showName,
            shotName: e.shotName,
            allocationDate: e.allocationDate.toISOString().split('T')[0],
            manDays: e.manDays,
          })),
          suggested: rowData,
          rowNum,
        });
      } else {
        validRows.push(rowData);
      }
    }

    // If preview mode, return analysis
    if (isPreview) {
      console.log('Returning preview data:', {
        validCount: validRows.length,
        conflictsCount: conflicts.length,
        errorsCount: errors.length,
        warningsCount: warnings.length
      });
      return NextResponse.json({
        preview: {
          valid: validRows,
          conflicts,
          errors,
          warnings,
        }
      });
    }

    // Apply merge strategy to conflicts
    let rowsToImport = [...validRows];
    let replacedCount = 0;
    let skippedCount = 0;
    
    if (conflicts.length > 0) {
      if (mergeStrategy === 'replace') {
        // Delete existing allocations for conflicted date ranges, then add new
        for (const conflict of conflicts) {
          const start = new Date(conflict.suggested.startDate);
          const end = new Date(conflict.suggested.endDate);
          
          await prisma.resourceAllocation.deleteMany({
            where: {
              resourceId: conflict.suggested.resourceId,
              allocationDate: {
                gte: start,
                lte: end,
              }
            }
          });
          
          replacedCount++;
          rowsToImport.push(conflict.suggested);
        }
      } else if (mergeStrategy === 'add') {
        // Just add alongside existing
        rowsToImport.push(...conflicts.map(c => c.suggested));
      } else if (mergeStrategy === 'skip') {
        // Skip conflicts
        skippedCount = conflicts.length;
      }
    }

    if (rowsToImport.length === 0) {
      return NextResponse.json({
        error: 'No rows to import after applying merge strategy',
        skipped: skippedCount,
      }, { status: 400 });
    }

    // Generate daily allocations from row data
    const allocations: any[] = [];
    for (const rowData of rowsToImport) {
      const start = new Date(rowData.startDate);
      const end = new Date(rowData.endDate);
      const current = new Date(start);
      
      while (current <= end) {
        allocations.push({
          resourceId: rowData.resourceId,
          showName: rowData.showName,
          shotName: rowData.shotName,
          allocationDate: new Date(current),
          manDays: rowData.manDays,
          isLeave: rowData.isLeave,
          isIdle: rowData.isIdle,
          notes: rowData.notes,
          createdBy: user.id,
        });
        current.setDate(current.getDate() + 1);
      }
    }

    // Validate daily totals don't exceed 1.0 MD
    const dailyTotals = new Map<string, number>();
    for (const allocation of allocations) {
      const key = `${allocation.resourceId}-${allocation.allocationDate.toISOString().split('T')[0]}`;
      const current = dailyTotals.get(key) || 0;
      
      // Check against existing allocations in DB (after replacements)
      const existing = await prisma.resourceAllocation.findMany({
        where: {
          resourceId: allocation.resourceId,
          allocationDate: allocation.allocationDate,
        }
      });
      
      const existingTotal = existing.reduce((sum, a) => sum + a.manDays, 0);
      const newTotal = current + allocation.manDays + existingTotal;
      
      if (newTotal > 1.0) {
        const memberInfo = await prisma.resourceMember.findUnique({
          where: { id: allocation.resourceId },
          select: { empName: true, empId: true }
        });
        warnings.push(
          `${memberInfo?.empName || allocation.resourceId} on ${allocation.allocationDate.toLocaleDateString()}: Total MD would be ${newTotal.toFixed(2)} (limit: 1.0)`
        );
      }
      
      dailyTotals.set(key, current + allocation.manDays);
    }

    // Create all allocations
    const created = await prisma.resourceAllocation.createMany({
      data: allocations,
    });

    return NextResponse.json({
      success: true,
      imported: created.count,
      total: rowsToImport.length,
      conflicts: conflicts.length,
      replaced: replacedCount,
      skipped: skippedCount,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error('Error importing allocations:', error);
    return NextResponse.json({ error: 'Failed to import allocations' }, { status: 500 });
  }
}
