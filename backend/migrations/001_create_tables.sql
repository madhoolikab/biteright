-- BiteRight database schema
-- Run this in Supabase SQL Editor

-- Profiles
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    age INTEGER NOT NULL,
    height_cm NUMERIC NOT NULL,
    weight_kg NUMERIC NOT NULL,
    goal TEXT NOT NULL CHECK (goal IN ('maintain', 'lose', 'gain')),
    goal_weight_kg NUMERIC,
    weekly_rate_kg NUMERIC,
    activity_level TEXT NOT NULL CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'very_active')),
    dietary_preference TEXT NOT NULL CHECK (dietary_preference IN ('vegetarian', 'eggetarian', 'non_vegetarian', 'vegan')),
    health_conditions TEXT[] DEFAULT '{}',
    primary_cuisine TEXT NOT NULL CHECK (primary_cuisine IN ('south_indian', 'north_indian', 'mixed_indian', 'other')),
    unit_preference TEXT NOT NULL DEFAULT 'metric' CHECK (unit_preference IN ('metric', 'imperial')),
    calorie_target INTEGER NOT NULL,
    protein_target_g INTEGER NOT NULL,
    carbs_target_g INTEGER NOT NULL,
    fat_target_g INTEGER NOT NULL,
    fibre_target_g INTEGER NOT NULL,
    bmr INTEGER NOT NULL,
    maintenance_calories INTEGER NOT NULL,
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id)
);

-- Daily logs (one row per user per day)
CREATE TABLE IF NOT EXISTS daily_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    total_calories NUMERIC DEFAULT 0,
    total_carbs_g NUMERIC DEFAULT 0,
    total_protein_g NUMERIC DEFAULT 0,
    total_fat_g NUMERIC DEFAULT 0,
    total_fibre_g NUMERIC DEFAULT 0,
    water_ml INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, log_date)
);

-- Meal items
CREATE TABLE IF NOT EXISTS meal_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    daily_log_id UUID REFERENCES daily_logs(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')),
    item_name TEXT NOT NULL,
    calories NUMERIC NOT NULL,
    carbs_g NUMERIC,
    protein_g NUMERIC,
    fat_g NUMERIC,
    fibre_g NUMERIC,
    portion_grams NUMERIC,
    portion_desc TEXT,
    is_estimate BOOLEAN DEFAULT true,
    is_favourite BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'manual' CHECK (source IN ('photo', 'manual', 'favourite')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Water logs
CREATE TABLE IF NOT EXISTS water_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    amount_ml INTEGER NOT NULL DEFAULT 250,
    logged_at TIMESTAMPTZ DEFAULT now()
);

-- Weight logs
CREATE TABLE IF NOT EXISTS weight_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date DATE NOT NULL,
    weight_kg NUMERIC NOT NULL,
    smoothed_kg NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, log_date)
);

-- Weekly insights
CREATE TABLE IF NOT EXISTS weekly_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    insight_text TEXT NOT NULL,
    stats_json JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, week_start)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date ON daily_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_meal_items_user_date ON meal_items(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_meal_items_favourite ON meal_items(user_id, is_favourite) WHERE is_favourite = true;
CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON water_logs(user_id, log_date);
CREATE INDEX IF NOT EXISTS idx_weight_logs_user_date ON weight_logs(user_id, log_date);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern for all tables)
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['profiles', 'daily_logs', 'meal_items', 'water_logs', 'weight_logs', 'weekly_insights'])
    LOOP
        EXECUTE format('CREATE POLICY "Users see own data" ON %I FOR SELECT USING (auth.uid() = user_id)', tbl);
        EXECUTE format('CREATE POLICY "Users insert own data" ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)', tbl);
        EXECUTE format('CREATE POLICY "Users update own data" ON %I FOR UPDATE USING (auth.uid() = user_id)', tbl);
        EXECUTE format('CREATE POLICY "Users delete own data" ON %I FOR DELETE USING (auth.uid() = user_id)', tbl);
    END LOOP;
END $$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER daily_logs_updated_at BEFORE UPDATE ON daily_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
