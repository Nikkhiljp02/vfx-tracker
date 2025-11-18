# Database Migration Fix for Production

## Current Issues

Your production deployment is failing because:
1. ✅ Prisma schema was switched from SQLite to PostgreSQL
2. ❌ Supabase database tables don't match the new schema
3. ❌ API routes fail with 500 errors (missing tables)

## Quick Fix Options

### Option 1: Use Prisma Migrate (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```powershell
   npm install -g supabase
   ```

2. **Generate migration SQL**:
   ```powershell
   cd "c:\Users\nikhil patil\VFX TRACKER\vfx-tracker"
   npx prisma migrate dev --create-only --name production_sync
   ```

3. **Copy the generated SQL** from:
   `prisma/migrations/<timestamp>_production_sync/migration.sql`

4. **Run in Supabase**:
   - Go to https://app.supabase.com
   - Select your project
   - Navigate to **SQL Editor**
   - Paste and run the migration SQL

### Option 2: Push Schema Directly

1. **Set environment variables**:
   ```powershell
   $env:DATABASE_URL="your-supabase-connection-string"
   $env:DIRECT_URL="your-supabase-direct-connection-string"
   ```

2. **Push schema to Supabase**:
   ```powershell
   cd "c:\Users\nikhil patil\VFX TRACKER\vfx-tracker"
   npx prisma db push
   ```

   This will:
   - Compare local schema with Supabase
   - Create missing tables
   - Add missing columns
   - Create indexes

3. **Verify**:
   ```powershell
   npx prisma studio
   ```

### Option 3: Manual SQL Execution (Single Table)

Run this SQL in Supabase SQL Editor to create the `award_sheets` table:

```sql
CREATE TABLE IF NOT EXISTS "award_sheets" (
    "id" TEXT NOT NULL,
    "showName" TEXT NOT NULL,
    "shotName" TEXT NOT NULL,
    "customFields" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "award_sheets_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE INDEX "award_sheets_showName_idx" ON "award_sheets"("showName");
CREATE INDEX "award_sheets_shotName_idx" ON "award_sheets"("shotName");
CREATE UNIQUE INDEX "award_sheets_showName_shotName_key" ON "award_sheets"("showName", "shotName");
```

### Option 4: Complete Schema Migration (All Tables)

**Recommended if you have a fresh Supabase database.**

Run the complete schema from `complete-schema.sql`:

1. Open the file: `c:\Users\nikhil patil\VFX TRACKER\vfx-tracker\complete-schema.sql`
2. Copy the entire contents
3. Go to Supabase → SQL Editor
4. Paste and run

This creates all tables at once with proper indexes and foreign keys.

## Verify Environment Variables in Vercel

Make sure these are set in Vercel Project Settings → Environment Variables:

- `DATABASE_URL` - Your Supabase connection pooler URL (with `?pgbouncer=true`)
- `DIRECT_URL` - Your Supabase direct connection URL (without pgbouncer)

**Format:**
```
DATABASE_URL=postgresql://postgres:[password]@[host]:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:[password]@[host]:5432/postgres
```

## Post-Migration Verification

After running the migration, verify in Supabase:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

Expected tables:
- ✅ users
- ✅ shows
- ✅ shots
- ✅ tasks
- ✅ departments
- ✅ status_options
- ✅ activity_logs
- ✅ shot_notes
- ✅ notifications
- ✅ delivery_schedules
- ✅ schedule_execution_logs
- ✅ resource_members
- ✅ resource_allocations
- ✅ award_sheets (plural!)
- ✅ saved_views
- ✅ sessions

## Troubleshooting

### If tables already exist but schema is different:

```powershell
# This will show differences
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy
```

### If you get "relation already exists" errors:

The table exists but might be out of sync. Use:
```powershell
npx prisma db push --accept-data-loss
```
⚠️ Only use this if you're okay with potential data structure changes.

---

## Next Steps After Migration

1. Redeploy on Vercel (it will pick up the new database)
2. Test API endpoints:
   - GET /api/award-sheet
   - GET /api/resource/members
   - GET /api/shots

3. Monitor Vercel logs for any remaining errors
