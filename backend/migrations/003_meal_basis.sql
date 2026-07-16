-- Show-the-work: per-dish "what I saw & why" for nutrition estimates
-- Run this in Supabase SQL Editor after 002_meal_and_profile_calibration.sql

-- Meal items: the model's plain-language basis for each estimate
-- (summary line + ingredient list + assumed oil_level). Nullable and
-- backwards-compatible: existing rows stay NULL and every surface treats
-- a missing basis as "don't render the line".
ALTER TABLE meal_items
    ADD COLUMN IF NOT EXISTS basis JSONB;
