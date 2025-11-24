# Feedback Activity Logs Implementation

## Summary
Added comprehensive activity log tracking for all Feedback operations to capture all changes in the ActivityLog table.

## Changes Made

### 1. **Feedback Creation Logging** (`app/api/feedbacks/route.ts`)
- Added activity log creation after feedback is created
- Logs all initial field values: showName, shotName, shotTag, version, department, leadName, status, feedbackNotes, feedbackDate
- Includes user information (username/email and userId)
- Entity Type: `Feedback`
- Action Type: `CREATE`

### 2. **Feedback Update Logging** (`app/api/feedbacks/[id]/route.ts`)
- Fetches current feedback data before update
- Tracks changes to ALL fields:
  - **status** - Status changes (C APP, C KB, AWF)
  - **feedbackNotes** - Feedback text updates
  - **version** - Version changes
  - **department** - Department changes
  - **leadName** - Lead name changes
  - **shotTag** - Shot tag changes (Fresh, Additional)
  - **feedbackDate** - Feedback date changes
- Creates separate activity log entry for EACH changed field
- Stores both oldValue and newValue for each change
- Entity Type: `Feedback`
- Action Type: `UPDATE`
- Includes fieldName to identify what changed

### 3. **Feedback Deletion Logging** (`app/api/feedbacks/[id]/route.ts`)
- Fetches complete feedback data before deletion
- Stores entire entity data in `fullEntityData` field
- Enables potential restoration of deleted feedbacks
- Entity Type: `Feedback`
- Action Type: `DELETE`

### 4. **Bulk Import Logging** (`app/api/feedbacks/import/route.ts`)
- Logs both CREATE and UPDATE operations during Excel import
- For updates: Stores both old and new entity data
- For creates: Stores new entity data
- Uses special fieldName `bulk_import` to identify batch operations
- Maintains full audit trail of imported data

## Fields Tracked in Activity Logs

| Field | Description | Logged On |
|-------|-------------|-----------|
| showName | Show name | CREATE |
| shotName | Shot name | CREATE |
| shotTag | Fresh/Additional | CREATE, UPDATE |
| version | Version number | CREATE, UPDATE |
| department | Department (Comp/Paint/Roto/MMRA) | CREATE, UPDATE |
| leadName | Lead artist name | CREATE, UPDATE |
| status | C APP / C KB / AWF | CREATE, UPDATE |
| feedbackNotes | Feedback text content | CREATE, UPDATE |
| feedbackDate | Date feedback received | CREATE, UPDATE |
| taskId | Linked task ID | CREATE (not logged directly) |

## Activity Log Structure for Feedback

### CREATE Operation
```json
{
  "entityType": "Feedback",
  "entityId": "clxxx...",
  "actionType": "CREATE",
  "fieldName": null,
  "oldValue": null,
  "newValue": "{\"showName\":\"...\",\"shotName\":\"...\",\"status\":\"...\",...}",
  "userName": "john.doe",
  "userId": "clyyy..."
}
```

### UPDATE Operation (per field)
```json
{
  "entityType": "Feedback",
  "entityId": "clxxx...",
  "actionType": "UPDATE",
  "fieldName": "status",
  "oldValue": "C KB",
  "newValue": "C APP",
  "userName": "jane.smith",
  "userId": "clzzz..."
}
```

### DELETE Operation
```json
{
  "entityType": "Feedback",
  "entityId": "clxxx...",
  "actionType": "DELETE",
  "fieldName": null,
  "oldValue": null,
  "newValue": null,
  "fullEntityData": "{\"id\":\"...\",\"showName\":\"...\",\"status\":\"...\",...]",
  "userName": "admin.user",
  "userId": "claaa..."
}
```

## Integration with Status Sync

When feedback status changes:
1. Activity log captures the feedback status change
2. If linked task exists (taskId), task status is also updated
3. Task update triggers its own activity log (handled by task API)

This creates a complete audit trail showing:
- Feedback status changed by [user] at [time]
- Task status changed by feedback sync at [time]

## Query Examples

### Get all feedback changes for a specific shot
```sql
SELECT * FROM activity_logs 
WHERE entityType = 'Feedback' 
  AND newValue LIKE '%shotName":"SHOT_001"%'
ORDER BY timestamp DESC;
```

### Get all status changes
```sql
SELECT * FROM activity_logs 
WHERE entityType = 'Feedback' 
  AND fieldName = 'status'
ORDER BY timestamp DESC;
```

### Get user's feedback activity
```sql
SELECT * FROM activity_logs 
WHERE entityType = 'Feedback' 
  AND userId = 'user_id_here'
ORDER BY timestamp DESC;
```

## Next Steps

1. **Stop dev server** to unlock Prisma client files
2. **Run `npx prisma generate`** to regenerate client with updated code
3. **Restart dev server** to apply changes
4. **Test feedback operations** to verify logging works
5. **Check Admin Panel > Activity Logs** to see feedback entries

## Validation Checklist

- [ ] Create new feedback → Check activity log shows CREATE with all fields
- [ ] Update feedback status → Check activity log shows UPDATE for status field
- [ ] Update feedback notes → Check activity log shows UPDATE for feedbackNotes field
- [ ] Update multiple fields → Check separate log entry for each changed field
- [ ] Delete feedback → Check activity log shows DELETE with fullEntityData
- [ ] Import feedbacks → Check activity log shows bulk_import entries
- [ ] Verify userName and userId are captured correctly
- [ ] Verify timestamp is accurate
- [ ] Test that task status sync still works after feedback changes
