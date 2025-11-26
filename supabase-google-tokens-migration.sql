-- Migration: Add googleTokens column to user_preferences table
-- This separates Google OAuth tokens from filter preferences

-- Add the new column
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS "googleTokens" TEXT;

-- If there are any existing Google tokens stored in filterState, 
-- you may want to migrate them manually by checking if filterState 
-- contains 'access_token' or 'refresh_token'
