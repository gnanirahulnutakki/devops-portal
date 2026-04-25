-- Add per-membership feature flags for granular section control
ALTER TABLE "memberships"
ADD COLUMN IF NOT EXISTS "featureFlags" jsonb NOT NULL DEFAULT '{}'::jsonb;

