-- Multi-modal logging: units, calorie ranges, non-destructive corrections, calibration
-- Run this in Supabase SQL Editor after 001_create_tables.sql

-- Meal items: quantity/unit, calorie range, user-corrected field tracking, new sources
ALTER TABLE meal_items
    ADD COLUMN IF NOT EXISTS quantity NUMERIC,
    ADD COLUMN IF NOT EXISTS unit TEXT,
    ADD COLUMN IF NOT EXISTS calorie_low NUMERIC,
    ADD COLUMN IF NOT EXISTS calorie_high NUMERIC,
    ADD COLUMN IF NOT EXISTS user_edited_fields TEXT[] DEFAULT '{}';

ALTER TABLE meal_items DROP CONSTRAINT IF EXISTS meal_items_source_check;
ALTER TABLE meal_items ADD CONSTRAINT meal_items_source_check
    CHECK (source IN ('photo', 'manual', 'favourite', 'voice', 'text'));

-- Profiles: progressive calibration (populated in-context during meal logging, not onboarding)
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS oil_usage_level TEXT
        CHECK (oil_usage_level IN ('light', 'medium', 'generous')),
    ADD COLUMN IF NOT EXISTS portion_calibration JSONB;
