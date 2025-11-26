import { NextRequest, NextResponse } from 'next/server';

// Webhook endpoint for Google Apps Script to call
// This allows the "Update Tracker" and "Refresh from Tracker" buttons in Google Sheets to work
export async function POST(req: NextRequest) {
  try {
    const { spreadsheetId, action } = await req.json();
    
    console.log('[Google Sheets Webhook] Received request:', { spreadsheetId, action });

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'Spreadsheet ID is required' },
        { status: 400 }
      );
    }

    if (!action || !['import', 'sync'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "import" or "sync"' },
        { status: 400 }
      );
    }

    // For now, return a message that the user should use the VFX Tracker UI
    // Full webhook implementation would require authentication handling
    return NextResponse.json({
      success: false,
      error: 'Please use the VFX Tracker web interface to sync changes. The Apps Script webhook requires authentication which is not yet implemented.',
      message: 'Use the "Update from Sheets" button in VFX Tracker instead.',
    });

  } catch (error: any) {
    console.error('[Google Sheets Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook error', details: error.message },
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
