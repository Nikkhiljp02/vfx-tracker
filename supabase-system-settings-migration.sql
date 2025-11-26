-- Migration: Add system_settings table for storing app-wide configuration
-- Run this in Supabase SQL Editor

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups by key
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(key);

-- Also ensure the googleTokens column exists on user_preferences
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS "googleTokens" TEXT;
