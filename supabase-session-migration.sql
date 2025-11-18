-- Session Management Database Migration for Supabase
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Add new columns to sessions table (if they don't exist)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "lastActivity" TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "userAgent" TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "deviceType" TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "browser" TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "os" TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "loggedOutAt" TIMESTAMP;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS "loggedOutBy" TEXT;

-- Step 2: Create indexes on sessions table
CREATE INDEX IF NOT EXISTS "sessions_userId_isActive_idx" ON sessions("userId", "isActive");

-- Step 3: Create login_history table
CREATE TABLE IF NOT EXISTS login_history (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  username TEXT NOT NULL,
  "loginAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "logoutAt" TIMESTAMP,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "deviceType" TEXT,
  browser TEXT,
  os TEXT,
  location TEXT,
  "loginSuccess" BOOLEAN NOT NULL DEFAULT true,
  "failureReason" TEXT,
  "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
  "suspicionFlags" TEXT
);

-- Step 4: Create indexes on login_history table
CREATE INDEX IF NOT EXISTS "login_history_userId_loginAt_idx" ON login_history("userId", "loginAt");
CREATE INDEX IF NOT EXISTS "login_history_isSuspicious_idx" ON login_history("isSuspicious");
CREATE INDEX IF NOT EXISTS "login_history_loginSuccess_idx" ON login_history("loginSuccess");

-- Verification queries (run these to check if migration succeeded)
-- SELECT COUNT(*) FROM sessions;
-- SELECT COUNT(*) FROM login_history;
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sessions';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'login_history';
