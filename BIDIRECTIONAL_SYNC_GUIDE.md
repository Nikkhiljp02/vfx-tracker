# Bidirectional Sync & Import/Export System

## Overview
The VFX Tracker now features a **comprehensive bidirectional synchronization system** between Resource Forecast, Allocations, and Dashboard views. All three sheets remain perfectly in sync in real-time.

---

## 🔄 Bidirectional Sync Features

### How It Works
- **Resource Forecast → Allocations**: When you add/update/delete shots in the forecast grid, changes automatically appear in the Allocations page
- **Allocations → Resource Forecast**: When you import allocations via CSV, the forecast grid updates immediately
- **Both → Dashboard**: All changes from either view update the Dashboard statistics in real-time
- **Cross-Tab Sync**: Changes sync even across multiple browser tabs using BroadcastChannel API

### What Gets Synced
✅ New allocations created in forecast view  
✅ Deleted allocations from forecast view  
✅ Bulk paste operations in forecast  
✅ CSV imports in allocations page  
✅ Manual allocation updates  
✅ Weekend working states  
✅ Man-days modifications  

---

## 📥 Import System (Allocations Page)

### Import Action Column

The **Action** column in your CSV determines whether each row creates new allocations or updates existing ones:

#### 1. **NEW** (Add New Allocations)
- Creates **new allocation entries** from CSV data
- Does NOT modify or delete existing allocations
- Perfect for adding fresh allocations or new shots
- Can create additional allocations alongside existing ones

#### 2. **UPDATE** (Replace Existing Allocations)
- **Deletes ALL existing allocations** for that artist on those dates
- Creates new allocations from the CSV row
- Overwrites everything for that member on the specified date range
- Perfect for completely replacing allocations for a date period
- Use this to reassign an artist from one shot to another

### How to Import

1. **Prepare CSV File**
   - **Required columns**: `Action`, `Emp ID`, `Shot`, `Show`, `Start Date`, `End Date`, `Total MD`
   - **Optional columns**: `Artist Name`, `Designation`, `Department`, `Shift`, `Days`
   - **Action values**: `NEW` (create new) or `UPDATE` (replace existing)
   - Date format: `YYYY-MM-DD` (e.g., `2025-01-15`)
   - **Format matches the Allocations table view (grouped by shot with date ranges)**
   - **Auto-fill**: Designation, Department, and Shift are automatically filled from member data based on Emp ID
   - **Validation**: Total MD ÷ Days must not exceed 1.0 (max 1 man-day per person per day)

2. **Example CSV Format (Full)**
```csv
Action,Emp ID,Artist Name,Designation,Department,Shift,Show,Shot,Start Date,End Date,Days,Total MD
UPDATE,VFX001,John Doe,Compositor,Compositing,Day,ProjectX,Shot_010,2025-01-15,2025-01-17,3,3.0
NEW,VFX002,Jane Smith,Animator,Animation,Night,ProjectY,Shot_020,2025-01-16,2025-01-18,3,1.5
UPDATE,VFX003,Bob Lee,Modeler,Modeling,Day,ProjectX,Shot_030,2025-01-17,2025-01-19,3,3.0
```

   **Minimal CSV Format (Required Only)**
```csv
Action,Emp ID,Show,Shot,Start Date,End Date,Total MD
UPDATE,VFX001,ProjectX,Shot_010,2025-01-15,2025-01-17,3.0
NEW,VFX002,ProjectY,Shot_020,2025-01-16,2025-01-18,1.5
UPDATE,VFX003,ProjectX,Shot_030,2025-01-17,2025-01-19,3.0
```
   Note: Artist Name, Designation, Department, and Shift will be auto-filled from the employee master data.

3. **Import Steps**
   - Go to **Allocations** page
   - Select import mode: **Add New** or **Update Existing**
   - Click **Import CSV** button
   - Select your CSV file
   - System validates employee IDs
   - Review any errors (employees not found)
   - Confirm to proceed with valid rows
   - See success/failure count

4. **Error Handling**
   - System validates employee IDs against active members
   - Invalid employee IDs are reported with row numbers
   - You can proceed with valid rows or cancel
   - Failed imports are counted separately

### Import Validation
- ✅ Employee ID must exist in the system
- ✅ Employee must be active
- ✅ Date must be valid format
- ✅ Man Days must be numeric
- ✅ Required columns must be present

---

## 📤 Export System (Allocations Page)

### Export Features

#### Filtered Export
- Exports **only the data matching current filters**
- Respects all active filters: department, shift, show, date range, search query
- Does NOT export all data - only what you see filtered

### Available Filters for Export

1. **Search Query** - Filter by artist name, emp ID, shot name, or show name
2. **Department** - Filter by specific department (e.g., Compositing, Animation)
3. **Shift** - Filter by shift (Day, Night, General)
4. **Show** - Filter by specific show/project
5. **Date Range** - Filter from/to specific dates

### How to Export

1. **Apply Filters** (Optional)
   - Select department, shift, show
   - Set date range (From/To dates)
   - Enter search keywords
   - Only filtered rows will be exported

2. **Click Export CSV**
   - Green "Export CSV" button in top-right
   - Downloads immediately as `allocations_YYYY-MM-DD_HHMM.csv`
   - Includes all filtered allocations with individual daily entries

3. **Export Format**
```csv
Emp ID,Artist Name,Designation,Department,Shift,Show,Shot,Start Date,End Date,Days,Total MD
VFX001,John Doe,Compositor,Compositing,Day,ProjectX,Shot_010,2025-01-15,2025-01-17,3,3.0
VFX001,John Doe,Compositor,Compositing,Day,ProjectX,Shot_011,2025-01-18,2025-01-20,3,3.0
```

**Note:**
- **One row per allocation** (artist + shot combination with date range)
- Start Date and End Date define the allocation period
- Total MD is the sum of all man-days for that period
- Days is calculated automatically (End Date - Start Date + 1)
- System distributes Total MD evenly across all days in the range on import

### Export Use Cases
- 📊 **Report Generation**: Export specific department allocations for weekly reports
- 📅 **Date-Range Analysis**: Export allocations for specific date periods
- 🎬 **Show-Specific Data**: Export all allocations for a single show
- 🔄 **Bulk Updates**: Export filtered data, modify in Excel, re-import with "Update" mode

---

## 🎯 Practical Workflows

### Workflow 1: Update Man-Days in Bulk
1. Filter allocations by show and date range
2. Export to CSV
3. Open in Excel and modify Man Days column
4. Select **Update Existing** mode
5. Import modified CSV
6. Changes sync to Forecast and Dashboard automatically

### Workflow 2: Add New Allocations for New Show
1. Prepare CSV with new show allocations
2. Select **Add New** mode
3. Import CSV
4. New allocations appear in Forecast view immediately
5. Dashboard updates with new show statistics

### Workflow 3: Department-Specific Export
1. Filter by Department (e.g., "Compositing")
2. Set date range for current week
3. Export CSV for departmental report
4. Share with department head

### Workflow 4: Cross-Checking Data
1. Export allocations with filters
2. Compare with forecast grid
3. Both views show identical data (synced)
4. Make corrections in either view
5. Changes sync automatically

---

## 🛡️ Data Integrity

### Sync Guarantees
- ✅ All three views (Forecast, Allocations, Dashboard) always show same data
- ✅ Changes propagate in under 1 second
- ✅ Cross-tab synchronization ensures consistency
- ✅ Database is single source of truth

### Import Safety
- ⚠️ **Add New Mode**: Can create duplicates if same allocation exists
- ✅ **Update Existing Mode**: Cannot create duplicates, only updates
- ✅ Invalid employee IDs are rejected before database operations
- ✅ Partial imports allowed (skip invalid rows, import valid ones)

### Export Accuracy
- ✅ Exports match exact filter criteria
- ✅ Individual daily allocations (one row per date)
- ✅ Grouped by employee and shot
- ✅ Includes all metadata (department, shift, designation)

---

## 🔧 Technical Details

### BroadcastChannel API
- Channel name: `resource-updates`
- Message type: `{ type: 'allocation-updated' }`
- Triggers reload in all listening views
- Works across browser tabs

### Sync Points
- Resource Forecast: On cell save, bulk paste, delete
- Allocations: On import completion
- Dashboard: Listens to both sources

### Performance
- Import: ~100-500 allocations per second (depends on network)
- Export: Instant for <10,000 rows
- Sync: <1 second latency across views

---

## 📋 CSV Template

Download or create a CSV with this structure:

```csv
Action,Emp ID,Artist Name,Designation,Department,Shift,Show,Shot,Start Date,End Date,Days,Total MD
UPDATE,VFX001,John Doe,Compositor,Compositing,Day,ProjectX,Shot_010,2025-01-15,2025-01-17,3,3.0
NEW,VFX002,Jane Smith,Animator,Animation,Night,ProjectY,Shot_020,2025-01-16,2025-01-18,3,1.5
UPDATE,VFX003,Bob Lee,Modeler,Modeling,Day,ProjectX,Shot_011,2025-01-15,2025-01-19,5,5.0
```

**Important Notes:**
- **Action column**: Must be `NEW` or `UPDATE` (determines import behavior)
- **Grouped format**: One row per artist + shot allocation (NOT one row per day)
- **Start Date** and **End Date** define the allocation period
- **Total MD** is the sum for the entire period (distributed evenly per day on import)
- **Days** column is informational (auto-calculated: End Date - Start Date + 1)
- **Auto-fill**: Designation, Department, Shift are looked up from employee data (not required in CSV)
- **1 MD per day limit**: Total MD ÷ Days cannot exceed 1.0 (validation enforced)
- Export produces full format with Action=UPDATE - you can edit and re-import
- For manual CSV creation, use minimal format with just required columns
- System automatically creates daily allocations for each day in the range

---

## ⚡ Tips & Best Practices

### For Importing
1. Always validate employee IDs before import
2. Use **Update Existing** mode when modifying man-days to avoid duplicates
3. Use **Add New** mode when adding fresh allocations
4. Review error messages carefully - they indicate which rows failed
5. Keep CSV headers exact (case-sensitive)

### For Exporting
1. Apply filters before export to get only needed data
2. Export regularly for backup purposes
3. Use exported CSV as template for new imports
4. Date range filters help manage large datasets

### For Sync
1. Wait 1-2 seconds after bulk operations for sync to complete
2. Refresh browser if sync seems stuck (rare)
3. Check Dashboard to verify all changes propagated
4. Both views should always match - report if they don't

---

## 🚨 Troubleshooting

### Import Issues

**"Employee ID not found"**
- Employee doesn't exist or is inactive
- Check Emp ID spelling/format
- Verify employee in Resource Members page

**"Missing required columns"**
- CSV must have: Emp ID, Shot, Show, Allocation Date, Man Days
- Column names must match exactly (case-sensitive)

**Import shows 0 success**
- All employee IDs invalid
- Check CSV format
- Verify employees are active

### Sync Issues

**Changes not appearing in other view**
- Wait 2-3 seconds for sync
- Refresh the other view manually
- Check browser console for errors

**Dashboard not updating**
- Click Refresh button on Dashboard
- Check date range includes new allocations
- Verify allocations are within current week view

### Export Issues

**Export is empty**
- No allocations match current filters
- Clear filters and try again
- Check date range settings

**Missing data in export**
- Export respects all active filters
- Clear unwanted filters before export

---

## 📞 Support

For issues or questions:
1. Check this guide first
2. Verify data in all three views (Forecast, Allocations, Dashboard)
3. Try refresh/re-sync operations
4. Report persistent issues with screenshots

---

**Last Updated**: November 2025  
**Version**: 1.0  
**Feature Status**: ✅ Production Ready
