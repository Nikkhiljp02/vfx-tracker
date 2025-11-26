import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuth, formatDataForSheets, detectSheetChanges } from '@/lib/google-sheets';
import { prisma } from '@/lib/prisma';
import { google } from 'googleapis';

// Helper function to increment version
function incrementVersion(currentVersion: string | null): string {
  if (!currentVersion) return 'v001';
  
  const match = currentVersion.match(/v(\d+)/i);
  if (match) {
    const num = parseInt(match[1], 10) + 1;
    return `v${num.toString().padStart(3, '0')}`;
  }
  return 'v001';
}

// Status color mapping for conditional formatting
const statusColors: Record<string, { red: number; green: number; blue: number }> = {
  'YTS': { red: 0.85, green: 0.85, blue: 0.85 },
  'WIP': { red: 1.0, green: 0.9, blue: 0.6 },
  'Int App': { red: 0.7, green: 0.85, blue: 1.0 },
  'AWF': { red: 0.8, green: 0.7, blue: 0.95 },
  'C APP': { red: 0.6, green: 0.9, blue: 0.6 },
  'C KB': { red: 1.0, green: 0.7, blue: 0.7 },
  'OMIT': { red: 0.6, green: 0.6, blue: 0.6 },
  'HOLD': { red: 1.0, green: 0.85, blue: 0.7 },
};

// Webhook endpoint for Google Apps Script to call
// This allows the "Update Tracker" and "Refresh from Tracker" buttons in Google Sheets to work
export async function POST(req: NextRequest) {
  try {
    const { spreadsheetId, action, apiKey } = await req.json();
    
    console.log('[Google Sheets Webhook] Received request:', { spreadsheetId, action });

    if (!spreadsheetId) {
      return NextResponse.json(
        { success: false, error: 'Spreadsheet ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['import', 'sync'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Invalid action. Use "import" or "sync"' },
        { status: 400 }
      );
    }

    // Get system settings to verify spreadsheet ID and get webhook key
    const settings = await prisma.systemSettings.findFirst({
      where: { key: 'google_sheets' }
    });

    if (!settings) {
      return NextResponse.json(
        { success: false, error: 'Google Sheets not configured in VFX Tracker.' },
        { status: 400 }
      );
    }

    const settingsData = JSON.parse(settings.value);
    
    // Verify the spreadsheet ID matches
    if (settingsData.spreadsheetId !== spreadsheetId) {
      return NextResponse.json(
        { success: false, error: 'Spreadsheet ID does not match configured sheet.' },
        { status: 403 }
      );
    }

    // Verify API key if configured
    if (settingsData.webhookKey && settingsData.webhookKey !== apiKey) {
      return NextResponse.json(
        { success: false, error: 'Invalid API key. Check your Apps Script configuration.' },
        { status: 401 }
      );
    }

    // Find a user with valid Google tokens (preferably admin)
    const usersWithTokens = await prisma.user.findMany({
      where: {
        preferences: {
          googleTokens: { not: null }
        }
      },
      include: { preferences: true },
      orderBy: { role: 'asc' } // ADMIN comes first alphabetically
    });

    if (usersWithTokens.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No users have connected Google Sheets. Please connect from VFX Tracker first.' },
        { status: 400 }
      );
    }

    // Use the first user with tokens (preferably admin)
    const user = usersWithTokens[0];
    const tokens = JSON.parse(user.preferences!.googleTokens!);

    if (!tokens.access_token && !tokens.refresh_token) {
      return NextResponse.json(
        { success: false, error: 'Google authorization expired. Please reconnect from VFX Tracker.' },
        { status: 401 }
      );
    }

    // Set up auth
    const auth = getGoogleAuth();
    auth.setCredentials(tokens);

    if (action === 'import') {
      // Import changes FROM Google Sheets TO VFX Tracker
      return await handleImportFromSheets(auth, spreadsheetId, user, tokens);
    } else if (action === 'sync') {
      // Sync data FROM VFX Tracker TO Google Sheets
      return await handleSyncToSheets(auth, spreadsheetId, user, tokens);
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

  } catch (error: any) {
    console.error('[Google Sheets Webhook] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook error: ' + error.message },
      { status: 500 }
    );
  }
}

// Handle import from Google Sheets to VFX Tracker
async function handleImportFromSheets(auth: any, spreadsheetId: string, user: any, tokens: any) {
  try {
    console.log('[Webhook Import] Starting import from sheets...');

    // Get all shows with shots and tasks for change detection
    const shows = await prisma.show.findMany({
      include: {
        shots: {
          include: {
            tasks: true
          }
        }
      }
    });

    // Detect changes from Google Sheets (cast to any to avoid type issues with Prisma results)
    const changes = await detectSheetChanges(auth, spreadsheetId, shows as any);
    console.log('[Webhook Import] Detected', changes.length, 'changes');

    if (changes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No changes detected in Google Sheets.',
        changes: []
      });
    }

    // Apply changes to database
    const appliedChanges: any[] = [];
    
    for (const change of changes) {
      try {
        const currentTask = await prisma.task.findUnique({
          where: { id: change.taskId },
        });

        if (!currentTask) {
          console.log('[Webhook Import] Task not found:', change.taskId);
          continue;
        }

        const updateData = { ...change.updates };

        // Handle AWF version increment logic
        if (updateData.status === 'AWF' && currentTask.status !== 'AWF') {
          updateData.deliveredVersion = incrementVersion(currentTask.deliveredVersion);
          updateData.deliveredDate = new Date();
          console.log('[Webhook Import] AWF auto-increment:', updateData.deliveredVersion);
        }

        // Update task in database
        await prisma.task.update({
          where: { id: change.taskId },
          data: updateData,
        });

        // Log the change
        await prisma.activityLog.create({
          data: {
            actionType: 'UPDATE',
            entityType: 'Task',
            entityId: change.taskId,
            userId: user.id,
            userName: user.username + ' (via Google Sheets)',
            fieldName: 'multiple',
            oldValue: JSON.stringify({
              status: currentTask.status,
              deliveredVersion: currentTask.deliveredVersion,
            }),
            newValue: JSON.stringify({
              source: 'Google Sheets Webhook',
              changes: updateData,
            }),
          },
        });

        appliedChanges.push({
          taskId: change.taskId,
          shotName: change.shotName,
          updates: change.updates,
        });
      } catch (updateError: any) {
        console.error('[Webhook Import] Failed to update task:', change.taskId, updateError.message);
      }
    }

    // Save refreshed tokens if they changed
    const refreshedCredentials = auth.credentials;
    if (refreshedCredentials?.access_token !== tokens.access_token) {
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: { googleTokens: JSON.stringify(refreshedCredentials) },
      });
    }

    console.log('[Webhook Import] Applied', appliedChanges.length, 'changes');

    return NextResponse.json({
      success: true,
      message: `Updated ${appliedChanges.length} tasks in VFX Tracker.`,
      changes: appliedChanges,
      totalDetected: changes.length,
      totalApplied: appliedChanges.length,
    });

  } catch (error: any) {
    console.error('[Webhook Import] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Import failed: ' + error.message },
      { status: 500 }
    );
  }
}

// Handle sync from VFX Tracker to Google Sheets
async function handleSyncToSheets(auth: any, spreadsheetId: string, user: any, tokens: any) {
  try {
    console.log('[Webhook Sync] Starting sync to sheets...');

    // Get all shows with shots and tasks
    const shows = await prisma.show.findMany({
      include: {
        shots: {
          include: {
            tasks: true
          }
        }
      }
    });

    // Format data for sheets
    const rows = formatDataForSheets(shows);
    console.log('[Webhook Sync] Formatted rows:', rows.length);

    // Create sheets client
    const sheets = google.sheets({ version: 'v4', auth });

    // Get spreadsheet info to find sheet ID
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.properties',
    });

    const firstSheet = spreadsheetInfo.data.sheets?.[0];
    const sheetId = firstSheet?.properties?.sheetId || 0;

    // Clear existing data
    try {
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: 'A:Z',
      });
    } catch (clearError: any) {
      console.log('[Webhook Sync] Clear failed:', clearError.message);
    }

    // Write new data
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows },
    });

    // Apply formatting
    const requests: any[] = [];
    const dataRows = rows.length;

    // Header formatting
    requests.push({
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 16 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.2, green: 0.2, blue: 0.3 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 }, fontSize: 10 },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE',
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    });

    // Data rows formatting
    if (dataRows > 1) {
      requests.push({
        repeatCell: {
          range: { sheetId, startRowIndex: 1, endRowIndex: dataRows, startColumnIndex: 0, endColumnIndex: 16 },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            }
          },
          fields: 'userEnteredFormat(horizontalAlignment,verticalAlignment)'
        }
      });
    }

    // Freeze header row
    requests.push({
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount'
      }
    });

    // Hide ID columns (O, P)
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: 14, endIndex: 16 },
        properties: { hiddenByUser: true },
        fields: 'hiddenByUser'
      }
    });

    // Auto-resize columns
    requests.push({
      autoResizeDimensions: {
        dimensions: { sheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 14 }
      }
    });

    // Add borders
    requests.push({
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: dataRows, startColumnIndex: 0, endColumnIndex: 14 },
        top: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
        bottom: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
        left: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
        right: { style: 'SOLID', width: 1, color: { red: 0.8, green: 0.8, blue: 0.8 } },
        innerHorizontal: { style: 'SOLID', width: 1, color: { red: 0.9, green: 0.9, blue: 0.9 } },
        innerVertical: { style: 'SOLID', width: 1, color: { red: 0.9, green: 0.9, blue: 0.9 } },
      }
    });

    // Status dropdown validation
    if (dataRows > 1) {
      requests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, endRowIndex: dataRows, startColumnIndex: 7, endColumnIndex: 8 },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: Object.keys(statusColors).map(s => ({ userEnteredValue: s }))
            },
            showCustomUi: true,
            strict: false
          }
        }
      });
    }

    // Status color conditional formatting
    Object.entries(statusColors).forEach(([status, color]) => {
      requests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{ sheetId, startRowIndex: 1, endRowIndex: dataRows, startColumnIndex: 7, endColumnIndex: 8 }],
            booleanRule: {
              condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: status }] },
              format: { backgroundColor: color }
            }
          },
          index: 0
        }
      });
    });

    // Execute all formatting
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    }

    // Save refreshed tokens if they changed
    const refreshedCredentials = auth.credentials;
    if (refreshedCredentials?.access_token !== tokens.access_token) {
      await prisma.userPreferences.update({
        where: { userId: user.id },
        data: { googleTokens: JSON.stringify(refreshedCredentials) },
      });
    }

    console.log('[Webhook Sync] Sync complete, wrote', rows.length, 'rows');

    return NextResponse.json({
      success: true,
      message: `Sheet refreshed with ${rows.length - 1} tasks from VFX Tracker.`,
      rowCount: rows.length - 1,
    });

  } catch (error: any) {
    console.error('[Webhook Sync] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed: ' + error.message },
      { status: 500 }
    );
  }
}

// Allow OPTIONS for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
