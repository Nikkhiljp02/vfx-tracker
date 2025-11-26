import { google } from 'googleapis';
import { Show, Shot, Task } from './types';

// Google Sheets configuration
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// Initialize Google Auth
export function getGoogleAuth() {
  const credentials = {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uris: [process.env.NEXTAUTH_URL + '/api/google-sheets/callback'],
  };

  if (!credentials.client_id || !credentials.client_secret) {
    console.error('[Google Auth] Missing credentials:', {
      hasClientId: !!credentials.client_id,
      hasClientSecret: !!credentials.client_secret,
      redirectUri: credentials.redirect_uris[0]
    });
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.');
  }

  const { client_id, client_secret, redirect_uris } = credentials;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  return oAuth2Client;
}

// Generate authorization URL
export function getAuthUrl() {
  const auth = getGoogleAuth();
  const authUrl = auth.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  });
  return authUrl;
}

// Exchange authorization code for tokens
export async function getTokensFromCode(code: string) {
  const auth = getGoogleAuth();
  const { tokens } = await auth.getToken(code);
  return tokens;
}

// Set credentials for authenticated requests
export function setCredentials(auth: any, tokens: any) {
  auth.setCredentials(tokens);
  return auth;
}

// Format data for Google Sheets (same as Excel export)
export function formatDataForSheets(shows: Show[]) {
  const rows: any[][] = [];
  
  // Header row
  rows.push([
    'Show Name',
    'Client',
    'Shot Name',
    'Shot Tag',
    'Scope of Work',
    'Department',
    'Is Internal',
    'Status',
    'Lead Name',
    'Bid (MDs)',
    'Internal ETA',
    'Client ETA',
    'Delivered Version',
    'Delivered Date',
    'Shot ID', // Hidden column for sync
    'Task ID', // Hidden column for sync
  ]);

  // Data rows
  shows.forEach((show) => {
    show.shots?.forEach((shot) => {
      shot.tasks?.forEach((task) => {
        rows.push([
          show.showName,
          show.clientName || '',
          shot.shotName,
          shot.shotTag,
          shot.scopeOfWork || '',
          task.department,
          task.isInternal ? 'Yes' : 'No',
          task.status,
          task.leadName || '',
          task.bidMds || '',
          task.internalEta ? new Date(task.internalEta).toISOString().split('T')[0] : '',
          task.clientEta ? new Date(task.clientEta).toISOString().split('T')[0] : '',
          task.deliveredVersion || '',
          task.deliveredDate ? new Date(task.deliveredDate).toISOString().split('T')[0] : '',
          shot.id, // Hidden
          task.id, // Hidden
        ]);
      });

      // If shot has no tasks
      if (!shot.tasks || shot.tasks.length === 0) {
        rows.push([
          show.showName,
          show.clientName || '',
          shot.shotName,
          shot.shotTag,
          shot.scopeOfWork || '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          shot.id,
          '',
        ]);
      }
    });
  });

  return rows;
}

// Create or update Google Sheet
export async function syncToGoogleSheets(
  auth: any,
  spreadsheetId: string | null,
  shows: Show[]
) {
  // Fix: Handle string "null" from database
  if (spreadsheetId === 'null' || spreadsheetId === '') {
    spreadsheetId = null;
  }
  console.log('[Google Sheets] Sync starting with spreadsheetId:', spreadsheetId);
  
  const sheets = google.sheets({ version: 'v4', auth });
  const data = formatDataForSheets(shows);

  let isNewSpreadsheet = false;
  let sheetName = 'Tracker Data';
  
  // Create new spreadsheet if none exists
  if (!spreadsheetId) {
    isNewSpreadsheet = true;
    console.log('[Google Sheets] Creating NEW spreadsheet...');
    try {
      const response = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `VFX Tracker - ${new Date().toISOString().split('T')[0]}`,
          },
          sheets: [
            {
              properties: {
                title: 'Tracker Data',
                gridProperties: {
                  frozenRowCount: 1,
                  rowCount: Math.max(1000, data.length + 10),
                  columnCount: 16,
                },
              },
              data: [
                {
                  startRow: 0,
                  startColumn: 0,
                  rowData: data.map(row => ({
                    values: row.map(cell => ({
                      userEnteredValue: { stringValue: String(cell || '') }
                    }))
                  }))
                }
              ]
            },
          ],
        },
      });

      spreadsheetId = response.data.spreadsheetId!;
      sheetName = response.data.sheets?.[0]?.properties?.title || 'Tracker Data';
      console.log('[Google Sheets] Created spreadsheet:', spreadsheetId);
    } catch (createError: any) {
      console.error('[Google Sheets] Failed to create spreadsheet:', createError.message);
      throw createError;
    }
  } else {
    console.log('[Google Sheets] Updating EXISTING spreadsheet:', spreadsheetId);
    
    // Get the actual first sheet name
    try {
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties.title'
      });
      sheetName = spreadsheetInfo.data.sheets?.[0]?.properties?.title || 'Sheet1';
      console.log('[Google Sheets] Using sheet name:', sheetName);
    } catch (e) {
      console.log('[Google Sheets] Could not get sheet name, using default');
      sheetName = 'Sheet1';
    }
    
    // For existing spreadsheets, clear and update
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${sheetName}'!A1:P`,
      });
    } catch (error: any) {
      console.log('[Google Sheets] Clear failed, will overwrite:', error.message);
    }

    // Update with new data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: data,
      },
    });
  }

  // Format the sheet
  await formatSheet(sheets, spreadsheetId, data.length);

  return spreadsheetId;
}

// Format the Google Sheet (styling, column widths, borders, status colors)
async function formatSheet(sheets: any, spreadsheetId: string, dataRowCount: number) {
  console.log('[Google Sheets Format] Starting formatting for', dataRowCount, 'rows');
  
  try {
    // Get the actual sheet ID first
    const spreadsheetMeta = await sheets.spreadsheets.get({ 
      spreadsheetId,
      fields: 'sheets.properties'
    });
    const firstSheet = spreadsheetMeta.data.sheets?.[0]?.properties;
    const sheetId = firstSheet?.sheetId || 0;
    const sheetName = firstSheet?.title || 'Sheet1';
    console.log('[Google Sheets Format] Sheet ID:', sheetId, 'Name:', sheetName);

    // Border style
    const borderStyle = {
      style: 'SOLID',
      width: 1,
      color: { red: 0.7, green: 0.7, blue: 0.7 },
    };

    // Build formatting requests
    const requests: any[] = [
      // Header row formatting (bold, background color, centered)
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.15, green: 0.3, blue: 0.5 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                bold: true,
                fontSize: 10,
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
        },
      },
      // Center align ALL data cells
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: dataRowCount,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
        },
      },
      // Add borders to all cells
      {
        updateBorders: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: dataRowCount,
            startColumnIndex: 0,
            endColumnIndex: 14,
          },
          top: borderStyle,
          bottom: borderStyle,
          left: borderStyle,
          right: borderStyle,
          innerHorizontal: borderStyle,
          innerVertical: borderStyle,
        },
      },
      // Auto-resize columns
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 14,
          },
        },
      },
      // Hide ID columns (O and P - columns 14 and 15)
      {
        updateDimensionProperties: {
          range: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: 14,
            endIndex: 16,
          },
          properties: {
            hiddenByUser: true,
          },
          fields: 'hiddenByUser',
        },
      },
      // Freeze first row
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      // Add data validation for Status column (column H, index 7)
      {
        setDataValidation: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            endRowIndex: dataRowCount,
            startColumnIndex: 7,
            endColumnIndex: 8,
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'YTS' },
                { userEnteredValue: 'WIP' },
                { userEnteredValue: 'Int App' },
                { userEnteredValue: 'AWF' },
                { userEnteredValue: 'C APP' },
                { userEnteredValue: 'C KB' },
                { userEnteredValue: 'OMIT' },
                { userEnteredValue: 'HOLD' },
              ],
            },
            showCustomUi: true,
            strict: false,
          },
        },
      },
    ];

    // Status color mapping
    const statusColorMap: Record<string, { red: number; green: number; blue: number }> = {
      'YTS': { red: 0.85, green: 0.85, blue: 0.85 },
      'WIP': { red: 1.0, green: 0.9, blue: 0.6 },
      'Int App': { red: 0.7, green: 0.85, blue: 1.0 },
      'AWF': { red: 0.8, green: 0.7, blue: 0.95 },
      'C APP': { red: 0.6, green: 0.9, blue: 0.6 },
      'C KB': { red: 1.0, green: 0.7, blue: 0.7 },
      'OMIT': { red: 0.6, green: 0.6, blue: 0.6 },
      'HOLD': { red: 1.0, green: 0.85, blue: 0.7 },
    };

    // First apply basic formatting
    console.log('[Google Sheets Format] Applying basic formatting requests:', requests.length);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
    console.log('[Google Sheets Format] Basic formatting applied');

    // Now read the data to get status values for color coding
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${sheetName}'!H2:H${dataRowCount}`,
    });
    const statusValues = dataResponse.data.values || [];
    console.log('[Google Sheets Format] Found', statusValues.length, 'status values for coloring');

    // Build color requests for each status cell
    const colorRequests: any[] = [];
    statusValues.forEach((row: string[], index: number) => {
      const status = row[0];
      if (status && statusColorMap[status]) {
        colorRequests.push({
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: index + 1, // +1 for header
              endRowIndex: index + 2,
              startColumnIndex: 7,
              endColumnIndex: 8,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: statusColorMap[status],
                textFormat: {
                  bold: true,
                },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        });
      }
    });

    if (colorRequests.length > 0) {
      console.log('[Google Sheets Format] Applying', colorRequests.length, 'status color requests');
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: colorRequests },
      });
      console.log('[Google Sheets Format] Status colors applied');
    }

    console.log('[Google Sheets Format] All formatting completed successfully');
  } catch (formatError: any) {
    console.error('[Google Sheets Format] Error:', formatError.message);
    console.error('[Google Sheets Format] Full error:', JSON.stringify(formatError.response?.data || formatError, null, 2));
  }
}

// Read changes from Google Sheets
export async function readFromGoogleSheets(auth: any, spreadsheetId: string) {
  const sheets = google.sheets({ version: 'v4', auth });

  // Try to read from the first sheet (whatever it's named)
  // First, get the sheet name
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || 'Sheet1';
  
  console.log('[Google Sheets Read] Reading from sheet:', firstSheetName);

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${firstSheetName}'!A2:P`, // Skip header row, use actual sheet name
  });

  const rows = response.data.values || [];
  console.log('[Google Sheets Read] Found', rows.length, 'rows');
  
  // Parse rows into changes
  const updates: any[] = [];

  rows.forEach((row, index) => {
    const [
      showName,
      client,
      shotName,
      shotTag,
      scopeOfWork,
      department,
      isInternal,
      status,
      leadName,
      bidMds,
      internalEta,
      clientEta,
      deliveredVersion,
      deliveredDate,
      shotId,
      taskId,
    ] = row;

    // Only process rows with task IDs (editable tasks)
    if (taskId) {
      updates.push({
        taskId,
        shotId,
        updates: {
          status: status || 'YTS',
          leadName: leadName || null,
          bidMds: bidMds ? parseFloat(bidMds) : null,
          internalEta: internalEta ? new Date(internalEta) : null,
          clientEta: clientEta ? new Date(clientEta) : null,
          deliveredVersion: deliveredVersion || null,
          deliveredDate: deliveredDate ? new Date(deliveredDate) : null,
        },
      });
    }
  });

  return updates;
}

// Compare and detect changes
export async function detectSheetChanges(
  auth: any,
  spreadsheetId: string,
  currentShows: Show[]
) {
  console.log('[Google Sheets Detect] Starting change detection...');
  const sheetUpdates = await readFromGoogleSheets(auth, spreadsheetId);
  console.log('[Google Sheets Detect] Sheet updates count:', sheetUpdates.length);
  const changes: any[] = [];

  // Create a map of current tasks for quick lookup
  const taskMap = new Map<string, Task>();
  currentShows.forEach(show => {
    show.shots?.forEach(shot => {
      shot.tasks?.forEach(task => {
        taskMap.set(task.id, task);
      });
    });
  });
  console.log('[Google Sheets Detect] Tasks in tracker:', taskMap.size);

  // Compare sheet data with current data
  sheetUpdates.forEach((update, index) => {
    const currentTask = taskMap.get(update.taskId);
    if (!currentTask) {
      console.log('[Google Sheets Detect] Task not found:', update.taskId);
      return;
    }

    const taskChanges: any = {};
    let hasChanges = false;

    // Check each field for changes - with detailed logging for first few
    if (index < 3) {
      console.log('[Google Sheets Detect] Comparing task:', update.taskId);
      console.log('[Google Sheets Detect] Sheet status:', update.updates.status, 'vs Tracker:', currentTask.status);
      console.log('[Google Sheets Detect] Sheet leadName:', update.updates.leadName, 'vs Tracker:', currentTask.leadName);
    }

    // Check each field for changes
    if (update.updates.status !== currentTask.status) {
      taskChanges.status = update.updates.status;
      hasChanges = true;
    }
    if (update.updates.leadName !== currentTask.leadName) {
      taskChanges.leadName = update.updates.leadName;
      hasChanges = true;
    }
    if (update.updates.bidMds !== currentTask.bidMds) {
      taskChanges.bidMds = update.updates.bidMds;
      hasChanges = true;
    }
    if (update.updates.deliveredVersion !== currentTask.deliveredVersion) {
      taskChanges.deliveredVersion = update.updates.deliveredVersion;
      hasChanges = true;
    }

    // Check dates
    const currentInternalEta = currentTask.internalEta 
      ? new Date(currentTask.internalEta).toISOString().split('T')[0] 
      : null;
    const newInternalEta = update.updates.internalEta 
      ? new Date(update.updates.internalEta).toISOString().split('T')[0] 
      : null;
    if (currentInternalEta !== newInternalEta) {
      taskChanges.internalEta = update.updates.internalEta;
      hasChanges = true;
    }

    const currentClientEta = currentTask.clientEta 
      ? new Date(currentTask.clientEta).toISOString().split('T')[0] 
      : null;
    const newClientEta = update.updates.clientEta 
      ? new Date(update.updates.clientEta).toISOString().split('T')[0] 
      : null;
    if (currentClientEta !== newClientEta) {
      taskChanges.clientEta = update.updates.clientEta;
      hasChanges = true;
    }

    const currentDeliveredDate = currentTask.deliveredDate 
      ? new Date(currentTask.deliveredDate).toISOString().split('T')[0] 
      : null;
    const newDeliveredDate = update.updates.deliveredDate 
      ? new Date(update.updates.deliveredDate).toISOString().split('T')[0] 
      : null;
    if (currentDeliveredDate !== newDeliveredDate) {
      taskChanges.deliveredDate = update.updates.deliveredDate;
      hasChanges = true;
    }

    if (hasChanges) {
      changes.push({
        taskId: update.taskId,
        shotId: update.shotId,
        updates: taskChanges,
      });
    }
  });

  return changes;
}
