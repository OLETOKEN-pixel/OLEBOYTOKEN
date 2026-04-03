-- Add Twitter (X) and Twitch OAuth fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS twitter_account_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS twitter_username TEXT,
ADD COLUMN IF NOT EXISTS twitter_linked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS twitch_account_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS twitch_username TEXT,
ADD COLUMN IF NOT EXISTS twitch_linked_at TIMESTAMPTZ;

-- ────────────────────────────────────────────────────
-- Twitter OAuth states (includes code_verifier for PKCE)
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.twitter_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  state TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_twitter_oauth_states_expires ON public.twitter_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_twitter_oauth_states_state ON public.twitter_oauth_states(state);

ALTER TABLE public.twitter_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own twitter oauth states"
  ON public.twitter_oauth_states FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select own twitter oauth states"
  ON public.twitter_oauth_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own twitter oauth states"
  ON public.twitter_oauth_states FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all twitter oauth states"
  ON public.twitter_oauth_states FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

ALTER PUBLICATION supabase_realtime ADD TABLE public.twitter_oauth_states;

-- ────────────────────────────────────────────────────
-- Twitch OAuth states (standard, no PKCE)
-- ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.twitch_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  state TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_twitch_oauth_states_expires ON public.twitch_oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_twitch_oauth_states_state ON public.twitch_oauth_states(state);

ALTER TABLE public.twitch_oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own twitch oauth states"
  ON public.twitch_oauth_states FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select own twitch oauth states"
  ON public.twitch_oauth_states FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own twitch oauth states"
  ON public.twitch_oauth_states FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all twitch oauth states"
  ON public.twitch_oauth_states FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

ALTER PUBLICATION supabase_realtime ADD TABLE public.twitch_oauth_states;
