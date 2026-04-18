-- Fix: Add missing joiner_payer_user_id column to matches table.
-- This column is accessed unconditionally by finalize_match_payout but was never
-- added via a schema migration. Affects all match sizes (1v1, 2v2, 3v3, 4v4).
-- For 1v1: column is read but not used in payout logic (NULL is fine).
-- For team matches: join_match_v2 already sets this when joiner pays via cover mode.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS joiner_payer_user_id UUID REFERENCES auth.users(id);
