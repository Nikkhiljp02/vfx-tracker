# Google Sheets Live Sync - Setup Guide

## Overview
This integration enables **bidirectional live sync** between VFX Tracker and Google Sheets. You can:
- ✅ Push tracker data to Google Sheets instantly
- ✅ Edit data in Google Sheets
- ✅ Pull changes back to VFX Tracker with one click
- ✅ Use Google Apps Script button in the sheet for instant updates

## Setup Instructions

### Step 1: Get Google Cloud Credentials

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create a New Project**
   - Click "Select a project" → "New Project"
   - Name: `VFX Tracker`
   - Click "Create"

3. **Enable Google Sheets API**
   - Go to "APIs & Services" → "Library"
   - Search for "Google Sheets API"
   - Click "Enable"

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure OAuth consent screen:
     - User Type: Internal (if using Google Workspace) or External
     - App name: `VFX Tracker`
     - User support email: Your email
     - Authorized domains: Your Vercel domain (e.g., `vfx-tracker.vercel.app`)
     - Developer contact: Your email
     - Scopes: Add `https://www.googleapis.com/auth/spreadsheets`
     - Save and continue

5. **Configure OAuth Client**
   - Application type: `Web application`
   - Name: `VFX Tracker OAuth`
   - Authorized JavaScript origins:
     - `http://localhost:3000` (for local dev)
     - `https://vfx-tracker.vercel.app` (your production URL)
   - Authorized redirect URIs:
     - `http://localhost:3000/api/google-sheets/callback`
     - `https://vfx-tracker.vercel.app/api/google-sheets/callback`
   - Click "Create"

6. **Copy Credentials**
   - You'll see: `Client ID` and `Client secret`
   - **Save these** - you'll need them next!

### Step 2: Add Environment Variables

Add these to your `.env.production` file and Vercel:

```bash
# Google Sheets API Credentials
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# Already have these:
# NEXTAUTH_URL="https://vfx-tracker.vercel.app"
```

**In Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add both variables:
   - `GOOGLE_CLIENT_ID` → paste your Client ID
   - `GOOGLE_CLIENT_SECRET` → paste your Client secret
3. Select "Production" environment
4. Redeploy your app

### Step 3: Use the Integration

#### A. Connect Google Sheets (First Time)
1. **Click "Connect Sheets" button** in VFX Tracker header
2. Google will ask for permission
3. Click "Allow" (grants access to create/edit sheets)
4. You'll be redirected back to VFX Tracker

#### B. Sync Data to Google Sheets
1. **Click "Sync to Sheets" button**
   - Creates a new Google Sheet (or updates existing)
   - All tracker data is pushed instantly
   - Sheet opens automatically in new tab

#### C. Edit in Google Sheets
- Edit any editable fields:
  - Status (dropdown with validation)
  - Lead Name
  - Bid (MDs)
  - Internal ETA
  - Client ETA
  - Delivered Version
  - Delivered Date
- Changes are saved automatically in Google Sheets

#### D. Pull Changes Back to Tracker
- **Click "Update from Sheets" button** in VFX Tracker
- All changes from Google Sheets are applied
- Activity log tracks all changes
- Page refreshes with updated data

## Google Apps Script - "Update Tracker" Button

To add a button directly in Google Sheets that triggers sync:

### 1. Open Script Editor
1. In your Google Sheet, go to: **Extensions → Apps Script**
2. Delete existing code
3. Paste this script:

\`\`\`javascript
// VFX Tracker - Google Sheets Integration Script

// Configuration
const VFX_TRACKER_URL = 'https://vfx-tracker.vercel.app'; // Change to your URL
const API_ENDPOINT = VFX_TRACKER_URL + '/api/google-sheets/webhook';

// Create custom menu
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('VFX Tracker')
    .addItem('📥 Update Tracker', 'updateVFXTracker')
    .addItem('🔄 Refresh from Tracker', 'refreshFromTracker')
    .addSeparator()
    .addItem('ℹ️ About', 'showAbout')
    .addToUi();
}

// Update VFX Tracker with changes from this sheet
function updateVFXTracker() {
  const ui = SpreadsheetApp.getUi();
  
  // Confirm action
  const response = ui.alert(
    'Update VFX Tracker',
    'This will send all changes from this sheet to VFX Tracker. Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  try {
    // Get spreadsheet ID
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    // Call VFX Tracker API
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify({
        spreadsheetId: spreadsheetId,
        action: 'import'
      }),
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(API_ENDPOINT, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      ui.alert('✅ Updated ' + result.changes.length + ' tasks in VFX Tracker!');
    } else {
      ui.alert('❌ Error: ' + (result.error || 'Failed to update tracker'));
    }
    
  } catch (error) {
    ui.alert('❌ Failed to connect: ' + error.message);
  }
}

// Refresh sheet with latest data from VFX Tracker
function refreshFromTracker() {
  const ui = SpreadsheetApp.getUi();
  
  const response = ui.alert(
    'Refresh from Tracker',
    'This will overwrite this sheet with latest data from VFX Tracker. Any unsaved changes will be lost. Continue?',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  try {
    const spreadsheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
    
    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify({
        spreadsheetId: spreadsheetId,
        action: 'sync'
      }),
      'muteHttpExceptions': true
    };
    
    const response = UrlFetchApp.fetch(API_ENDPOINT, options);
    const result = JSON.parse(response.getContentText());
    
    if (result.success) {
      ui.alert('✅ Sheet refreshed with latest tracker data!');
      SpreadsheetApp.flush(); // Force refresh
    } else {
      ui.alert('❌ Error: ' + (result.error || 'Failed to refresh'));
    }
    
  } catch (error) {
    ui.alert('❌ Failed to connect: ' + error.message);
  }
}

// Show about dialog
function showAbout() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'VFX Tracker Integration',
    'This sheet is connected to VFX Tracker for live sync.\\n\\n' +
    '📥 Update Tracker: Send changes to VFX Tracker\\n' +
    '🔄 Refresh from Tracker: Get latest data\\n\\n' +
    'Sheet URL: ' + VFX_TRACKER_URL,
    ui.ButtonSet.OK
  );
}
\`\`\`

### 2. Update Configuration
- Change `VFX_TRACKER_URL` to your actual Vercel URL

### 3. Save and Authorize
1. Click "Save" (disk icon)
2. Name it: `VFX Tracker Sync`
3. Close script editor
4. Refresh your Google Sheet
5. You'll see a new menu: **VFX Tracker**
6. Click it → "Update Tracker" → Grant permissions

### 4. Use the Menu
- **📥 Update Tracker**: Push changes from sheet to VFX Tracker
- **🔄 Refresh from Tracker**: Pull latest data from VFX Tracker

## Data Format in Google Sheets

### Columns (A-N are visible, O-P are hidden):

| Column | Field | Editable | Notes |
|--------|-------|----------|-------|
| A | Show Name | ❌ | Read-only |
| B | Client | ❌ | Read-only |
| C | Shot Name | ❌ | Read-only |
| D | Shot Tag | ❌ | Read-only |
| E | Scope of Work | ❌ | Read-only |
| F | Department | ❌ | Read-only |
| G | Is Internal | ❌ | Read-only |
| H | Status | ✅ | Dropdown validation |
| I | Lead Name | ✅ | Text |
| J | Bid (MDs) | ✅ | Number |
| K | Internal ETA | ✅ | Date (YYYY-MM-DD) |
| L | Client ETA | ✅ | Date (YYYY-MM-DD) |
| M | Delivered Version | ✅ | Text (e.g., v001) |
| N | Delivered Date | ✅ | Date (YYYY-MM-DD) |
| O | Shot ID | 🔒 | Hidden (for sync) |
| P | Task ID | 🔒 | Hidden (for sync) |

### Status Dropdown Values:
- YTS (Yet To Start)
- WIP (Work In Progress)
- Int App (Internal Approval)
- AWF (Awaiting Feedback)
- C APP (Client Approved)
- C KB (Client Kickback)
- OMIT
- HOLD

## Sync Behavior

### From Tracker → Sheets:
- ✅ Creates/updates complete dataset
- ✅ Maintains formatting and validation
- ✅ Freezes header row
- ✅ Auto-resizes columns
- ✅ Hides ID columns

### From Sheets → Tracker:
- ✅ Only updates editable fields
- ✅ Creates activity log for each change
- ✅ Validates data types
- ✅ Preserves read-only fields
- ✅ Tracks who made changes

### Instant Updates:
- Click "Update from Sheets" button in VFX Tracker
- Or use "Update Tracker" menu in Google Sheets
- Both trigger immediate sync
- No polling/delays - instant on-demand

## Permissions & Security

### Google Scopes Required:
- `https://www.googleapis.com/auth/spreadsheets` (read/write sheets)

### User Permissions in VFX Tracker:
- **View Only**: Can view synced sheets (read-only)
- **Edit Users**: Can sync and import changes
- **Admin**: Full access to all sync features

### Data Security:
- OAuth tokens stored encrypted in database
- Tokens refresh automatically
- Only authorized users can sync
- Activity log tracks all changes

## Troubleshooting

### "Google authorization expired"
**Fix**: Click "Connect Sheets" again to re-authorize

### "No spreadsheet ID found"
**Fix**: Click "Sync to Sheets" to create initial sheet

### "Failed to sync to Google Sheets"
**Check**:
1. Environment variables are set correctly
2. Redirect URI matches exactly
3. Google Sheets API is enabled
4. OAuth consent screen is configured

### Apps Script "Failed to connect"
**Fix**:
1. Verify `VFX_TRACKER_URL` in script
2. Make sure webhook API endpoint exists
3. Check CORS settings
4. Grant script permissions

### Changes not appearing
**Fix**:
1. Click "Update from Sheets" manually
2. Check activity log for errors
3. Verify editable fields are correct
4. Refresh the page

## Webhook API (For Apps Script)

Create this endpoint for Google Sheets to call:

**File**: `app/api/google-sheets/webhook/route.ts`

```typescript
// This allows Google Sheets Apps Script to trigger sync
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { spreadsheetId, action } = await req.json();
  
  // Verify request (add auth if needed)
  // ... implement sync logic based on action
  
  return NextResponse.json({ success: true });
}
```

## Best Practices

1. **Sync Frequency**: 
   - Manual sync on-demand (recommended)
   - For auto-sync: every 5-10 minutes max

2. **Data Editing**:
   - Coordinate with team to avoid conflicts
   - Use VFX Tracker for bulk operations
   - Use Google Sheets for quick status updates

3. **Large Datasets**:
   - Google Sheets supports up to 10 million cells
   - Paginate if you have 10,000+ tasks
   - Consider filtering by show/department

4. **Backup**:
   - Google Sheets auto-saves
   - VFX Tracker maintains activity log
   - Export to Excel periodically for backups

## Support

- **Google Cloud Issues**: https://cloud.google.com/support
- **Google Sheets API**: https://developers.google.com/sheets/api
- **OAuth Setup**: https://developers.google.com/identity/protocols/oauth2
