import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const isAdminOrCoordinator = user.role === 'ADMIN' || 
                                  user.role === 'COORDINATOR' || 
                                  user.role === 'PRODUCTION COORDINATOR' ||
                                  user.role?.toUpperCase().includes('COORDINATOR');

    if (!isAdminOrCoordinator) {
      return NextResponse.json({ error: 'Forbidden - Admin/Coordinator only' }, { status: 403 });
    }

    const { metrics, filters, dateRange, format: exportFormat } = await request.json();

    // Fetch data based on metrics
    const reportData = await generateReportData(metrics, filters, dateRange);

    if (exportFormat === 'excel') {
      const buffer = await generateExcelReport(reportData, metrics);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="report-${Date.now()}.xlsx"`,
        },
      });
    } else if (exportFormat === 'pdf') {
      // PDF generation would go here (requires additional library like pdfkit)
      return NextResponse.json({ error: 'PDF export coming soon' }, { status: 501 });
    } else if (exportFormat === 'csv') {
      const csv = generateCSVReport(reportData, metrics);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="report-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });

  } catch (error) {
    console.error('Error exporting report:', error);
    return NextResponse.json({ error: 'Failed to export report' }, { status: 500 });
  }
}

async function generateReportData(metrics: string[], filters: any[], dateRange: any) {
  const data: any = {};

  // Fetch shows
  if (metrics.includes('m1')) {
    data.totalShows = await prisma.show.count({ where: { isActive: true } });
  }

  // Fetch shots
  if (metrics.includes('m2')) {
    data.totalShots = await prisma.shot.count();
  }

  // Fetch tasks
  if (metrics.includes('m3') || metrics.includes('m9') || metrics.includes('m10')) {
    const tasks = await prisma.task.findMany({
      select: {
        id: true,
        department: true,
        status: true,
      },
    });
    data.tasks = tasks;
    data.completedTasks = tasks.filter(t => t.status === 'C APP' || t.status === 'C KB').length;
    data.totalTasks = tasks.length;
  }

  // Fetch resources
  if (metrics.includes('m4') || metrics.includes('m5') || metrics.includes('m6')) {
    const members = await prisma.resourceMember.count({ where: { isActive: true } });
    data.activeArtists = members;

    const allocations = await prisma.resourceAllocation.findMany({
      where: {
        isLeave: false,
        isIdle: false,
      },
      select: {
        manDays: true,
      },
    });
    data.totalManDays = allocations.reduce((sum, a) => sum + a.manDays, 0);
  }

  return data;
}

async function generateExcelReport(data: any, metrics: string[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Report');

  // Add title
  worksheet.addRow(['Custom Analytics Report']);
  worksheet.addRow([`Generated: ${format(new Date(), 'PPpp')}`]);
  worksheet.addRow([]);

  // Add metrics
  worksheet.addRow(['Metric', 'Value']);
  
  const metricNames: any = {
    m1: 'Total Shows',
    m2: 'Total Shots',
    m3: 'Completed Tasks',
    m4: 'Active Artists',
    m5: 'Total Man-Days',
    m9: 'Task Completion Rate',
  };

  metrics.forEach(metricId => {
    const name = metricNames[metricId] || metricId;
    let value: any = '-';
    
    if (metricId === 'm1' && data.totalShows !== undefined) value = data.totalShows;
    if (metricId === 'm2' && data.totalShots !== undefined) value = data.totalShots;
    if (metricId === 'm3' && data.completedTasks !== undefined) value = data.completedTasks;
    if (metricId === 'm4' && data.activeArtists !== undefined) value = data.activeArtists;
    if (metricId === 'm5' && data.totalManDays !== undefined) value = data.totalManDays;
    if (metricId === 'm9' && data.totalTasks && data.completedTasks) {
      value = `${Math.round((data.completedTasks / data.totalTasks) * 100)}%`;
    }
    
    worksheet.addRow([name, value]);
  });

  // Style the header
  worksheet.getRow(1).font = { bold: true, size: 16 };
  worksheet.getRow(4).font = { bold: true };
  worksheet.getColumn(1).width = 30;
  worksheet.getColumn(2).width = 20;

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as Buffer;
}

function generateCSVReport(data: any, metrics: string[]): string {
  let csv = 'Metric,Value\n';
  
  const metricNames: any = {
    m1: 'Total Shows',
    m2: 'Total Shots',
    m3: 'Completed Tasks',
    m4: 'Active Artists',
    m5: 'Total Man-Days',
    m9: 'Task Completion Rate',
  };

  metrics.forEach(metricId => {
    const name = metricNames[metricId] || metricId;
    let value: any = '-';
    
    if (metricId === 'm1' && data.totalShows !== undefined) value = data.totalShows;
    if (metricId === 'm2' && data.totalShots !== undefined) value = data.totalShots;
    if (metricId === 'm3' && data.completedTasks !== undefined) value = data.completedTasks;
    if (metricId === 'm4' && data.activeArtists !== undefined) value = data.activeArtists;
    if (metricId === 'm5' && data.totalManDays !== undefined) value = data.totalManDays;
    if (metricId === 'm9' && data.totalTasks && data.completedTasks) {
      value = `${Math.round((data.completedTasks / data.totalTasks) * 100)}%`;
    }
    
    csv += `${name},${value}\n`;
  });

  return csv;
}
