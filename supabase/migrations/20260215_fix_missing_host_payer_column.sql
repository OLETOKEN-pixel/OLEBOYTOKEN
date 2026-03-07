-- Fix: Add missing host_payer_user_id column to matches table
-- This column was used by functions but never added via migration
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS host_payer_user_id UUID REFERENCES auth.users(id);

-- Backfill existing matches: host_payer = creator by default
UPDATE matches SET host_payer_user_id = creator_id WHERE host_payer_user_id IS NULL;
