# Testing Activity Logs for Feedback

## Current Status
Activity logging code has been implemented for all Feedback operations:
✅ CREATE - Logs when feedback is created
✅ UPDATE - Logs all field changes (status, notes, version, department, lead, tag, date)  
✅ DELETE - Logs deletion with full entity backup
✅ BULK IMPORT - Logs both create and update during Excel import

## Testing Instructions

### Option 1: Test on Production (Vercel)
Since your production database is PostgreSQL on Supabase and properly configured:

1. Open your deployed app: https://your-vercel-app.vercel.app
2. Login with admin credentials
3. Navigate to **Feedback** tab
4. **Create a new feedback**:
   - Fill in: Show, Shot, Tag, Version, Department, Status, Notes
   - Click Save
5. **Check Activity Log**:
   - Go to Admin Panel > Activity Logs
   - Filter by Entity Type = "Feedback"
   - You should see CREATE entry with all field values

6. **Update the feedback**:
   - Change status from "C APP" to "C KB"
   - Change feedbackNotes
   - Click Save
7. **Check Activity Log**:
   - Refresh Activity Logs
   - You should see UPDATE entries for each changed field

8. **Delete the feedback**:
   - Delete the test feedback
9. **Check Activity Log**:
   - You should see DELETE entry with fullEntityData

### Option 2: Test Locally (Requires DB Setup)

Your local setup has a mismatch:
- `.env` specifies SQLite: `DATABASE_URL="file:./dev.db"`
- `schema.prisma` specifies PostgreSQL: `provider = "postgresql"`
- Migration files are for SQLite

**To fix local testing:**

#### Quick Fix - Use SQLite locally:
```powershell
# 1. Change schema.prisma provider to sqlite
# Find line 9 in schema.prisma:
#   provider  = "postgresql"
# Change to:
#   provider  = "sqlite"

# 2. Comment out directUrl (not needed for SQLite)
# Find line 11 in schema.prisma:
#   directUrl = env("DIRECT_URL")
# Change to:
#   # directUrl = env("DIRECT_URL")

# 3. Kill dev server
Get-Process node | Stop-Process -Force

# 4. Regenerate Prisma Client
npx prisma generate

# 5. Apply migrations
npx prisma migrate deploy

# 6. Restart dev server
npm run dev

# 7. Open http://localhost:3000 and test
```

#### Better Fix - Use PostgreSQL locally too:
```powershell
# 1. Keep schema.prisma as is (provider = "postgresql")

# 2. Update .env to use your Supabase connection:
DATABASE_URL="postgresql://postgres.gcuypucjznrtfltsxwsd:Dgkvfx%401%232%233%234%235%23@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres.gcuypucjznrtfltsxwsd:Dgkvfx%401%232%233%234%235%23@db.gcuypucjznrtfltsxwsd.supabase.co:5432/postgres"

# 3. Generate Prisma Client
npx prisma generate

# 4. Run migrations (if needed)
npx prisma migrate deploy

# 5. Start dev server
npm run dev

# 6. Open http://localhost:3000 and test
```

## What to Verify

### 1. Feedback CREATE Logging
**Activity Log Entry Should Show:**
```json
{
  "entityType": "Feedback",
  "actionType": "CREATE",
  "fieldName": null,
  "newValue": "{\"showName\":\"...\",\"shotName\":\"...\",\"status\":\"C APP\",...}",
  "userName": "your.username",
  "userId": "clxxx..."
}
```

### 2. Feedback UPDATE Logging (per field)
**Activity Log Entries Should Show (one per changed field):**
```json
{
  "entityType": "Feedback",
  "actionType": "UPDATE",
  "fieldName": "status",
  "oldValue": "C KB",
  "newValue": "C APP",
  "userName": "your.username",
  "userId": "clxxx..."
}
```

### 3. Feedback DELETE Logging
**Activity Log Entry Should Show:**
```json
{
  "entityType": "Feedback",
  "actionType": "DELETE",
  "fullEntityData": "{\"id\":\"...\",\"showName\":\"...\",\"status\":\"C APP\",...}",
  "userName": "your.username",
  "userId": "clxxx..."
}
```

## Common Issues

### Issue: "Property 'feedback' does not exist on Prisma Client"
**Solution:** Run `npx prisma generate` after stopping dev server

### Issue: "Environment variable not found: DIRECT_URL"
**Solution:** Add `DIRECT_URL="file:./dev.db"` to .env file

### Issue: "Error validating datasource `db`: the URL must start with the protocol `postgresql://`"
**Solution:** Either:
- Change schema.prisma provider to "sqlite" OR
- Change .env DATABASE_URL to PostgreSQL connection string

### Issue: Activity logs table doesn't exist
**Solution:** Run migrations: `npx prisma migrate deploy`

## Code Locations

Activity logging is implemented in:
- `app/api/feedbacks/route.ts` - CREATE logging (line 108-124)
- `app/api/feedbacks/[id]/route.ts` - UPDATE logging (line 75-105), DELETE logging (line 150-164)
- `app/api/feedbacks/import/route.ts` - Bulk import logging (line 110-125, 147-162)

All logging uses try-catch to prevent failures from breaking the main operation.
