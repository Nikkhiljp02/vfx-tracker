# Supabase Database Migration Guide

This guide provides step-by-step instructions to update your Supabase database with all the new resource management schema changes.

## Migration Files Overview

The following migration files need to be executed **in order**:

1. ✅ **add-resource-forecast-models.sql** - Core resource tables (ResourceMember, ResourceAllocation)
2. ✅ **add_saved_views.sql** - SavedView table for filter persistence
3. ✅ **add_award_sheet.sql** - AwardSheet table for show/shot validation
4. ✅ **add_weekend_working_column.sql** - Add isWeekendWorking column
5. ✅ **add_performance_indexes.sql** - Performance indexes (5x faster queries)

---

## Prerequisites

Before starting:
- [ ] Access to Supabase Dashboard (https://app.supabase.com)
- [ ] Project selected: Your VFX Tracker project
- [ ] SQL Editor open

---

## Step-by-Step Migration Process

### Step 1: Backup Your Database (Recommended)

Before making any schema changes, create a backup:

1. Go to **Database** → **Backups** in Supabase Dashboard
2. Click **Create Backup**
3. Name it: `pre-resource-management-migration`

### Step 2: Execute Core Resource Tables

**File:** `prisma/migrations/add-resource-forecast-models.sql`

1. Open **SQL Editor** in Supabase
2. Copy the entire content of `add-resource-forecast-models.sql`
3. Paste into SQL Editor
4. Click **Run**
5. ✅ Verify: Should see "Success. No rows returned"

**What this creates:**
- `resource_members` table with Employee data
- `resource_allocations` table with allocation data
- Indexes for fast lookups
- Foreign key relationship between tables

### Step 3: Add SavedView Table

**File:** `prisma/migrations/add_saved_views.sql`

1. Copy content of `add_saved_views.sql`
2. Paste into SQL Editor
3. Click **Run**
4. ✅ Verify: No errors

**What this creates:**
- `SavedView` table for persistent filter configurations
- Indexes for user, viewType, and quick filters

### Step 4: Add AwardSheet Table

**File:** `prisma/migrations/add_award_sheet.sql`

1. Copy content of `add_award_sheet.sql`
2. Paste into SQL Editor
3. Click **Run**
4. ✅ Verify: No errors

**What this creates:**
- `AwardSheet` table for show/shot management
- Unique constraint on (showName, shotName)
- Indexes for faster lookups

### Step 5: Add Weekend Working Column

**File:** `prisma/migrations/add_weekend_working_column.sql`

1. Copy content of `add_weekend_working_column.sql`
2. Paste into SQL Editor
3. Click **Run**
4. ✅ Verify: Column added successfully

**What this adds:**
- `isWeekendWorking` column to `resource_allocations` table
- Default value: `false`

### Step 6: Apply Performance Indexes

**File:** `prisma/migrations/add_performance_indexes.sql`

1. Copy content of `add_performance_indexes.sql`
2. Paste into SQL Editor
3. Click **Run**
4. ⏱️ This may take 30-60 seconds depending on data size
5. ✅ Verify: All indexes created

**What this creates:**
- Comprehensive indexes on ResourceAllocation, ResourceMember
- Indexes on Shot, Task, ActivityLog, Notification tables
- Query optimizer analysis (ANALYZE statements)
- **Expected Performance Gain:** 5x faster queries

---

## Verification Queries

After all migrations, run these queries to verify everything is set up correctly:

### 1. Check All Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'resource_members',
    'resource_allocations', 
    'SavedView',
    'AwardSheet'
  )
ORDER BY table_name;
```

**Expected:** 4 rows returned

### 2. Check resource_allocations Columns

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'resource_allocations'
ORDER BY ordinal_position;
```

**Verify:** `isWeekendWorking` column exists with BOOLEAN type

### 3. Check Indexes

```sql
SELECT 
  tablename, 
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('resource_allocations', 'resource_members', 'SavedView', 'AwardSheet')
ORDER BY tablename, indexname;
```

**Expected:** Multiple indexes for each table

### 4. Check Foreign Keys

```sql
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'resource_allocations';
```

**Expected:** Foreign key from `resourceId` → `resource_members.id`

---

## Post-Migration Checklist

After completing all migrations:

- [ ] All 5 migration files executed successfully
- [ ] Verification queries run without errors
- [ ] 4 new tables exist: resource_members, resource_allocations, SavedView, AwardSheet
- [ ] isWeekendWorking column present in resource_allocations
- [ ] Indexes created (check with verification query #3)
- [ ] Foreign key relationship working

---

## Table Schema Reference

### resource_members
```sql
id              TEXT PRIMARY KEY
empId           TEXT UNIQUE NOT NULL
empName         TEXT NOT NULL
designation     TEXT NOT NULL
reportingTo     TEXT
department      TEXT NOT NULL
shift           TEXT DEFAULT 'Day'
isActive        BOOLEAN DEFAULT true
createdDate     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updatedDate     TIMESTAMP
```

### resource_allocations
```sql
id                  TEXT PRIMARY KEY
resourceId          TEXT NOT NULL (FK → resource_members.id)
showName            TEXT NOT NULL
shotName            TEXT NOT NULL
allocationDate      TIMESTAMP NOT NULL
manDays             DOUBLE PRECISION DEFAULT 0
isLeave             BOOLEAN DEFAULT false
isIdle              BOOLEAN DEFAULT false
isWeekendWorking    BOOLEAN DEFAULT false
notes               TEXT
createdBy           TEXT
createdDate         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updatedDate         TIMESTAMP
```

### SavedView
```sql
id              TEXT PRIMARY KEY
name            TEXT NOT NULL
viewType        TEXT DEFAULT 'resource'
filters         TEXT NOT NULL (JSON string)
isPublic        BOOLEAN DEFAULT false
isQuickFilter   BOOLEAN DEFAULT false
createdBy       TEXT NOT NULL
createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updatedAt       TIMESTAMP
```

### AwardSheet
```sql
id              TEXT PRIMARY KEY
showName        TEXT NOT NULL
shotName        TEXT NOT NULL
customFields    JSONB DEFAULT '{}'
createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updatedAt       TIMESTAMP
UNIQUE(showName, shotName)
```

---

## Troubleshooting

### Error: "relation already exists"

**Solution:** Table already created. Safe to ignore or use `CREATE TABLE IF NOT EXISTS`.

### Error: "column already exists"

**Solution:** Column already added. Safe to ignore or use `ADD COLUMN IF NOT EXISTS`.

### Performance Issues After Migration

1. Run ANALYZE manually:
   ```sql
   ANALYZE resource_allocations;
   ANALYZE resource_members;
   ```

2. Check index usage:
   ```sql
   SELECT * FROM pg_stat_user_indexes 
   WHERE schemaname = 'public';
   ```

### Foreign Key Constraint Error

**Cause:** Orphaned data in resource_allocations referencing non-existent resource_members

**Solution:**
```sql
-- Find orphaned allocations
SELECT DISTINCT resourceId 
FROM resource_allocations a
WHERE NOT EXISTS (
  SELECT 1 FROM resource_members m WHERE m.id = a.resourceId
);

-- Option 1: Delete orphaned allocations
DELETE FROM resource_allocations 
WHERE resourceId NOT IN (SELECT id FROM resource_members);

-- Option 2: Create placeholder members for orphaned IDs (if data is important)
```

---

## Next Steps

After successful migration:

1. ✅ Test resource management features locally
2. ✅ Deploy application to Vercel/production
3. ✅ Verify resource forecast view loads correctly
4. ✅ Test import functionality with CSV
5. ✅ Check performance of allocation queries

---

## Rollback Plan (Emergency Only)

If you need to undo migrations:

```sql
-- Drop tables in reverse order
DROP TABLE IF EXISTS "AwardSheet" CASCADE;
DROP TABLE IF EXISTS "SavedView" CASCADE;
DROP TABLE IF EXISTS "resource_allocations" CASCADE;
DROP TABLE IF EXISTS "resource_members" CASCADE;

-- Drop indexes (if tables weren't dropped)
-- Run this query to get all index names:
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('resource_allocations', 'resource_members', 'SavedView', 'AwardSheet');

-- Then drop each index manually
```

⚠️ **WARNING:** This will delete all resource management data. Only use in development or if you have a backup.

---

## Migration Execution Order Summary

```
1. add-resource-forecast-models.sql      ← Core tables
2. add_saved_views.sql                   ← Saved filters
3. add_award_sheet.sql                   ← Show/shot validation
4. add_weekend_working_column.sql        ← Add missing column
5. add_performance_indexes.sql           ← Performance boost
```

## Support# Set your Supabase connection strings
$env:DATABASE_URL="your-supabase-pooler-url"
$env:DIRECT_URL="your-supabase-direct-url"

# Push schema to Supabase
npx prisma db push

If you encounter issues:
1. Check Supabase logs in Dashboard → Logs
2. Review error messages in SQL Editor
3. Verify prerequisites are met
4. Try verification queries to identify missing components

---

**Last Updated:** $(date)
**Migration Version:** 1.0
**Compatible with:** VFX Tracker Resource Management System v1.0
