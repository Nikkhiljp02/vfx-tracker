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
  const sheets = google.sheets({ version: 'v4', auth });
  const data = formatDataForSheets(shows);

  // Create new spreadsheet if none exists
  if (!spreadsheetId) {
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
                frozenRowCount: 1, // Freeze header row
              },
            },
          },
        ],
      },
    });

    spreadsheetId = response.data.spreadsheetId!;
  }

  // Clear existing data
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Tracker Data!A1:P',
  });

  // Update with new data
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Tracker Data!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: data,
    },
  });

  // Format the sheet
  await formatSheet(sheets, spreadsheetId);

  return spreadsheetId;
}

// Format the Google Sheet (styling, column widths, etc.)
async function formatSheet(sheets: any, spreadsheetId: string) {
  const requests = [
    // Header row formatting (bold, background color)
    {
      repeatCell: {
        range: {
          sheetId: 0,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.4, blue: 0.6 },
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
            },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    },
    // Auto-resize columns
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId: 0,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 14,
        },
      },
    },
    // Hide ID columns (O and P)
    {
      updateDimensionProperties: {
        range: {
          sheetId: 0,
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
          sheetId: 0,
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
          sheetId: 0,
          startRowIndex: 1,
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
          strict: true,
        },
      },
    },
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests },
  });
}

// Read changes from Google Sheets
export async function readFromGoogleSheets(auth: any, spreadsheetId: string) {
  const sheets = google.sheets({ version: 'v4', auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Tracker Data!A2:P', // Skip header row
  });

  const rows = response.data.values || [];
  
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
  const sheetUpdates = await readFromGoogleSheets(auth, spreadsheetId);
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

  // Compare sheet data with current data
  sheetUpdates.forEach(update => {
    const currentTask = taskMap.get(update.taskId);
    if (!currentTask) return;

    const taskChanges: any = {};
    let hasChanges = false;

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
        changes: taskChanges,
      });
    }
  });

  return changes;
}
