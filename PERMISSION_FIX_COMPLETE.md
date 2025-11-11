# View-Only Permission Fix - Complete Implementation

## Issue Reported
View-only users (with `canEdit=false` in ShowAccess) were able to edit tasks and data in both detailed view and non-detailed view despite having only viewing access.

## Root Cause
The frontend never received or checked the `ShowAccess.canEdit` permission. Backend APIs were already protected (returning 403 errors), but the UI was showing edit controls to all users, creating a poor user experience.

## Comprehensive Solution Implemented

### 1. Backend - Data Layer ✅
**File: `app/api/shows/route.ts`**

- Modified GET endpoint to include `canEdit` flag with each show
- Admin/Coordinator users: All shows have `canEdit: true`
- Regular users: `canEdit` value comes from ShowAccess table
- Uses Prisma `include` to fetch ShowAccess relationships

```typescript
// For regular users
const userShowAccess = await prisma.showAccess.findMany({
  where: { userId: user.id },
  include: { show: { include: { shots: { include: { tasks: true }}}}}
});

const showsWithPermissions = userShowAccess.map(access => ({
  ...access.show,
  canEdit: access.canEdit
}));
```

### 2. Type Safety ✅
**File: `lib/types.ts`**

- Added `canEdit?: boolean` to Show interface
- Ensures TypeScript checks permission usage across components

### 3. Detailed View - TaskCell Protection ✅
**File: `components/TaskCell.tsx`**

**Implemented:**
- Added `canEdit` permission check via useMemo
- Lock icon (🔒) for view-only cells
- Gray background for non-editable cells
- Tooltip: "View only - No edit permission"
- Cells not clickable when `canEdit=false`

**Visual Changes:**
- View-only: Gray background, lock icon, not clickable
- Edit access: White background, pencil icon on hover, clickable

### 4. Non-Detailed View - Multi-Cell Selection Protection ✅
**File: `components/TrackerTable.tsx`**

**Implemented:**
- Added `hasEditPermission` check
- Modified `handleCellClick()` - Returns early if no edit permission
- Modified `handleCellRightClick()` - Prevents context menu for view-only users
- Context menu with status change options hidden

**Protection Added:**
```typescript
const handleCellClick = (cellId: string, e: React.MouseEvent, rowIndex: number) => {
  if (detailedView) return;
  if (!hasEditPermission) return; // NEW: View-only users cannot select cells
  // ... rest of logic
};

const handleCellRightClick = (e: React.MouseEvent, cellId: string, rowIndex: number) => {
  if (detailedView) return;
  if (!hasEditPermission) return; // NEW: View-only users cannot access context menu
  // ... rest of logic
};
```

### 5. Header Button Visibility ✅
**File: `components/Header.tsx`**

**Buttons Hidden for View-Only Users:**
- ❌ Import (Excel upload)
- ❌ Update (bulk update)
- ❌ New Shot
- ❌ New Show (unless Admin/Coordinator)
- ❌ Status Management (unless Admin/Coordinator)

**Always Visible:**
- ✅ Template Download
- ✅ Export
- ✅ Activity Log

**User Menu Indicator:**
- Shows "✏️ Edit Access" or "👁️ View Only" based on permissions

### 6. Bulk Actions Protection ✅
**File: `components/BulkActionsBar.tsx`**

**Implemented:**
- Added `hasEditPermission` check on selected shots
- Bar returns `null` (hidden) if no edit permission on any selected shot
- Prevents access to:
  - Update ETA
  - Update Lead
  - Update Status
  - Update Turnover
  - Delete shots

```typescript
const hasEditPermission = useMemo(() => {
  if (selectedShotIds.size === 0) return false;
  const selectedShots = shots.filter(s => selectedShotIds.has(s.id));
  return selectedShots.some(shot => {
    const show = shows.find(sh => sh.id === shot.showId);
    return show?.canEdit === true;
  });
}, [selectedShotIds, shots, shows]);

if (!hasEditPermission) return null;
```

### 7. Selection Mode Toggle Hidden ✅
**File: `components/FilterPanel.tsx`**

**Implemented:**
- Added `hasEditPermission` check
- Selection Mode toggle button hidden for view-only users
- Prevents enabling selection mode for bulk operations
- Button conditionally rendered:

```typescript
{hasEditPermission && (
  <button onClick={toggleSelectionMode}>
    Enable Selection
  </button>
)}
```

### 8. Department View Protection ✅
**File: `components/DepartmentView.tsx`**

**Implemented:**
- Added `useSession` hook and `hasEditPermission` check
- Modified `handleCellClick()` - Returns early if no edit permission
- Modified `handleCellRightClick()` - Prevents context menu for view-only users
- Same protection as TrackerTable for non-detailed view

**Protection Pattern:**
```typescript
const handleCellClick = (cellId: string, e: React.MouseEvent, rowIndex: number) => {
  if (detailedView) return;
  if (!hasEditPermission) return; // View-only users cannot select cells
  // ... rest of logic
};

const handleCellRightClick = (e: React.MouseEvent, cellId: string, rowIndex: number) => {
  if (detailedView) return;
  if (!hasEditPermission) return; // View-only users cannot access context menu
  // ... rest of logic
};
```

### 9. Activity Log Undo Protection ✅
**File: `components/ActivityLogModal.tsx`**

**Implemented:**
- Added `canUndo` permission check (Admin/Coordinator only)
- Undo and Restore buttons hidden for regular users
- View-only users can view activity logs but cannot reverse changes

**Protection:**
```typescript
const canUndo = useMemo(() => {
  if (!session?.user) return false;
  const role = (session.user as any).role;
  return role === 'ADMIN' || role === 'COORDINATOR';
}, [session]);

// In render:
{canUndo && !log.isReversed && (log.actionType === 'UPDATE' || log.actionType === 'DELETE') && (
  <button onClick={() => handleUndo(log.id)}>
    Undo/Restore
  </button>
)}
```

## Permission Check Pattern

All components now use this consistent pattern:

```typescript
import { useSession } from 'next-auth/react';

const { data: session } = useSession();

const hasEditPermission = useMemo(() => {
  if (!session?.user) return false;
  const role = (session.user as any).role;
  if (role === 'ADMIN' || role === 'COORDINATOR') return true;
  return shows.some(show => show.canEdit === true);
}, [session, shows]);
```

## Files Modified

1. ✅ `app/api/shows/route.ts` - Returns canEdit with shows
2. ✅ `lib/types.ts` - Added canEdit to Show interface
3. ✅ `components/TaskCell.tsx` - Lock icon, non-clickable cells
4. ✅ `components/TrackerTable.tsx` - Disabled cell selection and context menu (non-detailed view)
5. ✅ `components/DepartmentView.tsx` - Disabled cell selection and context menu (department view)
6. ✅ `components/Header.tsx` - Conditional button rendering
7. ✅ `components/BulkActionsBar.tsx` - Hidden for view-only
8. ✅ `components/FilterPanel.tsx` - Hidden selection mode toggle
9. ✅ `components/ActivityLogModal.tsx` - Hidden undo/restore buttons for non-admin users

## Testing Checklist

### As Admin User:
- [x] Can edit all tasks
- [x] All buttons visible
- [x] Selection mode available
- [x] Bulk actions available
- [x] Context menu works

### As View-Only User (canEdit=false):
- [x] Cannot click task cells in detailed view (lock icon shown)
- [x] Cannot select cells in non-detailed view
- [x] No context menu on right-click
- [x] Import/Update/New Shot buttons hidden
- [x] Selection mode toggle hidden
- [x] Bulk actions bar never appears
- [x] User menu shows "👁️ View Only"
- [x] Can still view all data
- [x] Can export and download templates
- [x] Can access activity log (read-only)

### Department View:
- [x] Same TaskCell component, same protections apply
- [x] View-only users see lock icons
- [x] No edit capabilities
- [x] Cannot select cells in non-detailed view
- [x] No context menu access
- [x] Same protection as main tracker table

### Activity Log:
- [x] View-only users can view all activity logs
- [x] Undo/Restore buttons hidden for non-admin users
- [x] Only Admin and Coordinator can undo/restore changes

## Defense-in-Depth Strategy

1. **UI Layer**: Controls hidden/disabled
2. **Interaction Layer**: Click handlers return early
3. **Visual Feedback**: Lock icons, gray backgrounds
4. **Component Layer**: Permission checks in each component
5. **Data Layer**: API includes permission flags
6. **API Layer**: Backend still validates (returns 403 if bypassed)

## Known Behaviors

### View-Only Users CAN:
- ✅ View all tracker data
- ✅ Use filters
- ✅ Search for shots
- ✅ Export data to Excel
- ✅ Download templates
- ✅ View activity logs
- ✅ View shot notes/chat (read-only)
- ✅ Toggle detailed/non-detailed view
- ✅ Adjust table density
- ✅ Sort columns
- ✅ Resize columns

### View-Only Users CANNOT:
- ❌ Edit task status (both detailed and non-detailed views)
- ❌ Click/select cells in non-detailed view (TrackerTable)
- ❌ Click/select cells in department view
- ❌ Access context menu in any view
- ❌ Use selection mode
- ❌ Access bulk actions
- ❌ Import Excel files
- ❌ Create new shots
- ❌ Create new shows
- ❌ Delete anything
- ❌ Update ETAs, leads, turnovers
- ❌ Undo or restore changes in Activity Log

## Next Steps

1. ✅ Test with actual view-only user account
2. ✅ Verify all edit controls are hidden
3. ✅ Verify context menu doesn't appear
4. ✅ Test department view permissions
5. ⏳ Deploy to production when ready

## Migration to Cloud

When deploying to Vercel + Supabase:
- All permission logic will work identically
- ShowAccess table will migrate via Prisma
- No code changes needed for permissions
- Environment variables need updating (DATABASE_URL, NEXTAUTH_SECRET)

## Summary

The permission system now enforces view-only access at **9 different layers**:
1. API data (canEdit flag)
2. TaskCell component (lock icon, non-clickable in detailed view)
3. TrackerTable handlers (cell selection disabled in non-detailed view)
4. DepartmentView handlers (cell selection disabled in non-detailed view)
5. Header buttons (hidden for view-only)
6. BulkActionsBar (hidden for view-only)
7. FilterPanel (selection mode toggle hidden)
8. ActivityLogModal (undo/restore hidden for non-admin)
9. Backend validation (403 errors if bypassed)

View-only users now have a clear, consistent experience with visual indicators (lock icons, hidden controls) showing they cannot edit data across **all views** including:
- ✅ Tracker Table (detailed view)
- ✅ Tracker Table (non-detailed view)
- ✅ Department View (detailed view)
- ✅ Department View (non-detailed view)
- ✅ Activity Log (view-only, no undo)
