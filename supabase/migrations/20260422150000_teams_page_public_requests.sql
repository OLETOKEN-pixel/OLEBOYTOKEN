-- Teams page: public listing, join requests, invites, member management, and logos.

ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS max_members integer NOT NULL DEFAULT 4;

ALTER TABLE public.teams
DROP CONSTRAINT IF EXISTS teams_max_members_check;

ALTER TABLE public.teams
ADD CONSTRAINT teams_max_members_check CHECK (max_members IN (2, 3, 4));

CREATE INDEX IF NOT EXISTS idx_team_members_user_status
ON public.team_members (user_id, status);

CREATE INDEX IF NOT EXISTS idx_team_members_team_status
ON public.team_members (team_id, status);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team-logos',
  'team-logos',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']::text[];

DROP POLICY IF EXISTS "Team logos are publicly readable" ON storage.objects;
CREATE POLICY "Team logos are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "Users can upload their team logos" ON storage.objects;
CREATE POLICY "Users can upload their team logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'team-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can update their team logos" ON storage.objects;
CREATE POLICY "Users can update their team logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'team-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'team-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can delete their team logos" ON storage.objects;
CREATE POLICY "Users can delete their team logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'team-logos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP FUNCTION IF EXISTS public.create_team(text);
DROP FUNCTION IF EXISTS public.create_team(text, integer, text);
DROP FUNCTION IF EXISTS public.send_team_invite(uuid, uuid);
DROP FUNCTION IF EXISTS public.respond_to_invite(uuid, text);
DROP FUNCTION IF EXISTS public.request_join_team(uuid);
DROP FUNCTION IF EXISTS public.respond_to_team_request(uuid, uuid, text);
DROP FUNCTION IF EXISTS public.remove_team_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_teams_page(text, integer, integer);
DROP FUNCTION IF EXISTS public.get_team_detail(uuid);
DROP FUNCTION IF EXISTS public.get_team_invites();

CREATE FUNCTION public.create_team(
  p_name text,
  p_max_members integer DEFAULT 4,
  p_logo_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_tag text;
  v_attempts integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be logged in to create a team');
  END IF;

  IF p_name IS NULL OR length(trim(p_name)) < 2 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team name must be at least 2 characters');
  END IF;

  IF p_max_members NOT IN (2, 3, 4) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team size must be Duo, Trio, or Squad');
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_tag := upper(substring(md5(gen_random_uuid()::text), 1, 5));

    BEGIN
      INSERT INTO public.teams (name, tag, owner_id, logo_url, max_members)
      VALUES (trim(p_name), v_tag, auth.uid(), nullif(trim(coalesce(p_logo_url, '')), ''), p_max_members)
      RETURNING id INTO v_team_id;

      EXIT;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempts >= 8 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Failed to generate a unique team tag');
      END IF;
    END;
  END LOOP;

  INSERT INTO public.team_members (team_id, user_id, role, status)
  VALUES (v_team_id, auth.uid(), 'owner', 'accepted');

  RETURN jsonb_build_object('success', true, 'team_id', v_team_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.send_team_invite(
  p_team_id uuid,
  p_invitee_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_member_count integer;
  v_existing record;
BEGIN
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
      AND status = 'accepted'
      AND role IN ('owner', 'captain')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to invite members');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_invitee_user_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found');
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  IF v_member_count >= v_team.max_members THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team is full');
  END IF;

  SELECT * INTO v_existing
  FROM public.team_members
  WHERE team_id = p_team_id AND user_id = p_invitee_user_id;

  IF FOUND AND v_existing.status IN ('accepted', 'pending') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE WHEN v_existing.status = 'accepted' THEN 'User is already a member of this team' ELSE 'User already has a pending invite or request' END
    );
  END IF;

  IF FOUND THEN
    UPDATE public.team_members
    SET status = 'pending', invited_by = auth.uid(), role = 'member', updated_at = now()
    WHERE team_id = p_team_id AND user_id = p_invitee_user_id;
  ELSE
    INSERT INTO public.team_members (team_id, user_id, role, status, invited_by)
    VALUES (p_team_id, p_invitee_user_id, 'member', 'pending', auth.uid());
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, payload)
  VALUES (
    p_invitee_user_id,
    'team_invite',
    'Team Invitation',
    'You have been invited to join ' || v_team.name,
    jsonb_build_object(
      'team_id', p_team_id,
      'team_name', v_team.name,
      'team_tag', v_team.tag,
      'invited_by_user_id', auth.uid(),
      'invited_by_username', (SELECT username FROM public.profiles WHERE user_id = auth.uid())
    )
  );

  RETURN jsonb_build_object('success', true, 'message', 'Invite sent successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_invite(
  p_team_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_invite record;
  v_member_count integer;
BEGIN
  IF p_action NOT IN ('accept', 'decline') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  SELECT * INTO v_invite
  FROM public.team_members
  WHERE team_id = p_team_id
    AND user_id = auth.uid()
    AND status = 'pending'
    AND invited_by IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending invite found');
  END IF;

  IF p_action = 'accept' THEN
    SELECT count(*) INTO v_member_count
    FROM public.team_members
    WHERE team_id = p_team_id AND status = 'accepted';

    IF v_member_count >= v_team.max_members THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team is already full');
    END IF;

    UPDATE public.team_members
    SET status = 'accepted', updated_at = now()
    WHERE team_id = p_team_id AND user_id = auth.uid();

    INSERT INTO public.notifications (user_id, type, title, message, payload)
    VALUES (
      v_team.owner_id,
      'invite_accepted',
      'Invite Accepted',
      (SELECT username FROM public.profiles WHERE user_id = auth.uid()) || ' has joined ' || v_team.name,
      jsonb_build_object('team_id', p_team_id, 'team_name', v_team.name, 'accepted_by_user_id', auth.uid())
    );

    RETURN jsonb_build_object('success', true, 'message', 'You have joined the team');
  END IF;

  UPDATE public.team_members
  SET status = 'rejected', updated_at = now()
  WHERE team_id = p_team_id AND user_id = auth.uid();

  INSERT INTO public.notifications (user_id, type, title, message, payload)
  VALUES (
    v_team.owner_id,
    'invite_declined',
    'Invite Declined',
    (SELECT username FROM public.profiles WHERE user_id = auth.uid()) || ' declined to join ' || v_team.name,
    jsonb_build_object('team_id', p_team_id, 'team_name', v_team.name, 'declined_by_user_id', auth.uid())
  );

  RETURN jsonb_build_object('success', true, 'message', 'Invite declined');
END;
$$;

CREATE OR REPLACE FUNCTION public.request_join_team(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_member_count integer;
  v_existing record;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be logged in to request a team');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  IF v_member_count >= v_team.max_members THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team is full');
  END IF;

  SELECT * INTO v_existing
  FROM public.team_members
  WHERE team_id = p_team_id AND user_id = auth.uid();

  IF FOUND AND v_existing.status IN ('accepted', 'pending') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', CASE WHEN v_existing.status = 'accepted' THEN 'You are already in this team' ELSE 'You already have a pending request or invite' END
    );
  END IF;

  IF FOUND THEN
    UPDATE public.team_members
    SET status = 'pending', invited_by = NULL, role = 'member', updated_at = now()
    WHERE team_id = p_team_id AND user_id = auth.uid();
  ELSE
    INSERT INTO public.team_members (team_id, user_id, role, status, invited_by)
    VALUES (p_team_id, auth.uid(), 'member', 'pending', NULL);
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, payload)
  SELECT
    tm.user_id,
    'team_join_request',
    'Team Join Request',
    (SELECT username FROM public.profiles WHERE user_id = auth.uid()) || ' wants to join ' || v_team.name,
    jsonb_build_object('team_id', p_team_id, 'team_name', v_team.name, 'requester_user_id', auth.uid())
  FROM public.team_members tm
  WHERE tm.team_id = p_team_id
    AND tm.status = 'accepted'
    AND tm.role IN ('owner', 'captain');

  RETURN jsonb_build_object('success', true, 'message', 'Join request sent');
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_to_team_request(
  p_team_id uuid,
  p_user_id uuid,
  p_action text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_member_count integer;
BEGIN
  IF p_action NOT IN ('accept', 'decline') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid action');
  END IF;

  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = auth.uid()
      AND status = 'accepted'
      AND role IN ('owner', 'captain')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to manage requests');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = p_user_id
      AND status = 'pending'
      AND invited_by IS NULL
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'No pending request found');
  END IF;

  IF p_action = 'accept' THEN
    SELECT count(*) INTO v_member_count
    FROM public.team_members
    WHERE team_id = p_team_id AND status = 'accepted';

    IF v_member_count >= v_team.max_members THEN
      RETURN jsonb_build_object('success', false, 'error', 'Team is already full');
    END IF;

    UPDATE public.team_members
    SET status = 'accepted', updated_at = now()
    WHERE team_id = p_team_id AND user_id = p_user_id;

    INSERT INTO public.notifications (user_id, type, title, message, payload)
    VALUES (
      p_user_id,
      'invite_accepted',
      'Join Request Accepted',
      'Your request to join ' || v_team.name || ' was accepted',
      jsonb_build_object('team_id', p_team_id, 'team_name', v_team.name)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Request accepted');
  END IF;

  UPDATE public.team_members
  SET status = 'rejected', updated_at = now()
  WHERE team_id = p_team_id AND user_id = p_user_id;

  INSERT INTO public.notifications (user_id, type, title, message, payload)
  VALUES (
    p_user_id,
    'invite_declined',
    'Join Request Declined',
    'Your request to join ' || v_team.name || ' was declined',
    jsonb_build_object('team_id', p_team_id, 'team_name', v_team.name)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Request declined');
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_team_member(
  p_team_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
BEGIN
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  IF v_team.owner_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the team owner can remove members');
  END IF;

  IF p_user_id = v_team.owner_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot remove the team owner');
  END IF;

  DELETE FROM public.team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User is not a member of this team');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, payload)
  VALUES (
    p_user_id,
    'removed_from_team',
    'Removed from Team',
    'You have been removed from ' || v_team.name,
    jsonb_build_object('team_id', p_team_id, 'team_name', v_team.name)
  );

  RETURN jsonb_build_object('success', true, 'message', 'Member removed');
END;
$$;

CREATE OR REPLACE FUNCTION public.get_teams_page(
  p_search text DEFAULT '',
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teams jsonb;
BEGIN
  SELECT coalesce(jsonb_agg(to_jsonb(row) ORDER BY row.wins DESC, row.win_rate DESC, row.name ASC), '[]'::jsonb)
  INTO v_teams
  FROM (
    SELECT
      t.id,
      t.name,
      t.tag,
      t.logo_url,
      t.max_members,
      t.owner_id,
      t.created_at,
      coalesce(mc.member_count, 0)::integer AS member_count,
      coalesce(ms.total_matches, 0)::integer AS total_matches,
      coalesce(ms.wins, 0)::integer AS wins,
      greatest(coalesce(ms.total_matches, 0) - coalesce(ms.wins, 0), 0)::integer AS losses,
      CASE
        WHEN coalesce(ms.total_matches, 0) = 0 THEN 0
        ELSE round((coalesce(ms.wins, 0)::numeric / ms.total_matches::numeric) * 100, 2)
      END AS win_rate,
      (
        SELECT tm.status
        FROM public.team_members tm
        WHERE tm.team_id = t.id AND tm.user_id = auth.uid()
        ORDER BY tm.updated_at DESC NULLS LAST, tm.created_at DESC NULLS LAST
        LIMIT 1
      ) AS current_user_status,
      (
        auth.uid() IS NOT NULL
        AND coalesce(mc.member_count, 0) < t.max_members
        AND NOT EXISTS (
          SELECT 1
          FROM public.team_members tm
          WHERE tm.team_id = t.id
            AND tm.user_id = auth.uid()
            AND tm.status IN ('accepted', 'pending')
        )
      ) AS can_request
    FROM public.teams t
    LEFT JOIN (
      SELECT team_id, count(*) AS member_count
      FROM public.team_members
      WHERE status = 'accepted'
      GROUP BY team_id
    ) mc ON mc.team_id = t.id
    LEFT JOIN (
      SELECT
        team_id,
        count(*) AS total_matches,
        count(*) FILTER (WHERE won) AS wins
      FROM (
        SELECT
          CASE WHEN m.team_a_id = mr.winner_team_id THEN m.team_a_id ELSE m.team_a_id END AS team_id,
          (mr.winner_team_id = m.team_a_id) AS won
        FROM public.matches m
        JOIN public.match_results mr ON mr.match_id = m.id
        WHERE m.team_a_id IS NOT NULL
          AND mr.status IN ('confirmed', 'resolved')
          AND m.status IN ('completed', 'finished', 'admin_resolved')
        UNION ALL
        SELECT
          m.team_b_id AS team_id,
          (mr.winner_team_id = m.team_b_id) AS won
        FROM public.matches m
        JOIN public.match_results mr ON mr.match_id = m.id
        WHERE m.team_b_id IS NOT NULL
          AND mr.status IN ('confirmed', 'resolved')
          AND m.status IN ('completed', 'finished', 'admin_resolved')
      ) team_match_rows
      WHERE team_id IS NOT NULL
      GROUP BY team_id
    ) ms ON ms.team_id = t.id
    WHERE p_search IS NULL
      OR length(trim(p_search)) = 0
      OR t.name ILIKE '%' || trim(p_search) || '%'
      OR t.tag ILIKE '%' || trim(p_search) || '%'
    ORDER BY coalesce(ms.wins, 0) DESC, win_rate DESC, t.name ASC
    LIMIT greatest(1, least(coalesce(p_limit, 10), 50))
    OFFSET greatest(coalesce(p_offset, 0), 0)
  ) row;

  RETURN jsonb_build_object('success', true, 'teams', v_teams);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_detail(p_team_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team record;
  v_member_count integer;
  v_total_matches integer;
  v_wins integer;
  v_members jsonb;
  v_user_role text;
  v_user_status text;
BEGIN
  SELECT * INTO v_team FROM public.teams WHERE id = p_team_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Team not found');
  END IF;

  SELECT count(*) INTO v_member_count
  FROM public.team_members
  WHERE team_id = p_team_id AND status = 'accepted';

  SELECT count(*), count(*) FILTER (WHERE mr.winner_team_id = p_team_id)
  INTO v_total_matches, v_wins
  FROM public.matches m
  JOIN public.match_results mr ON mr.match_id = m.id
  WHERE (m.team_a_id = p_team_id OR m.team_b_id = p_team_id)
    AND mr.status IN ('confirmed', 'resolved')
    AND m.status IN ('completed', 'finished', 'admin_resolved');

  SELECT tm.role, tm.status INTO v_user_role, v_user_status
  FROM public.team_members tm
  WHERE tm.team_id = p_team_id AND tm.user_id = auth.uid()
  ORDER BY tm.updated_at DESC NULLS LAST, tm.created_at DESC NULLS LAST
  LIMIT 1;

  SELECT coalesce(jsonb_agg(to_jsonb(row) ORDER BY row.role_sort, row.created_at), '[]'::jsonb)
  INTO v_members
  FROM (
    SELECT
      tm.id,
      tm.team_id,
      tm.user_id,
      tm.role,
      tm.status,
      tm.created_at,
      p.username,
      p.avatar_url,
      p.discord_avatar_url,
      p.epic_username,
      coalesce(ux.total_xp, 0) AS total_xp,
      CASE tm.role WHEN 'owner' THEN 0 WHEN 'captain' THEN 1 ELSE 2 END AS role_sort
    FROM public.team_members tm
    JOIN public.profiles p ON p.user_id = tm.user_id
    LEFT JOIN public.user_xp ux ON ux.user_id = tm.user_id
    WHERE tm.team_id = p_team_id
      AND tm.status = 'accepted'
  ) row;

  RETURN jsonb_build_object(
    'success', true,
    'team', jsonb_build_object(
      'id', v_team.id,
      'name', v_team.name,
      'tag', v_team.tag,
      'logo_url', v_team.logo_url,
      'owner_id', v_team.owner_id,
      'max_members', v_team.max_members,
      'member_count', v_member_count,
      'total_matches', coalesce(v_total_matches, 0),
      'wins', coalesce(v_wins, 0),
      'losses', greatest(coalesce(v_total_matches, 0) - coalesce(v_wins, 0), 0),
      'win_rate', CASE WHEN coalesce(v_total_matches, 0) = 0 THEN 0 ELSE round((coalesce(v_wins, 0)::numeric / v_total_matches::numeric) * 100, 2) END,
      'current_user_role', v_user_role,
      'current_user_status', v_user_status,
      'can_manage', coalesce(v_user_status = 'accepted' AND v_user_role IN ('owner', 'captain'), false),
      'can_kick', coalesce(v_user_status = 'accepted' AND v_user_role = 'owner', false),
      'can_request', auth.uid() IS NOT NULL AND v_member_count < v_team.max_members AND coalesce(v_user_status, 'none') NOT IN ('accepted', 'pending')
    ),
    'members', v_members
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_team_invites()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent jsonb;
  v_received jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You must be logged in');
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(row) ORDER BY row.created_at DESC), '[]'::jsonb)
  INTO v_sent
  FROM (
    SELECT
      tm.id,
      'invite' AS kind,
      tm.team_id,
      t.name AS team_name,
      t.logo_url AS team_logo_url,
      tm.user_id AS target_user_id,
      p.username AS target_username,
      coalesce(p.discord_avatar_url, p.avatar_url) AS target_avatar_url,
      p.epic_username AS target_epic_username,
      coalesce(ux.total_xp, 0) AS target_total_xp,
      tm.status,
      tm.created_at,
      coalesce(stats.win_rate, 0) AS win_rate
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    JOIN public.profiles p ON p.user_id = tm.user_id
    LEFT JOIN public.user_xp ux ON ux.user_id = tm.user_id
    LEFT JOIN LATERAL (
      SELECT
        CASE WHEN count(*) = 0 THEN 0 ELSE round((count(*) FILTER (WHERE mr.winner_team_id = t.id)::numeric / count(*)::numeric) * 100, 2) END AS win_rate
      FROM public.matches m
      JOIN public.match_results mr ON mr.match_id = m.id
      WHERE (m.team_a_id = t.id OR m.team_b_id = t.id)
        AND mr.status IN ('confirmed', 'resolved')
        AND m.status IN ('completed', 'finished', 'admin_resolved')
    ) stats ON true
    WHERE tm.invited_by = auth.uid()
    UNION ALL
    SELECT
      tm.id,
      'request' AS kind,
      tm.team_id,
      t.name AS team_name,
      t.logo_url AS team_logo_url,
      t.owner_id AS target_user_id,
      t.name AS target_username,
      t.logo_url AS target_avatar_url,
      t.tag AS target_epic_username,
      0 AS target_total_xp,
      tm.status,
      tm.created_at,
      coalesce(stats.win_rate, 0) AS win_rate
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    LEFT JOIN LATERAL (
      SELECT
        CASE WHEN count(*) = 0 THEN 0 ELSE round((count(*) FILTER (WHERE mr.winner_team_id = t.id)::numeric / count(*)::numeric) * 100, 2) END AS win_rate
      FROM public.matches m
      JOIN public.match_results mr ON mr.match_id = m.id
      WHERE (m.team_a_id = t.id OR m.team_b_id = t.id)
        AND mr.status IN ('confirmed', 'resolved')
        AND m.status IN ('completed', 'finished', 'admin_resolved')
    ) stats ON true
    WHERE tm.user_id = auth.uid()
      AND tm.invited_by IS NULL
      AND tm.role = 'member'
  ) row;

  SELECT coalesce(jsonb_agg(to_jsonb(row) ORDER BY row.created_at DESC), '[]'::jsonb)
  INTO v_received
  FROM (
    SELECT
      tm.id,
      'invite' AS kind,
      tm.team_id,
      t.name AS team_name,
      t.logo_url AS team_logo_url,
      tm.invited_by AS target_user_id,
      p.username AS target_username,
      coalesce(p.discord_avatar_url, p.avatar_url) AS target_avatar_url,
      p.epic_username AS target_epic_username,
      coalesce(ux.total_xp, 0) AS target_total_xp,
      tm.status,
      tm.created_at,
      coalesce(stats.win_rate, 0) AS win_rate
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    JOIN public.profiles p ON p.user_id = tm.invited_by
    LEFT JOIN public.user_xp ux ON ux.user_id = tm.invited_by
    LEFT JOIN LATERAL (
      SELECT
        CASE WHEN count(*) = 0 THEN 0 ELSE round((count(*) FILTER (WHERE mr.winner_team_id = t.id)::numeric / count(*)::numeric) * 100, 2) END AS win_rate
      FROM public.matches m
      JOIN public.match_results mr ON mr.match_id = m.id
      WHERE (m.team_a_id = t.id OR m.team_b_id = t.id)
        AND mr.status IN ('confirmed', 'resolved')
        AND m.status IN ('completed', 'finished', 'admin_resolved')
    ) stats ON true
    WHERE tm.user_id = auth.uid()
      AND tm.invited_by IS NOT NULL
    UNION ALL
    SELECT
      tm.id,
      'request' AS kind,
      tm.team_id,
      t.name AS team_name,
      t.logo_url AS team_logo_url,
      tm.user_id AS target_user_id,
      p.username AS target_username,
      coalesce(p.discord_avatar_url, p.avatar_url) AS target_avatar_url,
      p.epic_username AS target_epic_username,
      coalesce(ux.total_xp, 0) AS target_total_xp,
      tm.status,
      tm.created_at,
      coalesce(stats.win_rate, 0) AS win_rate
    FROM public.team_members tm
    JOIN public.teams t ON t.id = tm.team_id
    JOIN public.profiles p ON p.user_id = tm.user_id
    LEFT JOIN public.user_xp ux ON ux.user_id = tm.user_id
    LEFT JOIN LATERAL (
      SELECT
        CASE WHEN count(*) = 0 THEN 0 ELSE round((count(*) FILTER (WHERE mr.winner_team_id = t.id)::numeric / count(*)::numeric) * 100, 2) END AS win_rate
      FROM public.matches m
      JOIN public.match_results mr ON mr.match_id = m.id
      WHERE (m.team_a_id = t.id OR m.team_b_id = t.id)
        AND mr.status IN ('confirmed', 'resolved')
        AND m.status IN ('completed', 'finished', 'admin_resolved')
    ) stats ON true
    WHERE tm.invited_by IS NULL
      AND tm.role = 'member'
      AND EXISTS (
        SELECT 1
        FROM public.team_members manager
        WHERE manager.team_id = tm.team_id
          AND manager.user_id = auth.uid()
          AND manager.status = 'accepted'
          AND manager.role IN ('owner', 'captain')
      )
  ) row;

  RETURN jsonb_build_object('success', true, 'sent', v_sent, 'received', v_received);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team(text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_team_invite(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_invite(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_join_team(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_team_request(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_team_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_teams_page(text, integer, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_detail(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_invites() TO authenticated;
