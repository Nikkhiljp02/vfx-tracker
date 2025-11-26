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
};

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

    // Get body data (shows)
    const { shows } = await req.json();
    console.log('[Google Sheets Sync] Shows count:', shows?.length);

    // Format data for sheets
    const rows = formatDataForSheets(shows);
    console.log('[Google Sheets Sync] Formatted rows:', rows.length);

    // Create sheets client
    const sheets = google.sheets({ version: 'v4', auth });

    // Clear existing data and write new data
    try {
      // First, try to clear the existing data
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: 'A:Z', // Clear all columns
      });
      console.log('[Google Sheets Sync] Cleared existing data');
    } catch (clearError: any) {
      // If clear fails, the sheet might not exist or be empty - that's OK
      console.log('[Google Sheets Sync] Clear failed (sheet might be new):', clearError.message);
    }

    // Write new data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: rows,
      },
    });
    console.log('[Google Sheets Sync] Data written successfully');

    // Apply comprehensive formatting
    try {
      // Get sheet ID (usually 0 for the first sheet)
      const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetId = spreadsheet.data.sheets?.[0]?.properties?.sheetId || 0;
      const dataRowCount = rows.length;

      // Border style
      const borderStyle = {
        style: 'SOLID',
        width: 1,
        color: { red: 0.7, green: 0.7, blue: 0.7 },
      };

      // Build formatting requests
      const requests: any[] = [
        // Freeze first row
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        // Header row styling - dark blue with white text
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 14 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.15, green: 0.3, blue: 0.5 },
                textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
          },
        },
        // Center align all data cells
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 1, endRowIndex: dataRowCount, startColumnIndex: 0, endColumnIndex: 14 },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'CENTER',
                verticalAlignment: 'MIDDLE',
              },
            },
            fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)',
          },
        },
        // Add borders to all data cells
        {
          updateBorders: {
            range: { sheetId, startRowIndex: 0, endRowIndex: dataRowCount, startColumnIndex: 0, endColumnIndex: 14 },
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
            dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 14 },
          },
        },
        // Hide Shot ID and Task ID columns (O and P = columns 14 and 15)
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: 'COLUMNS', startIndex: 14, endIndex: 16 },
            properties: { hiddenByUser: true },
            fields: 'hiddenByUser',
          },
        },
        // Add dropdown validation for Status column (column H, index 7)
        {
          setDataValidation: {
            range: { sheetId, startRowIndex: 1, endRowIndex: dataRowCount, startColumnIndex: 7, endColumnIndex: 8 },
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

      // Apply basic formatting first
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
      console.log('[Google Sheets Sync] Basic formatting applied');

      // Now apply status color coding
      // Read status values from column H
      const statusResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'H2:H' + dataRowCount,
      });
      const statusValues = statusResponse.data.values || [];

      // Build color requests for each status
      const colorRequests: any[] = [];
      statusValues.forEach((row: string[], index: number) => {
        const status = row[0];
        if (status && statusColors[status]) {
          colorRequests.push({
            repeatCell: {
              range: { sheetId, startRowIndex: index + 1, endRowIndex: index + 2, startColumnIndex: 7, endColumnIndex: 8 },
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
        console.log('[Google Sheets Sync] Status colors applied:', colorRequests.length);
      }

      console.log('[Google Sheets Sync] All formatting complete');
    } catch (formatError: any) {
      console.error('[Google Sheets Sync] Formatting failed:', formatError.message);
      // Log full error for debugging
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
