# Admin Panel Bug Fixes - November 19, 2025

## Issues Fixed

### 1. Department Deactivate Button Not Working ✅
**Problem:** Clicking deactivate/activate button in departments tab had no effect.

**Root Cause:** Missing PATCH endpoint for `/api/departments/[id]`

**Solution:** 
- Created new file: `app/api/departments/[id]/route.ts` with PATCH method
- Updated `app/api/departments/route.ts` to support `?includeInactive=true` query parameter
- Updated Shows page to fetch departments with `includeInactive=true`

**Files Modified:**
- ✅ Created `app/api/departments/[id]/route.ts` (27 lines)
- ✅ Modified `app/api/departments/route.ts` (added includeInactive parameter)
- ✅ Modified `app/admin/shows/page.tsx` (fetch call updated)

---

### 2. Status Option Deactivate Button Not Working ✅
**Problem:** Clicking deactivate/activate button in status options tab had no effect.

**Root Cause:** Missing PATCH method in `/api/status-options/[id]` (only had PUT and DELETE)

**Solution:** 
- Added PATCH method to existing `app/api/status-options/[id]/route.ts`
- PATCH handles toggle operation (isActive only)
- PUT handles full updates (name, color, order, isActive)

**Files Modified:**
- ✅ Modified `app/api/status-options/[id]/route.ts` (added PATCH method, 53 lines)

---

### 3. Shot Count Showing 0 for Shows ✅
**Problem:** NAPEX show has shots in database but admin panel shows 0.

**Root Cause:** `/api/shows` route was including full shots relation but not exposing `_count` field

**Solution:** 
- Added `_count: { select: { shots: true } }` to Prisma query in both admin and user show fetches
- This adds `_count.shots` property to each show object
- Frontend already had code to display `show._count?.shots || 0`

**Files Modified:**
- ✅ Modified `app/api/shows/route.ts` (2 locations - admin fetch and user fetch)

---

### 4. Activity Logs Empty ✅
**Problem:** Activity Logs page shows no data even though logs exist in database.

**Root Cause:** 
1. API returned plain array `[]` but frontend expected `{logs: [], total: number}` structure
2. Missing pagination, filtering, and search support in API
3. Missing filters for actionType, search, date range

**Solution:** 
- Completely restructured `/api/activity-logs` GET endpoint:
  - Added pagination support (page, limit, skip/take)
  - Added filtering: entityType, actionType, search, startDate, endDate
  - Added total count query for pagination
  - Changed response format to: `{logs: [], total: number, page: number, limit: number, totalPages: number}`
  - Added search across userName, fieldName, oldValue, newValue
  - Removed `mode: 'insensitive'` (not supported in SQLite)

**Files Modified:**
- ✅ Modified `app/api/activity-logs/route.ts` (complete refactor of GET method)

---

### 5. Permission Manager Role Configuration ✅
**Problem:** Permission matrix used incorrect role names not matching database schema.

**Root Cause:** 
- API used: SHOW_SUPERVISOR, SHOT_SUPERVISOR, ARTIST, PRODUCTION
- Schema has: ADMIN, COORDINATOR, MANAGER, PRODUCER, DEPARTMENT, VIEWER, RESOURCE

**Solution:** 
- Updated `DEFAULT_MATRIX` in permissions API to match actual database roles:
  - **ADMIN** - Full access to all 28 permissions
  - **COORDINATOR** - Create/edit shows, shots, tasks, deliveries, resources
  - **MANAGER** - Edit shows/shots/tasks, view/create deliveries and resources
  - **PRODUCER** - Similar to Manager but with delivery delete permission
  - **DEPARTMENT** - View shows/shots, edit tasks and shots in their department
  - **RESOURCE** - View + full CRUD on resources, view everything else
  - **VIEWER** - Read-only access to shows, shots, tasks, deliveries, resources

**Files Modified:**
- ✅ Modified `app/api/admin/permissions/route.ts` (replaced all role definitions)

---

## Testing Instructions

### Test Department Toggle:
1. Go to Admin Panel → Shows & Configuration
2. Click "Departments" tab
3. Click "Deactivate" on any active department
4. Should see it turn gray and button change to "Activate"
5. Click "Activate" to restore
6. ✅ Should see green checkmark and "Active" status

### Test Status Option Toggle:
1. Go to Admin Panel → Shows & Configuration
2. Click "Status Options" tab
3. Click "Deactivate" on any active status
4. Should see it turn gray and button change to "Activate"
5. Click "Activate" to restore
6. ✅ Should see color indicator and "Active" status

### Test Shot Count:
1. Go to Admin Panel → Shows & Configuration
2. Click "Shows" tab
3. Find NAPEX show (or any show with shots)
4. ✅ Should see correct number in "Shots" column (not 0)

### Test Activity Logs:
1. Go to Admin Panel → Activity Logs
2. ✅ Should see list of recent activities (if any exist)
3. Test filters:
   - Entity Type dropdown (Show, Shot, Task, etc.)
   - Action Type dropdown (CREATE, UPDATE, DELETE)
   - Search box (searches userName, fieldName, values)
   - Date range picker
4. Test pagination (next/previous buttons)
5. ✅ Test "Export to CSV" button

### Test Permission Manager:
1. Go to Admin Panel → Permissions
2. ✅ Should see 7 roles: ADMIN, COORDINATOR, MANAGER, PRODUCER, DEPARTMENT, RESOURCE, VIEWER
3. Click category filters (Shows, Shots, Tasks, Users, Deliveries, Resources, Settings)
4. Try toggling any permission for COORDINATOR role
5. ✅ Should see checkmark change color
6. Try clicking ADMIN row permissions
7. ✅ Should NOT allow changes (ADMIN is locked)

---

## Files Created
1. `app/api/departments/[id]/route.ts` - PATCH endpoint for department toggle

## Files Modified
1. `app/api/departments/route.ts` - Added includeInactive parameter
2. `app/api/status-options/[id]/route.ts` - Added PATCH method
3. `app/api/shows/route.ts` - Added _count for shots
4. `app/api/activity-logs/route.ts` - Complete refactor with pagination/filters
5. `app/admin/shows/page.tsx` - Fetch departments with includeInactive=true
6. `app/api/admin/permissions/route.ts` - Updated all role definitions

## Technical Notes

### SQLite vs PostgreSQL Compatibility
- Removed `mode: 'insensitive'` from search queries (SQLite doesn't support it)
- Using simple `contains` for case-sensitive search in development
- Production (PostgreSQL) can add `mode: 'insensitive'` back if needed

### Permission System Architecture
The permission manager is currently using in-memory DEFAULT_MATRIX. For production:
- Create `Permission` model in Prisma schema
- Create `RolePermission` junction table
- Store permission matrix in database
- Update GET endpoint to fetch from DB
- Update PUT endpoint to persist changes to DB

### Activity Logging
Activity logs are being created automatically when:
- Shows are created/updated/deleted
- Shots are created/updated/deleted  
- Tasks are created/updated/deleted
- Users are created/updated/deleted
- Deliveries are created/updated/deleted

The logging is handled by individual API routes using `POST /api/activity-logs`.

---

## Next Steps

1. **Test all fixes locally** - Verify each bug is resolved
2. **Check for any console errors** - Monitor browser DevTools
3. **Test edge cases** - Empty states, large datasets, rapid clicking
4. **Commit changes** with message: "fix(admin): Fix department/status toggles, shot counts, activity logs, and permissions"
5. **Push to GitHub** - Deploy to production
6. **Monitor production** - Check logs for any errors

---

## Performance Considerations

### Activity Logs Performance
- Currently limited to 50 logs per page
- Export limited to 10,000 records
- Consider adding indexes:
  ```sql
  CREATE INDEX idx_activity_logs_entity ON ActivityLog(entityType, entityId);
  CREATE INDEX idx_activity_logs_timestamp ON ActivityLog(timestamp DESC);
  CREATE INDEX idx_activity_logs_user ON ActivityLog(userId);
  ```

### Shows API Performance
- Using `_count` is more efficient than loading all shots
- Consider caching show list for admins (30-60 seconds)
- For large datasets (1000+ shows), add pagination

### Permission Manager
- Current in-memory approach is fast but not persistent
- Database approach needed for production
- Consider caching permission matrix per role (reduces DB queries)
