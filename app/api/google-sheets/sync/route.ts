import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuth, formatDataForSheets } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { auth as getAuth } from '@/lib/auth';
import { google } from 'googleapis';

// Status color mapping for conditional formatting
const statusColors: Record<string, { red: number; green: number; blue: number }> = {
  'YTS': { red: 0.85, green: 0.85, blue: 0.85 },      // Gray
  'WIP': { red: 1.0, green: 0.9, blue: 0.6 },         // Yellow
  'Int App': { red: 0.7, green: 0.85, blue: 1.0 },    // Light Blue
  'AWF': { red: 0.8, green: 0.7, blue: 0.95 },        // Purple
  'C APP': { red: 0.6, green: 0.9, blue: 0.6 },       // Green
  'C KB': { red: 1.0, green: 0.7, blue: 0.7 },        // Red/Pink
  'OMIT': { red: 0.6, green: 0.6, blue: 0.6 },        // Dark Gray
  'HOLD': { red: 1.0, green: 0.85, blue: 0.7 },       // Orange
  'Int KB': { red: 1.0, green: 0.8, blue: 0.8 },      // Light Red
};

// Column indexes (0-based) after adding EP, SEQ, TO, Frames
// Columns: Show Name(0), Client(1), Shot Name(2), Shot Tag(3), EP(4), SEQ(5), TO(6), Frames(7), 
//          SOW(8), Department(9), Is Internal(10), Status(11), Lead Name(12), Bid(13), 
//          Internal ETA(14), Client ETA(15), Delivered Version(16), Delivered Date(17),
//          Shot ID(18), Task ID(19)
const TOTAL_COLUMNS = 20;
const STATUS_COLUMN_INDEX = 11;
const HIDDEN_COLUMNS_START = 18;

// Generate summary data from shows
function generateSummaryData(shows: any[]): any[][] {
  const summaryRows: any[][] = [];
  
  // Title row
  summaryRows.push(['VFX TRACKER SUMMARY']);
  summaryRows.push(['Last Updated:', new Date().toLocaleString()]);
  summaryRows.push([]); // Empty row
  
  // Header row
  summaryRows.push(['Show', 'Total Shots', 'YTS', 'WIP', 'Int App', 'AWF', 'C APP', 'C KB', 'OMIT', 'HOLD']);
  
  // Data rows for each show
  shows.forEach(show => {
    const statusCounts: Record<string, number> = {
      'YTS': 0, 'WIP': 0, 'Int App': 0, 'AWF': 0, 'C APP': 0, 'C KB': 0, 'OMIT': 0, 'HOLD': 0
    };
    
    // Count unique shots per status (use the highest priority status per shot)
    const shotStatuses: Record<string, string> = {};
    
    show.shots?.forEach((shot: any) => {
      shot.tasks?.forEach((task: any) => {
        const currentStatus = shotStatuses[shot.id];
        // Track the most advanced status for the shot
        if (!currentStatus || getStatusPriority(task.status) > getStatusPriority(currentStatus)) {
          shotStatuses[shot.id] = task.status;
        }
      });
    });
    
    // Count statuses
    Object.values(shotStatuses).forEach(status => {
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    });
    
    const totalShots = show.shots?.length || 0;
    
    summaryRows.push([
      show.showName,
      totalShots,
      statusCounts['YTS'],
      statusCounts['WIP'],
      statusCounts['Int App'],
      statusCounts['AWF'],
      statusCounts['C APP'],
      statusCounts['C KB'],
      statusCounts['OMIT'],
      statusCounts['HOLD'],
    ]);
  });
  
  // Grand total row
  summaryRows.push([]); // Empty row
  const grandTotal = shows.reduce((acc, show) => acc + (show.shots?.length || 0), 0);
  summaryRows.push(['GRAND TOTAL', grandTotal]);
  
  return summaryRows;
}

// Get status priority for determining shot overall status
function getStatusPriority(status: string): number {
  const priorities: Record<string, number> = {
    'C APP': 8, 'AWF': 7, 'C KB': 6, 'Int App': 5, 'WIP': 4, 'YTS': 3, 'HOLD': 2, 'OMIT': 1
  };
  return priorities[status] || 0;
}

// Sync tracker data to Google Sheets (simple overwrite)
export async function POST(req: NextRequest) {
  try {
    console.log('[Google Sheets Sync] Starting sync...');
    
    const session = await getAuth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user and their Google tokens
    const user = await prisma.user.findUnique({
      where: { username: (session.user as any).username || '' },
      include: { preferences: true },
    });

    if (!user?.preferences?.googleTokens) {
      return NextResponse.json(
        { error: 'Google Sheets not connected. Please connect first.' },
        { status: 400 }
      );
    }

    // Get system spreadsheet ID from admin settings
    const settings = await prisma.systemSettings.findFirst({
      where: { key: 'google_sheets' }
    });

    if (!settings) {
      return NextResponse.json(
        { error: 'No Google Sheet configured. Please set up the Sheet ID in Admin > Settings > Google Sheets.' },
        { status: 400 }
      );
    }

    const { spreadsheetId } = JSON.parse(settings.value);
    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'No Google Sheet ID configured. Please set up the Sheet ID in Admin > Settings > Google Sheets.' },
        { status: 400 }
      );
    }

    console.log('[Google Sheets Sync] Using spreadsheet:', spreadsheetId);

    // Parse tokens
    const tokens = JSON.parse(user.preferences.googleTokens);
    if (!tokens.access_token && !tokens.refresh_token) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }

    // Set up auth
    const auth = getGoogleAuth();
    auth.setCredentials(tokens);

    // Fetch FRESH data from database instead of using potentially stale client data
    const freshShows = await prisma.show.findMany({
      where: { status: { not: 'Archived' } }, // Exclude archived shows
      include: {
        shots: {
          where: { isActive: true },
          include: {
            tasks: {
              where: { isActive: true },
              orderBy: { department: 'asc' }
            }
          },
          orderBy: { shotName: 'asc' }
        }
      },
      orderBy: { showName: 'asc' }
    });
    console.log('[Google Sheets Sync] Fresh shows count:', freshShows.length);

    // Format data for sheets using FRESH database data
    const rows = formatDataForSheets(freshShows as any);
    console.log('[Google Sheets Sync] Formatted rows:', rows.length);

    // Generate summary data
    const summaryRows = generateSummaryData(freshShows as any);

    // Create sheets client
    const sheets = google.sheets({ version: 'v4', auth });

    // Get spreadsheet info to find sheets
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const existingSheets = spreadsheet.data.sheets || [];
    
    // Find Summary sheet and main data sheet (not Summary)
    const summarySheet = existingSheets.find(s => s.properties?.title === 'Summary');
    let summarySheetId = summarySheet?.properties?.sheetId;
    
    // Find the main data sheet (first sheet that's NOT Summary)
    // If Summary exists at index 0, we need the next sheet
    let mainSheet = existingSheets.find(s => s.properties?.title !== 'Summary');
    
    // If no non-Summary sheet exists, we'll use whatever sheet is available (shouldn't happen normally)
    if (!mainSheet && existingSheets.length > 0) {
      mainSheet = existingSheets.find(s => s.properties?.title === 'Summary') ? existingSheets[1] : existingSheets[0];
    }
    
    // Default sheet name - prefer "Tracker Data" or first available non-Summary sheet
    let mainSheetName = mainSheet?.properties?.title || 'Sheet1';
    let mainSheetId = mainSheet?.properties?.sheetId || 0;
    
    // If no suitable main sheet found, rename Summary won't work - just use Sheet1
    if (mainSheetName === 'Summary') {
      // All sheets are Summary? Create or use Sheet1
      mainSheetName = 'Tracker Data';
      // We'll create it below if needed
    }
    
    console.log('[Google Sheets Sync] Main sheet:', mainSheetName, 'ID:', mainSheetId);
    console.log('[Google Sheets Sync] Summary sheet ID:', summarySheetId);

    // Create Summary sheet if it doesn't exist (at the END, not beginning)
    if (!summarySheet) {
      try {
        const addSheetResponse = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: {
                  title: 'Summary',
                  // Don't specify index - adds at end by default
                }
              }
            }]
          }
        });
        summarySheetId = addSheetResponse.data.replies?.[0]?.addSheet?.properties?.sheetId;
        console.log('[Google Sheets Sync] Created Summary sheet');
      } catch (e: any) {
        console.log('[Google Sheets Sync] Could not create Summary sheet:', e.message);
      }
    }

    // Clear and write main data sheet
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${mainSheetName}!A:Z`,
      });
      console.log('[Google Sheets Sync] Cleared main sheet');
    } catch (clearError: any) {
      console.log('[Google Sheets Sync] Clear failed (might be empty):', clearError.message);
    }

    // Write main data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${mainSheetName}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });
    console.log('[Google Sheets Sync] Main data written');

    // Write Summary sheet
    if (summarySheetId !== undefined) {
      try {
        await sheets.spreadsheets.values.clear({
          spreadsheetId,
          range: 'Summary!A:Z',
        });
        
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Summary!A1',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: summaryRows },
        });
        console.log('[Google Sheets Sync] Summary data written');
      } catch (e: any) {
        console.log('[Google Sheets Sync] Summary write failed:', e.message);
      }
    }

    const dataRowCount = rows.length;

    // Column widths in pixels
    // Columns: Show Name(0), Client(1), Shot Name(2), Shot Tag(3), EP(4), SEQ(5), TO(6), Frames(7), 
    //          SOW(8), Department(9), Is Internal(10), Status(11), Lead Name(12), Bid(13), 
    //          Internal ETA(14), Client ETA(15), Delivered Version(16), Delivered Date(17),
    //          Shot ID(18), Task ID(19)
    const columnWidths = [
      120,  // Show Name
      100,  // Client
      100,  // Shot Name
      80,   // Shot Tag
      50,   // EP
      50,   // SEQ
      50,   // TO
      60,   // Frames
      150,  // SOW (Scope of Work)
      90,   // Department
      80,   // Is Internal
      80,   // Status
      100,  // Lead Name
      70,   // Bid (MDs)
      90,   // Internal ETA
      90,   // Client ETA
      100,  // Delivered Version
      90,   // Delivered Date
    ];
    const SOW_COLUMN_INDEX = 8;

    // Apply formatting
    try {
      // Border style - solid black for all borders
      const borderStyle = {
        style: 'SOLID',
        width: 1,
        color: { red: 0, green: 0, blue: 0 },
      };

      // Build formatting requests for main sheet
      const requests: any[] = [
        // Freeze first row
        {
          updateSheetProperties: {
            properties: { sheetId: mainSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        // Set header row height to 35
        {
          updateDimensionProperties: {
            range: { sheetId: mainSheetId, dimension: 'ROWS', startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 35 },
            fields: 'pixelSize',
          },
        },
        // Set all data rows height to 25
        {
          updateDimensionProperties: {
            range: { sheetId: mainSheetId, dimension: 'ROWS', startIndex: 1, endIndex: dataRowCount },
            properties: { pixelSize: 25 },
            fields: 'pixelSize',
          },
        },
        // Header row styling - dark blue with white text, NO WRAP (single line)
        {
          repeatCell: {
            range: { sheetId: mainSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: HIDDEN_COLUMNS_START },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.15, green: 0.3, blue: 0.5 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
                wrapStrategy: 'CLIP', // No wrap - single line
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,wrapStrategy)',
          },
        },
        // Center align all data cells
        {
          repeatCell: {
            range: { sheetId: mainSheetId, startRowIndex: 1, endRowIndex: dataRowCount, startColumnIndex: 0, endColumnIndex: HIDDEN_COLUMNS_START },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
          },
        },
        // SOW column - wrap text
        {
          repeatCell: {
            range: { sheetId: mainSheetId, startRowIndex: 1, endRowIndex: dataRowCount, startColumnIndex: SOW_COLUMN_INDEX, endColumnIndex: SOW_COLUMN_INDEX + 1 },
            cell: {
              userEnteredFormat: {
                wrapStrategy: 'WRAP',
                horizontalAlignment: 'LEFT',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(wrapStrategy,horizontalAlignment,verticalAlignment)',
          },
        },
        // Add ALL borders to visible data cells
        {
          updateBorders: {
            range: { sheetId: mainSheetId, startRowIndex: 0, endRowIndex: dataRowCount, startColumnIndex: 0, endColumnIndex: HIDDEN_COLUMNS_START },
            top: borderStyle,
            bottom: borderStyle,
            left: borderStyle,
            right: borderStyle,
            innerHorizontal: borderStyle,
            innerVertical: borderStyle,
          },
        },
        // Hide Shot ID and Task ID columns ONLY
        {
          updateDimensionProperties: {
            range: { sheetId: mainSheetId, dimension: 'COLUMNS', startIndex: HIDDEN_COLUMNS_START, endIndex: TOTAL_COLUMNS },
            properties: { hiddenByUser: true },
            fields: 'hiddenByUser',
          },
        },
        // Unhide all visible columns (0 to 17)
        {
          updateDimensionProperties: {
            range: { sheetId: mainSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: HIDDEN_COLUMNS_START },
            properties: { hiddenByUser: false },
            fields: 'hiddenByUser',
          },
        },
        // Clear ALL data validations first (removes any unwanted dropdowns like on Frames column)
        {
          setDataValidation: {
            range: { sheetId: mainSheetId, startRowIndex: 1, endRowIndex: dataRowCount, startColumnIndex: 0, endColumnIndex: HIDDEN_COLUMNS_START },
            rule: null, // This clears validation
          },
        },
        // Status dropdown validation (ONLY for Status column, index 11)
        {
          setDataValidation: {
            range: { sheetId: mainSheetId, startRowIndex: 1, endRowIndex: dataRowCount, startColumnIndex: STATUS_COLUMN_INDEX, endColumnIndex: STATUS_COLUMN_INDEX + 1 },
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'YTS' },
                  { userEnteredValue: 'WIP' },
                  { userEnteredValue: 'Int App' },
                  { userEnteredValue: 'Int KB' },
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

      // Set individual column widths
      columnWidths.forEach((width, index) => {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId: mainSheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
            properties: { pixelSize: width },
            fields: 'pixelSize',
          },
        });
      });

      // Add Summary sheet formatting if it exists
      if (summarySheetId !== undefined) {
        requests.push(
          // Summary title formatting
          {
            repeatCell: {
              range: { sheetId: summarySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 10 },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 14 },
                },
              },
              fields: 'userEnteredFormat(textFormat)',
            },
          },
          // Summary header row formatting
          {
            repeatCell: {
              range: { sheetId: summarySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 10 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.15, green: 0.3, blue: 0.5 },
                  textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                  horizontalAlignment: 'CENTER',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
            },
          },
          // Summary data borders
          {
            updateBorders: {
              range: { sheetId: summarySheetId, startRowIndex: 3, endRowIndex: summaryRows.length, startColumnIndex: 0, endColumnIndex: 10 },
              top: borderStyle,
              bottom: borderStyle,
              left: borderStyle,
              right: borderStyle,
              innerHorizontal: borderStyle,
              innerVertical: borderStyle,
            },
          },
          // Auto-resize Summary columns
          {
            autoResizeDimensions: {
              dimensions: { sheetId: summarySheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 10 },
            },
          }
        );
      }

      // Apply formatting
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
      console.log('[Google Sheets Sync] Formatting applied');

      // Apply status color coding to main sheet
      const statusResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${mainSheetName}!L2:L${dataRowCount}`, // Column L is Status (index 11)
      });
      const statusValues = statusResponse.data.values || [];

      const colorRequests: any[] = [];
      statusValues.forEach((row: string[], index: number) => {
        const status = row[0];
        if (status && statusColors[status]) {
          colorRequests.push({
            repeatCell: {
              range: { sheetId: mainSheetId, startRowIndex: index + 1, endRowIndex: index + 2, startColumnIndex: STATUS_COLUMN_INDEX, endColumnIndex: STATUS_COLUMN_INDEX + 1 },
              cell: {
                userEnteredFormat: {
                  backgroundColor: statusColors[status],
                  textFormat: { bold: true },
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
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: colorRequests },
        });
        console.log('[Google Sheets Sync] Status colors applied');
      }

    } catch (formatError: any) {
      console.error('[Google Sheets Sync] Formatting failed:', formatError.message);
      if (formatError.response?.data) {
        console.error('[Google Sheets Sync] Error details:', JSON.stringify(formatError.response.data));
      }
    }

    // Save refreshed tokens if they changed
    const refreshedCredentials = auth.credentials;
    if (refreshedCredentials?.access_token !== tokens.access_token) {
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: { googleTokens: JSON.stringify(refreshedCredentials) },
      });
      console.log('[Google Sheets Sync] Tokens refreshed and saved');
    }

    return NextResponse.json({
      success: true,
      spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      rowsWritten: rows.length,
    });
  } catch (error: any) {
    console.error('[Google Sheets Sync] Error:', error);
    
    if (error.code === 401 || error.message?.includes('invalid_grant')) {
      return NextResponse.json(
        { error: 'Google authorization expired. Please reconnect.' },
        { status: 401 }
      );
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Google Sheet not found. Please check the Sheet ID in Admin Settings.' },
        { status: 404 }
      );
    }
    
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'No permission to edit the Google Sheet. Make sure you have edit access.' },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to sync to Google Sheets' },
      { status: 500 }
    );
  }
}
