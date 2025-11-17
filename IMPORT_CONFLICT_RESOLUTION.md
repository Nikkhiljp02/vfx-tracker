# Import with Conflict Resolution Guide

## Overview

The enhanced CSV/Excel import system now includes:
- **Preview Mode** - Analyze your file before importing
- **Conflict Detection** - Identifies overlapping allocations
- **Merge Strategies** - Choose how to handle conflicts
- **Validation Report** - Detailed errors and warnings
- **Diff View** - Compare new vs. existing data

## Import Workflow

### Step 1: Upload & Analyze

1. Click "Import Allocations" button in Resource Forecast
2. Download template (optional) to see required format
3. Select your Excel/CSV file
4. Click "Analyze File →"

The system will scan your file and categorize each row as:
- ✅ **Valid** - No issues, ready to import
- ⚠️ **Conflict** - Overlaps with existing allocations
- ❌ **Error** - Missing required fields or invalid data

### Step 2: Review Preview

The preview screen shows:

#### Summary Dashboard
- **Total Rows** - Number of rows in your file
- **Valid** - Rows that can be imported directly
- **Conflicts** - Rows with overlapping date ranges
- **Errors** - Rows that need to be fixed

#### Validation Errors
If any errors are found:
- **Must fix before importing**
- List shows row number and specific issue
- Fix in Excel and re-upload

#### Conflict Resolution
If conflicts are detected, choose a merge strategy:

**🔄 Replace Existing** (Default)
- Deletes ALL existing allocations for the member on conflicting dates
- Then adds the new allocations from your file
- **Use when:** Updating/correcting allocations
- **Example:** You have new shot assignments that should replace old ones

**➕ Add Alongside**
- Keeps existing allocations
- Adds new allocations from your file
- May result in >1.0 MD/day (overallocation)
- **Use when:** Adding additional work to existing allocations
- **Example:** Artist is already allocated 0.5 MD to Show A, you want to add 0.3 MD to Show B

**⏭️ Skip Conflicts**
- Only imports rows without conflicts
- Skips any rows that overlap with existing data
- **Use when:** Doing a bulk import and want to avoid touching existing data
- **Example:** Importing future allocations while preserving current week

#### Warnings
Non-blocking issues that won't prevent import:
- Potential overallocations (>1.0 MD/day)
- Unusual date ranges
- Missing optional fields

### Step 3: Import

1. Choose your merge strategy (if there are conflicts)
2. Review the import summary
3. Click "Import X Records"
4. System processes:
   - Applies merge strategy to conflicts
   - Validates all data
   - Creates allocations in database
   - Syncs to all open views

### Step 4: Review Results

Success screen shows:
- **Imported** - Number of allocations created
- **Replaced** - Number of existing allocations deleted
- **Skipped** - Number of conflicting rows skipped
- **Warnings** - Any issues encountered

## Excel Format

### Required Columns

| Column | Required | Description | Example |
|--------|----------|-------------|---------|
| **Action** | Yes | NEW or UPDATE | UPDATE |
| **Emp ID** | Yes | Employee identifier | EMP001 |
| **Show Name** | No* | Project name | Project Alpha |
| **Shot Name** | No* | Shot identifier | SH0010 |
| **Start Date** | Yes | YYYY-MM-DD | 2025-11-18 |
| **End Date** | Yes | YYYY-MM-DD | 2025-11-22 |
| **Total MD** | Yes | Total man-days for range | 2.5 |
| **Notes** | No | Comments | Compositing work |

\* Required unless marking as Leave or Idle

### Action Column

- **NEW** - Add to existing allocations (even if dates overlap)
- **UPDATE** - Replace existing allocations for these dates

### Calculated Fields

- **Days** = (End Date - Start Date) + 1
- **Per-Day MD** = Total MD ÷ Days

**Validation:** Per-Day MD must be ≤ 1.0

## Examples

### Example 1: Simple Import (No Conflicts)

**Excel Data:**
```
Action | Emp ID | Show Name     | Shot Name | Start Date | End Date   | Total MD | Notes
NEW    | EMP001 | Project Alpha | SH0010    | 2025-12-01 | 2025-12-05 | 5.0      | Comp work
NEW    | EMP002 | Project Beta  | SH0020    | 2025-12-01 | 2025-12-03 | 1.5      | Animation
```

**Result:**
- All rows valid (no conflicts)
- Import creates 8 daily allocations (5 days for EMP001, 3 for EMP002)
- EMP001: 1.0 MD/day, EMP002: 0.5 MD/day

### Example 2: Update with Conflicts

**Existing in Database:**
```
EMP001: 2025-12-01 to 2025-12-05 - Project Alpha - SH0010 - 1.0 MD/day
```

**Excel Data:**
```
Action | Emp ID | Show Name    | Shot Name | Start Date | End Date   | Total MD
UPDATE | EMP001 | Project Beta | SH0050    | 2025-12-01 | 2025-12-05 | 3.0
```

**With "Replace Existing":**
1. Deletes Project Alpha allocation (5 days)
2. Creates Project Beta allocation (5 days × 0.6 MD/day)

**With "Add Alongside":**
1. Keeps Project Alpha (1.0 MD/day)
2. Adds Project Beta (0.6 MD/day)
3. ⚠️ Warning: Total = 1.6 MD/day (overallocated)

**With "Skip Conflicts":**
1. Skips this row entirely
2. No changes to database

### Example 3: Partial Conflicts

**Existing:**
```
EMP001: 2025-12-01 to 2025-12-03 - Project Alpha - 1.0 MD/day
```

**Excel:**
```
Action | Emp ID | Show Name    | Start Date | End Date   | Total MD
UPDATE | EMP001 | Project Beta | 2025-12-01 | 2025-12-10 | 5.0
UPDATE | EMP002 | Project Gamma| 2025-12-01 | 2025-12-05 | 2.5
```

**Result:**
- Row 1: **Conflict** (overlaps Dec 1-3)
- Row 2: **Valid** (no existing allocation for EMP002)

**With "Replace Existing":**
- EMP001: Deletes Alpha (Dec 1-3), creates Beta (Dec 1-10, 0.5 MD/day)
- EMP002: Creates Gamma (Dec 1-5, 0.5 MD/day)

## Common Scenarios

### Scenario: Weekly Resource Planning

**Goal:** Import next week's allocations without touching current week

**Strategy:**
1. Export current allocations to check dates
2. Create new Excel with future dates only
3. Use **Action = NEW**
4. Import with "Skip Conflicts" strategy

### Scenario: Correcting Wrong Allocations

**Goal:** Fix incorrect show/shot assignments

**Strategy:**
1. Export current allocations
2. Edit Show Name / Shot Name in Excel
3. Use **Action = UPDATE**
4. Import with "Replace Existing" strategy

### Scenario: Adding Secondary Work

**Goal:** Artist already allocated to Show A, add Show B work

**Strategy:**
1. Create Excel with new Show B allocations
2. Use **Action = NEW** or "Add Alongside" strategy
3. Monitor warnings for overallocation
4. Adjust MD values if needed

### Scenario: Bulk Update from Production

**Goal:** Import master schedule from production team

**Strategy:**
1. Get Excel export from production
2. Add **Action** column (UPDATE for all rows)
3. Analyze to see conflicts
4. Use "Replace Existing" to apply production schedule
5. Review warnings for overallocations

## Troubleshooting

### "Row X: Missing Emp ID"
- **Cause:** Employee ID column is empty or misspelled
- **Fix:** Ensure "Emp ID" column has values for all rows

### "Row X: Employee EMP999 not found"
- **Cause:** Employee doesn't exist in Resource Members
- **Fix:** Import employee first or use valid Emp ID

### "Row X: Invalid dates"
- **Cause:** Date format not recognized
- **Fix:** Use YYYY-MM-DD format (e.g., 2025-12-15)

### "Row X: Per-day MD exceeds 1.0"
- **Cause:** Total MD ÷ Days > 1.0
- **Fix:** Reduce Total MD or increase date range
- **Example:** 5 MD over 3 days = 1.67 MD/day ❌

### "All rows have conflicts, nothing to import"
- **Cause:** Using "Skip Conflicts" with all overlapping dates
- **Fix:** Use "Replace Existing" or "Add Alongside" instead

### Warnings about overallocation
- **Not blocking** - Import will still succeed
- **Review:** Check if artists can handle >1.0 MD/day
- **Adjust:** Reduce MD values or spread work over more days

## Best Practices

1. **Always Analyze First** - Use preview mode before importing
2. **Small Batches** - Import weekly instead of monthly for easier conflict resolution
3. **Action Column Discipline** - Be explicit with NEW vs UPDATE
4. **Check Existing Data** - Export current allocations before bulk updates
5. **Validate Externally** - Check your Excel formulas before import
6. **Use Templates** - Download and modify the provided template
7. **Review Warnings** - Don't ignore overallocation warnings
8. **Test with Sample** - Import 5-10 rows first, verify, then do full import

## Advanced Tips

### Bulk Replace All Allocations
```
Action = UPDATE for all rows
Strategy = Replace Existing
```
Wipes and recreates all allocations for specified date ranges.

### Safe Incremental Import
```
Action = NEW for all rows  
Strategy = Skip Conflicts
```
Only adds genuinely new allocations, never modifies existing.

### Overwrite Specific Artists
```
Filter Excel to specific Emp IDs
Action = UPDATE
Strategy = Replace Existing
```
Targeted updates without affecting other team members.

### Validation-Only Run
```
Click "Analyze File"
Review errors and warnings
Fix Excel file
Re-analyze until clean
Then import
```
Iterative approach to ensure data quality.

## Integration with Existing Features

### Bidirectional Sync
- Imports automatically sync to Dashboard and Allocations views
- Changes appear in all open tabs within 1 second

### Undo Support
- Import creates single undo checkpoint
- Ctrl+Z to revert entire import
- Only works if still in same session

### Weekend Working
- Import respects weekend working flag
- Allocations on Sat/Sun only if weekend mode enabled

### Validation Rules
- 1 MD per day limit still enforced
- Action column logic applies (NEW vs UPDATE)
- Auto-fill designation, department from employee data

## API Reference

### Preview Endpoint
```
POST /api/resource/allocations/import
FormData: { file, preview: 'true' }
Returns: { preview: { valid, conflicts, errors, warnings } }
```

### Import Endpoint
```
POST /api/resource/allocations/import
FormData: { file, preview: 'false', mergeStrategy: 'replace'|'add'|'skip' }
Returns: { success, imported, replaced, skipped, warnings }
```

## Future Enhancements

- [ ] Save merge strategy preference per user
- [ ] Export conflict report to Excel
- [ ] Dry-run mode (preview import without committing)
- [ ] Import history log
- [ ] Template library (common patterns)
- [ ] Batch undo (undo multiple imports)
- [ ] Smart conflict resolution (ML-based suggestions)

---

**Updated:** November 2025  
**Version:** 2.0
