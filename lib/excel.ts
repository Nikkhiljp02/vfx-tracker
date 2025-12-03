import * as XLSX from 'xlsx';
import { Show, Shot, Task } from './types';

// Robust date parser that handles multiple formats
// Supports: "2025-12-10", "12-Dec-25", "12-Dec", "10/12/2025", "10-12-2025", Excel serial numbers
// Returns ISO date string (YYYY-MM-DD) to avoid timezone issues
function parseFlexibleDate(value: any): string | null {
  if (!value) return null;
  
  // Helper to format as YYYY-MM-DD
  const formatDate = (year: number, month: number, day: number): string => {
    const y = year.toString();
    const m = (month + 1).toString().padStart(2, '0');
    const d = day.toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  
  // If it's already a valid Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    // Use local date components to avoid timezone shift
    return formatDate(value.getFullYear(), value.getMonth(), value.getDate());
  }
  
  // If it's an Excel serial number (number between 1 and 100000)
  if (typeof value === 'number' && value > 0 && value < 100000) {
    // Excel epoch starts from Dec 30, 1899 (in UTC to avoid timezone issues)
    // Using UTC calculation to get correct date
    const excelEpoch = Date.UTC(1899, 11, 30);
    const msPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch + value * msPerDay);
    if (!isNaN(date.getTime())) {
      return formatDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
    }
  }
  
  const str = value.toString().trim();
  if (!str) return null;
  
  // Check if it's already an ISO date string (YYYY-MM-DD or with time)
  const isoDateOnly = /^(\d{4})-(\d{2})-(\d{2})$/;
  const isoMatch = str.match(isoDateOnly);
  if (isoMatch) {
    return str; // Already in correct format
  }
  
  // Check if it's an ISO datetime string (from previous toISOString calls)
  const isoDateTime = /^(\d{4})-(\d{2})-(\d{2})T/;
  const isoDateTimeMatch = str.match(isoDateTime);
  if (isoDateTimeMatch) {
    return `${isoDateTimeMatch[1]}-${isoDateTimeMatch[2]}-${isoDateTimeMatch[3]}`;
  }
  
  const months: Record<string, number> = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11,
  };
  
  const currentYear = new Date().getFullYear();
  
  // Try different date patterns
  let year: number | null = null;
  let month: number | null = null;
  let day: number | null = null;
  
  // Pattern: "12-Dec-25" or "12-Dec-2025" or "12-Dec"
  const ddMmmYyPattern = /^(\d{1,2})[-\/]([a-zA-Z]{3,9})(?:[-\/](\d{2,4}))?$/i;
  let match = str.match(ddMmmYyPattern);
  if (match) {
    day = parseInt(match[1]);
    const monthStr = match[2].toLowerCase();
    month = months[monthStr];
    year = match[3] ? parseInt(match[3]) : currentYear;
    if (year < 100) year += 2000;
  }
  
  // Pattern: "Dec-12-25" or "Dec-12-2025" or "Dec-12"
  if (month === null) {
    const mmmDdYyPattern = /^([a-zA-Z]{3,9})[-\/](\d{1,2})(?:[-\/](\d{2,4}))?$/i;
    match = str.match(mmmDdYyPattern);
    if (match) {
      const monthStr = match[1].toLowerCase();
      month = months[monthStr];
      day = parseInt(match[2]);
      year = match[3] ? parseInt(match[3]) : currentYear;
      if (year < 100) year += 2000;
    }
  }
  
  // Pattern: "2025-12-10" (ISO format) - already handled above, but just in case
  if (month === null) {
    const isoPattern = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/;
    match = str.match(isoPattern);
    if (match) {
      year = parseInt(match[1]);
      month = parseInt(match[2]) - 1;
      day = parseInt(match[3]);
    }
  }
  
  // Pattern: "10/12/2025" or "10-12-2025" (DD/MM/YYYY)
  if (month === null) {
    const ddMmYyyyPattern = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})$/;
    match = str.match(ddMmYyyyPattern);
    if (match) {
      day = parseInt(match[1]);
      month = parseInt(match[2]) - 1;
      year = parseInt(match[3]);
      if (year < 100) year += 2000;
    }
  }
  
  // Validate and return
  if (year !== null && month !== null && day !== null && 
      month >= 0 && month <= 11 && day >= 1 && day <= 31 &&
      year >= 1970 && year <= 2100) {
    return formatDate(year, month, day);
  }
  
  // Try native Date parsing as last resort
  const nativeDate = new Date(str);
  if (!isNaN(nativeDate.getTime()) && nativeDate.getFullYear() > 1970) {
    return formatDate(nativeDate.getFullYear(), nativeDate.getMonth(), nativeDate.getDate());
  }
  
  return null;
}

// Format date to d-MMM-yy format (e.g., "4-Dec-25") for display
function formatDateDisplay(date: Date | null): string {
  if (!date || isNaN(date.getTime())) return '';
  
  const day = date.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const year = date.getFullYear().toString().slice(-2);
  
  return `${day}-${month}-${year}`;
}

// Helper to safely format date for export without timezone shift
function safeFormatDate(date: any): string {
  if (!date) return '';
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
          'Internal ETA': safeFormatDate(task.internalEta),
          'Client ETA': safeFormatDate(task.clientEta),
          'Delivered Version': task.deliveredVersion || '',
          'Delivered Date': safeFormatDate(task.deliveredDate),
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
        // Use cellDates: true to parse dates as Date objects
        const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
        
        // Read the first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON - use raw: true to get native Date objects
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true });
        
        // Process each row to parse dates properly
        const processedData = jsonData.map((row: any) => {
          const processedRow = { ...row };
          
          // Parse date fields using our flexible parser (returns YYYY-MM-DD string)
          ['Internal ETA', 'Client ETA', 'Delivered Date'].forEach(field => {
            if (processedRow[field] !== undefined && processedRow[field] !== null && processedRow[field] !== '') {
              processedRow[field] = parseFlexibleDate(processedRow[field]);
            }
          });
          
          return processedRow;
        });
        
        resolve(processedData);
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
        internalEta: parseFlexibleDate(row['Internal ETA']),
        clientEta: parseFlexibleDate(row['Client ETA']),
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
// Uses Show Name + Shot Name + Shot Tag as unique identifier for shots
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
  const processedShots = new Set<string>(); // Track which shots we've added shot-level updates for

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
    const shotTag = row['Shot Tag']?.toString().trim() || null;
    const department = row['Department']?.toString().trim();

    const show = showsMap.get(showName);
    if (!show) {
      errors.push(`Row ${rowNum}: Show "${showName}" not found`);
      return;
    }

    // Find shot by Show Name + Shot Name + Shot Tag (tag is optional match)
    let shot = show.shots?.find(s => {
      const nameMatch = s.shotName === shotName;
      // If shotTag is provided in the import, match it; otherwise just match by name
      if (shotTag) {
        return nameMatch && s.shotTag === shotTag;
      }
      return nameMatch;
    });
    
    if (!shot) {
      errors.push(`Row ${rowNum}: Shot "${shotName}"${shotTag ? ` with tag "${shotTag}"` : ''} not found in show "${showName}"`);
      return;
    }

    // Create a unique key for this shot to avoid duplicate shot updates
    const shotKey = `${show.id}|${shot.id}`;

    // Always check for shot-level updates (once per shot)
    if (!processedShots.has(shotKey)) {
      const shotUpdateData: any = {};
      
      // Shot Tag update
      if (row['Shot Tag'] !== undefined && row['Shot Tag'] !== shot.shotTag) {
        shotUpdateData.shotTag = row['Shot Tag']?.toString().trim() || 'Fresh';
      }
      
      // Scope of Work - support multiple column names
      const sowValue = row['Scope of Work'] ?? row['SOW'] ?? row['sow'];
      if (sowValue !== undefined) {
        shotUpdateData.scopeOfWork = sowValue?.toString().trim() || '';
      }
      
      // Episode
      if (row['EP'] !== undefined) {
        shotUpdateData.episode = row['EP']?.toString().trim() || null;
      }
      
      // Sequence
      if (row['SEQ'] !== undefined) {
        shotUpdateData.sequence = row['SEQ']?.toString().trim() || null;
      }
      
      // Turnover
      if (row['TO'] !== undefined) {
        shotUpdateData.turnover = row['TO']?.toString().trim() || null;
      }
      
      // Frames
      if (row['Frames'] !== undefined) {
        const frames = row['Frames'];
        shotUpdateData.frames = frames ? parseInt(frames.toString()) : null;
      }
      
      // Remark
      if (row['Remark'] !== undefined) {
        shotUpdateData.remark = row['Remark']?.toString().trim() || null;
      }

      if (Object.keys(shotUpdateData).length > 0) {
        updates.push({
          shotId: shot.id,
          updateData: shotUpdateData,
        });
      }
      
      processedShots.add(shotKey);
    }

    // If department is provided, also update the task
    if (department) {
      const isInternal = row['Is Internal']?.toString().toLowerCase() === 'yes';
      const task = shot.tasks?.find(t => 
        t.department === department && t.isInternal === isInternal
      );

      if (!task) {
        errors.push(`Row ${rowNum}: Task for ${isInternal ? 'Internal ' : ''}${department} not found in shot "${shotName}"`);
        return;
      }

      const taskUpdateData: any = {};
      if (row['Status'] !== undefined) taskUpdateData.status = row['Status']?.toString().trim() || '';
      if (row['Lead Name'] !== undefined) taskUpdateData.leadName = row['Lead Name']?.toString().trim() || null;
      if (row['Bid (MDs)'] !== undefined) {
        const bid = row['Bid (MDs)'];
        taskUpdateData.bidMds = bid ? parseFloat(bid.toString()) : null;
      }
      // Parse dates using flexible parser (returns YYYY-MM-DD string)
      if (row['Internal ETA'] !== undefined) {
        taskUpdateData.internalEta = parseFlexibleDate(row['Internal ETA']);
      }
      if (row['Client ETA'] !== undefined) {
        taskUpdateData.clientEta = parseFlexibleDate(row['Client ETA']);
      }
      if (row['Delivered Version'] !== undefined) taskUpdateData.deliveredVersion = row['Delivered Version']?.toString().trim() || null;
      if (row['Delivered Date'] !== undefined) {
        taskUpdateData.deliveredDate = parseFlexibleDate(row['Delivered Date']);
      }

      if (Object.keys(taskUpdateData).length > 0) {
        updates.push({
          taskId: task.id,
          updateData: taskUpdateData,
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
