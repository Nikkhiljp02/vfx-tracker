# Advanced Filtering & Saved Views Guide

## Overview

The Resource Forecast view now includes powerful filtering and bulk operation features to help you manage allocations more efficiently.

## Features Implemented

### 1. Advanced Filtering

Filter your resource view by multiple criteria:

#### Available Filters

- **Department** - Filter by department (existing)
- **Shift** - Filter by shift (existing)  
- **Show** - Filter by specific show/project
- **Utilization** - Filter by allocation status:
  - **All** - Show everyone
  - **Overallocated** - Show only artists with >1.0 MD/day average
  - **Available** - Show only artists with 0 MD allocations
  - **Partial** - Show only artists with 0-1.0 MD/day average
- **Search** - Search by employee name, ID, or shot name (existing)

#### How to Use Filters

1. Navigate to the Resource Forecast view
2. Use the filter dropdowns in the toolbar
3. Filters combine (AND logic) - all active filters must match
4. Click "Clear View" to reset all filters

### 2. Saved Views

Save your favorite filter combinations for quick access.

#### Creating a Saved View

1. Apply the filters you want to save
2. Click the **"Save View"** button in the toolbar
3. Enter a name for your view (e.g., "My Team", "Overallocated Artists")
4. Choose options:
   - **Make this view public** - Share with all users
   - **Add to Quick Filters bar** - Pin to the top for one-click access
5. Click "Save View"

#### Using Saved Views

**Quick Filter Bar:**
- Quick filter views appear as buttons at the top of the page
- Click any button to instantly apply that filter set
- Active quick filter is highlighted in blue

**Saved Views Dropdown:**
- Click the saved views dropdown to see all your views + public views
- Select a view to apply it
- Click the ❌ button to delete a view you created

#### Managing Saved Views

- **Apply**: Click a saved view name or quick filter button
- **Delete**: Click the ❌ next to the view in the dropdown (only for your own views)
- **Clear**: Click "Clear View" to remove all filters

### 3. Bulk Operations

Perform operations on multiple allocations at once.

#### Bulk Reassign Allocations

Move all allocations from one artist to another for a date range.

**How to Use:**
1. Click **"Bulk Operations"** → **"Bulk Reassign Allocations"**
2. Select the source artist (move FROM)
3. Select the target artist (move TO)
4. Choose date range:
   - All visible dates
   - Current week (7 days from today)
5. Click "Reassign Allocations"

**What it does:**
- Deletes all allocations from the source artist in the selected date range
- Creates identical allocations for the target artist
- Preserves show name, shot name, man-days, and all other properties

**Use cases:**
- Artist leaving a show
- Reassigning work due to availability changes
- Balancing workload between artists

#### Bulk Copy Week Pattern

Copy a 7-day allocation pattern from one week to another for an artist.

**How to Use:**
1. Click **"Bulk Operations"** → **"Copy Week Pattern"**
2. Select the artist
3. Choose source week start date (the week to copy FROM)
4. Choose target week start date (the week to copy TO)
5. Click "Copy Week Pattern"

**What it does:**
- Copies all allocations for 7 days starting from the source date
- Creates duplicate allocations for 7 days starting from the target date
- Preserves existing allocations in the target week (doesn't delete)

**Use cases:**
- Repeating weekly allocation patterns
- Copying a successful week's schedule to future weeks
- Template-based allocation

### 4. Keyboard Shortcuts (Future)

_Coming soon:_
- `Ctrl+S` - Save current view
- `Ctrl+R` - Bulk reassign
- `Ctrl+W` - Copy week pattern

## Technical Details

### Database Schema

New `SavedView` table stores filter configurations:

```prisma
model SavedView {
  id            String   @id @default(cuid())
  name          String
  viewType      String   @default("resource")
  filters       String   // JSON: {department, shift, show, utilization, search, etc.}
  isPublic      Boolean  @default(false)
  isQuickFilter Boolean  @default(false)
  createdBy     String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

### API Endpoints

- `GET /api/saved-views?viewType=resource` - Fetch user's + public views
- `POST /api/saved-views` - Create new saved view
- `PATCH /api/saved-views/[id]` - Update saved view
- `DELETE /api/saved-views/[id]` - Delete saved view

### Filter Storage

Filters are stored as JSON strings:

```json
{
  "department": "Compositing",
  "shift": "all",
  "show": "Project Alpha",
  "utilization": "overallocated",
  "search": "",
  "startDate": "2025-11-17",
  "dateRange": 30
}
```

## Best Practices

### Creating Effective Saved Views

1. **Be Specific** - Name views clearly ("Comp - Overallocated" not "View 1")
2. **Use Quick Filters** - Mark frequently-used views as quick filters
3. **Share Public Views** - Make team-wide views public for consistency
4. **Combine Filters** - Use multiple filters together (e.g., Department + Utilization)

### Using Bulk Operations Safely

1. **Check Before Reassigning** - Verify target artist availability
2. **Use Undo** - Bulk operations can be undone with Ctrl+Z
3. **Test with Small Ranges** - Try one week before doing larger ranges
4. **Verify Sync** - Changes sync to Allocations page automatically

### Performance Tips

1. **Limit Date Ranges** - Shorter date ranges = faster filtering
2. **Use Quick Filters** - Pre-load frequently-used filter sets
3. **Clear Inactive Filters** - Remove filters you're not actively using

## Common Workflows

### Finding Overallocated Artists

1. Set Utilization filter to "Overallocated"
2. Review artists with >1.0 MD/day average
3. Use bulk reassign to balance workload
4. Save as "Overallocated Check" quick filter for daily use

### Managing Department Allocations

1. Filter by Department (e.g., "Compositing")
2. Filter by Show to focus on specific project
3. Review allocations and adjust as needed
4. Save as "[Dept] - [Show]" view for team leads

### Weekly Planning

1. Use "Available" utilization filter to find free artists
2. Copy successful week patterns to future weeks
3. Reassign work from overallocated to available artists
4. Export to CSV for stakeholder review

## Troubleshooting

### Saved View Not Appearing

- Check if you're filtering by viewType (should be "resource")
- Refresh the page to reload saved views
- Verify you're logged in as the view creator (for private views)

### Bulk Operation Not Working

- Ensure source and target are different (can't reassign to same artist)
- Check date range has allocations in it
- Verify you have edit permissions
- Use Undo (Ctrl+Z) if operation went wrong

### Filters Not Applying

- Clear browser cache and reload
- Check if active view is overriding your manual filters
- Click "Clear View" to reset all filters
- Try saving and re-applying the filter combination

## Updates & Future Enhancements

### Coming Soon

- [ ] Keyboard shortcuts for power users
- [ ] Bulk delete allocations by criteria
- [ ] Export filtered view to CSV
- [ ] Duplicate saved view
- [ ] View usage analytics
- [ ] Preset filter templates
- [ ] Multi-select for bulk reassign (reassign multiple artists at once)

### Changelog

**v1.0 - November 2025**
- Initial release of Advanced Filtering & Saved Views
- Show filter, Utilization filter
- Quick filter bar
- Saved views with public/private options
- Bulk reassign allocations
- Bulk copy week pattern

## Support

For issues or feature requests related to advanced filtering and bulk operations, contact your system administrator or refer to the main VFX Tracker documentation.
