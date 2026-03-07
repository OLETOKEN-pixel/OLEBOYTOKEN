-- ===========================================
-- OLEBOY TOKEN - Complete Database Schema
-- ===========================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- PROFILES TABLE (linked to auth.users)
-- ===========================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  epic_username TEXT,
  preferred_region TEXT DEFAULT 'EU',
  preferred_platform TEXT DEFAULT 'PC',
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===========================================
-- WALLETS TABLE
-- ===========================================
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  balance DECIMAL(10, 2) DEFAULT 0.00 CHECK (balance >= 0),
  locked_balance DECIMAL(10, 2) DEFAULT 0.00 CHECK (locked_balance >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

-- Wallet policies
CREATE POLICY "Users can view own wallet"
  ON public.wallets FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can update wallets"
  ON public.wallets FOR UPDATE USING (auth.uid() = user_id);

-- ===========================================
-- TRANSACTIONS TABLE
-- ===========================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'lock', 'unlock', 'payout', 'refund', 'fee')),
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  match_id UUID,
  stripe_session_id TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Transaction policies
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ===========================================
-- TEAMS TABLE
-- ===========================================
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  tag TEXT NOT NULL UNIQUE CHECK (LENGTH(tag) <= 5),
  description TEXT,
  logo_url TEXT,
  owner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Team policies
CREATE POLICY "Teams are viewable by everyone"
  ON public.teams FOR SELECT USING (true);

CREATE POLICY "Owner can update team"
  ON public.teams FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can create teams"
  ON public.teams FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owner can delete team"
  ON public.teams FOR DELETE USING (auth.uid() = owner_id);

-- ===========================================
-- TEAM MEMBERS TABLE
-- ===========================================
CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'captain', 'member')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  invited_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Team member policies
CREATE POLICY "Team members viewable by all"
  ON public.team_members FOR SELECT USING (true);

CREATE POLICY "Team owners can manage members"
  ON public.team_members FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid())
    OR auth.uid() = user_id
  );

CREATE POLICY "Members can update own status"
  ON public.team_members FOR UPDATE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid())
  );

CREATE POLICY "Team owners can delete members"
  ON public.team_members FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.teams WHERE id = team_id AND owner_id = auth.uid())
    OR auth.uid() = user_id
  );

-- ===========================================
-- MATCHES TABLE
-- ===========================================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  game TEXT DEFAULT 'FN' NOT NULL,
  region TEXT NOT NULL CHECK (region IN ('EU', 'NA-East', 'NA-West', 'OCE', 'BR', 'ASIA', 'ME')),
  platform TEXT NOT NULL CHECK (platform IN ('PC', 'Console', 'Mobile', 'All')),
  mode TEXT NOT NULL CHECK (mode IN ('Box Fight', 'Realistic', 'Zone Wars', '1v1', '2v2', '3v3', '4v4')),
  team_size INTEGER DEFAULT 1 CHECK (team_size >= 1 AND team_size <= 4),
  first_to INTEGER DEFAULT 3 CHECK (first_to IN (1, 3, 5, 7, 10)),
  entry_fee DECIMAL(10, 2) NOT NULL CHECK (entry_fee >= 0),
  is_private BOOLEAN DEFAULT false,
  private_code TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'full', 'started', 'finished', 'canceled', 'expired', 'disputed')),
  expires_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Match policies
CREATE POLICY "Matches viewable by all"
  ON public.matches FOR SELECT USING (true);

CREATE POLICY "Users can create matches"
  ON public.matches FOR INSERT WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator can update match"
  ON public.matches FOR UPDATE USING (auth.uid() = creator_id);

-- ===========================================
-- MATCH PARTICIPANTS TABLE
-- ===========================================
CREATE TABLE public.match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id),
  status TEXT DEFAULT 'joined' CHECK (status IN ('joined', 'ready', 'playing', 'finished', 'left')),
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, user_id)
);

-- Enable RLS
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

-- Match participant policies
CREATE POLICY "Participants viewable by all"
  ON public.match_participants FOR SELECT USING (true);

CREATE POLICY "Users can join matches"
  ON public.match_participants FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation"
  ON public.match_participants FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can leave matches"
  ON public.match_participants FOR DELETE USING (auth.uid() = user_id);

-- ===========================================
-- MATCH RESULTS TABLE
-- ===========================================
CREATE TABLE public.match_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  winner_user_id UUID REFERENCES public.profiles(user_id),
  winner_team_id UUID REFERENCES public.teams(id),
  loser_confirmed BOOLEAN DEFAULT false,
  winner_confirmed BOOLEAN DEFAULT false,
  proof_url TEXT,
  dispute_reason TEXT,
  admin_notes TEXT,
  resolved_by UUID REFERENCES public.profiles(user_id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'disputed', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

-- Match result policies
CREATE POLICY "Results viewable by all"
  ON public.match_results FOR SELECT USING (true);

CREATE POLICY "Participants can insert results"
  ON public.match_results FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.match_participants WHERE match_id = match_results.match_id AND user_id = auth.uid())
  );

CREATE POLICY "Participants can update results"
  ON public.match_results FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.match_participants WHERE match_id = match_results.match_id AND user_id = auth.uid())
  );

-- ===========================================
-- CHAT MESSAGES TABLE (Global Chat)
-- ===========================================
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (LENGTH(message) <= 500),
  is_deleted BOOLEAN DEFAULT false,
  deleted_by UUID REFERENCES public.profiles(user_id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Chat message policies
CREATE POLICY "Messages viewable by all"
  ON public.chat_messages FOR SELECT USING (true);

CREATE POLICY "Users can send messages"
  ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can delete messages"
  ON public.chat_messages FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- ===========================================
-- LEADERBOARD VIEW
-- ===========================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT 
  p.id,
  p.user_id,
  p.username,
  p.avatar_url,
  COUNT(DISTINCT CASE WHEN mr.winner_user_id = p.user_id AND mr.status = 'confirmed' THEN mr.match_id END) as wins,
  COUNT(DISTINCT mp.match_id) as total_matches,
  COALESCE(SUM(CASE WHEN mr.winner_user_id = p.user_id AND mr.status = 'confirmed' THEN m.entry_fee * 1.9 ELSE 0 END), 0) as total_earnings
FROM public.profiles p
LEFT JOIN public.match_participants mp ON mp.user_id = p.user_id
LEFT JOIN public.matches m ON m.id = mp.match_id AND m.status = 'finished'
LEFT JOIN public.match_results mr ON mr.match_id = m.id
GROUP BY p.id, p.user_id, p.username, p.avatar_url
ORDER BY wins DESC, total_earnings DESC;

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_match_results_updated_at
  BEFORE UPDATE ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create wallet when profile is created
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_profile();

-- ===========================================
-- ENABLE REALTIME FOR CHAT
-- ===========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;-- Fix security warnings by setting search_path on functions

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix handle_new_profile function
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.user_id);
  RETURN NEW;
END;
$$;

-- Fix the leaderboard view - recreate with security_invoker
DROP VIEW IF EXISTS public.leaderboard;
CREATE VIEW public.leaderboard
WITH (security_invoker = on)
AS
SELECT 
  p.id,
  p.user_id,
  p.username,
  p.avatar_url,
  COUNT(DISTINCT CASE WHEN mr.winner_user_id = p.user_id AND mr.status = 'confirmed' THEN mr.match_id END) as wins,
  COUNT(DISTINCT mp.match_id) as total_matches,
  COALESCE(SUM(CASE WHEN mr.winner_user_id = p.user_id AND mr.status = 'confirmed' THEN m.entry_fee * 1.9 ELSE 0 END), 0) as total_earnings
FROM public.profiles p
LEFT JOIN public.match_participants mp ON mp.user_id = p.user_id
LEFT JOIN public.matches m ON m.id = mp.match_id AND m.status = 'finished'
LEFT JOIN public.match_results mr ON mr.match_id = m.id
GROUP BY p.id, p.user_id, p.username, p.avatar_url
ORDER BY wins DESC, total_earnings DESC;-- =====================================================
-- SECURITY FIX: Comprehensive security hardening migration
-- =====================================================

-- 1. Create app_role enum type for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- 2. Create user_roles table (separate from profiles to avoid privilege escalation)
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can only view their own roles
CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    USING (auth.uid() = user_id);

-- 3. Create security definer function to check roles (prevents infinite recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = _user_id
          AND role = _role
    )
$$;

-- 4. Create is_admin helper function
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.has_role(auth.uid(), 'admin')
$$;

-- 5. Migrate existing admins from profiles.role to user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'admin'::app_role
FROM public.profiles
WHERE role = 'admin'
ON CONFLICT (user_id, role) DO NOTHING;

-- 6. Create a public-safe view for profiles (excludes sensitive data)
CREATE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
    id,
    user_id,
    username,
    avatar_url,
    epic_username,
    preferred_region,
    preferred_platform,
    created_at
FROM public.profiles
WHERE is_banned = false;

-- 7. Fix profiles RLS policies
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- Users can view their own full profile
CREATE POLICY "Users can view own full profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = user_id);

-- Authenticated users can view limited public profile data (for participant lists etc.)
CREATE POLICY "Authenticated can view public profile data"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin());

-- Update the update policy to allow admins to ban users
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (
        auth.uid() = user_id AND 
        -- Users cannot change their own role or banned status
        is_banned IS NOT DISTINCT FROM (SELECT p.is_banned FROM public.profiles p WHERE p.user_id = auth.uid()) AND
        role IS NOT DISTINCT FROM (SELECT p.role FROM public.profiles p WHERE p.user_id = auth.uid())
    );

CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (public.is_admin());

-- 8. Fix match_results RLS - restrict sensitive dispute info
DROP POLICY IF EXISTS "Results viewable by all" ON public.match_results;

-- Match participants can view results (including dispute details for their matches)
CREATE POLICY "Participants can view match results"
    ON public.match_results FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.match_participants
            WHERE match_participants.match_id = match_results.match_id
            AND match_participants.user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- 9. Fix transactions RLS - allow admins to view all
CREATE POLICY "Admins can view all transactions"
    ON public.transactions FOR SELECT
    USING (public.is_admin());

-- 10. Create secure wallet operation functions (prevents client-side manipulation)
CREATE OR REPLACE FUNCTION public.lock_funds_for_match(
    p_match_id UUID,
    p_amount DECIMAL(10,2)
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_current_balance DECIMAL(10,2);
    v_current_locked DECIMAL(10,2);
BEGIN
    -- Get user ID from auth context
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    IF p_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Invalid amount');
    END IF;
    
    -- Lock row for update to prevent race conditions
    SELECT balance, locked_balance 
    INTO v_current_balance, v_current_locked
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found');
    END IF;
    
    -- Validate sufficient balance
    IF v_current_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    
    -- Atomic update
    UPDATE public.wallets
    SET 
        balance = balance - p_amount,
        locked_balance = locked_balance + p_amount,
        updated_at = now()
    WHERE user_id = v_user_id;
    
    -- Log transaction
    INSERT INTO public.transactions (user_id, type, amount, match_id, description)
    VALUES (v_user_id, 'lock', p_amount, p_match_id, 'Locked funds for match');
    
    RETURN json_build_object('success', true);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.lock_funds_for_match(UUID, DECIMAL) TO authenticated;

-- 11. Add function validation to handle_new_profile to prevent abuse
CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Validate that the profile being created matches the authenticated user
    -- This adds defense-in-depth even though INSERT policy should already enforce this
    IF NEW.user_id != auth.uid() THEN
        RAISE EXCEPTION 'Cannot create wallet for other users';
    END IF;
    
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.user_id);
    RETURN NEW;
END;
$$;-- Add unique constraint on username to prevent duplicates
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_unique UNIQUE (username);

-- Create function to check username availability (public access for signup form)
CREATE OR REPLACE FUNCTION public.check_username_available(p_username TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE LOWER(username) = LOWER(p_username)
    );
$$;

-- Grant execute to anonymous users so they can check during signup
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_username_available(TEXT) TO authenticated;-- Add payment details to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS paypal_email TEXT,
ADD COLUMN IF NOT EXISTS iban TEXT;

-- Create withdrawal_requests table
CREATE TABLE public.withdrawal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL CHECK (amount >= 5),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('paypal', 'bank')),
    payment_details TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES public.profiles(user_id)
);

-- Enable RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own withdrawal requests
CREATE POLICY "Users can view own withdrawals"
ON public.withdrawal_requests
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create withdrawal requests
CREATE POLICY "Users can create withdrawals"
ON public.withdrawal_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all withdrawal requests
CREATE POLICY "Admins can view all withdrawals"
ON public.withdrawal_requests
FOR SELECT
USING (public.is_admin());

-- Admins can update withdrawal requests
CREATE POLICY "Admins can update withdrawals"
ON public.withdrawal_requests
FOR UPDATE
USING (public.is_admin());

-- Create function to process withdrawal (admin only)
CREATE OR REPLACE FUNCTION public.process_withdrawal(
    p_withdrawal_id UUID,
    p_status TEXT,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_withdrawal RECORD;
    v_current_balance DECIMAL(10,2);
BEGIN
    -- Check if caller is admin
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Get withdrawal request
    SELECT * INTO v_withdrawal
    FROM public.withdrawal_requests
    WHERE id = p_withdrawal_id
    FOR UPDATE;
    
    IF v_withdrawal IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Withdrawal not found');
    END IF;
    
    IF v_withdrawal.status != 'pending' THEN
        RETURN json_build_object('success', false, 'error', 'Withdrawal already processed');
    END IF;
    
    -- If approving, check and deduct balance
    IF p_status = 'approved' OR p_status = 'completed' THEN
        SELECT balance INTO v_current_balance
        FROM public.wallets
        WHERE user_id = v_withdrawal.user_id
        FOR UPDATE;
        
        IF v_current_balance < v_withdrawal.amount THEN
            RETURN json_build_object('success', false, 'error', 'Insufficient balance');
        END IF;
        
        -- Deduct from wallet
        UPDATE public.wallets
        SET balance = balance - v_withdrawal.amount,
            updated_at = now()
        WHERE user_id = v_withdrawal.user_id;
        
        -- Log transaction
        INSERT INTO public.transactions (user_id, type, amount, description)
        VALUES (v_withdrawal.user_id, 'payout', v_withdrawal.amount, 'Withdrawal processed');
    END IF;
    
    -- Update withdrawal request
    UPDATE public.withdrawal_requests
    SET status = p_status,
        admin_notes = p_admin_notes,
        processed_at = now(),
        processed_by = auth.uid()
    WHERE id = p_withdrawal_id;
    
    RETURN json_build_object('success', true);
END;
$$;-- Tabella per il saldo della piattaforma (singolo record)
CREATE TABLE public.platform_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Inserisci il record iniziale
INSERT INTO public.platform_wallet (balance) VALUES (0);

-- Tabella per tracciare ogni singola fee raccolta
CREATE TABLE public.platform_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id),
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_earnings ENABLE ROW LEVEL SECURITY;

-- Solo admin possono vedere il wallet della piattaforma
CREATE POLICY "Admins can view platform wallet"
ON public.platform_wallet FOR SELECT
USING (public.is_admin());

-- Solo admin possono vedere i guadagni
CREATE POLICY "Admins can view platform earnings"
ON public.platform_earnings FOR SELECT
USING (public.is_admin());

-- Trigger per updated_at
CREATE TRIGGER update_platform_wallet_updated_at
BEFORE UPDATE ON public.platform_wallet
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Funzione per registrare una fee della piattaforma (chiamata quando si conclude un match)
CREATE OR REPLACE FUNCTION public.record_platform_fee(p_match_id UUID, p_fee_amount NUMERIC)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    -- Registra la fee
    INSERT INTO public.platform_earnings (match_id, amount)
    VALUES (p_match_id, p_fee_amount);
    
    -- Aggiorna il saldo della piattaforma
    UPDATE public.platform_wallet
    SET balance = balance + p_fee_amount,
        updated_at = now();
    
    RETURN json_build_object('success', true);
END;
$$;

-- Funzione per prelevare i guadagni della piattaforma (solo admin)
CREATE OR REPLACE FUNCTION public.withdraw_platform_earnings(p_amount NUMERIC, p_payment_method TEXT, p_payment_details TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_current_balance NUMERIC;
BEGIN
    -- Verifica che sia admin
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Ottieni il saldo corrente
    SELECT balance INTO v_current_balance
    FROM public.platform_wallet
    FOR UPDATE;
    
    IF v_current_balance < p_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient platform balance');
    END IF;
    
    -- Scala dal wallet della piattaforma
    UPDATE public.platform_wallet
    SET balance = balance - p_amount,
        updated_at = now();
    
    -- Crea una richiesta di prelievo speciale per la piattaforma
    -- Usiamo l'user_id dell'admin che fa la richiesta
    INSERT INTO public.withdrawal_requests (user_id, amount, payment_method, payment_details, status, admin_notes)
    VALUES (auth.uid(), p_amount, p_payment_method, p_payment_details, 'pending', 'Platform earnings withdrawal');
    
    RETURN json_build_object('success', true);
END;
$$;-- Function to complete match and process payout
CREATE OR REPLACE FUNCTION public.complete_match_payout(p_match_id uuid, p_winner_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_match RECORD;
    v_entry_fee DECIMAL(10,2);
    v_prize_pool DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_winner_payout DECIMAL(10,2);
    v_loser_user_id UUID;
    v_participant RECORD;
BEGIN
    -- Get match details
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status = 'finished' THEN
        RETURN json_build_object('success', false, 'error', 'Match already finished');
    END IF;
    
    v_entry_fee := v_match.entry_fee;
    v_prize_pool := v_entry_fee * 2;
    v_platform_fee := v_prize_pool * 0.05;
    v_winner_payout := v_prize_pool - v_platform_fee;
    
    -- Find loser (the other participant)
    SELECT user_id INTO v_loser_user_id
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id != p_winner_user_id
    LIMIT 1;
    
    IF v_loser_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Loser not found');
    END IF;
    
    -- Unlock and pay winner (they get their entry back + opponent's entry - fee)
    UPDATE public.wallets
    SET 
        balance = balance + v_winner_payout,
        locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = p_winner_user_id;
    
    -- Remove loser's locked balance (they lose their entry fee)
    UPDATE public.wallets
    SET 
        locked_balance = locked_balance - v_entry_fee,
        updated_at = now()
    WHERE user_id = v_loser_user_id;
    
    -- Log winner payout transaction
    INSERT INTO public.transactions (user_id, type, amount, match_id, description)
    VALUES (p_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Match winnings');
    
    -- Log loser loss transaction
    INSERT INTO public.transactions (user_id, type, amount, match_id, description)
    VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Match entry lost');
    
    -- Record platform fee
    INSERT INTO public.platform_earnings (match_id, amount)
    VALUES (p_match_id, v_platform_fee);
    
    UPDATE public.platform_wallet
    SET balance = balance + v_platform_fee, updated_at = now();
    
    -- Update match status to finished
    UPDATE public.matches
    SET status = 'finished', finished_at = now()
    WHERE id = p_match_id;
    
    -- Update match result status to confirmed
    UPDATE public.match_results
    SET status = 'confirmed', winner_user_id = p_winner_user_id, updated_at = now()
    WHERE match_id = p_match_id;
    
    RETURN json_build_object(
        'success', true, 
        'winner_payout', v_winner_payout,
        'platform_fee', v_platform_fee
    );
END;
$function$;

-- Function to declare match result (called by participants)
CREATE OR REPLACE FUNCTION public.declare_match_result(p_match_id uuid, p_i_won boolean)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_existing_result RECORD;
    v_opponent_id UUID;
    v_is_participant BOOLEAN;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Check if user is participant
    SELECT EXISTS(
        SELECT 1 FROM public.match_participants 
        WHERE match_id = p_match_id AND user_id = v_user_id
    ) INTO v_is_participant;
    
    IF NOT v_is_participant THEN
        RETURN json_build_object('success', false, 'error', 'Not a participant');
    END IF;
    
    -- Get match
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status NOT IN ('full', 'started') THEN
        RETURN json_build_object('success', false, 'error', 'Match not in progress');
    END IF;
    
    -- Get opponent
    SELECT user_id INTO v_opponent_id
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id != v_user_id
    LIMIT 1;
    
    -- Check existing result
    SELECT * INTO v_existing_result
    FROM public.match_results
    WHERE match_id = p_match_id
    FOR UPDATE;
    
    IF v_existing_result IS NULL THEN
        -- First declaration - create result record
        IF p_i_won THEN
            INSERT INTO public.match_results (match_id, winner_user_id, winner_confirmed, status)
            VALUES (p_match_id, v_user_id, true, 'pending');
        ELSE
            -- User says they lost, so opponent won
            INSERT INTO public.match_results (match_id, winner_user_id, loser_confirmed, status)
            VALUES (p_match_id, v_opponent_id, true, 'pending');
        END IF;
        
        -- Update match to started if not already
        UPDATE public.matches SET status = 'started', started_at = COALESCE(started_at, now())
        WHERE id = p_match_id AND status = 'full';
        
        RETURN json_build_object('success', true, 'status', 'waiting_confirmation');
    ELSE
        -- Second declaration - check for agreement
        IF p_i_won THEN
            IF v_existing_result.winner_user_id = v_user_id THEN
                -- Both claim same winner (user) - confirmed!
                IF v_existing_result.loser_confirmed THEN
                    -- Opponent already confirmed they lost
                    PERFORM public.complete_match_payout(p_match_id, v_user_id);
                    RETURN json_build_object('success', true, 'status', 'confirmed', 'winner', v_user_id);
                ELSE
                    -- Update winner_confirmed
                    UPDATE public.match_results 
                    SET winner_confirmed = true, updated_at = now()
                    WHERE match_id = p_match_id;
                    RETURN json_build_object('success', true, 'status', 'waiting_loser_confirmation');
                END IF;
            ELSE
                -- DISPUTE: both claim they won
                UPDATE public.match_results 
                SET status = 'disputed', dispute_reason = 'Both players claim victory', updated_at = now()
                WHERE match_id = p_match_id;
                
                UPDATE public.matches SET status = 'disputed' WHERE id = p_match_id;
                
                RETURN json_build_object('success', true, 'status', 'disputed');
            END IF;
        ELSE
            -- User says they lost
            IF v_existing_result.winner_user_id = v_opponent_id THEN
                -- Agreement! Opponent claimed win, user confirms loss
                UPDATE public.match_results 
                SET loser_confirmed = true, updated_at = now()
                WHERE match_id = p_match_id;
                
                PERFORM public.complete_match_payout(p_match_id, v_opponent_id);
                RETURN json_build_object('success', true, 'status', 'confirmed', 'winner', v_opponent_id);
            ELSIF v_existing_result.winner_user_id = v_user_id THEN
                -- User previously claimed win, now says lost - update winner
                UPDATE public.match_results 
                SET winner_user_id = v_opponent_id, loser_confirmed = true, updated_at = now()
                WHERE match_id = p_match_id;
                
                IF v_existing_result.winner_confirmed THEN
                    -- This was a dispute scenario, now resolved
                    PERFORM public.complete_match_payout(p_match_id, v_opponent_id);
                    RETURN json_build_object('success', true, 'status', 'confirmed', 'winner', v_opponent_id);
                END IF;
                
                RETURN json_build_object('success', true, 'status', 'waiting_confirmation');
            END IF;
        END IF;
    END IF;
    
    RETURN json_build_object('success', true, 'status', 'updated');
END;
$function$;

-- Admin function to resolve disputes
CREATE OR REPLACE FUNCTION public.admin_resolve_dispute(p_match_id uuid, p_winner_user_id uuid, p_admin_notes text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Update result with admin decision
    UPDATE public.match_results
    SET 
        winner_user_id = p_winner_user_id,
        status = 'resolved',
        resolved_by = auth.uid(),
        admin_notes = p_admin_notes,
        updated_at = now()
    WHERE match_id = p_match_id;
    
    -- Process payout
    PERFORM public.complete_match_payout(p_match_id, p_winner_user_id);
    
    RETURN json_build_object('success', true);
END;
$function$;-- =============================================
-- OLEBOY TOKEN - Complete Match System Migration
-- =============================================

-- 1. Add new columns to match_participants
ALTER TABLE public.match_participants 
ADD COLUMN IF NOT EXISTS team_side TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ready BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS result_choice TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS result_at TIMESTAMPTZ DEFAULT NULL;

-- Add constraints for team_side and result_choice
ALTER TABLE public.match_participants 
DROP CONSTRAINT IF EXISTS match_participants_team_side_check,
DROP CONSTRAINT IF EXISTS match_participants_result_choice_check;

ALTER TABLE public.match_participants 
ADD CONSTRAINT match_participants_team_side_check CHECK (team_side IN ('A', 'B')),
ADD CONSTRAINT match_participants_result_choice_check CHECK (result_choice IN ('WIN', 'LOSS'));

-- 2. Update matches status constraint to support new states
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_status_check 
CHECK (status IN ('open', 'joined', 'ready_check', 'in_progress', 'result_pending', 'completed', 'disputed', 'canceled', 'admin_resolved', 'expired', 'finished', 'full', 'started'));

-- 3. Create join_match_v2 function
CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_current_balance DECIMAL(10,2);
    v_existing_participant RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get match with lock
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status != 'open' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not open');
    END IF;
    
    IF v_match.creator_id = v_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot join your own match');
    END IF;
    
    -- Check if already participant
    SELECT * INTO v_existing_participant
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id;
    
    IF v_existing_participant IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'Already a participant');
    END IF;
    
    -- Check wallet balance
    SELECT balance INTO v_current_balance
    FROM public.wallets
    WHERE user_id = v_user_id
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Wallet not found');
    END IF;
    
    IF v_current_balance < v_match.entry_fee THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance');
    END IF;
    
    -- Lock funds
    UPDATE public.wallets
    SET 
        balance = balance - v_match.entry_fee,
        locked_balance = locked_balance + v_match.entry_fee,
        updated_at = now()
    WHERE user_id = v_user_id;
    
    -- Log transaction
    INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_user_id, 'lock', v_match.entry_fee, p_match_id, 'Locked funds for match join', 'completed');
    
    -- Add as participant with team_side B
    INSERT INTO public.match_participants (match_id, user_id, team_side, status)
    VALUES (p_match_id, v_user_id, 'B', 'joined');
    
    -- Update host to team_side A if not set
    UPDATE public.match_participants
    SET team_side = 'A'
    WHERE match_id = p_match_id AND user_id = v_match.creator_id AND team_side IS NULL;
    
    -- Update match status to ready_check
    UPDATE public.matches
    SET status = 'ready_check'
    WHERE id = p_match_id;
    
    RETURN json_build_object('success', true, 'status', 'ready_check');
END;
$$;

-- 4. Create set_player_ready function
CREATE OR REPLACE FUNCTION public.set_player_ready(p_match_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_participant RECORD;
    v_all_ready BOOLEAN;
    v_total_participants INT;
    v_ready_count INT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get match
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status != 'ready_check' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not in ready check phase');
    END IF;
    
    -- Check if participant
    SELECT * INTO v_participant
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id
    FOR UPDATE;
    
    IF v_participant IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a participant');
    END IF;
    
    IF v_participant.ready = TRUE THEN
        RETURN json_build_object('success', false, 'error', 'Already ready');
    END IF;
    
    -- Set ready
    UPDATE public.match_participants
    SET ready = TRUE, ready_at = now()
    WHERE match_id = p_match_id AND user_id = v_user_id;
    
    -- Check if all participants are ready
    SELECT COUNT(*), COUNT(*) FILTER (WHERE ready = TRUE)
    INTO v_total_participants, v_ready_count
    FROM public.match_participants
    WHERE match_id = p_match_id;
    
    -- Add 1 for the current user who just became ready
    v_ready_count := v_ready_count + 1;
    
    IF v_ready_count >= v_total_participants THEN
        -- All ready, start match
        UPDATE public.matches
        SET status = 'in_progress', started_at = now()
        WHERE id = p_match_id;
        
        RETURN json_build_object('success', true, 'status', 'in_progress', 'all_ready', true);
    END IF;
    
    RETURN json_build_object('success', true, 'status', 'ready_check', 'ready_count', v_ready_count, 'total', v_total_participants);
END;
$$;

-- 5. Create submit_match_result function
CREATE OR REPLACE FUNCTION public.submit_match_result(p_match_id UUID, p_result TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_participant RECORD;
    v_all_voted BOOLEAN;
    v_team_a_result TEXT;
    v_team_b_result TEXT;
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_entry_fee DECIMAL(10,2);
    v_prize_pool DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_winner_payout DECIMAL(10,2);
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    IF p_result NOT IN ('WIN', 'LOSS') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid result. Must be WIN or LOSS');
    END IF;
    
    -- Get match
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
        RETURN json_build_object('success', false, 'error', 'Match is not in progress');
    END IF;
    
    -- Check if participant
    SELECT * INTO v_participant
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id
    FOR UPDATE;
    
    IF v_participant IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a participant');
    END IF;
    
    IF v_participant.result_choice IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'Already submitted result');
    END IF;
    
    -- Save result
    UPDATE public.match_participants
    SET result_choice = p_result, result_at = now()
    WHERE match_id = p_match_id AND user_id = v_user_id;
    
    -- Update match to result_pending if not already
    IF v_match.status = 'in_progress' THEN
        UPDATE public.matches SET status = 'result_pending' WHERE id = p_match_id;
    END IF;
    
    -- Check if all have voted
    IF EXISTS (SELECT 1 FROM public.match_participants WHERE match_id = p_match_id AND result_choice IS NULL) THEN
        RETURN json_build_object('success', true, 'status', 'waiting_opponent');
    END IF;
    
    -- All voted - analyze results
    SELECT result_choice INTO v_team_a_result
    FROM public.match_participants
    WHERE match_id = p_match_id AND team_side = 'A'
    LIMIT 1;
    
    SELECT result_choice INTO v_team_b_result
    FROM public.match_participants
    WHERE match_id = p_match_id AND team_side = 'B'
    LIMIT 1;
    
    -- Check for agreement
    IF (v_team_a_result = 'WIN' AND v_team_b_result = 'LOSS') THEN
        -- Team A wins
        SELECT user_id INTO v_winner_user_id FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'A' LIMIT 1;
        SELECT user_id INTO v_loser_user_id FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'B' LIMIT 1;
        
        -- Process payout
        v_entry_fee := v_match.entry_fee;
        v_prize_pool := v_entry_fee * 2;
        v_platform_fee := v_prize_pool * 0.05;
        v_winner_payout := v_prize_pool - v_platform_fee;
        
        -- Pay winner
        UPDATE public.wallets
        SET balance = balance + v_winner_payout, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_winner_user_id;
        
        -- Remove loser locked
        UPDATE public.wallets
        SET locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_loser_user_id;
        
        -- Log transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Match winnings', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Match entry lost', 'completed');
        
        -- Record platform fee
        INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
        UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now();
        
        -- Update match
        UPDATE public.matches SET status = 'completed', finished_at = now() WHERE id = p_match_id;
        
        -- Create result record
        INSERT INTO public.match_results (match_id, winner_user_id, loser_confirmed, winner_confirmed, status)
        VALUES (p_match_id, v_winner_user_id, true, true, 'confirmed')
        ON CONFLICT (match_id) DO UPDATE SET winner_user_id = v_winner_user_id, status = 'confirmed', updated_at = now();
        
        RETURN json_build_object('success', true, 'status', 'completed', 'winner', v_winner_user_id);
        
    ELSIF (v_team_a_result = 'LOSS' AND v_team_b_result = 'WIN') THEN
        -- Team B wins
        SELECT user_id INTO v_winner_user_id FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'B' LIMIT 1;
        SELECT user_id INTO v_loser_user_id FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'A' LIMIT 1;
        
        -- Process payout
        v_entry_fee := v_match.entry_fee;
        v_prize_pool := v_entry_fee * 2;
        v_platform_fee := v_prize_pool * 0.05;
        v_winner_payout := v_prize_pool - v_platform_fee;
        
        -- Pay winner
        UPDATE public.wallets
        SET balance = balance + v_winner_payout, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_winner_user_id;
        
        -- Remove loser locked
        UPDATE public.wallets
        SET locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_loser_user_id;
        
        -- Log transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Match winnings', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Match entry lost', 'completed');
        
        -- Record platform fee
        INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
        UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now();
        
        -- Update match
        UPDATE public.matches SET status = 'completed', finished_at = now() WHERE id = p_match_id;
        
        -- Create result record
        INSERT INTO public.match_results (match_id, winner_user_id, loser_confirmed, winner_confirmed, status)
        VALUES (p_match_id, v_winner_user_id, true, true, 'confirmed')
        ON CONFLICT (match_id) DO UPDATE SET winner_user_id = v_winner_user_id, status = 'confirmed', updated_at = now();
        
        RETURN json_build_object('success', true, 'status', 'completed', 'winner', v_winner_user_id);
        
    ELSE
        -- Dispute: both WIN or both LOSS
        UPDATE public.matches SET status = 'disputed' WHERE id = p_match_id;
        
        INSERT INTO public.match_results (match_id, status, dispute_reason)
        VALUES (p_match_id, 'disputed', 
            CASE 
                WHEN v_team_a_result = 'WIN' AND v_team_b_result = 'WIN' THEN 'Both players claimed victory'
                ELSE 'Both players claimed loss'
            END
        )
        ON CONFLICT (match_id) DO UPDATE SET status = 'disputed', dispute_reason = 
            CASE 
                WHEN v_team_a_result = 'WIN' AND v_team_b_result = 'WIN' THEN 'Both players claimed victory'
                ELSE 'Both players claimed loss'
            END, updated_at = now();
        
        RETURN json_build_object('success', true, 'status', 'disputed');
    END IF;
END;
$$;

-- 6. Create cancel_match_v2 function
CREATE OR REPLACE FUNCTION public.cancel_match_v2(p_match_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_match RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get match
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.creator_id != v_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Only the host can cancel');
    END IF;
    
    IF v_match.status != 'open' THEN
        RETURN json_build_object('success', false, 'error', 'Can only cancel open matches');
    END IF;
    
    -- Refund host
    UPDATE public.wallets
    SET balance = balance + v_match.entry_fee, locked_balance = locked_balance - v_match.entry_fee, updated_at = now()
    WHERE user_id = v_user_id;
    
    -- Log refund
    INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_user_id, 'refund', v_match.entry_fee, p_match_id, 'Match canceled - refund', 'completed');
    
    -- Update match status
    UPDATE public.matches SET status = 'canceled' WHERE id = p_match_id;
    
    RETURN json_build_object('success', true);
END;
$$;

-- 7. Create leave_match function
CREATE OR REPLACE FUNCTION public.leave_match(p_match_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_participant RECORD;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get match
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status != 'ready_check' THEN
        RETURN json_build_object('success', false, 'error', 'Can only leave during ready check phase');
    END IF;
    
    IF v_match.creator_id = v_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Host cannot leave. Cancel the match instead.');
    END IF;
    
    -- Check if participant
    SELECT * INTO v_participant
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id;
    
    IF v_participant IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a participant');
    END IF;
    
    IF v_participant.ready = TRUE THEN
        RETURN json_build_object('success', false, 'error', 'Cannot leave after ready');
    END IF;
    
    -- Refund joiner
    UPDATE public.wallets
    SET balance = balance + v_match.entry_fee, locked_balance = locked_balance - v_match.entry_fee, updated_at = now()
    WHERE user_id = v_user_id;
    
    -- Log refund
    INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_user_id, 'refund', v_match.entry_fee, p_match_id, 'Left match - refund', 'completed');
    
    -- Remove participant
    DELETE FROM public.match_participants WHERE match_id = p_match_id AND user_id = v_user_id;
    
    -- Reset host ready status and match to open
    UPDATE public.match_participants SET ready = FALSE, ready_at = NULL WHERE match_id = p_match_id;
    UPDATE public.matches SET status = 'open' WHERE id = p_match_id;
    
    RETURN json_build_object('success', true);
END;
$$;

-- 8. Create admin_resolve_match_v2 function
CREATE OR REPLACE FUNCTION public.admin_resolve_match_v2(
    p_match_id UUID, 
    p_action TEXT, 
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_team_a_user UUID;
    v_team_b_user UUID;
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_entry_fee DECIMAL(10,2);
    v_prize_pool DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_winner_payout DECIMAL(10,2);
BEGIN
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_action NOT IN ('TEAM_A_WIN', 'TEAM_B_WIN', 'REFUND_BOTH') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid action');
    END IF;
    
    -- Get match
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status NOT IN ('disputed', 'ready_check', 'in_progress', 'result_pending') THEN
        RETURN json_build_object('success', false, 'error', 'Match cannot be resolved');
    END IF;
    
    -- Get participants
    SELECT user_id INTO v_team_a_user FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'A' LIMIT 1;
    SELECT user_id INTO v_team_b_user FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'B' LIMIT 1;
    
    v_entry_fee := v_match.entry_fee;
    v_prize_pool := v_entry_fee * 2;
    v_platform_fee := v_prize_pool * 0.05;
    v_winner_payout := v_prize_pool - v_platform_fee;
    
    IF p_action = 'REFUND_BOTH' THEN
        -- Refund both players
        UPDATE public.wallets
        SET balance = balance + v_entry_fee, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_team_a_user;
        
        UPDATE public.wallets
        SET balance = balance + v_entry_fee, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_team_b_user;
        
        -- Log refunds
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_team_a_user, 'refund', v_entry_fee, p_match_id, 'Admin resolved - refund', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_team_b_user, 'refund', v_entry_fee, p_match_id, 'Admin resolved - refund', 'completed');
        
        -- Update match and result
        UPDATE public.matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;
        
        INSERT INTO public.match_results (match_id, status, admin_notes, resolved_by)
        VALUES (p_match_id, 'resolved', p_notes, auth.uid())
        ON CONFLICT (match_id) DO UPDATE SET status = 'resolved', admin_notes = p_notes, resolved_by = auth.uid(), updated_at = now();
        
        RETURN json_build_object('success', true, 'action', 'refund_both');
    ELSE
        -- Assign winner
        IF p_action = 'TEAM_A_WIN' THEN
            v_winner_user_id := v_team_a_user;
            v_loser_user_id := v_team_b_user;
        ELSE
            v_winner_user_id := v_team_b_user;
            v_loser_user_id := v_team_a_user;
        END IF;
        
        -- Pay winner
        UPDATE public.wallets
        SET balance = balance + v_winner_payout, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_winner_user_id;
        
        -- Remove loser locked
        UPDATE public.wallets
        SET locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_loser_user_id;
        
        -- Log transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Admin resolved - winnings', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Admin resolved - loss', 'completed');
        
        -- Record platform fee
        INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
        UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now();
        
        -- Update match and result
        UPDATE public.matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;
        
        INSERT INTO public.match_results (match_id, winner_user_id, status, admin_notes, resolved_by)
        VALUES (p_match_id, v_winner_user_id, 'resolved', p_notes, auth.uid())
        ON CONFLICT (match_id) DO UPDATE SET winner_user_id = v_winner_user_id, status = 'resolved', admin_notes = p_notes, resolved_by = auth.uid(), updated_at = now();
        
        RETURN json_build_object('success', true, 'action', p_action, 'winner', v_winner_user_id);
    END IF;
END;
$$;

-- 9. Add unique constraint on match_results if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'match_results_match_id_key'
    ) THEN
        ALTER TABLE public.match_results ADD CONSTRAINT match_results_match_id_key UNIQUE (match_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;-- FIX BUG 1: Correct set_player_ready to not start match prematurely
-- Remove the erroneous +1 increment and add idempotency guard
CREATE OR REPLACE FUNCTION public.set_player_ready(p_match_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_participant RECORD;
    v_total_participants INT;
    v_ready_count INT;
    v_rows_updated INT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    -- Get match with lock
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status != 'ready_check' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not in ready check phase');
    END IF;
    
    -- Check if participant with lock
    SELECT * INTO v_participant
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id
    FOR UPDATE;
    
    IF v_participant IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a participant');
    END IF;
    
    IF v_participant.ready = TRUE THEN
        -- Already ready - return current state (idempotent)
        SELECT COUNT(*), COUNT(*) FILTER (WHERE ready = TRUE)
        INTO v_total_participants, v_ready_count
        FROM public.match_participants
        WHERE match_id = p_match_id;
        
        RETURN json_build_object('success', true, 'status', v_match.status, 'ready_count', v_ready_count, 'total', v_total_participants, 'already_ready', true);
    END IF;
    
    -- Set ready for this user
    UPDATE public.match_participants
    SET ready = TRUE, ready_at = now()
    WHERE match_id = p_match_id AND user_id = v_user_id;
    
    -- Count all participants and ready ones AFTER the update
    SELECT COUNT(*), COUNT(*) FILTER (WHERE ready = TRUE)
    INTO v_total_participants, v_ready_count
    FROM public.match_participants
    WHERE match_id = p_match_id;
    
    -- Log for debugging
    RAISE LOG 'set_player_ready: match=%, user=%, ready_count=%, total=%', p_match_id, v_user_id, v_ready_count, v_total_participants;
    
    -- Check if ALL participants are ready
    IF v_ready_count >= v_total_participants AND v_total_participants >= 2 THEN
        -- All ready - start match with idempotency guard
        UPDATE public.matches
        SET status = 'in_progress', started_at = now()
        WHERE id = p_match_id AND status = 'ready_check';
        
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        
        IF v_rows_updated > 0 THEN
            RAISE LOG 'set_player_ready: match % transitioned to in_progress', p_match_id;
            RETURN json_build_object('success', true, 'status', 'in_progress', 'all_ready', true, 'ready_count', v_ready_count, 'total', v_total_participants);
        ELSE
            -- Already transitioned by concurrent call
            RETURN json_build_object('success', true, 'status', 'in_progress', 'all_ready', true, 'ready_count', v_ready_count, 'total', v_total_participants, 'concurrent', true);
        END IF;
    END IF;
    
    RETURN json_build_object('success', true, 'status', 'ready_check', 'ready_count', v_ready_count, 'total', v_total_participants);
END;
$function$;

-- FIX BUG 3: Make admin_resolve_match_v2 more robust
-- Only allow disputed status, add idempotency, fallback for team_side
CREATE OR REPLACE FUNCTION public.admin_resolve_match_v2(p_match_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_match RECORD;
    v_team_a_user UUID;
    v_team_b_user UUID;
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_entry_fee DECIMAL(10,2);
    v_prize_pool DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_winner_payout DECIMAL(10,2);
    v_existing_payout INT;
    v_winner_locked DECIMAL(10,2);
    v_loser_locked DECIMAL(10,2);
BEGIN
    -- Check admin permission
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_action NOT IN ('TEAM_A_WIN', 'TEAM_B_WIN', 'REFUND_BOTH') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid action. Must be TEAM_A_WIN, TEAM_B_WIN, or REFUND_BOTH');
    END IF;
    
    -- Get match with lock
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    -- Idempotency: if already resolved, return success
    IF v_match.status IN ('admin_resolved', 'completed') THEN
        RAISE LOG 'admin_resolve_match_v2: match % already resolved (status=%)', p_match_id, v_match.status;
        RETURN json_build_object('success', true, 'already_resolved', true, 'status', v_match.status);
    END IF;
    
    -- Only allow resolution of disputed matches (strict)
    IF v_match.status != 'disputed' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not in disputed status. Current status: ' || v_match.status);
    END IF;
    
    -- Get participants with fallback for team_side
    -- Try team_side first, then fallback to creator/joiner logic
    SELECT user_id INTO v_team_a_user 
    FROM public.match_participants 
    WHERE match_id = p_match_id AND team_side = 'A' 
    LIMIT 1;
    
    SELECT user_id INTO v_team_b_user 
    FROM public.match_participants 
    WHERE match_id = p_match_id AND team_side = 'B' 
    LIMIT 1;
    
    -- Fallback if team_side is NULL
    IF v_team_a_user IS NULL THEN
        v_team_a_user := v_match.creator_id;
    END IF;
    
    IF v_team_b_user IS NULL THEN
        SELECT user_id INTO v_team_b_user 
        FROM public.match_participants 
        WHERE match_id = p_match_id AND user_id != v_match.creator_id
        LIMIT 1;
    END IF;
    
    -- Validate both participants exist
    IF v_team_a_user IS NULL OR v_team_b_user IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Missing participants for resolution');
    END IF;
    
    -- Check for existing payout (idempotency)
    SELECT COUNT(*) INTO v_existing_payout
    FROM public.transactions 
    WHERE match_id = p_match_id AND type IN ('payout', 'refund');
    
    IF v_existing_payout > 0 THEN
        RAISE LOG 'admin_resolve_match_v2: match % already has payout/refund transactions', p_match_id;
        RETURN json_build_object('success', true, 'already_resolved', true, 'existing_transactions', v_existing_payout);
    END IF;
    
    v_entry_fee := v_match.entry_fee;
    v_prize_pool := v_entry_fee * 2;
    v_platform_fee := v_prize_pool * 0.05;
    v_winner_payout := v_prize_pool - v_platform_fee;
    
    RAISE LOG 'admin_resolve_match_v2: match=%, action=%, team_a=%, team_b=%, entry_fee=%, prize=%', 
        p_match_id, p_action, v_team_a_user, v_team_b_user, v_entry_fee, v_prize_pool;
    
    IF p_action = 'REFUND_BOTH' THEN
        -- Validate locked_balance before refund
        SELECT locked_balance INTO v_winner_locked FROM public.wallets WHERE user_id = v_team_a_user FOR UPDATE;
        SELECT locked_balance INTO v_loser_locked FROM public.wallets WHERE user_id = v_team_b_user FOR UPDATE;
        
        IF v_winner_locked < v_entry_fee OR v_loser_locked < v_entry_fee THEN
            RAISE LOG 'admin_resolve_match_v2: insufficient locked_balance for refund. A=%, B=%, required=%', 
                v_winner_locked, v_loser_locked, v_entry_fee;
            RETURN json_build_object('success', false, 'error', 'Insufficient locked balance for refund');
        END IF;
        
        -- Refund both players
        UPDATE public.wallets
        SET balance = balance + v_entry_fee, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_team_a_user;
        
        UPDATE public.wallets
        SET balance = balance + v_entry_fee, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_team_b_user;
        
        -- Log refund transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_team_a_user, 'refund', v_entry_fee, p_match_id, 'Admin resolved - refund', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_team_b_user, 'refund', v_entry_fee, p_match_id, 'Admin resolved - refund', 'completed');
        
        -- Update match status
        UPDATE public.matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;
        
        -- Update/insert match result
        INSERT INTO public.match_results (match_id, status, admin_notes, resolved_by)
        VALUES (p_match_id, 'resolved', p_notes, auth.uid())
        ON CONFLICT (match_id) DO UPDATE SET status = 'resolved', admin_notes = p_notes, resolved_by = auth.uid(), updated_at = now();
        
        RAISE LOG 'admin_resolve_match_v2: match % resolved with REFUND_BOTH', p_match_id;
        RETURN json_build_object('success', true, 'action', 'refund_both', 'refunded_amount', v_entry_fee);
    ELSE
        -- Assign winner based on action
        IF p_action = 'TEAM_A_WIN' THEN
            v_winner_user_id := v_team_a_user;
            v_loser_user_id := v_team_b_user;
        ELSE
            v_winner_user_id := v_team_b_user;
            v_loser_user_id := v_team_a_user;
        END IF;
        
        -- Validate locked_balance before payout
        SELECT locked_balance INTO v_winner_locked FROM public.wallets WHERE user_id = v_winner_user_id FOR UPDATE;
        SELECT locked_balance INTO v_loser_locked FROM public.wallets WHERE user_id = v_loser_user_id FOR UPDATE;
        
        IF v_winner_locked < v_entry_fee OR v_loser_locked < v_entry_fee THEN
            RAISE LOG 'admin_resolve_match_v2: insufficient locked_balance. winner=%, loser=%, required=%', 
                v_winner_locked, v_loser_locked, v_entry_fee;
            RETURN json_build_object('success', false, 'error', 'Insufficient locked balance for payout');
        END IF;
        
        -- Pay winner (their entry back + opponent's entry - platform fee)
        UPDATE public.wallets
        SET balance = balance + v_winner_payout, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_winner_user_id;
        
        -- Remove loser's locked balance
        UPDATE public.wallets
        SET locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_loser_user_id;
        
        -- Log transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Admin resolved - winnings', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Admin resolved - loss', 'completed');
        
        -- Record platform fee
        INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
        UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now();
        
        -- Update match status
        UPDATE public.matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;
        
        -- Update/insert match result
        INSERT INTO public.match_results (match_id, winner_user_id, status, admin_notes, resolved_by)
        VALUES (p_match_id, v_winner_user_id, 'resolved', p_notes, auth.uid())
        ON CONFLICT (match_id) DO UPDATE SET winner_user_id = v_winner_user_id, status = 'resolved', admin_notes = p_notes, resolved_by = auth.uid(), updated_at = now();
        
        RAISE LOG 'admin_resolve_match_v2: match % resolved. winner=%, payout=%, platform_fee=%', 
            p_match_id, v_winner_user_id, v_winner_payout, v_platform_fee;
        
        RETURN json_build_object('success', true, 'action', p_action, 'winner', v_winner_user_id, 'payout', v_winner_payout, 'platform_fee', v_platform_fee);
    END IF;
END;
$function$;-- Fix: Add WHERE clause to platform_wallet updates in both functions

-- 1. Fix submit_match_result - add WHERE clause to platform_wallet updates
CREATE OR REPLACE FUNCTION public.submit_match_result(p_match_id uuid, p_result text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_participant RECORD;
    v_all_voted BOOLEAN;
    v_team_a_result TEXT;
    v_team_b_result TEXT;
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_entry_fee DECIMAL(10,2);
    v_prize_pool DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_winner_payout DECIMAL(10,2);
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    IF p_result NOT IN ('WIN', 'LOSS') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid result. Must be WIN or LOSS');
    END IF;
    
    -- Get match
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
        RETURN json_build_object('success', false, 'error', 'Match is not in progress');
    END IF;
    
    -- Check if participant
    SELECT * INTO v_participant
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id
    FOR UPDATE;
    
    IF v_participant IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a participant');
    END IF;
    
    IF v_participant.result_choice IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'Already submitted result');
    END IF;
    
    -- Save result
    UPDATE public.match_participants
    SET result_choice = p_result, result_at = now()
    WHERE match_id = p_match_id AND user_id = v_user_id;
    
    -- Update match to result_pending if not already
    IF v_match.status = 'in_progress' THEN
        UPDATE public.matches SET status = 'result_pending' WHERE id = p_match_id;
    END IF;
    
    -- Check if all have voted
    IF EXISTS (SELECT 1 FROM public.match_participants WHERE match_id = p_match_id AND result_choice IS NULL) THEN
        RETURN json_build_object('success', true, 'status', 'waiting_opponent');
    END IF;
    
    -- All voted - analyze results
    SELECT result_choice INTO v_team_a_result
    FROM public.match_participants
    WHERE match_id = p_match_id AND team_side = 'A'
    LIMIT 1;
    
    SELECT result_choice INTO v_team_b_result
    FROM public.match_participants
    WHERE match_id = p_match_id AND team_side = 'B'
    LIMIT 1;
    
    -- Check for agreement
    IF (v_team_a_result = 'WIN' AND v_team_b_result = 'LOSS') THEN
        -- Team A wins
        SELECT user_id INTO v_winner_user_id FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'A' LIMIT 1;
        SELECT user_id INTO v_loser_user_id FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'B' LIMIT 1;
        
        -- Process payout
        v_entry_fee := v_match.entry_fee;
        v_prize_pool := v_entry_fee * 2;
        v_platform_fee := v_prize_pool * 0.05;
        v_winner_payout := v_prize_pool - v_platform_fee;
        
        -- Pay winner
        UPDATE public.wallets
        SET balance = balance + v_winner_payout, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_winner_user_id;
        
        -- Remove loser locked
        UPDATE public.wallets
        SET locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_loser_user_id;
        
        -- Log transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Match winnings', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Match entry lost', 'completed');
        
        -- Record platform fee - FIX: add WHERE clause
        INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
        UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now()
        WHERE id IS NOT NULL;
        
        -- Update match
        UPDATE public.matches SET status = 'completed', finished_at = now() WHERE id = p_match_id;
        
        -- Create result record
        INSERT INTO public.match_results (match_id, winner_user_id, loser_confirmed, winner_confirmed, status)
        VALUES (p_match_id, v_winner_user_id, true, true, 'confirmed')
        ON CONFLICT (match_id) DO UPDATE SET winner_user_id = v_winner_user_id, status = 'confirmed', updated_at = now();
        
        RETURN json_build_object('success', true, 'status', 'completed', 'winner', v_winner_user_id);
        
    ELSIF (v_team_a_result = 'LOSS' AND v_team_b_result = 'WIN') THEN
        -- Team B wins
        SELECT user_id INTO v_winner_user_id FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'B' LIMIT 1;
        SELECT user_id INTO v_loser_user_id FROM public.match_participants WHERE match_id = p_match_id AND team_side = 'A' LIMIT 1;
        
        -- Process payout
        v_entry_fee := v_match.entry_fee;
        v_prize_pool := v_entry_fee * 2;
        v_platform_fee := v_prize_pool * 0.05;
        v_winner_payout := v_prize_pool - v_platform_fee;
        
        -- Pay winner
        UPDATE public.wallets
        SET balance = balance + v_winner_payout, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_winner_user_id;
        
        -- Remove loser locked
        UPDATE public.wallets
        SET locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_loser_user_id;
        
        -- Log transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Match winnings', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Match entry lost', 'completed');
        
        -- Record platform fee - FIX: add WHERE clause
        INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
        UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now()
        WHERE id IS NOT NULL;
        
        -- Update match
        UPDATE public.matches SET status = 'completed', finished_at = now() WHERE id = p_match_id;
        
        -- Create result record
        INSERT INTO public.match_results (match_id, winner_user_id, loser_confirmed, winner_confirmed, status)
        VALUES (p_match_id, v_winner_user_id, true, true, 'confirmed')
        ON CONFLICT (match_id) DO UPDATE SET winner_user_id = v_winner_user_id, status = 'confirmed', updated_at = now();
        
        RETURN json_build_object('success', true, 'status', 'completed', 'winner', v_winner_user_id);
        
    ELSE
        -- Dispute: both WIN or both LOSS
        UPDATE public.matches SET status = 'disputed' WHERE id = p_match_id;
        
        INSERT INTO public.match_results (match_id, status, dispute_reason)
        VALUES (p_match_id, 'disputed', 
            CASE 
                WHEN v_team_a_result = 'WIN' AND v_team_b_result = 'WIN' THEN 'Both players claimed victory'
                ELSE 'Both players claimed loss'
            END
        )
        ON CONFLICT (match_id) DO UPDATE SET status = 'disputed', dispute_reason = 
            CASE 
                WHEN v_team_a_result = 'WIN' AND v_team_b_result = 'WIN' THEN 'Both players claimed victory'
                ELSE 'Both players claimed loss'
            END, updated_at = now();
        
        RETURN json_build_object('success', true, 'status', 'disputed');
    END IF;
END;
$function$;

-- 2. Fix admin_resolve_match_v2 - add WHERE clause to platform_wallet update
CREATE OR REPLACE FUNCTION public.admin_resolve_match_v2(p_match_id uuid, p_action text, p_notes text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_match RECORD;
    v_team_a_user UUID;
    v_team_b_user UUID;
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_entry_fee DECIMAL(10,2);
    v_prize_pool DECIMAL(10,2);
    v_platform_fee DECIMAL(10,2);
    v_winner_payout DECIMAL(10,2);
    v_existing_payout INT;
    v_winner_locked DECIMAL(10,2);
    v_loser_locked DECIMAL(10,2);
BEGIN
    -- Check admin permission
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_action NOT IN ('TEAM_A_WIN', 'TEAM_B_WIN', 'REFUND_BOTH') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid action. Must be TEAM_A_WIN, TEAM_B_WIN, or REFUND_BOTH');
    END IF;
    
    -- Get match with lock
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    -- Idempotency: if already resolved, return success
    IF v_match.status IN ('admin_resolved', 'completed') THEN
        RAISE LOG 'admin_resolve_match_v2: match % already resolved (status=%)', p_match_id, v_match.status;
        RETURN json_build_object('success', true, 'already_resolved', true, 'status', v_match.status);
    END IF;
    
    -- Only allow resolution of disputed matches (strict)
    IF v_match.status != 'disputed' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not in disputed status. Current status: ' || v_match.status);
    END IF;
    
    -- Get participants with fallback for team_side
    SELECT user_id INTO v_team_a_user 
    FROM public.match_participants 
    WHERE match_id = p_match_id AND team_side = 'A' 
    LIMIT 1;
    
    SELECT user_id INTO v_team_b_user 
    FROM public.match_participants 
    WHERE match_id = p_match_id AND team_side = 'B' 
    LIMIT 1;
    
    -- Fallback if team_side is NULL
    IF v_team_a_user IS NULL THEN
        v_team_a_user := v_match.creator_id;
    END IF;
    
    IF v_team_b_user IS NULL THEN
        SELECT user_id INTO v_team_b_user 
        FROM public.match_participants 
        WHERE match_id = p_match_id AND user_id != v_match.creator_id
        LIMIT 1;
    END IF;
    
    -- Validate both participants exist
    IF v_team_a_user IS NULL OR v_team_b_user IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Missing participants for resolution');
    END IF;
    
    -- Check for existing payout (idempotency)
    SELECT COUNT(*) INTO v_existing_payout
    FROM public.transactions 
    WHERE match_id = p_match_id AND type IN ('payout', 'refund');
    
    IF v_existing_payout > 0 THEN
        RAISE LOG 'admin_resolve_match_v2: match % already has payout/refund transactions', p_match_id;
        RETURN json_build_object('success', true, 'already_resolved', true, 'existing_transactions', v_existing_payout);
    END IF;
    
    v_entry_fee := v_match.entry_fee;
    v_prize_pool := v_entry_fee * 2;
    v_platform_fee := v_prize_pool * 0.05;
    v_winner_payout := v_prize_pool - v_platform_fee;
    
    RAISE LOG 'admin_resolve_match_v2: match=%, action=%, team_a=%, team_b=%, entry_fee=%, prize=%', 
        p_match_id, p_action, v_team_a_user, v_team_b_user, v_entry_fee, v_prize_pool;
    
    IF p_action = 'REFUND_BOTH' THEN
        -- Validate locked_balance before refund
        SELECT locked_balance INTO v_winner_locked FROM public.wallets WHERE user_id = v_team_a_user FOR UPDATE;
        SELECT locked_balance INTO v_loser_locked FROM public.wallets WHERE user_id = v_team_b_user FOR UPDATE;
        
        IF v_winner_locked < v_entry_fee OR v_loser_locked < v_entry_fee THEN
            RAISE LOG 'admin_resolve_match_v2: insufficient locked_balance for refund. A=%, B=%, required=%', 
                v_winner_locked, v_loser_locked, v_entry_fee;
            RETURN json_build_object('success', false, 'error', 'Insufficient locked balance for refund');
        END IF;
        
        -- Refund both players
        UPDATE public.wallets
        SET balance = balance + v_entry_fee, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_team_a_user;
        
        UPDATE public.wallets
        SET balance = balance + v_entry_fee, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_team_b_user;
        
        -- Log refund transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_team_a_user, 'refund', v_entry_fee, p_match_id, 'Admin resolved - refund', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_team_b_user, 'refund', v_entry_fee, p_match_id, 'Admin resolved - refund', 'completed');
        
        -- Update match status
        UPDATE public.matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;
        
        -- Update/insert match result
        INSERT INTO public.match_results (match_id, status, admin_notes, resolved_by)
        VALUES (p_match_id, 'resolved', p_notes, auth.uid())
        ON CONFLICT (match_id) DO UPDATE SET status = 'resolved', admin_notes = p_notes, resolved_by = auth.uid(), updated_at = now();
        
        RAISE LOG 'admin_resolve_match_v2: match % resolved with REFUND_BOTH', p_match_id;
        RETURN json_build_object('success', true, 'action', 'refund_both', 'refunded_amount', v_entry_fee);
    ELSE
        -- Assign winner based on action
        IF p_action = 'TEAM_A_WIN' THEN
            v_winner_user_id := v_team_a_user;
            v_loser_user_id := v_team_b_user;
        ELSE
            v_winner_user_id := v_team_b_user;
            v_loser_user_id := v_team_a_user;
        END IF;
        
        -- Validate locked_balance before payout
        SELECT locked_balance INTO v_winner_locked FROM public.wallets WHERE user_id = v_winner_user_id FOR UPDATE;
        SELECT locked_balance INTO v_loser_locked FROM public.wallets WHERE user_id = v_loser_user_id FOR UPDATE;
        
        IF v_winner_locked < v_entry_fee OR v_loser_locked < v_entry_fee THEN
            RAISE LOG 'admin_resolve_match_v2: insufficient locked_balance. winner=%, loser=%, required=%', 
                v_winner_locked, v_loser_locked, v_entry_fee;
            RETURN json_build_object('success', false, 'error', 'Insufficient locked balance for payout');
        END IF;
        
        -- Pay winner (their entry back + opponent's entry - platform fee)
        UPDATE public.wallets
        SET balance = balance + v_winner_payout, locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_winner_user_id;
        
        -- Remove loser's locked balance
        UPDATE public.wallets
        SET locked_balance = locked_balance - v_entry_fee, updated_at = now()
        WHERE user_id = v_loser_user_id;
        
        -- Log transactions
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_user_id, 'payout', v_winner_payout, p_match_id, 'Admin resolved - winnings', 'completed');
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_user_id, 'fee', v_entry_fee, p_match_id, 'Admin resolved - loss', 'completed');
        
        -- Record platform fee - FIX: add WHERE clause
        INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
        UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now()
        WHERE id IS NOT NULL;
        
        -- Update match status
        UPDATE public.matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;
        
        -- Update/insert match result
        INSERT INTO public.match_results (match_id, winner_user_id, status, admin_notes, resolved_by)
        VALUES (p_match_id, v_winner_user_id, 'resolved', p_notes, auth.uid())
        ON CONFLICT (match_id) DO UPDATE SET winner_user_id = v_winner_user_id, status = 'resolved', admin_notes = p_notes, resolved_by = auth.uid(), updated_at = now();
        
        RAISE LOG 'admin_resolve_match_v2: match % resolved. winner=%, payout=%, platform_fee=%', 
            p_match_id, v_winner_user_id, v_winner_payout, v_platform_fee;
        
        RETURN json_build_object('success', true, 'action', p_action, 'winner', v_winner_user_id, 'payout', v_winner_payout, 'platform_fee', v_platform_fee);
    END IF;
END;
$function$;-- ===========================================
-- PHASE 1: Team System Database Updates
-- ===========================================

-- 1.1 Create notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'team_invite', 'invite_accepted', 'invite_declined', 'match_result', etc.
  title TEXT NOT NULL,
  message TEXT,
  payload JSONB DEFAULT '{}', -- {team_id, team_name, invited_by, match_id, etc.}
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 1.2 Add team columns to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS team_a_id UUID REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS team_b_id UUID REFERENCES public.teams(id),
ADD COLUMN IF NOT EXISTS payment_mode_host TEXT DEFAULT 'cover' CHECK (payment_mode_host IN ('cover', 'split')),
ADD COLUMN IF NOT EXISTS payment_mode_joiner TEXT DEFAULT 'cover' CHECK (payment_mode_joiner IN ('cover', 'split'));

-- ===========================================
-- 1.3 RPC: Search users for team invite
-- ===========================================
CREATE OR REPLACE FUNCTION public.search_users_for_invite(
  p_team_id UUID,
  p_search_term TEXT
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  epic_username TEXT,
  avatar_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Require at least 2 characters
  IF LENGTH(p_search_term) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT 
    p.user_id,
    p.username,
    p.epic_username,
    p.avatar_url
  FROM profiles p
  WHERE (
    p.username ILIKE '%' || p_search_term || '%' 
    OR p.epic_username ILIKE '%' || p_search_term || '%'
  )
  -- Exclude users already in team (any status)
  AND NOT EXISTS (
    SELECT 1 FROM team_members tm 
    WHERE tm.team_id = p_team_id 
    AND tm.user_id = p.user_id
  )
  -- Exclude the searcher themselves
  AND p.user_id != auth.uid()
  LIMIT 10;
END;
$$;

-- ===========================================
-- 1.4 RPC: Send team invite
-- ===========================================
CREATE OR REPLACE FUNCTION public.send_team_invite(
  p_team_id UUID,
  p_invitee_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_inviter RECORD;
  v_invitee RECORD;
  v_member_count INT;
  v_existing_member RECORD;
BEGIN
  -- Get team info
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Check if caller is owner or captain
  SELECT * INTO v_inviter 
  FROM team_members 
  WHERE team_id = p_team_id 
  AND user_id = auth.uid() 
  AND status = 'accepted'
  AND role IN ('owner', 'captain');
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You do not have permission to invite members');
  END IF;

  -- Check if invitee exists
  SELECT * INTO v_invitee FROM profiles WHERE user_id = p_invitee_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Check if user is already a member or has pending invite
  SELECT * INTO v_existing_member 
  FROM team_members 
  WHERE team_id = p_team_id AND user_id = p_invitee_user_id;
  
  IF FOUND THEN
    IF v_existing_member.status = 'accepted' THEN
      RETURN json_build_object('success', false, 'error', 'User is already a member of this team');
    ELSIF v_existing_member.status = 'pending' THEN
      RETURN json_build_object('success', false, 'error', 'User already has a pending invite');
    END IF;
  END IF;

  -- Check team size (max 4)
  SELECT COUNT(*) INTO v_member_count 
  FROM team_members 
  WHERE team_id = p_team_id AND status = 'accepted';
  
  IF v_member_count >= 4 THEN
    RETURN json_build_object('success', false, 'error', 'Team is full (max 4 members)');
  END IF;

  -- Create team member record with pending status
  INSERT INTO team_members (team_id, user_id, role, status, invited_by)
  VALUES (p_team_id, p_invitee_user_id, 'member', 'pending', auth.uid());

  -- Create notification for invitee
  INSERT INTO notifications (user_id, type, title, message, payload)
  VALUES (
    p_invitee_user_id,
    'team_invite',
    'Team Invitation',
    'You have been invited to join ' || v_team.name,
    json_build_object(
      'team_id', p_team_id,
      'team_name', v_team.name,
      'team_tag', v_team.tag,
      'invited_by_user_id', auth.uid(),
      'invited_by_username', (SELECT username FROM profiles WHERE user_id = auth.uid())
    )
  );

  RETURN json_build_object('success', true, 'message', 'Invite sent successfully');
END;
$$;

-- ===========================================
-- 1.5 RPC: Respond to team invite
-- ===========================================
CREATE OR REPLACE FUNCTION public.respond_to_invite(
  p_team_id UUID,
  p_action TEXT -- 'accept' or 'decline'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_invite RECORD;
  v_member_count INT;
  v_owner RECORD;
BEGIN
  -- Validate action
  IF p_action NOT IN ('accept', 'decline') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid action');
  END IF;

  -- Get team info
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Get pending invite for this user
  SELECT * INTO v_invite 
  FROM team_members 
  WHERE team_id = p_team_id 
  AND user_id = auth.uid() 
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'No pending invite found');
  END IF;

  IF p_action = 'accept' THEN
    -- Check team not full
    SELECT COUNT(*) INTO v_member_count 
    FROM team_members 
    WHERE team_id = p_team_id AND status = 'accepted';
    
    IF v_member_count >= 4 THEN
      RETURN json_build_object('success', false, 'error', 'Team is already full');
    END IF;

    -- Accept invite
    UPDATE team_members 
    SET status = 'accepted', updated_at = now()
    WHERE team_id = p_team_id AND user_id = auth.uid();

    -- Notify team owner
    SELECT tm.user_id INTO v_owner
    FROM team_members tm
    WHERE tm.team_id = p_team_id AND tm.role = 'owner';

    INSERT INTO notifications (user_id, type, title, message, payload)
    VALUES (
      v_owner.user_id,
      'invite_accepted',
      'Invite Accepted',
      (SELECT username FROM profiles WHERE user_id = auth.uid()) || ' has joined ' || v_team.name,
      json_build_object(
        'team_id', p_team_id,
        'team_name', v_team.name,
        'accepted_by_user_id', auth.uid(),
        'accepted_by_username', (SELECT username FROM profiles WHERE user_id = auth.uid())
      )
    );

    RETURN json_build_object('success', true, 'message', 'You have joined the team');
  ELSE
    -- Decline invite
    UPDATE team_members 
    SET status = 'rejected', updated_at = now()
    WHERE team_id = p_team_id AND user_id = auth.uid();

    -- Notify team owner
    SELECT tm.user_id INTO v_owner
    FROM team_members tm
    WHERE tm.team_id = p_team_id AND tm.role = 'owner';

    INSERT INTO notifications (user_id, type, title, message, payload)
    VALUES (
      v_owner.user_id,
      'invite_declined',
      'Invite Declined',
      (SELECT username FROM profiles WHERE user_id = auth.uid()) || ' declined to join ' || v_team.name,
      json_build_object(
        'team_id', p_team_id,
        'team_name', v_team.name,
        'declined_by_user_id', auth.uid(),
        'declined_by_username', (SELECT username FROM profiles WHERE user_id = auth.uid())
      )
    );

    RETURN json_build_object('success', true, 'message', 'Invite declined');
  END IF;
END;
$$;

-- ===========================================
-- 1.6 RPC: Get team members with balance info (for payment mode checks)
-- ===========================================
CREATE OR REPLACE FUNCTION public.get_team_members_with_balance(
  p_team_id UUID
)
RETURNS TABLE (
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  role TEXT,
  balance NUMERIC,
  has_sufficient_balance BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_fee NUMERIC := 0; -- Will be passed or checked separately
BEGIN
  RETURN QUERY
  SELECT 
    tm.user_id,
    p.username,
    p.avatar_url,
    tm.role,
    COALESCE(w.balance, 0) as balance,
    true as has_sufficient_balance -- Default, will be checked in frontend
  FROM team_members tm
  JOIN profiles p ON p.user_id = tm.user_id
  LEFT JOIN wallets w ON w.user_id = tm.user_id
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
  ORDER BY 
    CASE tm.role 
      WHEN 'owner' THEN 1 
      WHEN 'captain' THEN 2 
      ELSE 3 
    END;
END;
$$;

-- ===========================================
-- 1.7 RPC: Create team match (with COVER/SPLIT payment)
-- ===========================================
CREATE OR REPLACE FUNCTION public.create_team_match(
  p_team_id UUID,
  p_entry_fee NUMERIC,
  p_region TEXT,
  p_platform TEXT,
  p_mode TEXT,
  p_team_size INT,
  p_first_to INT,
  p_payment_mode TEXT, -- 'cover' or 'split'
  p_is_private BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_member_count INT;
  v_match_id UUID;
  v_total_cost NUMERIC;
  v_creator_balance NUMERIC;
  v_member RECORD;
  v_insufficient_members TEXT[];
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Validate team size
  IF p_team_size < 2 OR p_team_size > 4 THEN
    RETURN json_build_object('success', false, 'error', 'Team size must be 2, 3, or 4');
  END IF;

  -- Get team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Check caller is team member
  IF NOT EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = p_team_id 
    AND user_id = auth.uid() 
    AND status = 'accepted'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are not a member of this team');
  END IF;

  -- Check team has EXACT member count
  SELECT COUNT(*) INTO v_member_count 
  FROM team_members 
  WHERE team_id = p_team_id AND status = 'accepted';
  
  IF v_member_count != p_team_size THEN
    RETURN json_build_object('success', false, 'error', 
      'Team has ' || v_member_count || ' members but match requires exactly ' || p_team_size);
  END IF;

  v_total_cost := p_entry_fee * p_team_size;
  v_expires_at := now() + interval '15 minutes';

  IF p_payment_mode = 'cover' THEN
    -- COVER mode: creator pays for everyone
    SELECT balance INTO v_creator_balance 
    FROM wallets WHERE user_id = auth.uid();
    
    IF COALESCE(v_creator_balance, 0) < v_total_cost THEN
      RETURN json_build_object('success', false, 'error', 
        'Insufficient balance. You need ' || v_total_cost || ' Coins to cover the team');
    END IF;

    -- Create match
    INSERT INTO matches (
      creator_id, entry_fee, region, platform, mode, team_size, first_to, 
      is_private, status, expires_at, team_a_id, payment_mode_host
    ) VALUES (
      auth.uid(), p_entry_fee, p_region, p_platform, p_mode, p_team_size, p_first_to,
      p_is_private, 'open', v_expires_at, p_team_id, 'cover'
    ) RETURNING id INTO v_match_id;

    -- Lock funds from creator
    UPDATE wallets 
    SET balance = balance - v_total_cost, 
        locked_balance = locked_balance + v_total_cost,
        updated_at = now()
    WHERE user_id = auth.uid();

    -- Create transaction record
    INSERT INTO transactions (user_id, type, amount, description, match_id, status)
    VALUES (auth.uid(), 'lock', v_total_cost, 'Entry fee locked (covering team)', v_match_id, 'completed');

  ELSE
    -- SPLIT mode: each member pays their share
    v_insufficient_members := ARRAY[]::TEXT[];
    
    FOR v_member IN 
      SELECT tm.user_id, p.username, COALESCE(w.balance, 0) as balance
      FROM team_members tm
      JOIN profiles p ON p.user_id = tm.user_id
      LEFT JOIN wallets w ON w.user_id = tm.user_id
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      IF v_member.balance < p_entry_fee THEN
        v_insufficient_members := array_append(v_insufficient_members, v_member.username);
      END IF;
    END LOOP;

    IF array_length(v_insufficient_members, 1) > 0 THEN
      RETURN json_build_object('success', false, 'error', 
        'Insufficient balance for: ' || array_to_string(v_insufficient_members, ', '),
        'insufficient_members', v_insufficient_members);
    END IF;

    -- Create match
    INSERT INTO matches (
      creator_id, entry_fee, region, platform, mode, team_size, first_to, 
      is_private, status, expires_at, team_a_id, payment_mode_host
    ) VALUES (
      auth.uid(), p_entry_fee, p_region, p_platform, p_mode, p_team_size, p_first_to,
      p_is_private, 'open', v_expires_at, p_team_id, 'split'
    ) RETURNING id INTO v_match_id;

    -- Lock funds from each member
    FOR v_member IN 
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      UPDATE wallets 
      SET balance = balance - p_entry_fee, 
          locked_balance = locked_balance + p_entry_fee,
          updated_at = now()
      WHERE user_id = v_member.user_id;

      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_member.user_id, 'lock', p_entry_fee, 'Entry fee locked (split)', v_match_id, 'completed');
    END LOOP;
  END IF;

  -- Create participant records for all team members
  INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
  SELECT v_match_id, tm.user_id, p_team_id, 'A', 'joined'
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted';

  RETURN json_build_object('success', true, 'match_id', v_match_id);
END;
$$;

-- ===========================================
-- 1.8 RPC: Join team match (with COVER/SPLIT payment)
-- ===========================================
CREATE OR REPLACE FUNCTION public.join_team_match(
  p_match_id UUID,
  p_team_id UUID,
  p_payment_mode TEXT -- 'cover' or 'split'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_team RECORD;
  v_member_count INT;
  v_total_cost NUMERIC;
  v_joiner_balance NUMERIC;
  v_member RECORD;
  v_insufficient_members TEXT[];
BEGIN
  -- Get match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;

  -- Check match is open
  IF v_match.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;

  -- Check match hasn't expired
  IF v_match.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Match has expired');
  END IF;

  -- Check it's a team match
  IF v_match.team_size < 2 THEN
    RETURN json_build_object('success', false, 'error', 'This is not a team match');
  END IF;

  -- Get team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Check not joining with same team
  IF v_match.team_a_id = p_team_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot join with the same team');
  END IF;

  -- Check caller is team member
  IF NOT EXISTS (
    SELECT 1 FROM team_members 
    WHERE team_id = p_team_id 
    AND user_id = auth.uid() 
    AND status = 'accepted'
  ) THEN
    RETURN json_build_object('success', false, 'error', 'You are not a member of this team');
  END IF;

  -- Check team has EXACT member count
  SELECT COUNT(*) INTO v_member_count 
  FROM team_members 
  WHERE team_id = p_team_id AND status = 'accepted';
  
  IF v_member_count != v_match.team_size THEN
    RETURN json_build_object('success', false, 'error', 
      'Team has ' || v_member_count || ' members but match requires exactly ' || v_match.team_size);
  END IF;

  v_total_cost := v_match.entry_fee * v_match.team_size;

  IF p_payment_mode = 'cover' THEN
    -- COVER mode: joiner (captain) pays for everyone
    SELECT balance INTO v_joiner_balance 
    FROM wallets WHERE user_id = auth.uid();
    
    IF COALESCE(v_joiner_balance, 0) < v_total_cost THEN
      RETURN json_build_object('success', false, 'error', 
        'Insufficient balance. You need ' || v_total_cost || ' Coins to cover the team');
    END IF;

    -- Lock funds from joiner
    UPDATE wallets 
    SET balance = balance - v_total_cost, 
        locked_balance = locked_balance + v_total_cost,
        updated_at = now()
    WHERE user_id = auth.uid();

    INSERT INTO transactions (user_id, type, amount, description, match_id, status)
    VALUES (auth.uid(), 'lock', v_total_cost, 'Entry fee locked (covering team)', p_match_id, 'completed');

  ELSE
    -- SPLIT mode: each member pays their share
    v_insufficient_members := ARRAY[]::TEXT[];
    
    FOR v_member IN 
      SELECT tm.user_id, p.username, COALESCE(w.balance, 0) as balance
      FROM team_members tm
      JOIN profiles p ON p.user_id = tm.user_id
      LEFT JOIN wallets w ON w.user_id = tm.user_id
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      IF v_member.balance < v_match.entry_fee THEN
        v_insufficient_members := array_append(v_insufficient_members, v_member.username);
      END IF;
    END LOOP;

    IF array_length(v_insufficient_members, 1) > 0 THEN
      RETURN json_build_object('success', false, 'error', 
        'Insufficient balance for: ' || array_to_string(v_insufficient_members, ', '),
        'insufficient_members', v_insufficient_members);
    END IF;

    -- Lock funds from each member
    FOR v_member IN 
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      UPDATE wallets 
      SET balance = balance - v_match.entry_fee, 
          locked_balance = locked_balance + v_match.entry_fee,
          updated_at = now()
      WHERE user_id = v_member.user_id;

      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_member.user_id, 'lock', v_match.entry_fee, 'Entry fee locked (split)', p_match_id, 'completed');
    END LOOP;
  END IF;

  -- Update match with team B and payment mode
  UPDATE matches 
  SET team_b_id = p_team_id, 
      payment_mode_joiner = p_payment_mode,
      status = 'ready_check'
  WHERE id = p_match_id;

  -- Create participant records for all team B members
  INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
  SELECT p_match_id, tm.user_id, p_team_id, 'B', 'joined'
  FROM team_members tm
  WHERE tm.team_id = p_team_id AND tm.status = 'accepted';

  RETURN json_build_object('success', true, 'message', 'Team joined successfully');
END;
$$;

-- ===========================================
-- 1.9 RPC: Remove team member (owner only)
-- ===========================================
CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_team_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_member RECORD;
BEGIN
  -- Get team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Check caller is owner
  IF v_team.owner_id != auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Only the team owner can remove members');
  END IF;

  -- Cannot remove owner
  IF p_user_id = v_team.owner_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot remove the team owner');
  END IF;

  -- Check member exists
  SELECT * INTO v_member 
  FROM team_members 
  WHERE team_id = p_team_id AND user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User is not a member of this team');
  END IF;

  -- Remove member
  DELETE FROM team_members 
  WHERE team_id = p_team_id AND user_id = p_user_id;

  -- Notify removed member
  INSERT INTO notifications (user_id, type, title, message, payload)
  VALUES (
    p_user_id,
    'removed_from_team',
    'Removed from Team',
    'You have been removed from ' || v_team.name,
    json_build_object('team_id', p_team_id, 'team_name', v_team.name)
  );

  RETURN json_build_object('success', true, 'message', 'Member removed');
END;
$$;

-- ===========================================
-- 1.10 RPC: Leave team (member action)
-- ===========================================
CREATE OR REPLACE FUNCTION public.leave_team(
  p_team_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team RECORD;
  v_member RECORD;
BEGIN
  -- Get team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;

  -- Owner cannot leave (must delete team instead)
  IF v_team.owner_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Team owner cannot leave. Transfer ownership or delete the team.');
  END IF;

  -- Check is member
  SELECT * INTO v_member 
  FROM team_members 
  WHERE team_id = p_team_id AND user_id = auth.uid() AND status = 'accepted';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'You are not a member of this team');
  END IF;

  -- Leave team
  DELETE FROM team_members 
  WHERE team_id = p_team_id AND user_id = auth.uid();

  -- Notify owner
  INSERT INTO notifications (user_id, type, title, message, payload)
  VALUES (
    v_team.owner_id,
    'member_left',
    'Member Left Team',
    (SELECT username FROM profiles WHERE user_id = auth.uid()) || ' has left ' || v_team.name,
    json_build_object(
      'team_id', p_team_id, 
      'team_name', v_team.name,
      'left_by_user_id', auth.uid()
    )
  );

  RETURN json_build_object('success', true, 'message', 'You have left the team');
END;
$$;-- Create atomic team creation RPC that handles both team and owner member insert
CREATE OR REPLACE FUNCTION public.create_team(p_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_tag TEXT;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'You must be logged in to create a team');
  END IF;

  -- Validate name
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Team name is required');
  END IF;
  
  -- Generate tag from name (first 4 chars, uppercase, no spaces)
  v_tag := UPPER(REGEXP_REPLACE(LEFT(TRIM(p_name), 4), '\s+', '', 'g'));
  IF v_tag = '' THEN
    v_tag := 'TEAM';
  END IF;
  
  -- Create team
  INSERT INTO teams (name, tag, owner_id)
  VALUES (TRIM(p_name), v_tag, auth.uid())
  RETURNING id INTO v_team_id;
  
  -- Add owner as accepted member
  INSERT INTO team_members (team_id, user_id, role, status)
  VALUES (v_team_id, auth.uid(), 'owner', 'accepted');
  
  RETURN json_build_object('success', true, 'team_id', v_team_id);
  
EXCEPTION
  WHEN unique_violation THEN
    RETURN json_build_object('success', false, 'error', 'A team with this name already exists');
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;-- Drop unique constraint on teams.name to allow duplicate team names
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_name_key;

-- Update create_team RPC: random 5-char tag with retry loop, no name uniqueness check
CREATE OR REPLACE FUNCTION public.create_team(p_name TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id UUID;
  v_tag TEXT;
  v_attempts INT := 0;
  v_max_attempts INT := 5;
BEGIN
  -- Check if user is authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'You must be logged in to create a team');
  END IF;

  -- Validate name
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RETURN json_build_object('success', false, 'error', 'Team name is required');
  END IF;
  
  -- Try to create team with random tag (retry on tag collision)
  LOOP
    v_attempts := v_attempts + 1;
    
    -- Generate random 5-char uppercase tag
    v_tag := UPPER(SUBSTRING(md5(gen_random_uuid()::text), 1, 5));
    
    BEGIN
      -- Create team
      INSERT INTO teams (name, tag, owner_id)
      VALUES (TRIM(p_name), v_tag, auth.uid())
      RETURNING id INTO v_team_id;
      
      -- Success - exit loop
      EXIT;
      
    EXCEPTION
      WHEN unique_violation THEN
        -- Only retry if it's a tag collision and we haven't exceeded max attempts
        IF v_attempts >= v_max_attempts THEN
          RETURN json_build_object('success', false, 'error', 'Failed to generate unique team tag. Please try again.');
        END IF;
        -- Continue loop to retry with new tag
    END;
  END LOOP;
  
  -- Add owner as accepted member
  INSERT INTO team_members (team_id, user_id, role, status)
  VALUES (v_team_id, auth.uid(), 'owner', 'accepted');
  
  RETURN json_build_object('success', true, 'team_id', v_team_id);
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;-- Create RPC function for team owner to delete their team
CREATE OR REPLACE FUNCTION public.delete_team(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  -- Verify ownership
  SELECT owner_id INTO v_owner_id FROM public.teams WHERE id = p_team_id;
  
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;
  
  IF v_owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the owner can delete this team');
  END IF;
  
  -- Delete team members first (foreign key constraint)
  DELETE FROM public.team_members WHERE team_id = p_team_id;
  
  -- Delete the team
  DELETE FROM public.teams WHERE id = p_team_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;-- First drop the old function to change return type
DROP FUNCTION IF EXISTS public.join_match_v2(uuid);

-- Recreate join_match_v2 with active match check (1v1 only)
CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_match RECORD;
  v_wallet RECORD;
  v_entry_fee numeric;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Check if user has an active match
  IF has_active_match(v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Hai già un match attivo. Completa il match corrente prima di unirti ad altri.');
  END IF;
  
  -- Get match details
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  IF v_match.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;
  
  IF v_match.creator_id = v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot join your own match');
  END IF;
  
  -- This RPC is for 1v1 only
  IF v_match.team_size != 1 THEN
    RETURN json_build_object('success', false, 'error', 'Per i match a squadre usa join_team_match');
  END IF;
  
  -- Check if already joined
  IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = p_match_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already joined this match');
  END IF;
  
  v_entry_fee := v_match.entry_fee;
  
  -- Get wallet and check balance
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  
  IF v_wallet IS NULL OR v_wallet.balance < v_entry_fee THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Lock funds
  UPDATE wallets 
  SET balance = balance - v_entry_fee,
      locked_balance = locked_balance + v_entry_fee,
      updated_at = now()
  WHERE user_id = v_user_id;
  
  -- Create transaction record
  INSERT INTO transactions (user_id, type, amount, description, match_id, status)
  VALUES (v_user_id, 'lock', v_entry_fee, 'Entry fee locked for match', p_match_id, 'completed');
  
  -- Add as participant
  INSERT INTO match_participants (match_id, user_id, team_side, status)
  VALUES (p_match_id, v_user_id, 'B', 'joined');
  
  -- Update match status to ready_check (1v1 is now full)
  UPDATE matches 
  SET status = 'ready_check'
  WHERE id = p_match_id;
  
  RETURN json_build_object('success', true, 'message', 'Joined match successfully');
END;
$$;

-- Drop and recreate create_team_match with active match check
DROP FUNCTION IF EXISTS public.create_team_match(uuid, numeric, text, text, text, integer, integer, text, boolean);

CREATE OR REPLACE FUNCTION public.create_team_match(
  p_team_id uuid,
  p_entry_fee numeric,
  p_region text,
  p_platform text,
  p_mode text,
  p_team_size integer,
  p_first_to integer,
  p_payment_mode text,
  p_is_private boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_team RECORD;
  v_member RECORD;
  v_match_id uuid;
  v_total_fee numeric;
  v_fee_per_member numeric;
  v_active_check jsonb;
  v_accepted_count integer;
  v_insufficient_members TEXT[];
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  
  IF v_team IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;
  
  IF v_team.owner_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Only team owner can create matches');
  END IF;
  
  -- Count accepted members (including owner)
  SELECT COUNT(*) INTO v_accepted_count
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';
  
  IF v_accepted_count != p_team_size THEN
    RETURN json_build_object('success', false, 'error', 
      'Il team deve avere esattamente ' || p_team_size || ' membri accettati');
  END IF;
  
  -- Check if any team member has an active match
  v_active_check := team_has_active_match(p_team_id);
  IF (v_active_check->>'has_active')::boolean THEN
    RETURN json_build_object('success', false, 'error', 
      (v_active_check->>'username') || ' ha già un match attivo. Tutti i membri devono essere liberi.');
  END IF;
  
  v_total_fee := p_entry_fee * p_team_size;
  v_fee_per_member := p_entry_fee;
  
  -- Handle payment based on mode
  IF p_payment_mode = 'cover' THEN
    -- Owner pays full amount
    DECLARE
      v_owner_wallet RECORD;
    BEGIN
      SELECT * INTO v_owner_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
      
      IF v_owner_wallet IS NULL OR v_owner_wallet.balance < v_total_fee THEN
        RETURN json_build_object('success', false, 'error', 'Saldo insufficiente per coprire tutti i membri');
      END IF;
      
      UPDATE wallets 
      SET balance = balance - v_total_fee,
          locked_balance = locked_balance + v_total_fee,
          updated_at = now()
      WHERE user_id = v_user_id;
      
      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (v_user_id, 'lock', v_total_fee, 'Entry fee (cover mode) for team match', 'completed');
    END;
  ELSE
    -- Split: check balances first
    v_insufficient_members := ARRAY[]::TEXT[];
    
    FOR v_member IN 
      SELECT tm.user_id, p.username, COALESCE(w.balance, 0) as balance
      FROM team_members tm
      JOIN profiles p ON p.user_id = tm.user_id
      LEFT JOIN wallets w ON w.user_id = tm.user_id
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      IF v_member.balance < v_fee_per_member THEN
        v_insufficient_members := array_append(v_insufficient_members, v_member.username);
      END IF;
    END LOOP;
    
    IF array_length(v_insufficient_members, 1) > 0 THEN
      RETURN json_build_object('success', false, 'error', 
        'Saldo insufficiente per: ' || array_to_string(v_insufficient_members, ', '));
    END IF;
    
    -- Split: each member pays their share
    FOR v_member IN 
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      UPDATE wallets 
      SET balance = balance - v_fee_per_member,
          locked_balance = locked_balance + v_fee_per_member,
          updated_at = now()
      WHERE user_id = v_member.user_id;
      
      INSERT INTO transactions (user_id, type, amount, description, status)
      VALUES (v_member.user_id, 'lock', v_fee_per_member, 'Entry fee (split mode) for team match', 'completed');
    END LOOP;
  END IF;
  
  -- Create match
  INSERT INTO matches (
    creator_id, game, region, platform, mode, team_size, first_to, 
    entry_fee, is_private, status, team_a_id, payment_mode_host,
    expires_at
  ) VALUES (
    v_user_id, 'FN', p_region, p_platform, p_mode, p_team_size, p_first_to,
    p_entry_fee, p_is_private, 'open', p_team_id, p_payment_mode,
    now() + interval '30 minutes'
  )
  RETURNING id INTO v_match_id;
  
  -- Add all team members as participants
  FOR v_member IN 
    SELECT user_id FROM team_members 
    WHERE team_id = p_team_id AND status = 'accepted'
  LOOP
    INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
    VALUES (v_match_id, v_member.user_id, p_team_id, 'A', 'joined');
  END LOOP;
  
  RETURN json_build_object('success', true, 'match_id', v_match_id);
END;
$$;

-- Drop and recreate join_team_match with active match check
DROP FUNCTION IF EXISTS public.join_team_match(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.join_team_match(
  p_match_id uuid,
  p_team_id uuid,
  p_payment_mode text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_match RECORD;
  v_team RECORD;
  v_member RECORD;
  v_total_fee numeric;
  v_fee_per_member numeric;
  v_active_check jsonb;
  v_accepted_count integer;
  v_insufficient_members TEXT[];
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Match not found');
  END IF;
  
  IF v_match.status != 'open' THEN
    RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
  END IF;
  
  IF v_match.team_size = 1 THEN
    RETURN json_build_object('success', false, 'error', 'Per i match 1v1 usa join_match_v2');
  END IF;
  
  -- Get team
  SELECT * INTO v_team FROM teams WHERE id = p_team_id;
  
  IF v_team IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Team not found');
  END IF;
  
  IF v_team.owner_id != v_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Solo il team owner può far entrare il team in un match');
  END IF;
  
  -- Check team has exact required members
  SELECT COUNT(*) INTO v_accepted_count
  FROM team_members
  WHERE team_id = p_team_id AND status = 'accepted';
  
  IF v_accepted_count != v_match.team_size THEN
    RETURN json_build_object('success', false, 'error', 
      'Il team deve avere esattamente ' || v_match.team_size || ' membri accettati');
  END IF;
  
  -- Check if any team member has an active match
  v_active_check := team_has_active_match(p_team_id);
  IF (v_active_check->>'has_active')::boolean THEN
    RETURN json_build_object('success', false, 'error', 
      (v_active_check->>'username') || ' ha già un match attivo. Tutti i membri devono essere liberi.');
  END IF;
  
  -- Cannot join own match
  IF v_match.team_a_id = p_team_id THEN
    RETURN json_build_object('success', false, 'error', 'Non puoi unirti al tuo stesso match');
  END IF;
  
  v_total_fee := v_match.entry_fee * v_match.team_size;
  v_fee_per_member := v_match.entry_fee;
  
  -- Handle payment based on mode
  IF p_payment_mode = 'cover' THEN
    DECLARE
      v_owner_wallet RECORD;
    BEGIN
      SELECT * INTO v_owner_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
      
      IF v_owner_wallet IS NULL OR v_owner_wallet.balance < v_total_fee THEN
        RETURN json_build_object('success', false, 'error', 'Saldo insufficiente per coprire tutti i membri');
      END IF;
      
      UPDATE wallets 
      SET balance = balance - v_total_fee,
          locked_balance = locked_balance + v_total_fee,
          updated_at = now()
      WHERE user_id = v_user_id;
      
      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_user_id, 'lock', v_total_fee, 'Entry fee (cover mode) for joining team match', p_match_id, 'completed');
    END;
  ELSE
    -- Split: check balances first
    v_insufficient_members := ARRAY[]::TEXT[];
    
    FOR v_member IN 
      SELECT tm.user_id, p.username, COALESCE(w.balance, 0) as balance
      FROM team_members tm
      JOIN profiles p ON p.user_id = tm.user_id
      LEFT JOIN wallets w ON w.user_id = tm.user_id
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      IF v_member.balance < v_fee_per_member THEN
        v_insufficient_members := array_append(v_insufficient_members, v_member.username);
      END IF;
    END LOOP;
    
    IF array_length(v_insufficient_members, 1) > 0 THEN
      RETURN json_build_object('success', false, 'error', 
        'Saldo insufficiente per: ' || array_to_string(v_insufficient_members, ', '));
    END IF;
    
    -- Split: each member pays their share
    FOR v_member IN 
      SELECT tm.user_id
      FROM team_members tm
      WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
      UPDATE wallets 
      SET balance = balance - v_fee_per_member,
          locked_balance = locked_balance + v_fee_per_member,
          updated_at = now()
      WHERE user_id = v_member.user_id;
      
      INSERT INTO transactions (user_id, type, amount, description, match_id, status)
      VALUES (v_member.user_id, 'lock', v_fee_per_member, 'Entry fee (split mode) for joining team match', p_match_id, 'completed');
    END LOOP;
  END IF;
  
  -- Add all team members as participants (Team B)
  FOR v_member IN 
    SELECT user_id FROM team_members 
    WHERE team_id = p_team_id AND status = 'accepted'
  LOOP
    INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
    VALUES (p_match_id, v_member.user_id, p_team_id, 'B', 'joined');
  END LOOP;
  
  -- Update match with team B and set to ready_check
  UPDATE matches 
  SET team_b_id = p_team_id,
      payment_mode_joiner = p_payment_mode,
      status = 'ready_check'
  WHERE id = p_match_id;
  
  RETURN json_build_object('success', true, 'message', 'Team joined match successfully');
END;
$$;-- ============================================
-- FIX 1: Create expire_stale_matches function
-- ============================================
CREATE OR REPLACE FUNCTION public.expire_stale_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_participant RECORD;
    v_refund_amount NUMERIC;
BEGIN
    -- Find all open matches that have expired
    FOR v_match IN 
        SELECT m.id, m.creator_id, m.entry_fee, m.team_size, m.payment_mode_host
        FROM matches m
        WHERE m.status = 'open' AND m.expires_at < now()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- Calculate refund amount for creator (based on payment mode)
        IF v_match.payment_mode_host = 'cover' THEN
            v_refund_amount := v_match.entry_fee * v_match.team_size;
        ELSE
            v_refund_amount := v_match.entry_fee;
        END IF;
        
        -- Refund creator's locked balance
        UPDATE wallets 
        SET balance = balance + v_refund_amount,
            locked_balance = locked_balance - v_refund_amount,
            updated_at = now()
        WHERE user_id = v_match.creator_id
          AND id IS NOT NULL;
        
        -- Log refund transaction
        INSERT INTO transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_match.creator_id, 'refund', v_refund_amount, v_match.id, 'Match expired - auto refund', 'completed');
        
        -- Also refund any other participants who may have joined (edge case)
        FOR v_participant IN
            SELECT mp.user_id, mp.team_side
            FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.user_id != v_match.creator_id
        LOOP
            -- Refund participant
            UPDATE wallets 
            SET balance = balance + v_match.entry_fee,
                locked_balance = locked_balance - v_match.entry_fee,
                updated_at = now()
            WHERE user_id = v_participant.user_id
              AND id IS NOT NULL;
            
            INSERT INTO transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 'Match expired - auto refund', 'completed');
        END LOOP;
        
        -- Update match status to expired
        UPDATE matches SET status = 'expired', finished_at = now() WHERE id = v_match.id AND id IS NOT NULL;
    END LOOP;
END;
$$;

-- ============================================
-- FIX 2: Update admin_resolve_match_v2 to fix idempotency check
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_resolve_match_v2(
    p_match_id UUID,
    p_action TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_team_a RECORD;
    v_team_b RECORD;
    v_winner_side TEXT;
    v_winner_user_id UUID;
    v_loser_user_id UUID;
    v_total_pool NUMERIC;
    v_platform_fee NUMERIC;
    v_winner_payout NUMERIC;
    v_existing_admin_payout INT;
    v_participant RECORD;
    v_refund_amount NUMERIC;
BEGIN
    -- Verify admin
    IF NOT is_admin() THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    -- Lock and fetch match
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    -- Check if already resolved by admin (look for admin-specific transactions)
    SELECT COUNT(*) INTO v_existing_admin_payout
    FROM transactions 
    WHERE match_id = p_match_id 
      AND type IN ('payout', 'refund')
      AND description LIKE 'Admin resolved%';
    
    IF v_existing_admin_payout > 0 THEN
        -- Already resolved by admin, just ensure status is correct
        IF v_match.status NOT IN ('admin_resolved', 'completed') THEN
            UPDATE matches 
            SET status = 'admin_resolved', finished_at = COALESCE(finished_at, now()) 
            WHERE id = p_match_id AND id IS NOT NULL;
        END IF;
        RETURN json_build_object('success', true, 'already_resolved', true, 'message', 'Match was already resolved by admin');
    END IF;
    
    -- Allow resolution of disputed OR result_pending matches
    IF v_match.status NOT IN ('disputed', 'result_pending', 'in_progress') THEN
        RETURN json_build_object('success', false, 'error', 'Match cannot be resolved in current status: ' || v_match.status);
    END IF;

    -- Get participants
    SELECT mp.*, p.username INTO v_team_a
    FROM match_participants mp
    JOIN profiles p ON p.user_id = mp.user_id
    WHERE mp.match_id = p_match_id AND mp.team_side = 'A'
    LIMIT 1;
    
    SELECT mp.*, p.username INTO v_team_b
    FROM match_participants mp
    JOIN profiles p ON p.user_id = mp.user_id
    WHERE mp.match_id = p_match_id AND mp.team_side = 'B'
    LIMIT 1;

    IF v_team_a IS NULL OR v_team_b IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Missing participants');
    END IF;

    -- Calculate pool
    v_total_pool := v_match.entry_fee * v_match.team_size * 2;
    v_platform_fee := v_total_pool * 0.05;
    v_winner_payout := v_total_pool - v_platform_fee;

    IF p_action = 'REFUND_BOTH' THEN
        -- Refund all participants
        FOR v_participant IN
            SELECT mp.user_id, mp.team_side
            FROM match_participants mp
            WHERE mp.match_id = p_match_id
        LOOP
            -- Calculate refund based on payment mode
            IF v_participant.team_side = 'A' THEN
                IF v_match.payment_mode_host = 'cover' THEN
                    v_refund_amount := v_match.entry_fee * v_match.team_size;
                ELSE
                    v_refund_amount := v_match.entry_fee;
                END IF;
            ELSE
                IF v_match.payment_mode_joiner = 'cover' THEN
                    v_refund_amount := v_match.entry_fee * v_match.team_size;
                ELSE
                    v_refund_amount := v_match.entry_fee;
                END IF;
            END IF;
            
            -- Unlock and refund
            UPDATE wallets 
            SET balance = balance + v_refund_amount,
                locked_balance = locked_balance - v_refund_amount,
                updated_at = now()
            WHERE user_id = v_participant.user_id
              AND id IS NOT NULL;
            
            INSERT INTO transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_participant.user_id, 'refund', v_refund_amount, p_match_id, 
                    'Admin resolved: Refund - ' || COALESCE(p_notes, 'No notes'), 'completed');
        END LOOP;
        
        -- Update match result
        INSERT INTO match_results (match_id, status, admin_notes, resolved_by)
        VALUES (p_match_id, 'refunded', p_notes, auth.uid())
        ON CONFLICT (match_id) DO UPDATE SET
            status = 'refunded',
            admin_notes = p_notes,
            resolved_by = auth.uid(),
            updated_at = now();
        
        -- Update match status
        UPDATE matches 
        SET status = 'admin_resolved', finished_at = now() 
        WHERE id = p_match_id AND id IS NOT NULL;
        
        RETURN json_build_object('success', true, 'action', 'REFUND_BOTH');
        
    ELSIF p_action IN ('TEAM_A_WIN', 'TEAM_B_WIN') THEN
        -- Determine winner/loser
        IF p_action = 'TEAM_A_WIN' THEN
            v_winner_side := 'A';
            v_winner_user_id := v_team_a.user_id;
            v_loser_user_id := v_team_b.user_id;
        ELSE
            v_winner_side := 'B';
            v_winner_user_id := v_team_b.user_id;
            v_loser_user_id := v_team_a.user_id;
        END IF;
        
        -- Unlock loser's funds (remove from locked, don't add to balance)
        IF v_winner_side = 'A' THEN
            IF v_match.payment_mode_joiner = 'cover' THEN
                v_refund_amount := v_match.entry_fee * v_match.team_size;
            ELSE
                v_refund_amount := v_match.entry_fee;
            END IF;
        ELSE
            IF v_match.payment_mode_host = 'cover' THEN
                v_refund_amount := v_match.entry_fee * v_match.team_size;
            ELSE
                v_refund_amount := v_match.entry_fee;
            END IF;
        END IF;
        
        UPDATE wallets 
        SET locked_balance = locked_balance - v_refund_amount,
            updated_at = now()
        WHERE user_id = v_loser_user_id
          AND id IS NOT NULL;
        
        -- Unlock winner's funds and add payout
        IF v_winner_side = 'A' THEN
            IF v_match.payment_mode_host = 'cover' THEN
                v_refund_amount := v_match.entry_fee * v_match.team_size;
            ELSE
                v_refund_amount := v_match.entry_fee;
            END IF;
        ELSE
            IF v_match.payment_mode_joiner = 'cover' THEN
                v_refund_amount := v_match.entry_fee * v_match.team_size;
            ELSE
                v_refund_amount := v_match.entry_fee;
            END IF;
        END IF;
        
        UPDATE wallets 
        SET balance = balance + v_winner_payout,
            locked_balance = locked_balance - v_refund_amount,
            updated_at = now()
        WHERE user_id = v_winner_user_id
          AND id IS NOT NULL;
        
        -- Record transactions
        INSERT INTO transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_user_id, 'payout', v_winner_payout, p_match_id, 
                'Admin resolved: Winner - ' || COALESCE(p_notes, 'No notes'), 'completed');
        
        -- Record platform fee
        INSERT INTO platform_earnings (match_id, amount)
        VALUES (p_match_id, v_platform_fee);
        
        UPDATE platform_wallet 
        SET balance = balance + v_platform_fee, updated_at = now()
        WHERE id IS NOT NULL;
        
        -- Update match result
        INSERT INTO match_results (match_id, status, winner_user_id, admin_notes, resolved_by)
        VALUES (p_match_id, 'resolved', v_winner_user_id, p_notes, auth.uid())
        ON CONFLICT (match_id) DO UPDATE SET
            status = 'resolved',
            winner_user_id = v_winner_user_id,
            admin_notes = p_notes,
            resolved_by = auth.uid(),
            updated_at = now();
        
        -- Update match status
        UPDATE matches 
        SET status = 'admin_resolved', finished_at = now() 
        WHERE id = p_match_id AND id IS NOT NULL;
        
        RETURN json_build_object('success', true, 'action', p_action, 'winner', v_winner_user_id);
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid action: ' || p_action);
    END IF;
END;
$$;

-- ============================================
-- FIX 3: Update join_match_v2 to check expiration and call lazy cleanup
-- ============================================
DROP FUNCTION IF EXISTS public.join_match_v2(UUID);

CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_entry_fee NUMERIC;
    v_wallet RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Check if user already has an active match
    IF public.has_active_match(v_user_id) THEN
        RETURN json_build_object('success', false, 'error', 'You already have an active match. Complete or cancel it before joining another.');
    END IF;

    -- Lock and fetch match
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;

    -- Check if match is expired
    IF v_match.expires_at < now() THEN
        -- Lazy cleanup: expire this match
        PERFORM public.expire_stale_matches();
        RETURN json_build_object('success', false, 'error', 'This match has expired');
    END IF;

    IF v_match.status != 'open' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
    END IF;

    -- Only allow 1v1 matches through this function
    IF v_match.team_size != 1 THEN
        RETURN json_build_object('success', false, 'error', 'Use join_team_match for team matches');
    END IF;

    IF v_match.creator_id = v_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot join your own match');
    END IF;

    v_entry_fee := v_match.entry_fee;

    -- Check wallet
    SELECT * INTO v_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
    
    IF v_wallet IS NULL OR v_wallet.balance < v_entry_fee THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance');
    END IF;

    -- Lock funds
    UPDATE wallets 
    SET balance = balance - v_entry_fee,
        locked_balance = locked_balance + v_entry_fee,
        updated_at = now()
    WHERE user_id = v_user_id AND id IS NOT NULL;

    -- Record lock transaction
    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
    VALUES (v_user_id, 'lock', v_entry_fee, p_match_id, 'Entry fee locked for match', 'completed');

    -- Add as participant (Team B)
    INSERT INTO match_participants (match_id, user_id, team_side, status)
    VALUES (p_match_id, v_user_id, 'B', 'joined');

    -- Update match status to full (ready for ready-check)
    UPDATE matches 
    SET status = 'full', payment_mode_joiner = 'cover'
    WHERE id = p_match_id AND id IS NOT NULL;

    RETURN json_build_object('success', true, 'status', 'full');
END;
$$;

-- ============================================
-- FIX 4: Update join_team_match to check expiration
-- ============================================
DROP FUNCTION IF EXISTS public.join_team_match(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.join_team_match(
    p_match_id UUID,
    p_team_id UUID,
    p_payment_mode TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_team RECORD;
    v_team_member RECORD;
    v_member RECORD;
    v_entry_fee NUMERIC;
    v_total_fee NUMERIC;
    v_wallet RECORD;
    v_accepted_count INT;
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Check if team already has an active match
    IF public.team_has_active_match(p_team_id) THEN
        RETURN json_build_object('success', false, 'error', 'This team already has an active match. Complete or cancel it before joining another.');
    END IF;

    -- Lock and fetch match
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;

    -- Check if match is expired
    IF v_match.expires_at < now() THEN
        -- Lazy cleanup: expire this match
        PERFORM public.expire_stale_matches();
        RETURN json_build_object('success', false, 'error', 'This match has expired');
    END IF;

    IF v_match.status != 'open' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
    END IF;

    -- Verify team ownership
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    
    IF v_team IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Team not found');
    END IF;

    IF v_team.owner_id != v_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Only team owner can join matches');
    END IF;

    -- Check if it's the same team as Team A
    IF v_match.team_a_id = p_team_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot join your own match');
    END IF;

    -- Verify team size matches
    SELECT COUNT(*) INTO v_accepted_count
    FROM team_members
    WHERE team_id = p_team_id AND status = 'accepted';
    
    IF v_accepted_count != v_match.team_size THEN
        RETURN json_build_object('success', false, 'error', 
            'Team must have exactly ' || v_match.team_size || ' accepted members. You have ' || v_accepted_count);
    END IF;

    v_entry_fee := v_match.entry_fee;

    IF p_payment_mode = 'cover' THEN
        -- Owner covers all
        v_total_fee := v_entry_fee * v_match.team_size;
        
        SELECT * INTO v_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
        
        IF v_wallet IS NULL OR v_wallet.balance < v_total_fee THEN
            RETURN json_build_object('success', false, 'error', 'Insufficient balance to cover team');
        END IF;

        UPDATE wallets 
        SET balance = balance - v_total_fee,
            locked_balance = locked_balance + v_total_fee,
            updated_at = now()
        WHERE user_id = v_user_id AND id IS NOT NULL;

        INSERT INTO transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_user_id, 'lock', v_total_fee, p_match_id, 'Team entry fee locked (covered)', 'completed');

    ELSIF p_payment_mode = 'split' THEN
        -- Each member pays
        FOR v_member IN 
            SELECT tm.user_id 
            FROM team_members tm 
            WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
        LOOP
            SELECT * INTO v_wallet FROM wallets WHERE user_id = v_member.user_id FOR UPDATE;
            
            IF v_wallet IS NULL OR v_wallet.balance < v_entry_fee THEN
                RAISE EXCEPTION 'Team member has insufficient balance';
            END IF;

            UPDATE wallets 
            SET balance = balance - v_entry_fee,
                locked_balance = locked_balance + v_entry_fee,
                updated_at = now()
            WHERE user_id = v_member.user_id AND id IS NOT NULL;

            INSERT INTO transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_member.user_id, 'lock', v_entry_fee, p_match_id, 'Entry fee locked (split)', 'completed');
        END LOOP;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid payment mode');
    END IF;

    -- Add all team members as participants
    FOR v_member IN 
        SELECT tm.user_id 
        FROM team_members tm 
        WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
        INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
        VALUES (p_match_id, v_member.user_id, p_team_id, 'B', 'joined');
    END LOOP;

    -- Update match
    UPDATE matches 
    SET status = 'full', 
        team_b_id = p_team_id,
        payment_mode_joiner = p_payment_mode
    WHERE id = p_match_id AND id IS NOT NULL;

    RETURN json_build_object('success', true, 'status', 'full');

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;-- Create missing helper function: has_active_match
CREATE OR REPLACE FUNCTION public.has_active_match(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM match_participants mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = p_user_id
        AND m.status IN ('open', 'full', 'ready_check', 'in_progress', 'result_pending', 'disputed')
    );
END;
$$;

-- Create missing helper function: team_has_active_match
CREATE OR REPLACE FUNCTION public.team_has_active_match(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member RECORD;
BEGIN
    FOR v_member IN
        SELECT tm.user_id, p.username
        FROM team_members tm
        JOIN profiles p ON p.user_id = tm.user_id
        WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
        IF public.has_active_match(v_member.user_id) THEN
            RETURN jsonb_build_object('has_active', true, 'username', v_member.username);
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object('has_active', false, 'username', null);
END;
$$;

-- Fix match_results status check constraint to allow refunded and admin_resolved statuses
ALTER TABLE public.match_results DROP CONSTRAINT IF EXISTS match_results_status_check;

ALTER TABLE public.match_results ADD CONSTRAINT match_results_status_check 
CHECK (status IN ('pending', 'confirmed', 'disputed', 'resolved', 'refunded', 'admin_resolved'));-- Fix join_team_match to correctly handle JSONB return from team_has_active_match
CREATE OR REPLACE FUNCTION public.join_team_match(
    p_match_id UUID,
    p_team_id UUID,
    p_payment_mode TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_match RECORD;
    v_team RECORD;
    v_team_member RECORD;
    v_member RECORD;
    v_entry_fee NUMERIC;
    v_total_fee NUMERIC;
    v_wallet RECORD;
    v_accepted_count INT;
    v_active_check JSONB;  -- Store JSONB result from team_has_active_match
BEGIN
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;

    -- Check if team already has an active match (FIXED: properly handle JSONB)
    v_active_check := public.team_has_active_match(p_team_id);
    IF (v_active_check->>'has_active')::boolean THEN
        RETURN json_build_object('success', false, 'error', 
            (v_active_check->>'username') || ' already has an active match. Complete or cancel it first.');
    END IF;

    -- Lock and fetch match
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;

    -- Check if match is expired
    IF v_match.expires_at < now() THEN
        PERFORM public.expire_stale_matches();
        RETURN json_build_object('success', false, 'error', 'This match has expired');
    END IF;

    IF v_match.status != 'open' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
    END IF;

    -- Verify team ownership
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    
    IF v_team IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Team not found');
    END IF;

    IF v_team.owner_id != v_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Only team owner can join matches');
    END IF;

    -- Check if it's the same team as Team A
    IF v_match.team_a_id = p_team_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot join your own match');
    END IF;

    -- Verify team size matches
    SELECT COUNT(*) INTO v_accepted_count
    FROM team_members
    WHERE team_id = p_team_id AND status = 'accepted';
    
    IF v_accepted_count != v_match.team_size THEN
        RETURN json_build_object('success', false, 'error', 
            'Team must have exactly ' || v_match.team_size || ' accepted members. You have ' || v_accepted_count);
    END IF;

    v_entry_fee := v_match.entry_fee;

    IF p_payment_mode = 'cover' THEN
        -- Owner covers all
        v_total_fee := v_entry_fee * v_match.team_size;
        
        SELECT * INTO v_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
        
        IF v_wallet IS NULL OR v_wallet.balance < v_total_fee THEN
            RETURN json_build_object('success', false, 'error', 'Insufficient balance to cover team');
        END IF;

        UPDATE wallets 
        SET balance = balance - v_total_fee,
            locked_balance = locked_balance + v_total_fee,
            updated_at = now()
        WHERE user_id = v_user_id AND id IS NOT NULL;

        INSERT INTO transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_user_id, 'lock', v_total_fee, p_match_id, 'Team entry fee locked (covered)', 'completed');

    ELSIF p_payment_mode = 'split' THEN
        -- Each member pays
        FOR v_member IN 
            SELECT tm.user_id 
            FROM team_members tm 
            WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
        LOOP
            SELECT * INTO v_wallet FROM wallets WHERE user_id = v_member.user_id FOR UPDATE;
            
            IF v_wallet IS NULL OR v_wallet.balance < v_entry_fee THEN
                RAISE EXCEPTION 'Team member has insufficient balance';
            END IF;

            UPDATE wallets 
            SET balance = balance - v_entry_fee,
                locked_balance = locked_balance + v_entry_fee,
                updated_at = now()
            WHERE user_id = v_member.user_id AND id IS NOT NULL;

            INSERT INTO transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_member.user_id, 'lock', v_entry_fee, p_match_id, 'Entry fee locked (split)', 'completed');
        END LOOP;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid payment mode');
    END IF;

    -- Update match with Team B
    UPDATE matches 
    SET team_b_id = p_team_id,
        status = 'full',
        payment_mode_joiner = p_payment_mode
    WHERE id = p_match_id;

    -- Add all team members as participants
    FOR v_team_member IN
        SELECT tm.user_id
        FROM team_members tm
        WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
    LOOP
        INSERT INTO match_participants (match_id, user_id, team_id, team_side, status)
        VALUES (p_match_id, v_team_member.user_id, p_team_id, 'B', 'joined');
    END LOOP;

    -- Notify Team A members
    FOR v_member IN
        SELECT tm.user_id
        FROM team_members tm
        WHERE tm.team_id = v_match.team_a_id AND tm.status = 'accepted'
    LOOP
        INSERT INTO notifications (user_id, type, title, message, payload)
        VALUES (v_member.user_id, 'match_joined', 'Opponent Found!',
            'A team has joined your match. Get ready!',
            jsonb_build_object('match_id', p_match_id));
    END LOOP;

    RETURN json_build_object('success', true, 'match_id', p_match_id);
END;
$$;-- Fix has_active_match to exclude expired matches
-- This ensures expired matches (even with status 'open') don't block users from joining new matches

CREATE OR REPLACE FUNCTION public.has_active_match(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM match_participants mp
        JOIN matches m ON m.id = mp.match_id
        WHERE mp.user_id = p_user_id
        AND m.status IN ('open', 'full', 'ready_check', 'in_progress', 'result_pending', 'disputed')
        AND m.expires_at > now()  -- Exclude expired matches
    );
END;
$$;

-- Also fix team_has_active_match to exclude expired matches for consistency
CREATE OR REPLACE FUNCTION public.team_has_active_match(p_team_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_member RECORD;
BEGIN
    -- Check each accepted team member for active matches
    FOR v_member IN 
        SELECT tm.user_id, p.username
        FROM team_members tm
        JOIN profiles p ON p.user_id = tm.user_id
        WHERE tm.team_id = p_team_id
        AND tm.status = 'accepted'
    LOOP
        IF EXISTS (
            SELECT 1 FROM match_participants mp
            JOIN matches m ON m.id = mp.match_id
            WHERE mp.user_id = v_member.user_id
            AND m.status IN ('open', 'full', 'ready_check', 'in_progress', 'result_pending', 'disputed')
            AND m.expires_at > now()  -- Exclude expired matches
        ) THEN
            RETURN jsonb_build_object('has_active', true, 'username', v_member.username);
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object('has_active', false, 'username', NULL);
END;
$$;

-- Cleanup: expire any stale matches that should have been expired
UPDATE matches
SET status = 'expired'
WHERE status = 'open'
AND expires_at < now();-- Fix join_team_match to set status to 'ready_check' instead of 'full'
-- This ensures team matches appear in My Matches immediately after both teams join

CREATE OR REPLACE FUNCTION public.join_team_match(
    p_match_id UUID,
    p_team_id UUID,
    p_payment_mode TEXT DEFAULT 'split'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_team RECORD;
    v_member RECORD;
    v_active_check JSONB;
    v_total_cost NUMERIC;
    v_payer_id UUID;
    v_payer_balance NUMERIC;
    v_member_balance NUMERIC;
    v_accepted_count INT;
BEGIN
    -- Validate payment mode
    IF p_payment_mode NOT IN ('split', 'cover') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid payment mode');
    END IF;

    -- Get match with lock
    SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status != 'open' THEN
        RETURN json_build_object('success', false, 'error', 'Match is not open for joining');
    END IF;
    
    IF v_match.expires_at < now() THEN
        RETURN json_build_object('success', false, 'error', 'Match has expired');
    END IF;

    -- Get team
    SELECT * INTO v_team FROM teams WHERE id = p_team_id;
    
    IF v_team IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Team not found');
    END IF;
    
    -- Verify caller is team owner
    IF v_team.owner_id != auth.uid() THEN
        RETURN json_build_object('success', false, 'error', 'Only team owner can join matches');
    END IF;

    -- Count accepted members
    SELECT COUNT(*) INTO v_accepted_count
    FROM team_members
    WHERE team_id = p_team_id AND status = 'accepted';
    
    IF v_accepted_count != v_match.team_size THEN
        RETURN json_build_object('success', false, 'error', 
            'Team must have exactly ' || v_match.team_size || ' members (has ' || v_accepted_count || ')');
    END IF;

    -- Cannot join own match
    IF v_match.team_a_id = p_team_id THEN
        RETURN json_build_object('success', false, 'error', 'Cannot join your own match');
    END IF;

    -- Check if any team member has an active match
    v_active_check := team_has_active_match(p_team_id);
    IF (v_active_check->>'has_active')::boolean THEN
        RETURN json_build_object('success', false, 'error', 
            'Team member ' || (v_active_check->>'username') || ' is already in an active match');
    END IF;

    -- Calculate total cost
    v_total_cost := v_match.entry_fee * v_match.team_size;

    -- Handle payment based on mode
    IF p_payment_mode = 'cover' THEN
        -- Owner covers all
        v_payer_id := auth.uid();
        
        SELECT balance INTO v_payer_balance FROM wallets WHERE user_id = v_payer_id FOR UPDATE;
        
        IF v_payer_balance IS NULL OR v_payer_balance < v_total_cost THEN
            RETURN json_build_object('success', false, 'error', 'Insufficient balance to cover team entry');
        END IF;
        
        -- Deduct from owner
        UPDATE wallets 
        SET balance = balance - v_total_cost, 
            locked_balance = locked_balance + v_total_cost,
            updated_at = now()
        WHERE user_id = v_payer_id;
        
        -- Log transaction
        INSERT INTO transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_payer_id, 'lock', v_total_cost, p_match_id, 'Team entry fee (covering team)', 'completed');
        
    ELSE
        -- Split mode: each member pays their share
        FOR v_member IN 
            SELECT tm.user_id, p.username
            FROM team_members tm
            JOIN profiles p ON p.user_id = tm.user_id
            WHERE tm.team_id = p_team_id AND tm.status = 'accepted'
        LOOP
            SELECT balance INTO v_member_balance FROM wallets WHERE user_id = v_member.user_id FOR UPDATE;
            
            IF v_member_balance IS NULL OR v_member_balance < v_match.entry_fee THEN
                RETURN json_build_object('success', false, 'error', 
                    'Member ' || v_member.username || ' has insufficient balance');
            END IF;
            
            -- Deduct from each member
            UPDATE wallets 
            SET balance = balance - v_match.entry_fee,
                locked_balance = locked_balance + v_match.entry_fee,
                updated_at = now()
            WHERE user_id = v_member.user_id;
            
            -- Log transaction for each
            INSERT INTO transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_member.user_id, 'lock', v_match.entry_fee, p_match_id, 'Team entry fee (split)', 'completed');
        END LOOP;
    END IF;

    -- Add all team members as participants (Team B)
    FOR v_member IN 
        SELECT user_id FROM team_members 
        WHERE team_id = p_team_id AND status = 'accepted'
    LOOP
        INSERT INTO match_participants (match_id, user_id, team_side, team_id)
        VALUES (p_match_id, v_member.user_id, 'B', p_team_id);
    END LOOP;

    -- Update match: set team_b and change status to ready_check (not full!)
    UPDATE matches 
    SET team_b_id = p_team_id,
        status = 'ready_check',  -- Changed from 'full' to 'ready_check'
        payment_mode_joiner = p_payment_mode
    WHERE id = p_match_id;

    RETURN json_build_object('success', true, 'message', 'Team joined match successfully');
END;
$$;

-- Fix any currently stuck matches that have status 'full'
-- These should be in 'ready_check' so players can ready up
UPDATE matches 
SET status = 'ready_check' 
WHERE status = 'full';-- =========================================================================
-- COMPREHENSIVE FIX: Team Match Result Declaration & Wallet Reconciliation
-- =========================================================================

-- Part 1: Create submit_team_result - Captain-only result declaration
-- Part 2: Fix finalize_team_match with proper COVER/SPLIT payout logic
-- Part 3: Fix expire_stale_matches for team refunds
-- Part 4: Cleanup ghost locks migration
-- Part 5: Add better transaction descriptions

-- =========================================================================
-- PART 1: Captain-only team result submission
-- =========================================================================

CREATE OR REPLACE FUNCTION public.submit_team_result(p_match_id uuid, p_result text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_match RECORD;
    v_participant RECORD;
    v_user_team_side TEXT;
    v_is_captain BOOLEAN := FALSE;
    v_team_id UUID;
    v_other_team_result TEXT;
    v_other_side TEXT;
    v_winner_side TEXT;
    v_loser_side TEXT;
BEGIN
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not authenticated');
    END IF;
    
    IF p_result NOT IN ('WIN', 'LOSS') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid result. Must be WIN or LOSS');
    END IF;
    
    -- Get match with lock
    SELECT * INTO v_match
    FROM public.matches
    WHERE id = p_match_id
    FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    IF v_match.status NOT IN ('in_progress', 'result_pending') THEN
        RETURN json_build_object('success', false, 'error', 'Match is not in progress');
    END IF;
    
    -- Get participant info
    SELECT * INTO v_participant
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id;
    
    IF v_participant IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Not a participant');
    END IF;
    
    v_user_team_side := v_participant.team_side;
    v_team_id := v_participant.team_id;
    
    -- Determine if user is captain (team owner)
    -- For Team A (host side): captain is the match creator
    -- For Team B (joiner side): captain is the team owner
    IF v_user_team_side = 'A' THEN
        v_is_captain := (v_user_id = v_match.creator_id);
    ELSE
        -- Check if user is the team owner
        SELECT (owner_id = v_user_id) INTO v_is_captain
        FROM public.teams
        WHERE id = v_team_id;
    END IF;
    
    -- For 1v1 matches, everyone is their own captain
    IF v_match.team_size = 1 THEN
        v_is_captain := TRUE;
    END IF;
    
    IF NOT v_is_captain THEN
        RETURN json_build_object('success', false, 'error', 'Solo il capitano del team può dichiarare il risultato');
    END IF;
    
    -- Check if team already submitted result
    IF EXISTS (
        SELECT 1 FROM public.match_participants 
        WHERE match_id = p_match_id AND team_side = v_user_team_side AND result_choice IS NOT NULL
    ) THEN
        RETURN json_build_object('success', false, 'error', 'Il tuo team ha già dichiarato il risultato');
    END IF;
    
    -- Update ALL team members' result with captain's choice
    UPDATE public.match_participants
    SET result_choice = p_result, result_at = now()
    WHERE match_id = p_match_id AND team_side = v_user_team_side;
    
    -- Update match status to result_pending
    IF v_match.status = 'in_progress' THEN
        UPDATE public.matches SET status = 'result_pending' WHERE id = p_match_id;
    END IF;
    
    -- Check if other team has submitted
    v_other_side := CASE WHEN v_user_team_side = 'A' THEN 'B' ELSE 'A' END;
    
    SELECT result_choice INTO v_other_team_result
    FROM public.match_participants
    WHERE match_id = p_match_id AND team_side = v_other_side
    LIMIT 1;
    
    IF v_other_team_result IS NULL THEN
        RETURN json_build_object('success', true, 'status', 'waiting_opponent', 
            'message', 'Risultato registrato. In attesa del team avversario.');
    END IF;
    
    -- Both teams have submitted - check for agreement
    IF (p_result = 'WIN' AND v_other_team_result = 'LOSS') OR (p_result = 'LOSS' AND v_other_team_result = 'WIN') THEN
        -- Agreement! Finalize match
        IF p_result = 'WIN' THEN
            v_winner_side := v_user_team_side;
            v_loser_side := v_other_side;
        ELSE
            v_winner_side := v_other_side;
            v_loser_side := v_user_team_side;
        END IF;
        
        -- Call finalize function
        RETURN finalize_team_match(p_match_id, v_winner_side);
    ELSE
        -- Conflict! Open dispute
        UPDATE public.matches SET status = 'disputed' WHERE id = p_match_id;
        
        INSERT INTO public.match_results (match_id, status, dispute_reason)
        VALUES (p_match_id, 'disputed', 'Entrambi i team hanno dichiarato vittoria')
        ON CONFLICT (match_id) DO UPDATE SET 
            status = 'disputed',
            dispute_reason = 'Entrambi i team hanno dichiarato vittoria',
            updated_at = now();
        
        RETURN json_build_object('success', true, 'status', 'disputed',
            'message', 'Conflitto nei risultati. Match inviato agli admin per revisione.');
    END IF;
END;
$function$;

-- =========================================================================
-- PART 2: Team-aware match finalization with COVER/SPLIT logic
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finalize_team_match(p_match_id uuid, p_winner_side text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_match RECORD;
    v_winner_team_id UUID;
    v_loser_team_id UUID;
    v_winner_captain_id UUID;
    v_loser_captain_id UUID;
    v_winner_payment_mode TEXT;
    v_loser_payment_mode TEXT;
    v_entry_fee NUMERIC;
    v_team_size INT;
    v_total_pool NUMERIC;
    v_platform_fee NUMERIC;
    v_prize_pool NUMERIC;
    v_payout_per_member NUMERIC;
    v_participant RECORD;
    v_loser_side TEXT;
BEGIN
    -- Get match info
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    v_entry_fee := v_match.entry_fee;
    v_team_size := v_match.team_size;
    v_loser_side := CASE WHEN p_winner_side = 'A' THEN 'B' ELSE 'A' END;
    
    -- Calculate prize pool: entry_fee * team_size * 2 teams
    v_total_pool := v_entry_fee * v_team_size * 2;
    v_platform_fee := v_total_pool * 0.05;
    v_prize_pool := v_total_pool - v_platform_fee;
    
    -- Determine payment modes and team IDs
    IF p_winner_side = 'A' THEN
        v_winner_team_id := v_match.team_a_id;
        v_loser_team_id := v_match.team_b_id;
        v_winner_payment_mode := COALESCE(v_match.payment_mode_host, 'split');
        v_loser_payment_mode := COALESCE(v_match.payment_mode_joiner, 'split');
    ELSE
        v_winner_team_id := v_match.team_b_id;
        v_loser_team_id := v_match.team_a_id;
        v_winner_payment_mode := COALESCE(v_match.payment_mode_joiner, 'split');
        v_loser_payment_mode := COALESCE(v_match.payment_mode_host, 'split');
    END IF;
    
    -- Get captains
    v_winner_captain_id := (SELECT user_id FROM public.match_participants 
        WHERE match_id = p_match_id AND team_side = p_winner_side 
        ORDER BY joined_at ASC LIMIT 1);
    v_loser_captain_id := (SELECT user_id FROM public.match_participants 
        WHERE match_id = p_match_id AND team_side = v_loser_side 
        ORDER BY joined_at ASC LIMIT 1);
    
    -- ========================================
    -- PROCESS LOSER SIDE (unlock locked funds)
    -- ========================================
    IF v_loser_payment_mode = 'cover' THEN
        -- COVER: Captain paid all, remove all locked from captain
        UPDATE public.wallets
        SET locked_balance = locked_balance - (v_entry_fee * v_team_size),
            updated_at = now()
        WHERE user_id = v_loser_captain_id AND id IS NOT NULL;
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_loser_captain_id, 'fee', v_entry_fee * v_team_size, p_match_id, 
            'Match perso (Cover All - ' || v_team_size || ' giocatori)', 'completed');
    ELSE
        -- SPLIT: Each member paid individually, remove individual locks
        FOR v_participant IN 
            SELECT user_id FROM public.match_participants 
            WHERE match_id = p_match_id AND team_side = v_loser_side
        LOOP
            UPDATE public.wallets
            SET locked_balance = locked_balance - v_entry_fee,
                updated_at = now()
            WHERE user_id = v_participant.user_id AND id IS NOT NULL;
            
            INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_participant.user_id, 'fee', v_entry_fee, p_match_id, 
                'Match perso (Split Pay)', 'completed');
        END LOOP;
    END IF;
    
    -- ========================================
    -- PROCESS WINNER SIDE (payout winnings)
    -- ========================================
    IF v_winner_payment_mode = 'cover' THEN
        -- COVER: Captain paid all, captain receives all winnings
        -- Remove locked and add prize
        UPDATE public.wallets
        SET balance = balance + v_prize_pool,
            locked_balance = locked_balance - (v_entry_fee * v_team_size),
            updated_at = now()
        WHERE user_id = v_winner_captain_id AND id IS NOT NULL;
        
        INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
        VALUES (v_winner_captain_id, 'payout', v_prize_pool, p_match_id, 
            'Vittoria match (Cover All - Pool: ' || v_total_pool || ' Coins)', 'completed');
    ELSE
        -- SPLIT: Each member paid individually, distribute prize equally
        v_payout_per_member := v_prize_pool / v_team_size;
        
        FOR v_participant IN 
            SELECT user_id FROM public.match_participants 
            WHERE match_id = p_match_id AND team_side = p_winner_side
        LOOP
            UPDATE public.wallets
            SET balance = balance + v_payout_per_member,
                locked_balance = locked_balance - v_entry_fee,
                updated_at = now()
            WHERE user_id = v_participant.user_id AND id IS NOT NULL;
            
            INSERT INTO public.transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_participant.user_id, 'payout', v_payout_per_member, p_match_id, 
                'Vittoria match (Split Pay - quota personale)', 'completed');
        END LOOP;
    END IF;
    
    -- Record platform fee
    INSERT INTO public.platform_earnings (match_id, amount) VALUES (p_match_id, v_platform_fee);
    UPDATE public.platform_wallet SET balance = balance + v_platform_fee, updated_at = now()
    WHERE id IS NOT NULL;
    
    -- Update match status
    UPDATE public.matches 
    SET status = 'completed', finished_at = now() 
    WHERE id = p_match_id;
    
    -- Create/update match result
    INSERT INTO public.match_results (match_id, winner_user_id, winner_team_id, status)
    VALUES (p_match_id, v_winner_captain_id, v_winner_team_id, 'confirmed')
    ON CONFLICT (match_id) DO UPDATE SET 
        winner_user_id = v_winner_captain_id,
        winner_team_id = v_winner_team_id,
        status = 'confirmed',
        updated_at = now();
    
    RETURN json_build_object('success', true, 'status', 'completed', 
        'winner_side', p_winner_side,
        'winner_captain_id', v_winner_captain_id,
        'prize_pool', v_prize_pool);
END;
$function$;

-- =========================================================================
-- PART 3: Fix expire_stale_matches for team refunds (COVER/SPLIT)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.expire_stale_matches()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match RECORD;
    v_participant RECORD;
    v_refund_amount NUMERIC;
    v_captain_id UUID;
    v_payment_mode TEXT;
BEGIN
    -- Find all matches that should expire
    FOR v_match IN 
        SELECT m.id, m.creator_id, m.entry_fee, m.team_size, 
               m.payment_mode_host, m.payment_mode_joiner,
               m.team_a_id, m.team_b_id, m.status
        FROM matches m
        WHERE m.status IN ('open', 'ready_check') AND m.expires_at < now()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- ========================================
        -- Refund Team A (Host side)
        -- ========================================
        v_payment_mode := COALESCE(v_match.payment_mode_host, 'split');
        
        IF v_payment_mode = 'cover' THEN
            -- COVER: Only creator locked funds (entry_fee * team_size)
            v_refund_amount := v_match.entry_fee * v_match.team_size;
            
            UPDATE wallets 
            SET balance = balance + v_refund_amount,
                locked_balance = locked_balance - v_refund_amount,
                updated_at = now()
            WHERE user_id = v_match.creator_id AND id IS NOT NULL;
            
            INSERT INTO transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_match.creator_id, 'refund', v_refund_amount, v_match.id, 
                'Match scaduto - Rimborso (Cover All)', 'completed');
        ELSE
            -- SPLIT: Each Team A member locked individual entry
            FOR v_participant IN
                SELECT mp.user_id FROM match_participants mp
                WHERE mp.match_id = v_match.id AND mp.team_side = 'A'
            LOOP
                UPDATE wallets 
                SET balance = balance + v_match.entry_fee,
                    locked_balance = locked_balance - v_match.entry_fee,
                    updated_at = now()
                WHERE user_id = v_participant.user_id AND id IS NOT NULL;
                
                INSERT INTO transactions (user_id, type, amount, match_id, description, status)
                VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                    'Match scaduto - Rimborso (Split Pay)', 'completed');
            END LOOP;
        END IF;
        
        -- ========================================
        -- Refund Team B (Joiner side) if exists
        -- ========================================
        IF v_match.team_b_id IS NOT NULL OR EXISTS (
            SELECT 1 FROM match_participants WHERE match_id = v_match.id AND team_side = 'B'
        ) THEN
            v_payment_mode := COALESCE(v_match.payment_mode_joiner, 'split');
            
            -- Find Team B captain (first joiner)
            SELECT mp.user_id INTO v_captain_id
            FROM match_participants mp
            WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
            ORDER BY mp.joined_at ASC
            LIMIT 1;
            
            IF v_captain_id IS NOT NULL THEN
                IF v_payment_mode = 'cover' THEN
                    -- COVER: Captain locked all
                    v_refund_amount := v_match.entry_fee * v_match.team_size;
                    
                    UPDATE wallets 
                    SET balance = balance + v_refund_amount,
                        locked_balance = locked_balance - v_refund_amount,
                        updated_at = now()
                    WHERE user_id = v_captain_id AND id IS NOT NULL;
                    
                    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
                    VALUES (v_captain_id, 'refund', v_refund_amount, v_match.id, 
                        'Match scaduto - Rimborso (Cover All)', 'completed');
                ELSE
                    -- SPLIT: Each Team B member
                    FOR v_participant IN
                        SELECT mp.user_id FROM match_participants mp
                        WHERE mp.match_id = v_match.id AND mp.team_side = 'B'
                    LOOP
                        UPDATE wallets 
                        SET balance = balance + v_match.entry_fee,
                            locked_balance = locked_balance - v_match.entry_fee,
                            updated_at = now()
                        WHERE user_id = v_participant.user_id AND id IS NOT NULL;
                        
                        INSERT INTO transactions (user_id, type, amount, match_id, description, status)
                        VALUES (v_participant.user_id, 'refund', v_match.entry_fee, v_match.id, 
                            'Match scaduto - Rimborso (Split Pay)', 'completed');
                    END LOOP;
                END IF;
            END IF;
        END IF;
        
        -- Update match status to expired
        UPDATE matches SET status = 'expired', finished_at = now() WHERE id = v_match.id AND id IS NOT NULL;
    END LOOP;
END;
$$;

-- =========================================================================
-- PART 4: One-time cleanup of ghost locks
-- =========================================================================

-- Find and refund users with locked_balance > 0 but no active matches
DO $$
DECLARE
    v_wallet RECORD;
    v_active_lock NUMERIC;
BEGIN
    FOR v_wallet IN
        SELECT w.id, w.user_id, w.locked_balance
        FROM wallets w
        WHERE w.locked_balance > 0
    LOOP
        -- Calculate what should actually be locked
        SELECT COALESCE(SUM(
            CASE 
                WHEN m.payment_mode_host = 'cover' AND mp.team_side = 'A' AND mp.user_id = m.creator_id 
                    THEN m.entry_fee * m.team_size
                WHEN m.payment_mode_joiner = 'cover' AND mp.team_side = 'B' AND mp.user_id = (
                    SELECT user_id FROM match_participants 
                    WHERE match_id = m.id AND team_side = 'B' 
                    ORDER BY joined_at LIMIT 1
                ) THEN m.entry_fee * m.team_size
                WHEN COALESCE(m.payment_mode_host, 'split') = 'split' AND mp.team_side = 'A'
                    THEN m.entry_fee
                WHEN COALESCE(m.payment_mode_joiner, 'split') = 'split' AND mp.team_side = 'B'
                    THEN m.entry_fee
                ELSE 0
            END
        ), 0) INTO v_active_lock
        FROM match_participants mp
        JOIN matches m ON mp.match_id = m.id
        WHERE mp.user_id = v_wallet.user_id
          AND m.status IN ('open', 'ready_check', 'in_progress', 'result_pending');
        
        -- If there's a discrepancy, fix it
        IF v_wallet.locked_balance > v_active_lock THEN
            -- Move excess locked to available
            UPDATE wallets
            SET balance = balance + (v_wallet.locked_balance - v_active_lock),
                locked_balance = v_active_lock,
                updated_at = now()
            WHERE id = v_wallet.id;
            
            -- Log the reconciliation if significant
            IF (v_wallet.locked_balance - v_active_lock) >= 0.01 THEN
                INSERT INTO transactions (user_id, type, amount, description, status)
                VALUES (v_wallet.user_id, 'refund', v_wallet.locked_balance - v_active_lock, 
                    'Riconciliazione wallet - sblocco fondi orfani', 'completed');
            END IF;
        END IF;
    END LOOP;
END $$;

-- =========================================================================
-- PART 5: Update admin_resolve_match_v2 with team-aware logic
-- =========================================================================

CREATE OR REPLACE FUNCTION public.admin_resolve_match_v2(p_match_id uuid, p_action text, p_notes text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_is_admin BOOLEAN;
    v_match RECORD;
    v_participant RECORD;
    v_entry_fee NUMERIC;
    v_team_size INT;
    v_refund_amount NUMERIC;
    v_payment_mode TEXT;
    v_captain_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    SELECT public.is_admin() INTO v_is_admin;
    IF NOT v_is_admin THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    IF p_action NOT IN ('refund', 'team_a_wins', 'team_b_wins') THEN
        RETURN json_build_object('success', false, 'error', 'Invalid action. Use: refund, team_a_wins, team_b_wins');
    END IF;
    
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Match not found');
    END IF;
    
    v_entry_fee := v_match.entry_fee;
    v_team_size := v_match.team_size;
    
    IF p_action = 'refund' THEN
        -- Refund all participants based on payment mode
        
        -- Team A refund
        v_payment_mode := COALESCE(v_match.payment_mode_host, 'split');
        IF v_payment_mode = 'cover' THEN
            v_refund_amount := v_entry_fee * v_team_size;
            UPDATE wallets SET balance = balance + v_refund_amount, locked_balance = locked_balance - v_refund_amount, updated_at = now()
            WHERE user_id = v_match.creator_id AND id IS NOT NULL;
            INSERT INTO transactions (user_id, type, amount, match_id, description, status)
            VALUES (v_match.creator_id, 'refund', v_refund_amount, p_match_id, 'Admin refund - ' || COALESCE(p_notes, 'Dispute resolved'), 'completed');
        ELSE
            FOR v_participant IN SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = 'A' LOOP
                UPDATE wallets SET balance = balance + v_entry_fee, locked_balance = locked_balance - v_entry_fee, updated_at = now()
                WHERE user_id = v_participant.user_id AND id IS NOT NULL;
                INSERT INTO transactions (user_id, type, amount, match_id, description, status)
                VALUES (v_participant.user_id, 'refund', v_entry_fee, p_match_id, 'Admin refund - ' || COALESCE(p_notes, 'Dispute resolved'), 'completed');
            END LOOP;
        END IF;
        
        -- Team B refund
        v_payment_mode := COALESCE(v_match.payment_mode_joiner, 'split');
        SELECT user_id INTO v_captain_id FROM match_participants WHERE match_id = p_match_id AND team_side = 'B' ORDER BY joined_at LIMIT 1;
        IF v_captain_id IS NOT NULL THEN
            IF v_payment_mode = 'cover' THEN
                v_refund_amount := v_entry_fee * v_team_size;
                UPDATE wallets SET balance = balance + v_refund_amount, locked_balance = locked_balance - v_refund_amount, updated_at = now()
                WHERE user_id = v_captain_id AND id IS NOT NULL;
                INSERT INTO transactions (user_id, type, amount, match_id, description, status)
                VALUES (v_captain_id, 'refund', v_refund_amount, p_match_id, 'Admin refund - ' || COALESCE(p_notes, 'Dispute resolved'), 'completed');
            ELSE
                FOR v_participant IN SELECT user_id FROM match_participants WHERE match_id = p_match_id AND team_side = 'B' LOOP
                    UPDATE wallets SET balance = balance + v_entry_fee, locked_balance = locked_balance - v_entry_fee, updated_at = now()
                    WHERE user_id = v_participant.user_id AND id IS NOT NULL;
                    INSERT INTO transactions (user_id, type, amount, match_id, description, status)
                    VALUES (v_participant.user_id, 'refund', v_entry_fee, p_match_id, 'Admin refund - ' || COALESCE(p_notes, 'Dispute resolved'), 'completed');
                END LOOP;
            END IF;
        END IF;
        
        UPDATE matches SET status = 'admin_resolved', finished_at = now() WHERE id = p_match_id;
        UPDATE match_results SET status = 'resolved', admin_notes = p_notes, resolved_by = v_user_id, updated_at = now() WHERE match_id = p_match_id;
        
        RETURN json_build_object('success', true, 'status', 'refunded', 'message', 'All participants refunded');
        
    ELSIF p_action IN ('team_a_wins', 'team_b_wins') THEN
        -- Use finalize_team_match for proper payout
        DECLARE
            v_winner_side TEXT := CASE WHEN p_action = 'team_a_wins' THEN 'A' ELSE 'B' END;
            v_result json;
        BEGIN
            v_result := finalize_team_match(p_match_id, v_winner_side);
            
            -- Update to admin_resolved instead of completed
            UPDATE matches SET status = 'admin_resolved' WHERE id = p_match_id;
            UPDATE match_results SET admin_notes = p_notes, resolved_by = v_user_id WHERE match_id = p_match_id;
            
            RETURN json_build_object('success', true, 'status', 'resolved', 
                'winner_side', v_winner_side, 'message', 'Match resolved by admin');
        END;
    END IF;
    
    RETURN json_build_object('success', false, 'error', 'Unknown action');
END;
$function$;-- Create admin_action_logs table for audit trail
CREATE TABLE public.admin_action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action_type TEXT NOT NULL, -- 'resolve_dispute', 'ban_user', 'adjust_balance', 'fix_locks', etc.
  target_type TEXT NOT NULL, -- 'match', 'user', 'withdrawal', 'system'
  target_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_action_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view logs
CREATE POLICY "Admins can view action logs"
  ON public.admin_action_logs
  FOR SELECT
  USING (is_admin());

-- Only admins can insert logs (via RPCs)
CREATE POLICY "Admins can insert action logs"
  ON public.admin_action_logs
  FOR INSERT
  WITH CHECK (is_admin());

-- Create RPC to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action_type TEXT,
  p_target_type TEXT,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO admin_action_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), p_action_type, p_target_type, p_target_id, p_details)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Create RPC to get admin issue stats (disputes, ghost locks, stuck matches)
CREATE OR REPLACE FUNCTION public.get_admin_issue_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_disputed INT;
  v_expired_with_locks INT;
  v_stuck_ready INT;
  v_inconsistent INT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Count disputed matches
  SELECT COUNT(*) INTO v_disputed FROM matches WHERE status = 'disputed';

  -- Count expired matches where users still have locked balance related to those matches
  SELECT COUNT(DISTINCT m.id) INTO v_expired_with_locks
  FROM matches m
  JOIN match_participants mp ON mp.match_id = m.id
  JOIN wallets w ON w.user_id = mp.user_id
  WHERE m.status = 'expired' AND w.locked_balance > 0;

  -- Count matches in ready_check for more than 10 minutes
  SELECT COUNT(*) INTO v_stuck_ready
  FROM matches
  WHERE status = 'ready_check' 
    AND started_at IS NULL 
    AND created_at < NOW() - INTERVAL '10 minutes';

  -- Count matches with inconsistent results (both WIN or both LOSS)
  SELECT COUNT(DISTINCT m.id) INTO v_inconsistent
  FROM matches m
  JOIN match_participants mp_a ON mp_a.match_id = m.id AND mp_a.team_side = 'A'
  JOIN match_participants mp_b ON mp_b.match_id = m.id AND mp_b.team_side = 'B'
  WHERE m.status IN ('finished', 'disputed')
    AND mp_a.result_choice IS NOT NULL
    AND mp_b.result_choice IS NOT NULL
    AND mp_a.result_choice = mp_b.result_choice;

  v_result := jsonb_build_object(
    'disputed', v_disputed,
    'expired_with_locks', v_expired_with_locks,
    'stuck_ready_check', v_stuck_ready,
    'inconsistent_results', v_inconsistent,
    'total', v_disputed + v_expired_with_locks + v_stuck_ready + v_inconsistent
  );

  RETURN v_result;
END;
$$;

-- Create RPC to search across users, matches, transactions
CREATE OR REPLACE FUNCTION public.admin_global_search(p_query TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_users JSONB;
  v_matches JSONB;
  v_transactions JSONB;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Search users by username, email, or id
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'user_id', user_id,
    'username', username,
    'email', email,
    'avatar_url', avatar_url,
    'is_banned', is_banned
  )), '[]'::jsonb) INTO v_users
  FROM profiles
  WHERE 
    username ILIKE '%' || p_query || '%'
    OR email ILIKE '%' || p_query || '%'
    OR id::text ILIKE '%' || p_query || '%'
    OR user_id::text ILIKE '%' || p_query || '%'
  LIMIT 5;

  -- Search matches by id, creator username, status
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'mode', m.mode,
    'region', m.region,
    'status', m.status,
    'entry_fee', m.entry_fee,
    'team_size', m.team_size,
    'creator_username', p.username,
    'created_at', m.created_at
  )), '[]'::jsonb) INTO v_matches
  FROM matches m
  LEFT JOIN profiles p ON p.user_id = m.creator_id
  WHERE 
    m.id::text ILIKE '%' || p_query || '%'
    OR m.status ILIKE '%' || p_query || '%'
    OR p.username ILIKE '%' || p_query || '%'
  LIMIT 5;

  -- Search transactions by id, match_id, description
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'type', t.type,
    'amount', t.amount,
    'description', t.description,
    'match_id', t.match_id,
    'user_id', t.user_id,
    'created_at', t.created_at
  )), '[]'::jsonb) INTO v_transactions
  FROM transactions t
  WHERE 
    t.id::text ILIKE '%' || p_query || '%'
    OR t.match_id::text ILIKE '%' || p_query || '%'
    OR t.description ILIKE '%' || p_query || '%'
  LIMIT 5;

  v_result := jsonb_build_object(
    'users', v_users,
    'matches', v_matches,
    'transactions', v_transactions
  );

  RETURN v_result;
END;
$$;

-- Create RPC to adjust user balance (admin only)
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance NUMERIC;
  v_new_balance NUMERIC;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Get current balance
  SELECT balance INTO v_current_balance FROM wallets WHERE user_id = p_user_id;
  
  IF v_current_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User wallet not found');
  END IF;

  v_new_balance := v_current_balance + p_amount;

  IF v_new_balance < 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Resulting balance would be negative');
  END IF;

  -- Update balance
  UPDATE wallets SET balance = v_new_balance, updated_at = NOW() WHERE user_id = p_user_id;

  -- Create transaction record
  INSERT INTO transactions (user_id, type, amount, description, status)
  VALUES (p_user_id, CASE WHEN p_amount >= 0 THEN 'deposit' ELSE 'fee' END, ABS(p_amount), 'Admin: ' || p_reason, 'completed');

  -- Log action
  PERFORM log_admin_action('adjust_balance', 'user', p_user_id, jsonb_build_object('amount', p_amount, 'reason', p_reason, 'old_balance', v_current_balance, 'new_balance', v_new_balance));

  RETURN jsonb_build_object('success', true, 'old_balance', v_current_balance, 'new_balance', v_new_balance);
END;
$$;-- Drop existing function first
DROP FUNCTION IF EXISTS public.join_match_v2(uuid);

-- Recreate with fix: 'ready_check' instead of 'full'
CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match record;
  v_user_balance numeric;
  v_entry_fee numeric;
BEGIN
  -- Get match details with lock
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;
  
  IF v_match.status != 'open' THEN
    RAISE EXCEPTION 'Match is not open for joining';
  END IF;
  
  IF v_match.team_size != 1 THEN
    RAISE EXCEPTION 'This function is for 1v1 matches only. Use join_team_match for team matches.';
  END IF;
  
  IF v_match.creator_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot join your own match';
  END IF;
  
  IF v_match.expires_at < now() THEN
    RAISE EXCEPTION 'Match has expired';
  END IF;
  
  -- Check if user already in this match
  IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = p_match_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Already in this match';
  END IF;
  
  -- Check if user has an active match
  IF has_active_match(v_user_id) THEN
    RAISE EXCEPTION 'You already have an active match';
  END IF;
  
  v_entry_fee := v_match.entry_fee;
  
  -- Get user balance
  SELECT balance INTO v_user_balance FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  
  IF v_user_balance IS NULL OR v_user_balance < v_entry_fee THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct from wallet and lock
  UPDATE wallets 
  SET balance = balance - v_entry_fee,
      locked_balance = locked_balance + v_entry_fee
  WHERE user_id = v_user_id;
  
  -- Record lock transaction
  INSERT INTO transactions (user_id, type, amount, description, match_id)
  VALUES (v_user_id, 'lock', v_entry_fee, 'Entry fee locked for match', p_match_id);
  
  -- Add as participant
  INSERT INTO match_participants (match_id, user_id, team_side, is_ready, payment_mode, amount_paid)
  VALUES (p_match_id, v_user_id, 'B', false, 'cover', v_entry_fee);
  
  -- Update match status to ready_check (FIX: was 'full')
  UPDATE matches 
  SET status = 'ready_check', payment_mode_joiner = 'cover'
  WHERE id = p_match_id;
END;
$$;

-- Fix match 1v1 attualmente bloccati in 'full'
UPDATE matches 
SET status = 'ready_check' 
WHERE status = 'full' 
  AND team_size = 1 
  AND (SELECT COUNT(*) FROM match_participants WHERE match_id = matches.id) = 2;-- Fix: Remove overly permissive INSERT policy on notifications table
-- Notifications should ONLY be created through SECURITY DEFINER functions
-- which properly validate context before inserting (e.g., send_team_invite, respond_to_invite, etc.)

-- Drop the permissive INSERT policy that allows any user to insert notifications for anyone
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- No new INSERT policy is needed because:
-- 1. SECURITY DEFINER functions bypass RLS and can still insert notifications
-- 2. Direct client inserts should NOT be allowed to prevent spam/phishing attacks
-- 3. Existing functions like send_team_invite, respond_to_invite, etc. handle notification creation securely-- Add PayPal support columns to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'stripe';

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;

-- Add index for PayPal order lookup (idempotency)
CREATE INDEX IF NOT EXISTS idx_transactions_paypal_order_id ON public.transactions(paypal_order_id) WHERE paypal_order_id IS NOT NULL;-- Drop existing admin_global_search function first (needed due to return type change)
DROP FUNCTION IF EXISTS public.admin_global_search(TEXT);

-- Update admin_global_search to use escaped patterns
CREATE OR REPLACE FUNCTION public.admin_global_search(p_query TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSON;
  v_escaped_query TEXT;
BEGIN
  -- Check admin permission
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  
  -- Validate input length
  IF LENGTH(p_query) < 2 THEN
    RETURN json_build_object('users', '[]'::json, 'matches', '[]'::json, 'transactions', '[]'::json);
  END IF;
  
  IF LENGTH(p_query) > 100 THEN
    RAISE EXCEPTION 'Search term too long';
  END IF;
  
  -- Escape LIKE wildcards to prevent pattern injection
  v_escaped_query := escape_like_pattern(p_query);
  
  SELECT json_build_object(
    'users', (
      SELECT COALESCE(json_agg(row_to_json(u)), '[]'::json)
      FROM (
        SELECT 
          id,
          user_id,
          username,
          email,
          avatar_url,
          is_banned
        FROM profiles
        WHERE 
          username ILIKE '%' || v_escaped_query || '%'
          OR email ILIKE '%' || v_escaped_query || '%'
        LIMIT 5
      ) u
    ),
    'matches', (
      SELECT COALESCE(json_agg(row_to_json(m)), '[]'::json)
      FROM (
        SELECT 
          m.id,
          m.mode,
          m.region,
          m.status,
          m.entry_fee,
          m.team_size,
          p.username as creator_username,
          m.created_at
        FROM matches m
        LEFT JOIN profiles p ON m.creator_id = p.user_id
        WHERE 
          m.id::text ILIKE '%' || v_escaped_query || '%'
          OR m.mode ILIKE '%' || v_escaped_query || '%'
          OR p.username ILIKE '%' || v_escaped_query || '%'
        ORDER BY m.created_at DESC
        LIMIT 5
      ) m
    ),
    'transactions', (
      SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
      FROM (
        SELECT 
          t.id,
          t.type,
          t.amount,
          t.description,
          t.match_id,
          t.user_id,
          t.created_at
        FROM transactions t
        WHERE 
          t.id::text ILIKE '%' || v_escaped_query || '%'
          OR t.type ILIKE '%' || v_escaped_query || '%'
          OR t.description ILIKE '%' || v_escaped_query || '%'
        ORDER BY t.created_at DESC
        LIMIT 5
      ) t
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;-- Create highlights table for YouTube video montages
CREATE TABLE public.highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  youtube_url TEXT NOT NULL,
  youtube_video_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_highlights_user FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;

-- Policies: everyone can view, users can manage their own, admins can delete any
CREATE POLICY "Anyone can view highlights"
  ON public.highlights FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own highlights"
  ON public.highlights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own highlights"
  ON public.highlights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights or admin can delete any"
  ON public.highlights FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- Create updated_at trigger
CREATE TRIGGER update_highlights_updated_at
  BEFORE UPDATE ON public.highlights
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create match_proofs table for screenshot evidence
CREATE TABLE public.match_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_match_proofs_user FOREIGN KEY (user_id) REFERENCES profiles(user_id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.match_proofs ENABLE ROW LEVEL SECURITY;

-- Policy: only match participants and admins can view/insert proofs
CREATE POLICY "Match participants and admins can view proofs"
  ON public.match_proofs FOR SELECT
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM match_participants mp
      WHERE mp.match_id = match_proofs.match_id
      AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Match participants can insert proofs"
  ON public.match_proofs FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM match_participants mp
      WHERE mp.match_id = match_proofs.match_id
      AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own proofs or admin can delete any"
  ON public.match_proofs FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- Create storage bucket for proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for proofs bucket
CREATE POLICY "Match participants can view proof files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'proofs' AND
    (
      public.is_admin() OR
      EXISTS (
        SELECT 1 FROM match_participants mp
        WHERE mp.match_id = (storage.foldername(name))[1]::uuid
        AND mp.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Match participants can upload proof files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'proofs' AND
    EXISTS (
      SELECT 1 FROM match_participants mp
      WHERE mp.match_id = (storage.foldername(name))[1]::uuid
      AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own proof files or admin can delete any"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'proofs' AND
    (
      public.is_admin() OR
      auth.uid()::text = (storage.foldername(name))[2]
    )
  );

-- Enable realtime for highlights
ALTER PUBLICATION supabase_realtime ADD TABLE public.highlights;
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_proofs;-- Fix join_match_v2 function to use correct column names
CREATE OR REPLACE FUNCTION public.join_match_v2(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match record;
  v_user_balance numeric;
  v_entry_fee numeric;
BEGIN
  -- Get match details with lock
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  
  IF v_match IS NULL THEN
    RAISE EXCEPTION 'Match not found';
  END IF;
  
  IF v_match.status != 'open' THEN
    RAISE EXCEPTION 'Match is not open for joining';
  END IF;
  
  IF v_match.team_size != 1 THEN
    RAISE EXCEPTION 'Use join_team_match for team matches';
  END IF;
  
  IF v_match.creator_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot join your own match';
  END IF;
  
  IF v_match.expires_at < now() THEN
    RAISE EXCEPTION 'Match has expired';
  END IF;
  
  -- Check if already in match
  IF EXISTS (SELECT 1 FROM match_participants WHERE match_id = p_match_id AND user_id = v_user_id) THEN
    RAISE EXCEPTION 'Already in this match';
  END IF;
  
  -- Check active match
  IF has_active_match(v_user_id) THEN
    RAISE EXCEPTION 'You already have an active match';
  END IF;
  
  v_entry_fee := v_match.entry_fee;
  
  -- Get user balance
  SELECT balance INTO v_user_balance FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  
  IF v_user_balance IS NULL OR v_user_balance < v_entry_fee THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Lock funds
  UPDATE wallets 
  SET balance = balance - v_entry_fee,
      locked_balance = locked_balance + v_entry_fee
  WHERE user_id = v_user_id;
  
  -- Record transaction
  INSERT INTO transactions (user_id, type, amount, description, match_id)
  VALUES (v_user_id, 'lock', v_entry_fee, 'Entry fee locked for match', p_match_id);
  
  -- Add as participant with correct column names (ready instead of is_ready, no payment_mode/amount_paid)
  INSERT INTO match_participants (match_id, user_id, team_side, ready)
  VALUES (p_match_id, v_user_id, 'B', false);
  
  -- Update match status to ready_check
  UPDATE matches 
  SET status = 'ready_check', payment_mode_joiner = 'cover'
  WHERE id = p_match_id;
END;
$$;-- Create match_chat_messages table for live match chat
CREATE TABLE public.match_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT message_length CHECK (LENGTH(message) <= 500)
);

-- Create index for faster queries
CREATE INDEX idx_match_chat_messages_match_id ON public.match_chat_messages(match_id);
CREATE INDEX idx_match_chat_messages_created_at ON public.match_chat_messages(created_at);

-- Enable RLS
ALTER TABLE public.match_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Participants and admins can view match chat messages
CREATE POLICY "Participants and admins can view match chat"
ON public.match_chat_messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM match_participants WHERE match_id = match_chat_messages.match_id AND user_id = auth.uid()
  )
  OR is_admin()
);

-- Policy: Participants and admins can send messages (only when match is active)
CREATE POLICY "Participants and admins can send match chat"
ON public.match_chat_messages FOR INSERT WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM match_participants WHERE match_id = match_chat_messages.match_id AND user_id = auth.uid()
    )
    OR is_admin()
  )
  AND EXISTS (
    SELECT 1 FROM matches WHERE id = match_chat_messages.match_id 
    AND status IN ('ready_check', 'in_progress', 'result_pending', 'disputed', 'full')
  )
);

-- Enable realtime for match chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_chat_messages;-- Make the proofs bucket public so getPublicUrl() works
UPDATE storage.buckets 
SET public = true 
WHERE id = 'proofs';-- ============================================
-- FASE 1: VIP Subscription + Tips System
-- ============================================

-- Table: VIP subscriptions
CREATE TABLE public.vip_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vip_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vip_subscriptions
CREATE POLICY "Users can view own VIP status"
  ON public.vip_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all VIP"
  ON public.vip_subscriptions FOR SELECT
  USING (is_admin());

-- Table: Tips (coin transfers between users)
CREATE TABLE public.tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0 AND amount <= 50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT no_self_tip CHECK (from_user_id != to_user_id)
);

-- Enable RLS
ALTER TABLE public.tips ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tips
CREATE POLICY "Users can view tips they sent or received"
  ON public.tips FOR SELECT
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Admins can view all tips"
  ON public.tips FOR SELECT
  USING (is_admin());

-- ============================================
-- Function: Check VIP Status
-- ============================================
CREATE OR REPLACE FUNCTION public.check_vip_status(p_user_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_user UUID;
  v_subscription RECORD;
  v_days_remaining INT;
BEGIN
  v_target_user := COALESCE(p_user_id, auth.uid());
  
  SELECT * INTO v_subscription
  FROM vip_subscriptions
  WHERE user_id = v_target_user
    AND expires_at > now();
  
  IF v_subscription IS NULL THEN
    RETURN jsonb_build_object(
      'is_vip', false,
      'expires_at', null,
      'days_remaining', 0
    );
  END IF;
  
  v_days_remaining := GREATEST(0, EXTRACT(DAY FROM (v_subscription.expires_at - now()))::INT);
  
  RETURN jsonb_build_object(
    'is_vip', true,
    'expires_at', v_subscription.expires_at,
    'days_remaining', v_days_remaining
  );
END;
$$;

-- ============================================
-- Function: Purchase VIP (5 coins, 30 days)
-- ============================================
CREATE OR REPLACE FUNCTION public.purchase_vip()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_wallet RECORD;
  v_cost NUMERIC := 5;
  v_duration INTERVAL := '30 days';
  v_new_expires TIMESTAMPTZ;
  v_current_sub RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Get wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  
  IF v_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;
  
  IF v_wallet.balance < v_cost THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Check existing subscription
  SELECT * INTO v_current_sub FROM vip_subscriptions WHERE user_id = v_user_id;
  
  -- Calculate new expiration (extend if already VIP)
  IF v_current_sub IS NOT NULL AND v_current_sub.expires_at > now() THEN
    v_new_expires := v_current_sub.expires_at + v_duration;
  ELSE
    v_new_expires := now() + v_duration;
  END IF;
  
  -- Deduct coins
  UPDATE wallets SET balance = balance - v_cost WHERE user_id = v_user_id;
  
  -- Upsert subscription
  INSERT INTO vip_subscriptions (user_id, expires_at)
  VALUES (v_user_id, v_new_expires)
  ON CONFLICT (user_id) DO UPDATE SET
    expires_at = EXCLUDED.expires_at,
    started_at = CASE 
      WHEN vip_subscriptions.expires_at < now() THEN now()
      ELSE vip_subscriptions.started_at
    END;
  
  -- Log transaction
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES (v_user_id, 'fee', -v_cost, 'VIP Subscription (30 days)');
  
  RETURN jsonb_build_object(
    'success', true,
    'expires_at', v_new_expires,
    'days_remaining', 30
  );
END;
$$;

-- ============================================
-- Function: Send Tip (VIP only, anti-abuse)
-- ============================================
CREATE OR REPLACE FUNCTION public.send_tip(p_to_user_id UUID, p_amount NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_sender_wallet RECORD;
  v_receiver_wallet RECORD;
  v_is_vip BOOLEAN;
  v_tips_today INT;
  v_max_tips_per_day INT := 10;
  v_max_tip_amount NUMERIC := 50;
  v_receiver_profile RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF v_user_id = p_to_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot tip yourself');
  END IF;
  
  IF p_amount <= 0 OR p_amount > v_max_tip_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount (max 50 coins)');
  END IF;
  
  -- Check VIP status
  SELECT (check_vip_status(v_user_id)->>'is_vip')::BOOLEAN INTO v_is_vip;
  
  IF NOT v_is_vip THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP required to send tips');
  END IF;
  
  -- Check daily limit
  SELECT COUNT(*) INTO v_tips_today
  FROM tips
  WHERE from_user_id = v_user_id
    AND created_at > now() - INTERVAL '24 hours';
  
  IF v_tips_today >= v_max_tips_per_day THEN
    RETURN jsonb_build_object('success', false, 'error', 'Daily tip limit reached (10/day)');
  END IF;
  
  -- Get sender wallet
  SELECT * INTO v_sender_wallet FROM wallets WHERE user_id = v_user_id FOR UPDATE;
  
  IF v_sender_wallet.balance < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  
  -- Get receiver wallet
  SELECT * INTO v_receiver_wallet FROM wallets WHERE user_id = p_to_user_id FOR UPDATE;
  
  IF v_receiver_wallet IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Recipient not found');
  END IF;
  
  -- Get receiver profile for notification
  SELECT username INTO v_receiver_profile FROM profiles WHERE user_id = p_to_user_id;
  
  -- Transfer coins
  UPDATE wallets SET balance = balance - p_amount WHERE user_id = v_user_id;
  UPDATE wallets SET balance = balance + p_amount WHERE user_id = p_to_user_id;
  
  -- Log tip
  INSERT INTO tips (from_user_id, to_user_id, amount) VALUES (v_user_id, p_to_user_id, p_amount);
  
  -- Log transactions
  INSERT INTO transactions (user_id, type, amount, description)
  VALUES 
    (v_user_id, 'fee', -p_amount, 'Tip sent to @' || v_receiver_profile.username),
    (p_to_user_id, 'payout', p_amount, 'Tip received');
  
  RETURN jsonb_build_object('success', true, 'amount', p_amount);
END;
$$;

-- ============================================
-- Function: Change Username (VIP only)
-- ============================================
CREATE OR REPLACE FUNCTION public.change_username_vip(p_new_username TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_vip BOOLEAN;
  v_existing RECORD;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  IF length(p_new_username) < 3 OR length(p_new_username) > 20 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username must be 3-20 characters');
  END IF;
  
  IF p_new_username !~ '^[a-zA-Z0-9_]+$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username can only contain letters, numbers, and underscores');
  END IF;
  
  -- Check VIP status
  SELECT (check_vip_status(v_user_id)->>'is_vip')::BOOLEAN INTO v_is_vip;
  
  IF NOT v_is_vip THEN
    RETURN jsonb_build_object('success', false, 'error', 'VIP required to change username');
  END IF;
  
  -- Check if username is taken
  SELECT user_id INTO v_existing FROM profiles WHERE LOWER(username) = LOWER(p_new_username);
  
  IF v_existing.user_id IS NOT NULL AND v_existing.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Username already taken');
  END IF;
  
  -- Update username
  UPDATE profiles SET username = p_new_username WHERE user_id = v_user_id;
  
  RETURN jsonb_build_object('success', true, 'username', p_new_username);
END;
$$;-- ============================================
-- FASE 4: Weekly Leaderboard View (retry)
-- ============================================

-- Create weekly leaderboard view (coins earned this week from match payouts)
CREATE OR REPLACE VIEW public.leaderboard_weekly AS
SELECT 
  p.user_id,
  p.username,
  p.avatar_url,
  COALESCE(SUM(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE 0 END), 0) as weekly_earned
FROM profiles p
LEFT JOIN transactions t ON t.user_id = p.user_id 
  AND t.created_at >= date_trunc('week', now())
  AND t.type = 'payout'
GROUP BY p.user_id, p.username, p.avatar_url
HAVING COALESCE(SUM(CASE WHEN t.type = 'payout' AND t.amount > 0 THEN t.amount ELSE 0 END), 0) > 0
ORDER BY weekly_earned DESC
LIMIT 10;

-- ============================================
-- FASE 5: Epic Username Check (without unique constraint for now)
-- ============================================

-- Function to check epic username availability
CREATE OR REPLACE FUNCTION public.check_epic_username_available(p_epic_username TEXT, p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE LOWER(epic_username) = LOWER(p_epic_username)
    AND (p_user_id IS NULL OR user_id != p_user_id)
  );
$$;

-- ============================================
-- FASE 6: Admin Delete User Function
-- ============================================

CREATE OR REPLACE FUNCTION public.admin_prepare_delete_user(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_match_count INT;
  v_transaction_count INT;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;
  
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;
  
  IF v_profile.role = 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot delete admin users');
  END IF;
  
  SELECT COUNT(*) INTO v_match_count FROM match_participants WHERE user_id = p_user_id;
  SELECT COUNT(*) INTO v_transaction_count FROM transactions WHERE user_id = p_user_id;
  
  DELETE FROM match_chat_messages WHERE user_id = p_user_id;
  DELETE FROM match_participants WHERE user_id = p_user_id;
  DELETE FROM match_proofs WHERE user_id = p_user_id;
  DELETE FROM tips WHERE from_user_id = p_user_id OR to_user_id = p_user_id;
  DELETE FROM vip_subscriptions WHERE user_id = p_user_id;
  DELETE FROM transactions WHERE user_id = p_user_id;
  DELETE FROM wallets WHERE user_id = p_user_id;
  DELETE FROM notifications WHERE user_id = p_user_id;
  DELETE FROM team_members WHERE user_id = p_user_id;
  DELETE FROM highlights WHERE user_id = p_user_id;
  DELETE FROM profiles WHERE user_id = p_user_id;
  
  INSERT INTO admin_action_logs (admin_user_id, action_type, target_type, target_id, details)
  VALUES (auth.uid(), 'delete_user_data', 'user', p_user_id, jsonb_build_object(
    'username', v_profile.username,
    'email', v_profile.email,
    'matches_deleted', v_match_count,
    'transactions_deleted', v_transaction_count
  ));
  
  RETURN jsonb_build_object(
    'success', true, 
    'message', 'User data deleted',
    'user_id', p_user_id
  );
END;
$$;

-- ============================================
-- FASE 2: Player Stats Function
-- ============================================

CREATE OR REPLACE FUNCTION public.get_player_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_total_matches INT;
  v_wins INT;
  v_losses INT;
  v_win_rate NUMERIC;
  v_total_earned NUMERIC;
  v_total_profit NUMERIC;
  v_avg_profit NUMERIC;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  
  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;
  
  SELECT COUNT(*) INTO v_total_matches
  FROM match_participants mp
  JOIN matches m ON m.id = mp.match_id
  WHERE mp.user_id = p_user_id 
    AND m.status IN ('completed', 'finished');
  
  SELECT COUNT(*) INTO v_wins
  FROM match_results mr
  WHERE mr.winner_user_id = p_user_id 
    AND mr.status IN ('confirmed', 'resolved');
  
  v_losses := GREATEST(0, v_total_matches - v_wins);
  v_win_rate := CASE WHEN v_total_matches > 0 THEN ROUND((v_wins::NUMERIC / v_total_matches) * 100, 1) ELSE 0 END;
  
  SELECT 
    COALESCE(SUM(CASE WHEN type = 'payout' THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE 
      WHEN type = 'payout' THEN amount 
      WHEN type = 'fee' AND match_id IS NOT NULL THEN -amount
      ELSE 0 
    END), 0)
  INTO v_total_earned, v_total_profit
  FROM transactions
  WHERE user_id = p_user_id;
  
  v_avg_profit := CASE WHEN v_total_matches > 0 THEN ROUND(v_total_profit / v_total_matches, 2) ELSE 0 END;
  
  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'username', v_profile.username,
    'avatar_url', v_profile.avatar_url,
    'epic_username', v_profile.epic_username,
    'total_matches', v_total_matches,
    'wins', v_wins,
    'losses', v_losses,
    'win_rate', v_win_rate,
    'total_earned', v_total_earned,
    'total_profit', v_total_profit,
    'avg_profit_per_match', v_avg_profit,
    'member_since', v_profile.created_at
  );
END;
$$;
-- ============================================
-- CHALLENGES SYSTEM - FULL MIGRATION
-- ============================================

-- 1. Challenges definitions table (admin managed)
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly')),
  metric_type TEXT NOT NULL CHECK (metric_type IN (
    'match_completed', 'ready_up_fast', 'proof_uploaded', 'match_created_started'
  )),
  target_value INT NOT NULL DEFAULT 1,
  reward_xp INT NOT NULL DEFAULT 0,
  reward_coin NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User challenge progress table
CREATE TABLE public.user_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  period_key TEXT NOT NULL,
  progress_value INT NOT NULL DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  is_claimed BOOLEAN DEFAULT false,
  claimed_at TIMESTAMPTZ,
  reward_granted_xp INT DEFAULT 0,
  reward_granted_coin NUMERIC(10,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, challenge_id, period_key)
);

-- 3. Challenge event log for idempotency
CREATE TABLE public.challenge_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  challenge_id UUID,
  event_type TEXT NOT NULL,
  source_id UUID,
  event_hash TEXT NOT NULL UNIQUE,
  processed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. User XP tracking
CREATE TABLE public.user_xp (
  user_id UUID PRIMARY KEY,
  total_xp INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Anti-abuse tracking (max 3 matches vs same opponent/day)
CREATE TABLE public.challenge_anti_abuse (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  opponent_key TEXT NOT NULL,
  match_date DATE NOT NULL DEFAULT CURRENT_DATE,
  match_count INT DEFAULT 1,
  UNIQUE (user_id, opponent_key, match_date)
);

-- 6. Add challenge_progress_id to transactions for idempotent rewards
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS challenge_progress_id UUID UNIQUE;

-- Enable RLS
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_xp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_anti_abuse ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view active challenges" ON public.challenges
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage challenges" ON public.challenges
  FOR ALL USING (public.is_admin());

CREATE POLICY "Users view own progress" ON public.user_challenge_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert progress" ON public.user_challenge_progress
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update progress" ON public.user_challenge_progress
  FOR UPDATE USING (true);

CREATE POLICY "Users view own XP" ON public.user_xp
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view XP" ON public.user_xp
  FOR SELECT USING (true);

CREATE POLICY "System can manage XP" ON public.user_xp
  FOR ALL USING (true);

CREATE POLICY "System can manage event log" ON public.challenge_event_log
  FOR ALL USING (true);

CREATE POLICY "System can manage anti-abuse" ON public.challenge_anti_abuse
  FOR ALL USING (true);

-- Enable realtime for progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_challenge_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_xp;

-- Indexes for performance
CREATE INDEX idx_user_challenge_progress_user ON public.user_challenge_progress(user_id);
CREATE INDEX idx_user_challenge_progress_period ON public.user_challenge_progress(user_id, period_key);
CREATE INDEX idx_challenge_event_log_user ON public.challenge_event_log(user_id);
CREATE INDEX idx_challenge_event_log_hash ON public.challenge_event_log(event_hash);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Get current period key (daily or weekly)
CREATE OR REPLACE FUNCTION public.get_current_period_key(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF p_type = 'daily' THEN
    RETURN to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD');
  ELSIF p_type = 'weekly' THEN
    RETURN to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW');
  END IF;
  RETURN NULL;
END;
$$;

-- Check anti-abuse (returns true if event should count)
CREATE OR REPLACE FUNCTION public.check_challenge_anti_abuse(
  p_user_id UUID,
  p_opponent_user_id UUID,
  p_opponent_team_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_opponent_key TEXT;
  v_count INT;
BEGIN
  -- Determine opponent key
  IF p_opponent_team_id IS NOT NULL THEN
    v_opponent_key := 'team:' || p_opponent_team_id::TEXT;
  ELSIF p_opponent_user_id IS NOT NULL THEN
    v_opponent_key := 'user:' || p_opponent_user_id::TEXT;
  ELSE
    RETURN true; -- No opponent info, allow
  END IF;
  
  -- Upsert counter
  INSERT INTO challenge_anti_abuse (user_id, opponent_key, match_date, match_count)
  VALUES (p_user_id, v_opponent_key, CURRENT_DATE, 1)
  ON CONFLICT (user_id, opponent_key, match_date)
  DO UPDATE SET match_count = challenge_anti_abuse.match_count + 1
  RETURNING match_count INTO v_count;
  
  -- Allow only first 3 matches
  RETURN v_count <= 3;
END;
$$;

-- Record challenge event with idempotency
CREATE OR REPLACE FUNCTION public.record_challenge_event(
  p_user_id UUID,
  p_event_type TEXT,
  p_source_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_hash TEXT;
  v_existing RECORD;
BEGIN
  -- Generate unique event hash
  v_event_hash := md5(p_user_id::TEXT || p_event_type || COALESCE(p_source_id::TEXT, 'null'));
  
  -- Check if already processed (idempotency)
  SELECT * INTO v_existing FROM challenge_event_log WHERE event_hash = v_event_hash;
  
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_processed', true);
  END IF;
  
  -- Insert event log
  INSERT INTO challenge_event_log (user_id, event_type, source_id, event_hash)
  VALUES (p_user_id, p_event_type, p_source_id, v_event_hash);
  
  -- Update progress for matching challenges
  PERFORM update_challenge_progress(p_user_id, p_event_type, p_source_id);
  
  RETURN jsonb_build_object('success', true, 'processed', true);
END;
$$;

-- Update challenge progress
CREATE OR REPLACE FUNCTION public.update_challenge_progress(
  p_user_id UUID,
  p_metric_type TEXT,
  p_source_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_challenge RECORD;
  v_period_key TEXT;
  v_progress RECORD;
BEGIN
  -- Find all active challenges matching this metric
  FOR v_challenge IN 
    SELECT * FROM challenges 
    WHERE metric_type = p_metric_type 
    AND is_active = true
  LOOP
    -- Get correct period key
    v_period_key := get_current_period_key(v_challenge.type);
    
    -- Upsert progress
    INSERT INTO user_challenge_progress (user_id, challenge_id, period_key, progress_value)
    VALUES (p_user_id, v_challenge.id, v_period_key, 1)
    ON CONFLICT (user_id, challenge_id, period_key)
    DO UPDATE SET 
      progress_value = user_challenge_progress.progress_value + 1,
      updated_at = now();
    
    -- Check if now completed
    SELECT * INTO v_progress 
    FROM user_challenge_progress 
    WHERE user_id = p_user_id 
    AND challenge_id = v_challenge.id 
    AND period_key = v_period_key;
    
    IF v_progress.progress_value >= v_challenge.target_value AND NOT v_progress.is_completed THEN
      UPDATE user_challenge_progress 
      SET is_completed = true, completed_at = now()
      WHERE id = v_progress.id;
    END IF;
  END LOOP;
END;
$$;

-- Claim challenge reward (atomic)
CREATE OR REPLACE FUNCTION public.claim_challenge_reward(p_challenge_id UUID, p_period_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_progress RECORD;
  v_challenge RECORD;
  v_current_week TEXT;
  v_weekly_coins NUMERIC;
  v_actual_coin NUMERIC;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;
  
  -- Lock progress row
  SELECT * INTO v_progress 
  FROM user_challenge_progress
  WHERE user_id = v_user_id 
  AND challenge_id = p_challenge_id 
  AND period_key = p_period_key
  FOR UPDATE;
  
  IF v_progress IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Progress not found');
  END IF;
  
  -- Idempotency: already claimed
  IF v_progress.is_claimed THEN
    RETURN jsonb_build_object('success', true, 'already_claimed', true);
  END IF;
  
  -- Must be completed
  IF NOT v_progress.is_completed THEN
    RETURN jsonb_build_object('success', false, 'error', 'Challenge not completed');
  END IF;
  
  -- Get challenge details
  SELECT * INTO v_challenge FROM challenges WHERE id = p_challenge_id;
  
  v_actual_coin := v_challenge.reward_coin;
  
  -- Weekly coin cap check (EXACT period_key match)
  IF v_challenge.reward_coin > 0 THEN
    v_current_week := get_current_period_key('weekly');
    
    SELECT COALESCE(SUM(reward_granted_coin), 0) INTO v_weekly_coins
    FROM user_challenge_progress
    WHERE user_id = v_user_id 
    AND period_key = v_current_week
    AND is_claimed = true;
    
    IF v_weekly_coins >= 1 THEN
      v_actual_coin := 0; -- Cap reached
    END IF;
  END IF;
  
  -- Grant coin reward via transactions ledger
  IF v_actual_coin > 0 THEN
    INSERT INTO transactions (user_id, type, amount, description, challenge_progress_id, status)
    VALUES (v_user_id, 'payout', v_actual_coin, 'Challenge: ' || v_challenge.title, v_progress.id, 'completed');
    
    UPDATE wallets SET balance = balance + v_actual_coin, updated_at = now() 
    WHERE user_id = v_user_id;
  END IF;
  
  -- Grant XP (upsert)
  IF v_challenge.reward_xp > 0 THEN
    INSERT INTO user_xp (user_id, total_xp, updated_at)
    VALUES (v_user_id, v_challenge.reward_xp, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET total_xp = user_xp.total_xp + EXCLUDED.total_xp, updated_at = now();
  END IF;
  
  -- Mark claimed
  UPDATE user_challenge_progress 
  SET is_claimed = true, 
      claimed_at = now(),
      reward_granted_xp = v_challenge.reward_xp,
      reward_granted_coin = v_actual_coin
  WHERE id = v_progress.id;
  
  RETURN jsonb_build_object(
    'success', true, 
    'xp', v_challenge.reward_xp, 
    'coin', v_actual_coin,
    'coin_capped', v_challenge.reward_coin > 0 AND v_actual_coin = 0
  );
END;
$$;

-- Get user challenges with progress
CREATE OR REPLACE FUNCTION public.get_user_challenges(p_type TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_daily_key TEXT;
  v_weekly_key TEXT;
  v_result JSONB;
BEGIN
  v_daily_key := get_current_period_key('daily');
  v_weekly_key := get_current_period_key('weekly');
  
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'description', c.description,
      'type', c.type,
      'metric_type', c.metric_type,
      'target_value', c.target_value,
      'reward_xp', c.reward_xp,
      'reward_coin', c.reward_coin,
      'progress_value', COALESCE(p.progress_value, 0),
      'is_completed', COALESCE(p.is_completed, false),
      'is_claimed', COALESCE(p.is_claimed, false),
      'period_key', CASE WHEN c.type = 'daily' THEN v_daily_key ELSE v_weekly_key END
    )
    ORDER BY c.type, c.created_at
  ) INTO v_result
  FROM challenges c
  LEFT JOIN user_challenge_progress p 
    ON p.challenge_id = c.id 
    AND p.user_id = v_user_id
    AND p.period_key = CASE WHEN c.type = 'daily' THEN v_daily_key ELSE v_weekly_key END
  WHERE c.is_active = true
  AND (p_type IS NULL OR c.type = p_type);
  
  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

-- Get user XP
CREATE OR REPLACE FUNCTION public.get_user_xp()
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_xp INT;
BEGIN
  SELECT total_xp INTO v_xp FROM user_xp WHERE user_id = auth.uid();
  RETURN COALESCE(v_xp, 0);
END;
$$;

-- ============================================
-- TRIGGER: Handle proof upload for challenges
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_proof_challenge_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_match RECORD;
BEGIN
  -- Get match info to ensure it's valid
  SELECT * INTO v_match FROM matches WHERE id = NEW.match_id;
  
  -- Only count if match exists and is completed or in progress
  IF v_match IS NOT NULL AND v_match.status IN ('in_progress', 'result_pending', 'completed', 'finished') THEN
    PERFORM record_challenge_event(NEW.user_id, 'proof_uploaded', NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_proof_insert_challenge
AFTER INSERT ON public.match_proofs
FOR EACH ROW
EXECUTE FUNCTION handle_proof_challenge_event();

-- ============================================
-- SEED DATA: Default challenges
-- ============================================
INSERT INTO public.challenges (title, description, type, metric_type, target_value, reward_xp, reward_coin) VALUES
('Play 1 Match', 'Complete any match today', 'daily', 'match_completed', 1, 30, 0),
('Ready Up Fast', 'Ready within 2 minutes of joining', 'daily', 'ready_up_fast', 1, 20, 0),
('Good Proof', 'Upload proof screenshot in a match', 'daily', 'proof_uploaded', 1, 30, 0),
('Complete 10 Matches', 'Complete 10 matches this week', 'weekly', 'match_completed', 10, 50, 1),
('Create 5 Started', 'Create 5 matches that start playing', 'weekly', 'match_created_started', 5, 40, 1),
('Proof Streak', 'Upload proof in 5 different matches', 'weekly', 'proof_uploaded', 5, 50, 1);
