# Shot Ingest Feature - User Guide

## Overview
The Shot Ingest feature allows you to add multiple shots with their tasks in bulk using an Excel file. This is perfect for onboarding new shows or adding many shots at once.

## How to Use

### Step 1: Click Import Button
In the header, click the **Import** button (purple button with upload icon).

### Step 2: Choose Import Option
A modal will appear with two options:
- **Shot Ingest**: Add new shots in bulk
- **Update Data**: Update existing shots and tasks

Select **Shot Ingest**.

### Step 3: Download Template
Click the **Download Template** button to download the Excel template file:
`VFX_Shot_Ingest_Template.xlsx`

### Step 4: Fill the Template
Open the template file and fill in your shot data. The template has these columns:

| Column | Description | Example | Required |
|--------|-------------|---------|----------|
| Show Name | Name of the show (must exist) | "Example Show" | Yes |
| Shot Name | Unique shot identifier | "100_010_0010" | Yes |
| Shot Tag | Fresh or Retake | "Fresh" | Yes |
| Scope of Work | Description of the work | "CG Environment..." | No |
| Department | Department name | "Comp" | Yes |
| Is Internal | "Yes" or "No" | "No" | Yes |
| Status | Task status | "YTS" | Yes |
| Lead Name | Artist name | "John Doe" | No |
| Bid (MDs) | Man-days estimate | 2 | No |
| Internal ETA | Date (YYYY-MM-DD) | "2025-11-15" | No |
| Client ETA | Date (YYYY-MM-DD) | "2025-11-20" | No |

**Important Notes:**
- One shot can have multiple rows (one per department task)
- Show must already exist in the system
- Shot names must be unique within a show
- Date format must be YYYY-MM-DD
- Leave Internal ETA and Client ETA empty for internal tasks if not needed

### Step 5: Import the File
1. Click **Ingest Shots** button
2. Select your filled Excel file
3. Wait for the import to complete
4. You'll see a summary of:
   - Successfully created shots
   - Failed shots (if any)
   - Error messages for troubleshooting

## Example Template Data

```
Show Name: Example Show
Shot Name: 100_010_0010
Shot Tag: Fresh
Scope of Work: CG Environment with character integration
Department: Comp
Is Internal: No
Status: YTS
Lead Name: John Doe
Bid (MDs): 2
Internal ETA: 2025-11-15
Client ETA: 2025-11-20

Show Name: Example Show
Shot Name: 100_010_0010
Shot Tag: Fresh
Scope of Work: CG Environment with character integration
Department: Paint
Is Internal: Yes
Status: YTS
Lead Name: Jane Smith
Bid (MDs): 1
Internal ETA: 2025-11-13
Client ETA: (leave empty)
```

This creates one shot (100_010_0010) with two tasks (Comp and Paint).

## Common Errors and Solutions

### "Show not found"
**Problem**: The show name doesn't exist in your system.
**Solution**: Create the show first using "New Show" button, or check the spelling.

### "Shot already exists"
**Problem**: A shot with the same name already exists in that show.
**Solution**: Use a different shot name, or use "Update Data" instead to modify existing shots.

### "Invalid date format"
**Problem**: Date is not in YYYY-MM-DD format.
**Solution**: Format dates as 2025-11-15 (not 11/15/2025 or 15-Nov-2025).

### "Invalid status"
**Problem**: Status name doesn't match any in your system.
**Solution**: Check your status options and use exact names (case-sensitive).

## Tips for Success

1. **Start Small**: Test with 2-3 shots first to verify the format
2. **Use Show Names Exactly**: Copy-paste show names from the tracker to avoid typos
3. **Consistent Formatting**: Keep date formats consistent (YYYY-MM-DD)
4. **One Shot, Multiple Tasks**: Add multiple rows for the same shot if it has multiple departments
5. **Internal Tasks**: For internal tasks, leave Client ETA empty and set "Is Internal" to "Yes"
6. **Backup First**: Export your current data before doing large imports

## Keyboard Shortcut
Press **Ctrl+I** to quickly open the import modal!

## Update vs Ingest

- **Shot Ingest**: Creates NEW shots (will skip if shot already exists)
- **Update Data**: Modifies EXISTING shots and tasks (will show preview of changes)

Use Shot Ingest for onboarding new work, and Update Data for modifying existing shots.
