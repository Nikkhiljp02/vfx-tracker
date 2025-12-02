import * as XLSX from 'xlsx';
import { Show, Shot, Task } from './types';

// Export tracker data to Excel
export function exportToExcel(shows: Show[], filename: string = 'vfx_tracker_export.xlsx') {
  const workbook = XLSX.utils.book_new();

  // Create shots sheet
  const shotsData: any[] = [];
  
  shows.forEach((show) => {
    show.shots?.forEach((shot) => {
      shot.tasks?.forEach((task) => {
        shotsData.push({
          'Show Name': show.showName,
          'Client': show.clientName || '',
          'Shot Name': shot.shotName,
          'Shot Tag': shot.shotTag,
          'Scope of Work': shot.scopeOfWork || '',
          'Department': task.department,
          'Is Internal': task.isInternal ? 'Yes' : 'No',
          'Status': task.status,
          'Lead Name': task.leadName || '',
          'Bid (MDs)': task.bidMds || '',
          'Internal ETA': task.internalEta ? new Date(task.internalEta).toISOString().split('T')[0] : '',
          'Client ETA': task.clientEta ? new Date(task.clientEta).toISOString().split('T')[0] : '',
          'Delivered Version': task.deliveredVersion || '',
          'Delivered Date': task.deliveredDate ? new Date(task.deliveredDate).toISOString().split('T')[0] : '',
        });
      });

      // If shot has no tasks, add empty row
      if (!shot.tasks || shot.tasks.length === 0) {
        shotsData.push({
          'Show Name': show.showName,
          'Client': show.clientName || '',
          'Shot Name': shot.shotName,
          'Shot Tag': shot.shotTag,
          'Scope of Work': shot.scopeOfWork || '',
          'Department': '',
          'Is Internal': '',
          'Status': '',
          'Lead Name': '',
          'Bid (MDs)': '',
          'Internal ETA': '',
          'Client ETA': '',
          'Delivered Version': '',
          'Delivered Date': '',
        });
      }
    });
  });

  const shotsSheet = XLSX.utils.json_to_sheet(shotsData);
  
  // Set column widths
  shotsSheet['!cols'] = [
    { wch: 15 }, // Show Name
    { wch: 15 }, // Client
    { wch: 15 }, // Shot Name
    { wch: 12 }, // Shot Tag
    { wch: 30 }, // Scope of Work
    { wch: 12 }, // Department
    { wch: 12 }, // Is Internal
    { wch: 10 }, // Status
    { wch: 15 }, // Lead Name
    { wch: 10 }, // Bid (MDs)
    { wch: 12 }, // Internal ETA
    { wch: 12 }, // Client ETA
    { wch: 15 }, // Delivered Version
    { wch: 15 }, // Delivered Date
  ];

  XLSX.utils.book_append_sheet(workbook, shotsSheet, 'Shots');

  // Create shows summary sheet
  const showsSummary = shows.map((show) => ({
    'Show Name': show.showName,
    'Client': show.clientName || '',
    'Status': show.status,
    'Departments': JSON.parse(show.departments).join(', '),
    'Total Shots': show.shots?.length || 0,
    'Notes': show.notes || '',
  }));

  const showsSheet = XLSX.utils.json_to_sheet(showsSummary);
  showsSheet['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 10 },
    { wch: 25 },
    { wch: 12 },
    { wch: 30 },
  ];

  XLSX.utils.book_append_sheet(workbook, showsSheet, 'Shows');

  // Write file
  XLSX.writeFile(workbook, filename);
}

// Parse Excel file for import
export function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // Read the first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsBinaryString(file);
  });
}

// Validate and transform imported data
export function validateImportData(data: any[]): { valid: boolean; errors: string[]; shows: any[] } {
  const errors: string[] = [];
  const showsMap = new Map<string, any>();

  // Log the first row's keys to debug column names
  if (data.length > 0) {
    console.log('Excel column names found:', Object.keys(data[0]));
    console.log('First row data:', data[0]);
  }

  data.forEach((row, index) => {
    const rowNum = index + 2; // Excel row number (1-indexed + header)

    // Validate required fields
    if (!row['Show Name']) {
      errors.push(`Row ${rowNum}: Show Name is required`);
      return;
    }
    if (!row['Shot Name']) {
      errors.push(`Row ${rowNum}: Shot Name is required`);
      return;
    }

    const showName = row['Show Name'].toString().trim();
    const shotName = row['Shot Name'].toString().trim();

    // Get or create show
    if (!showsMap.has(showName)) {
      showsMap.set(showName, {
        showName,
        clientName: row['Client']?.toString().trim() || '',
        departments: [],
        shots: [],
      });
    }

    const show = showsMap.get(showName)!;

    // Find or create shot
    let shot = show.shots.find((s: any) => s.shotName === shotName);
    if (!shot) {
      // Support multiple column names for SOW
      const sowValue = row['Scope of Work'] || row['SOW'] || row['sow'] || row['Sow'] || row['scope of work'] || '';
      
      shot = {
        shotName,
        episode: row['EP']?.toString().trim() || null,
        sequence: row['SEQ']?.toString().trim() || null,
        turnover: row['TO']?.toString().trim() || null,
        shotTag: row['Shot Tag']?.toString().trim() || 'Fresh',
        scopeOfWork: sowValue?.toString().trim() || '',
        tasks: [],
      };
      show.shots.push(shot);
    }

    // Add task if department exists
    if (row['Department']) {
      const department = row['Department'].toString().trim();
      
      // Add department to show if not exists
      if (!show.departments.includes(department)) {
        show.departments.push(department);
      }

      const task = {
        department,
        isInternal: row['Is Internal']?.toString().toLowerCase() === 'yes',
        status: row['Status']?.toString().trim() || 'YTS',
        leadName: row['Lead Name']?.toString().trim() || null,
        bidMds: row['Bid (MDs)'] ? parseFloat(row['Bid (MDs)'].toString()) : null,
        internalEta: row['Internal ETA'] ? row['Internal ETA'] : null,
        clientEta: row['Client ETA'] ? row['Client ETA'] : null,
      };

      shot.tasks.push(task);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    shows: Array.from(showsMap.values()),
  };
}

// Download template Excel file
export function downloadTemplate() {
  const templateData = [
    {
      'Show Name': 'Example Show',
      'Client': 'Example Client',
      'Shot Name': 'Shot_001',
      'Shot Tag': 'Fresh',
      'Scope of Work': 'Remove wires and add CG elements',
      'Department': 'Comp',
      'Is Internal': 'No',
      'Status': 'YTS',
      'Lead Name': 'John Doe',
      'Bid (MDs)': '2.5',
      'Internal ETA': '2025-11-15',
      'Client ETA': '2025-11-20',
      'Delivered Version': '',
      'Delivered Date': '',
    },
    {
      'Show Name': 'Example Show',
      'Client': 'Example Client',
      'Shot Name': 'Shot_001',
      'Shot Tag': 'Fresh',
      'Scope of Work': 'Remove wires and add CG elements',
      'Department': 'Paint',
      'Is Internal': 'Yes',
      'Status': 'YTS',
      'Lead Name': 'Jane Smith',
      'Bid (MDs)': '1.0',
      'Internal ETA': '2025-11-12',
      'Client ETA': '',
      'Delivered Version': '',
      'Delivered Date': '',
    },
  ];

  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(templateData);
  
  sheet['!cols'] = [
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 12 },
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, 'Template');
  XLSX.writeFile(workbook, 'vfx_tracker_template.xlsx');
}

// Validate and prepare update data
export function validateUpdateData(data: any[], existingShows: Show[]): { 
  valid: boolean; 
  errors: string[]; 
  updates: Array<{
    showId?: string;
    shotId?: string;
    taskId?: string;
    updateData: any;
  }>;
} {
  const errors: string[] = [];
  const updates: Array<any> = [];

  // Create lookup maps
  const showsMap = new Map(existingShows.map(s => [s.showName, s]));

  data.forEach((row, index) => {
    const rowNum = index + 2;

    if (!row['Show Name'] || !row['Shot Name']) {
      errors.push(`Row ${rowNum}: Show Name and Shot Name are required`);
      return;
    }

    const showName = row['Show Name'].toString().trim();
    const shotName = row['Shot Name'].toString().trim();
    const department = row['Department']?.toString().trim();

    const show = showsMap.get(showName);
    if (!show) {
      errors.push(`Row ${rowNum}: Show "${showName}" not found`);
      return;
    }

    const shot = show.shots?.find(s => s.shotName === shotName);
    if (!shot) {
      errors.push(`Row ${rowNum}: Shot "${shotName}" not found in show "${showName}"`);
      return;
    }

    if (department) {
      // Update task
      const isInternal = row['Is Internal']?.toString().toLowerCase() === 'yes';
      const task = shot.tasks?.find(t => 
        t.department === department && t.isInternal === isInternal
      );

      if (!task) {
        errors.push(`Row ${rowNum}: Task for ${isInternal ? 'Internal ' : ''}${department} not found in shot "${shotName}"`);
        return;
      }

      const updateData: any = {};
      if (row['Status']) updateData.status = row['Status'].toString().trim();
      if (row['Lead Name']) updateData.leadName = row['Lead Name'].toString().trim();
      if (row['Bid (MDs)']) updateData.bidMds = parseFloat(row['Bid (MDs)'].toString());
      if (row['Internal ETA']) updateData.internalEta = row['Internal ETA'];
      if (row['Client ETA']) updateData.clientEta = row['Client ETA'];
      if (row['Delivered Version']) updateData.deliveredVersion = row['Delivered Version'].toString().trim();

      if (Object.keys(updateData).length > 0) {
        updates.push({
          taskId: task.id,
          updateData,
        });
      }
    } else {
      // Update shot only
      const updateData: any = {};
      if (row['Shot Tag']) updateData.shotTag = row['Shot Tag'].toString().trim();
      if (row['Scope of Work'] !== undefined) updateData.scopeOfWork = row['Scope of Work']?.toString().trim() || '';

      if (Object.keys(updateData).length > 0) {
        updates.push({
          shotId: shot.id,
          updateData,
        });
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    updates,
  };
}
