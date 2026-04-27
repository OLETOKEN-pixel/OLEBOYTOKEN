-- =====================================================================
-- TOURNAMENTS v1 — table scaffolding
-- =====================================================================
-- Tables, indexes, RLS policies for the tournaments feature.
-- The RPCs/triggers and the scheduled_start_at column live in the
-- follow-up migration 20260427100000_tournaments_rpcs_and_start_date.sql
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (LENGTH(name) BETWEEN 3 AND 60),
  creator_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('Box Fight', 'Realistic', 'Zone Wars')),
  team_size INTEGER NOT NULL CHECK (team_size BETWEEN 1 AND 4),
  first_to INTEGER NOT NULL DEFAULT 3 CHECK (first_to IN (1, 3, 5, 7, 10)),
  region TEXT NOT NULL DEFAULT 'EU' CHECK (region IN ('EU', 'NA-East', 'NA-West', 'OCE', 'BR', 'ASIA', 'ME')),
  platform TEXT NOT NULL DEFAULT 'All' CHECK (platform IN ('PC', 'Console', 'Mobile', 'All')),
  max_participants INTEGER NOT NULL CHECK (max_participants BETWEEN 2 AND 256),
  entry_fee NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (entry_fee >= 0),
  prize_pool_seed NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (prize_pool_seed >= 0),
  prize_pool_total NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (prize_pool_total >= 0),
  duration_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (duration_seconds BETWEEN 300 AND 86400),
  rules TEXT,
  creator_is_admin BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'registering'
    CHECK (status IN ('registering', 'ready_up', 'running', 'completed', 'cancelled')),
  ready_up_deadline TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tournaments_status_idx ON public.tournaments (status);
CREATE INDEX IF NOT EXISTS tournaments_creator_idx ON public.tournaments (creator_id);

DROP TRIGGER IF EXISTS tournaments_updated_at ON public.tournaments;
CREATE TRIGGER tournaments_updated_at
  BEFORE UPDATE ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.tournament_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  payer_user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  paid_amount NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready BOOLEAN NOT NULL DEFAULT false,
  ready_at TIMESTAMPTZ,
  matches_played INTEGER NOT NULL DEFAULT 0,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  current_match_id UUID,
  eliminated BOOLEAN NOT NULL DEFAULT false,
  CHECK ((user_id IS NOT NULL) <> (team_id IS NOT NULL)),
  UNIQUE (tournament_id, user_id),
  UNIQUE (tournament_id, team_id)
);

CREATE INDEX IF NOT EXISTS tp_tournament_idx ON public.tournament_participants (tournament_id);
CREATE INDEX IF NOT EXISTS tp_user_idx ON public.tournament_participants (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tp_team_idx ON public.tournament_participants (team_id) WHERE team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS tp_idle_idx ON public.tournament_participants (tournament_id)
  WHERE current_match_id IS NULL AND ready = true AND eliminated = false;

CREATE TABLE IF NOT EXISTS public.tournament_prize_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 1),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  UNIQUE (tournament_id, position)
);

CREATE INDEX IF NOT EXISTS tpp_tournament_idx ON public.tournament_prize_positions (tournament_id);

CREATE TABLE IF NOT EXISTS public.tournament_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL REFERENCES public.tournament_participants(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tpay_tournament_idx ON public.tournament_payouts (tournament_id);

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tournament_id UUID REFERENCES public.tournaments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS matches_tournament_idx ON public.matches (tournament_id) WHERE tournament_id IS NOT NULL;

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_prize_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tournaments viewable by all" ON public.tournaments;
CREATE POLICY "Tournaments viewable by all" ON public.tournaments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tournaments writable by creator or admin" ON public.tournaments;
CREATE POLICY "Tournaments writable by creator or admin" ON public.tournaments FOR UPDATE USING (
  creator_id = auth.uid() OR public.is_admin()
);

DROP POLICY IF EXISTS "Tournament participants viewable by all" ON public.tournament_participants;
CREATE POLICY "Tournament participants viewable by all" ON public.tournament_participants FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tournament prize positions viewable by all" ON public.tournament_prize_positions;
CREATE POLICY "Tournament prize positions viewable by all" ON public.tournament_prize_positions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Tournament payouts viewable by all" ON public.tournament_payouts;
CREATE POLICY "Tournament payouts viewable by all" ON public.tournament_payouts FOR SELECT USING (true);
