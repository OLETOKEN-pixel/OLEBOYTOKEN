import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { PlayerStatsModal } from '@/components/player/PlayerStatsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getDiscordAvatarUrl, getProfileInitial } from '@/lib/avatar';
import { queryKeys } from '@/lib/queryKeys';
import { getLevel } from '@/lib/xp';
import type {
  TeamDetailView,
  TeamInviteRow,
  TeamPageMember,
  TeamPageRow,
  TeamMemberStatus,
} from '@/types';

const F_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial', sans-serif";
const F_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', sans-serif";
const F_HEAD = "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', sans-serif";
const TEAMS_ASSETS = '/figma-assets/teams';
const TEAM_LOGO_BUCKET = 'team-logos';

type TeamsView = 'list' | 'invites' | 'my';
type InvitesTab = 'sent' | 'received';

interface TeamsPageResult {
  success: boolean;
  teams?: TeamPageRow[];
  error?: string;
}

interface TeamDetailResult {
  success: boolean;
  team?: TeamDetailView;
  members?: TeamPageMember[];
  error?: string;
}

interface TeamInvitesResult {
  success: boolean;
  sent?: TeamInviteRow[];
  received?: TeamInviteRow[];
  error?: string;
}

interface InviteSearchUser {
  user_id: string;
  username: string;
  epic_username: string | null;
  avatar_url: string | null;
}

const pageWrap: CSSProperties = {
  minHeight: '100vh',
  background: '#0f0404',
  color: '#fff',
  position: 'relative',
  overflowX: 'hidden',
  paddingTop: '156px',
};

const mainShell: CSSProperties = {
  width: 'min(1448px, calc(100vw - 96px))',
  margin: '0 auto',
  position: 'relative',
  zIndex: 2,
};

const buttonBase: CSSProperties = {
  height: '47px',
  borderRadius: '16px',
  border: '1px solid #ff1654',
  background: 'rgba(255,22,84,0.2)',
  color: '#fff',
  fontFamily: F_BOLD,
  fontSize: '24px',
  lineHeight: '29px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '8px',
  padding: '0 18px',
  textTransform: 'uppercase',
};

const panelStyle: CSSProperties = {
  width: '100%',
  minHeight: '396px',
  borderRadius: '14px',
  background: '#282828',
  position: 'relative',
  overflow: 'hidden',
};

function normalizeTeam(row: Partial<TeamPageRow>): TeamPageRow {
  return {
    id: String(row.id ?? ''),
    name: String(row.name ?? 'Unknown'),
    tag: String(row.tag ?? ''),
    logo_url: row.logo_url ?? null,
    max_members: Number(row.max_members ?? 4),
    owner_id: String(row.owner_id ?? ''),
    created_at: row.created_at ?? null,
    member_count: Number(row.member_count ?? 0),
    total_matches: Number(row.total_matches ?? 0),
    wins: Number(row.wins ?? 0),
    losses: Number(row.losses ?? 0),
    win_rate: Number(row.win_rate ?? 0),
    current_user_status: (row.current_user_status ?? null) as TeamMemberStatus | null,
    can_request: Boolean(row.can_request),
  };
}

function normalizeDetail(raw: TeamDetailResult | null | undefined): TeamDetailResult {
  if (!raw?.success || !raw.team) return { success: false, error: raw?.error ?? 'Team not found' };
  return {
    success: true,
    team: {
      ...raw.team,
      max_members: Number(raw.team.max_members ?? 4),
      member_count: Number(raw.team.member_count ?? 0),
      total_matches: Number(raw.team.total_matches ?? 0),
      wins: Number(raw.team.wins ?? 0),
      losses: Number(raw.team.losses ?? 0),
      win_rate: Number(raw.team.win_rate ?? 0),
      can_manage: Boolean(raw.team.can_manage),
      can_kick: Boolean(raw.team.can_kick),
      can_request: Boolean(raw.team.can_request),
    },
    members: (raw.members ?? []).map((member) => ({
      ...member,
      avatar_url: member.avatar_url ?? null,
      total_xp: Number(member.total_xp ?? 0),
    })),
  };
}

function formatWinRate(value: number) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function getSizeLabel(maxMembers: number) {
  if (maxMembers === 2) return 'Duo';
  if (maxMembers === 3) return 'Trio';
  return 'Squad';
}

function getStatusLabel(status?: TeamMemberStatus | null) {
  if (!status) return 'JOIN UP';
  if (status === 'pending') return 'PENDING';
  if (status === 'accepted') return 'ACCEPTED';
  return 'REJECTED';
}

function getTeamRowActionLabel(team: TeamPageRow) {
  if (team.current_user_status === 'pending') return 'REQUESTED';
  if (team.current_user_status === 'accepted') return 'VIEW TEAM';
  if (team.member_count >= team.max_members) return 'FULL';
  return 'REQUEST JOIN';
}

function getTitleOutlineSpec(label: string) {
  if (label.includes('MY TEAM')) {
    return {
      src: `${TEAMS_ASSETS}/title-outline-my-team.svg`,
      width: 1303.876,
      height: 22.979,
      top: 163.81,
    };
  }

  if (label.includes('INVITES')) {
    return {
      src: `${TEAMS_ASSETS}/title-outline-invites.svg`,
      width: 1168.034,
      height: 22.504,
      top: 164.28,
    };
  }

  return {
    src: `${TEAMS_ASSETS}/title-outline-teams.svg`,
    width: 528.667,
    height: 20.269,
    top: 166.52,
  };
}

function TeamLogo({ url, name, size = 68 }: { url?: string | null; name: string; size?: number }) {
  const style: CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '999px',
    background: '#d9d9d9',
    overflow: 'hidden',
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#0f0404',
    fontFamily: F_BOLD,
    fontSize: `${Math.max(14, size * 0.28)}px`,
  };

  if (url) {
    return <img src={url} alt={name} style={{ ...style, objectFit: 'cover' }} />;
  }

  return <div style={style}>{name.slice(0, 1).toUpperCase()}</div>;
}

function PlayerAvatar({
  avatarUrl,
  username,
  size = 58,
}: {
  avatarUrl?: string | null;
  username: string;
  size?: number;
}) {
  const resolved = getDiscordAvatarUrl({ discord_avatar_url: avatarUrl ?? null });

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={username}
        style={{ width: size, height: size, borderRadius: 999, objectFit: 'cover', flex: '0 0 auto' }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: '#d9d9d9',
        color: '#282828',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: F_BOLD,
        fontSize: Math.max(14, size * 0.34),
        flex: '0 0 auto',
      }}
    >
      {getProfileInitial({ username })}
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  const outline = getTitleOutlineSpec(label);

  return (
    <div style={{ position: 'relative', height: 187, marginLeft: '-71px', marginBottom: '52px' }}>
      <img
        src={`${TEAMS_ASSETS}/title-triangles.svg`}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0, width: 124, height: 186 }}
      />
      <h1
        style={{
          position: 'absolute',
          left: 71,
          top: 77,
          margin: 0,
          fontFamily: F_HEAD,
          fontSize: '80px',
          lineHeight: '95px',
          fontWeight: 900,
          fontStyle: 'oblique',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </h1>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 59.76,
          top: outline.top,
          width: outline.width,
          height: outline.height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 18.421,
            height: outline.width,
            position: 'relative',
            flex: '0 0 auto',
            transform: 'rotate(89.8deg) scaleY(-1)',
          }}
        >
          <img
            src={outline.src}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      </div>
    </div>
  );
}

function ActionBar({
  view,
  onView,
  onCreate,
}: {
  view: TeamsView;
  onView: (view: TeamsView) => void;
  onCreate: () => void;
}) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
      <button
        type="button"
        onClick={() => onView('my')}
        style={{
          ...buttonBase,
          width: 187,
          borderColor: '#d8ff16',
          background: view === 'my' ? '#d8ff16' : 'rgba(216,255,22,0.2)',
          color: view === 'my' ? '#282828' : '#fff',
        }}
      >
        MY TEAM
      </button>
      <button
        type="button"
        onClick={() => onView('invites')}
        style={{
          ...buttonBase,
          width: 156,
          borderColor: '#625afa',
          background: view === 'invites' ? '#625afa' : 'rgba(98,90,250,0.2)',
        }}
      >
        INVITES
      </button>
      <button type="button" onClick={onCreate} style={{ ...buttonBase, width: 182 }}>
        <img src={`${TEAMS_ASSETS}/plus.svg`} alt="" aria-hidden="true" style={{ width: 18, height: 18 }} />
        CREATE
      </button>
    </div>
  );
}

function SearchBar({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label
      style={{
        width: 400,
        height: 47,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.15)',
        background: '#282828',
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px 0 18px',
        boxSizing: 'border-box',
        gap: 12,
      }}
    >
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search a team"
        style={{
          flex: 1,
          border: 0,
          outline: 'none',
          background: 'transparent',
          color: '#fff',
          fontFamily: F_REGULAR,
          fontSize: 20,
          minWidth: 0,
        }}
      />
      <img src={`${TEAMS_ASSETS}/search-icon.svg`} alt="" aria-hidden="true" style={{ width: 26, height: 26 }} />
    </label>
  );
}

function TableHeader({ mode }: { mode: 'teams' | 'members' | 'invites'; }) {
  if (mode === 'invites') {
    return null;
  }

  return (
    <div
      style={{
        height: 75,
        display: 'grid',
        gridTemplateColumns: mode === 'teams' ? '1.3fr 0.65fr 0.9fr 180px' : '1.25fr 0.65fr 0.8fr 190px',
        alignItems: 'center',
        padding: '0 49px',
        fontFamily: F_BOLD,
        fontSize: 24,
        textAlign: 'center',
      }}
    >
      <span>NAME</span>
      <span>{mode === 'teams' ? 'SIZE' : 'LVL'}</span>
      <span>WIN RATE</span>
      <span />
    </div>
  );
}

function TeamRow({
  team,
  onOpen,
}: {
  team: TeamPageRow;
  onOpen: (teamId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(team.id)}
      style={{
        width: '100%',
        minHeight: 107,
        border: 0,
        borderTop: '1px solid rgba(255,255,255,0.16)',
        background: 'transparent',
        color: '#fff',
        display: 'grid',
        gridTemplateColumns: '1.3fr 0.65fr 0.9fr 180px',
        alignItems: 'center',
        padding: '0 49px',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 39, minWidth: 0 }}>
        <TeamLogo url={team.logo_url} name={team.name} />
        <span style={{ fontFamily: F_BOLD, fontSize: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {team.name}
        </span>
      </span>
      <span style={{ fontFamily: F_BOLD, fontSize: 24, textAlign: 'center' }}>
        {team.member_count}/{team.max_members}
      </span>
      <span style={{ fontFamily: F_BOLD, fontSize: 24, textAlign: 'center' }}>{formatWinRate(team.win_rate)}</span>
      <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <span
          style={{
            ...buttonBase,
            width: 176,
            height: 47,
            fontSize: 18,
            pointerEvents: 'none',
            borderColor: team.current_user_status === 'pending' ? '#625afa' : '#ff1654',
            background: team.current_user_status === 'pending' ? 'rgba(98,90,250,0.18)' : 'rgba(255,22,84,0.2)',
            opacity: team.member_count >= team.max_members && team.current_user_status !== 'accepted' ? 0.55 : 1,
          }}
        >
          {getTeamRowActionLabel(team)}
        </span>
      </span>
    </button>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div
      style={{
        minHeight: 270,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: F_BOLD,
        fontSize: 24,
        color: 'rgba(255,255,255,0.55)',
        textTransform: 'uppercase',
      }}
    >
      {label}
    </div>
  );
}

function ModalShell({
  children,
  width = 903,
  height,
  onClose,
}: {
  children: ReactNode;
  width?: number;
  height?: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        background: 'rgba(15,4,4,0.78)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: 52,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'relative',
          width: `min(${width}px, calc(100vw - 48px))`,
          minHeight: height,
          border: '1px solid #ff1654',
          borderRadius: 8,
          background: '#282828',
          boxSizing: 'border-box',
          color: '#fff',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title }: { title: string }) {
  return (
    <>
      <h2
        style={{
          margin: 0,
          paddingTop: 29,
          textAlign: 'center',
          fontFamily: F_HEAD,
          fontSize: 53,
          fontWeight: 900,
          fontStyle: 'oblique',
          lineHeight: '64px',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h2>
      <div style={{ width: '79%', height: 1, background: '#fff', margin: '18px auto 0' }} />
    </>
  );
}

function CreateTeamModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [maxMembers, setMaxMembers] = useState(4);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!logoFile) {
      setPreview(null);
      return undefined;
    }

    const url = URL.createObjectURL(logoFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('You must be logged in');
      const trimmed = name.trim();
      if (trimmed.length < 2) throw new Error('Team name must be at least 2 characters');

      let logoUrl: string | null = null;
      if (logoFile) {
        const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from(TEAM_LOGO_BUCKET)
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type || 'image/png' });

        if (uploadError) throw new Error(uploadError.message);

        const { data } = supabase.storage.from(TEAM_LOGO_BUCKET).getPublicUrl(path);
        logoUrl = data.publicUrl;
      }

      const { data, error } = await supabase.rpc('create_team', {
        p_name: trimmed,
        p_max_members: maxMembers,
        p_logo_url: logoUrl,
      });

      if (error) throw new Error(error.message);
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error ?? 'Failed to create team');
      return result;
    },
    onSuccess: () => {
      toast({ title: 'Team created' });
      onCreated();
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create team', description: error.message, variant: 'destructive' });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate();
  };

  return (
    <ModalShell onClose={onClose} width={903} height={745}>
      <ModalHeader title="CREATE TEAM" />
      <form onSubmit={submit} style={{ width: 665, maxWidth: 'calc(100% - 96px)', margin: '58px auto 48px' }}>
        <p style={{ margin: '0 0 14px', fontFamily: F_REGULAR, fontSize: 24 }}>Team profile:</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              width: 132,
              height: 132,
              borderRadius: 999,
              border: 0,
              background: '#0f0f0f',
              color: '#fff',
              cursor: 'pointer',
              overflow: 'hidden',
              fontFamily: F_REGULAR,
              fontSize: 14,
            }}
          >
            {preview ? <img src={preview} alt="Team logo preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : 'Upload Icon'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
            hidden
            onChange={(event) => setLogoFile(event.target.files?.[0] ?? null)}
          />
          <div style={{ flex: 1 }}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Insert your team's name"
              style={{
                width: '100%',
                height: 59,
                borderRadius: 12,
                border: 0,
                background: '#0f0f0f',
                color: '#fff',
                fontFamily: F_REGULAR,
                fontSize: 20,
                padding: '0 24px',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            />
            <p style={{ margin: '7px 0 0', fontFamily: F_REGULAR, fontSize: 16, color: '#ff1654' }}>
              It must be unique !
            </p>
          </div>
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.25)', margin: '43px auto 12px', width: 400 }} />
        <p style={{ margin: '0 0 10px', fontFamily: F_REGULAR, fontSize: 24 }}>Team size:</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 100 }}>
          {[2, 3, 4].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMaxMembers(value)}
              style={{
                ...buttonBase,
                width: value === 4 ? 185 : 138,
                height: 59,
                borderColor: maxMembers === value ? '#ff1654' : 'transparent',
                background: maxMembers === value ? '#8b0732' : '#0f0f0f',
                fontSize: 27,
              }}
            >
              {getSizeLabel(value)}
            </button>
          ))}
        </div>
        <div style={{ height: 1, background: 'rgba(255,255,255,0.25)', margin: '30px auto 18px', width: 589 }} />
        <button
          type="submit"
          disabled={createMutation.isPending}
          style={{ ...buttonBase, width: 361, height: 69, margin: '0 auto', display: 'flex', fontSize: 32 }}
        >
          {createMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : 'CREATE TEAM'}
        </button>
      </form>
    </ModalShell>
  );
}

function MemberCard({
  member,
  canKick,
  onProfile,
  onKick,
}: {
  member: TeamPageMember;
  canKick: boolean;
  onProfile: (userId: string) => void;
  onKick?: (userId: string) => void;
}) {
  return (
    <div
      style={{
        width: 368,
        height: 87,
        borderRadius: 8,
        border: '1px solid #ff1654',
        background: '#282828',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px 0 26px',
        boxSizing: 'border-box',
        gap: 15,
      }}
    >
      <PlayerAvatar avatarUrl={member.discord_avatar_url ?? member.avatar_url} username={member.username} />
      <div style={{ minWidth: 0, flex: 1 }}>
        <button
          type="button"
          onClick={() => onProfile(member.user_id)}
          style={{
            border: 0,
            background: 'transparent',
            padding: 0,
            color: '#ff1654',
            fontFamily: F_BOLD,
            fontSize: 20,
            cursor: 'pointer',
            display: 'block',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {member.username}
        </button>
        <p style={{ margin: 0, fontFamily: F_REGULAR, fontSize: 13, color: '#fff', opacity: 0.75 }}>
          {member.epic_username ?? 'Unknown'} <span style={{ fontSize: 10 }}>EPIC</span>
        </p>
      </div>
      {canKick && onKick ? (
        <button type="button" onClick={() => onKick(member.user_id)} style={{ ...buttonBase, width: 96, height: 36, fontSize: 16 }}>
          KICK
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onProfile(member.user_id)}
          aria-label={`Open ${member.username} profile`}
          style={{
            width: 47,
            height: 47,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.7)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: 24,
          }}
        >
          -
        </button>
      )}
    </div>
  );
}

function InvitePlayerModal({
  teamId,
  onClose,
  onInvited,
}: {
  teamId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const { toast } = useToast();
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<InviteSearchUser[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (term.trim().length < 2) {
      setResults([]);
      return undefined;
    }

    setLoading(true);
    const timer = window.setTimeout(async () => {
      const { data, error } = await supabase.rpc('search_users_for_invite', {
        p_team_id: teamId,
        p_search_term: term.trim(),
      });
      if (!active) return;
      setLoading(false);
      if (error) {
        toast({ title: 'Search failed', description: error.message, variant: 'destructive' });
        return;
      }
      setResults((data ?? []) as InviteSearchUser[]);
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [teamId, term, toast]);

  const sendInvite = async (userId: string) => {
    const { data, error } = await supabase.rpc('send_team_invite', {
      p_team_id: teamId,
      p_invitee_user_id: userId,
    });
    if (error) {
      toast({ title: 'Invite failed', description: error.message, variant: 'destructive' });
      return;
    }
    const result = data as { success?: boolean; error?: string } | null;
    if (!result?.success) {
      toast({ title: 'Invite failed', description: result?.error ?? 'Unable to send invite', variant: 'destructive' });
      return;
    }
    toast({ title: 'Invite sent' });
    onInvited();
    onClose();
  };

  return (
    <ModalShell onClose={onClose} width={560}>
      <div style={{ padding: 32 }}>
        <h2 style={{ margin: 0, fontFamily: F_HEAD, fontSize: 42, fontStyle: 'oblique' }}>INVITE PLAYER</h2>
        <input
          autoFocus
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search username or Epic"
          style={{
            marginTop: 24,
            width: '100%',
            height: 48,
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            background: '#111',
            color: '#fff',
            padding: '0 16px',
            fontFamily: F_REGULAR,
            fontSize: 18,
            outline: 'none',
          }}
        />
        <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
          {loading && <p style={{ fontFamily: F_REGULAR }}>Searching...</p>}
          {!loading && results.map((player) => (
            <button
              key={player.user_id}
              type="button"
              onClick={() => sendInvite(player.user_id)}
              style={{
                minHeight: 64,
                borderRadius: 8,
                border: '1px solid rgba(255,22,84,0.5)',
                background: '#1b1b1b',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0 14px',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <PlayerAvatar avatarUrl={player.avatar_url} username={player.username} size={44} />
              <span style={{ fontFamily: F_BOLD, fontSize: 18 }}>{player.username}</span>
              <span style={{ marginLeft: 'auto', fontFamily: F_REGULAR, fontSize: 14, opacity: 0.7 }}>{player.epic_username ?? 'No Epic'}</span>
            </button>
          ))}
          {!loading && term.trim().length >= 2 && results.length === 0 && (
            <p style={{ fontFamily: F_REGULAR, color: 'rgba(255,255,255,0.55)' }}>No players found</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function TeamViewModal({
  teamId,
  onClose,
  onChanged,
  onProfile,
}: {
  teamId: string;
  onClose: () => void;
  onChanged: () => void;
  onProfile: (userId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [inviteOpen, setInviteOpen] = useState(false);
  const detailQuery = useQuery({
    queryKey: queryKeys.teams.detail(teamId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_detail', { p_team_id: teamId });
      if (error) throw new Error(error.message);
      const result = normalizeDetail(data as TeamDetailResult);
      if (!result.success) throw new Error(result.error ?? 'Team not found');
      return result;
    },
  });

  const requestMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('request_join_team', { p_team_id: teamId });
      if (error) throw new Error(error.message);
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error ?? 'Unable to request team');
    },
    onSuccess: () => {
      toast({ title: 'Join request sent' });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
      onChanged();
    },
    onError: (error: Error) => toast({ title: 'Request failed', description: error.message, variant: 'destructive' }),
  });

  const team = detailQuery.data?.team;
  const members = detailQuery.data?.members ?? [];
  const emptySlots = Math.max(0, (team?.max_members ?? 4) - members.length);

  return (
    <>
      <ModalShell onClose={onClose} width={903} height={800}>
        {detailQuery.isPending ? (
          <div style={{ minHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : team ? (
          <>
            <ModalHeader title={team.name} />
            <div style={{ width: 368, margin: '68px auto 0', display: 'grid', gap: 23 }}>
              {members.map((member) => (
                <MemberCard key={member.user_id} member={member} canKick={false} onProfile={onProfile} />
              ))}
              {Array.from({ length: emptySlots }).map((_, index) => (
                <button
                  key={`empty-${index}`}
                  type="button"
                  onClick={() => team.can_manage && setInviteOpen(true)}
                  disabled={!team.can_manage}
                  style={{
                    width: 368,
                    height: 87,
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.35)',
                    background: '#282828',
                    color: '#fff',
                    cursor: team.can_manage ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: team.can_manage ? 1 : 0.55,
                  }}
                  aria-label="Invite player"
                >
                  <span style={{ width: 52, height: 52, borderRadius: 999, border: '1px dashed rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>+</span>
                </button>
              ))}
            </div>
            <div style={{ width: 589, height: 1, background: 'rgba(255,255,255,0.35)', margin: '26px auto 18px' }} />
            <button
              type="button"
              onClick={() => team.can_request && requestMutation.mutate()}
              disabled={!team.can_request || requestMutation.isPending}
              style={{
                ...buttonBase,
                width: 361,
                height: 69,
                margin: '0 auto',
                display: 'flex',
                fontSize: 32,
                opacity: team.can_request ? 1 : 0.55,
                cursor: team.can_request ? 'pointer' : 'default',
              }}
            >
              {requestMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : team.can_request ? 'JOIN TEAM' : getStatusLabel(team.current_user_status)}
            </button>
          </>
        ) : (
          <EmptyState label="Team not found" />
        )}
      </ModalShell>
      {inviteOpen && (
        <InvitePlayerModal
          teamId={teamId}
          onClose={() => setInviteOpen(false)}
          onInvited={() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.teams.detail(teamId) });
            onChanged();
          }}
        />
      )}
    </>
  );
}

function InvitesPanel({
  tab,
  onTab,
  invites,
  onRespond,
}: {
  tab: InvitesTab;
  onTab: (tab: InvitesTab) => void;
  invites: TeamInvitesResult | undefined;
  onRespond: (row: TeamInviteRow, action: 'accept' | 'decline') => void;
}) {
  const rows = tab === 'sent' ? invites?.sent ?? [] : invites?.received ?? [];

  return (
    <div style={panelStyle}>
      <div style={{ height: 75, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 220, fontFamily: F_BOLD, fontSize: 20 }}>
        <button type="button" onClick={() => onTab('sent')} style={{ border: 0, background: 'transparent', color: '#fff', opacity: tab === 'sent' ? 1 : 0.55, fontFamily: F_BOLD, fontSize: 20, cursor: 'pointer', borderBottom: tab === 'sent' ? '2px solid #ff1654' : '2px solid transparent', paddingBottom: 12 }}>
          SENT
        </button>
        <button type="button" onClick={() => onTab('received')} style={{ border: 0, background: 'transparent', color: '#fff', opacity: tab === 'received' ? 1 : 0.55, fontFamily: F_BOLD, fontSize: 20, cursor: 'pointer', borderBottom: tab === 'received' ? '2px solid #ff1654' : '2px solid transparent', paddingBottom: 12 }}>
          RECEIVED
        </button>
      </div>
      {rows.length === 0 ? (
        <EmptyState label={`No ${tab} invites`} />
      ) : (
        rows.map((row) => {
          const primary = row.kind === 'invite' && tab === 'received' ? row.team_name : row.target_username;
          const secondary = row.kind === 'request' ? row.team_name : row.target_epic_username;
          return (
            <div
              key={`${row.kind}-${row.id}`}
              style={{
                minHeight: 107,
                borderTop: '1px solid rgba(255,255,255,0.16)',
                display: 'grid',
                gridTemplateColumns: '1.3fr 0.65fr 0.9fr 190px',
                alignItems: 'center',
                padding: '0 49px',
                boxSizing: 'border-box',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 39, minWidth: 0 }}>
                {row.kind === 'invite' && tab === 'received'
                  ? <TeamLogo url={row.team_logo_url} name={row.team_name} />
                  : <PlayerAvatar avatarUrl={row.target_avatar_url} username={primary} size={68} />}
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: F_BOLD, fontSize: 24, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary}</span>
                  {secondary && <span style={{ display: 'block', fontFamily: F_REGULAR, fontSize: 14, color: 'rgba(255,255,255,0.62)' }}>{secondary}</span>}
                </span>
              </span>
              <span style={{ fontFamily: F_BOLD, fontSize: 24, textAlign: 'center' }}>
                LVL.{getLevel(row.target_total_xp ?? 0)}
              </span>
              <span style={{ fontFamily: F_BOLD, fontSize: 24, textAlign: 'center' }}>{formatWinRate(row.win_rate)}</span>
              <span style={{ display: 'flex', justifyContent: 'flex-end', gap: 13 }}>
                {tab === 'received' && row.status === 'pending' ? (
                  <>
                    <button type="button" aria-label={`Decline ${primary}`} onClick={() => onRespond(row, 'decline')} style={{ width: 47, height: 47, borderRadius: 8, border: 0, background: '#8b0732', color: '#fff', fontFamily: F_BOLD, fontSize: 26, cursor: 'pointer' }}>x</button>
                    <button type="button" aria-label={`Accept ${primary}`} onClick={() => onRespond(row, 'accept')} style={{ width: 47, height: 47, borderRadius: 8, border: 0, background: '#ff1654', color: '#fff', fontFamily: F_BOLD, fontSize: 16, cursor: 'pointer' }}>OK</button>
                  </>
                ) : (
                  <span style={{ ...buttonBase, width: 176, height: 47, fontSize: 20, opacity: row.status === 'rejected' ? 0.55 : 1 }}>{getStatusLabel(row.status)}</span>
                )}
              </span>
            </div>
          );
        })
      )}
    </div>
  );
}

function MyTeamPanel({
  details,
  selectedTeamId,
  onSelectTeam,
  onKick,
  onProfile,
  onInvite,
}: {
  details: TeamDetailResult[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  onKick: (teamId: string, userId: string) => void;
  onProfile: (userId: string) => void;
  onInvite: (teamId: string) => void;
}) {
  const selected = details.find((detail) => detail.team?.id === selectedTeamId) ?? details[0];
  const team = selected?.team;
  const members = selected?.members ?? [];

  if (!team) {
    return <div style={panelStyle}><EmptyState label="No team yet" /></div>;
  }

  return (
    <div style={panelStyle}>
      {details.length > 1 && (
        <div style={{ display: 'flex', gap: 10, padding: '16px 49px 0', flexWrap: 'wrap' }}>
          {details.map((detail) => detail.team && (
            <button
              key={detail.team.id}
              type="button"
              onClick={() => onSelectTeam(detail.team!.id)}
              style={{
                ...buttonBase,
                height: 36,
                fontSize: 15,
                borderRadius: 8,
                background: detail.team.id === team.id ? '#d8ff16' : 'rgba(216,255,22,0.15)',
                borderColor: '#d8ff16',
                color: detail.team.id === team.id ? '#282828' : '#fff',
              }}
            >
              {detail.team.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ height: details.length > 1 ? 59 : 75, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F_BOLD, fontSize: 18 }}>
        {team.name} - MANAGE
      </div>
      {members.map((member) => (
        <div
          key={member.user_id}
          style={{
            minHeight: 107,
            borderTop: '1px solid rgba(255,255,255,0.16)',
            display: 'grid',
            gridTemplateColumns: '1.3fr 0.65fr 0.9fr 190px',
            alignItems: 'center',
            padding: '0 49px',
            boxSizing: 'border-box',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 39, minWidth: 0 }}>
            <PlayerAvatar avatarUrl={member.discord_avatar_url ?? member.avatar_url} username={member.username} size={68} />
            <button
              type="button"
              onClick={() => onProfile(member.user_id)}
              style={{
                border: 0,
                background: 'transparent',
                color: '#fff',
                fontFamily: F_BOLD,
                fontSize: 24,
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {member.username}
            </button>
          </span>
          <span style={{ fontFamily: F_BOLD, fontSize: 24, textAlign: 'center' }}>LVL.{getLevel(member.total_xp ?? 0)}</span>
          <span style={{ fontFamily: F_BOLD, fontSize: 24, textAlign: 'center' }}>{formatWinRate(team.win_rate)}</span>
          <span style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {team.can_kick && member.user_id !== team.owner_id ? (
              <button type="button" onClick={() => onKick(team.id, member.user_id)} style={{ ...buttonBase, width: 176, height: 47 }}>
                KICK
              </button>
            ) : (
              <span style={{ color: 'rgba(255,255,255,0.45)', fontFamily: F_BOLD, fontSize: 18 }}>{member.role.toUpperCase()}</span>
            )}
          </span>
        </div>
      ))}
      {team.can_manage && members.length < team.max_members && (
        <div style={{ minHeight: 92, borderTop: '1px solid rgba(255,255,255,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button type="button" onClick={() => onInvite(team.id)} style={{ ...buttonBase, width: 260 }}>
            INVITE PLAYER
          </button>
        </div>
      )}
    </div>
  );
}

export default function Teams() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<TeamsView>('list');
  const [invitesTab, setInvitesTab] = useState<InvitesTab>('sent');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search, 250);

  const teamsQuery = useQuery({
    queryKey: queryKeys.teams.page(debouncedSearch, user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_teams_page', {
        p_search: debouncedSearch,
        p_limit: 10,
        p_offset: 0,
      });
      if (error) throw new Error(error.message);
      const result = data as TeamsPageResult | null;
      if (!result?.success) throw new Error(result?.error ?? 'Failed to load teams');
      return (result.teams ?? []).map(normalizeTeam);
    },
  });

  const invitesQuery = useQuery({
    queryKey: user ? queryKeys.teams.invites(user.id) : ['teams', 'invites', 'guest'],
    enabled: Boolean(user) && view === 'invites',
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_team_invites');
      if (error) throw new Error(error.message);
      const result = data as TeamInvitesResult | null;
      if (!result?.success) throw new Error(result?.error ?? 'Failed to load invites');
      return result;
    },
  });

  const myTeamsQuery = useQuery({
    queryKey: user ? queryKeys.teams.my(user.id) : ['teams', 'my', 'guest'],
    enabled: Boolean(user) && view === 'my',
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      if (error) throw new Error(error.message);
      const teamIds = Array.from(new Set((data ?? []).map((row: { team_id: string }) => row.team_id)));
      const details = await Promise.all(
        teamIds.map(async (teamId) => {
          const { data: detailData, error: detailError } = await supabase.rpc('get_team_detail', { p_team_id: teamId });
          if (detailError) throw new Error(detailError.message);
          return normalizeDetail(detailData as TeamDetailResult);
        }),
      );
      return details.filter((detail) => detail.success && detail.team);
    },
  });

  useEffect(() => {
    if (view === 'my' && !selectedTeamId && myTeamsQuery.data?.[0]?.team?.id) {
      setSelectedTeamId(myTeamsQuery.data[0].team.id);
    }
  }, [myTeamsQuery.data, selectedTeamId, view]);

  const respondMutation = useMutation({
    mutationFn: async ({ row, action }: { row: TeamInviteRow; action: 'accept' | 'decline' }) => {
      const rpc = row.kind === 'invite'
        ? supabase.rpc('respond_to_invite', { p_team_id: row.team_id, p_action: action })
        : supabase.rpc('respond_to_team_request', { p_team_id: row.team_id, p_user_id: row.target_user_id, p_action: action });
      const { data, error } = await rpc;
      if (error) throw new Error(error.message);
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error ?? 'Failed to update invite');
    },
    onSuccess: () => {
      toast({ title: 'Invite updated' });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
    },
    onError: (error: Error) => toast({ title: 'Invite failed', description: error.message, variant: 'destructive' }),
  });

  const kickMutation = useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }) => {
      const { data, error } = await supabase.rpc('remove_team_member', { p_team_id: teamId, p_user_id: userId });
      if (error) throw new Error(error.message);
      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) throw new Error(result?.error ?? 'Failed to remove member');
    },
    onSuccess: () => {
      toast({ title: 'Member removed' });
      queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
    },
    onError: (error: Error) => toast({ title: 'Kick failed', description: error.message, variant: 'destructive' }),
  });

  const title = view === 'list' ? 'TEAMS' : view === 'invites' ? 'TEAMS - INVITES' : 'TEAMS - MY TEAM';

  const panel = useMemo(() => {
    if (view === 'invites') {
      if (!user) return <div style={panelStyle}><EmptyState label="Login to see invites" /></div>;
      if (invitesQuery.isPending) return <div style={panelStyle}><EmptyState label="Loading invites" /></div>;
      return (
        <InvitesPanel
          tab={invitesTab}
          onTab={setInvitesTab}
          invites={invitesQuery.data}
          onRespond={(row, action) => respondMutation.mutate({ row, action })}
        />
      );
    }

    if (view === 'my') {
      if (!user) return <div style={panelStyle}><EmptyState label="Login to see your teams" /></div>;
      if (myTeamsQuery.isPending) return <div style={panelStyle}><EmptyState label="Loading my team" /></div>;
      return (
        <MyTeamPanel
          details={myTeamsQuery.data ?? []}
          selectedTeamId={selectedTeamId}
          onSelectTeam={setSelectedTeamId}
          onKick={(teamId, memberUserId) => kickMutation.mutate({ teamId, userId: memberUserId })}
          onProfile={setProfileUserId}
          onInvite={setInviteTeamId}
        />
      );
    }

    return (
      <div style={panelStyle}>
        <TableHeader mode="teams" />
        {teamsQuery.isPending ? (
          <EmptyState label="Loading teams" />
        ) : teamsQuery.data && teamsQuery.data.length > 0 ? (
          teamsQuery.data.map((team) => <TeamRow key={team.id} team={team} onOpen={setSelectedTeamId} />)
        ) : (
          <EmptyState label="No teams found" />
        )}
      </div>
    );
  }, [
    invitesQuery.data,
    invitesQuery.isPending,
    invitesTab,
    kickMutation,
    myTeamsQuery.data,
    myTeamsQuery.isPending,
    respondMutation,
    selectedTeamId,
    teamsQuery.data,
    teamsQuery.isPending,
    user,
    view,
  ]);

  return (
    <PublicLayout>
      <div style={pageWrap}>
        <img
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 146, objectFit: 'cover', pointerEvents: 'none' }}
        />
        <img
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', left: 0, top: 827, width: '100%', height: 146, objectFit: 'cover', transform: 'scaleY(-1)', pointerEvents: 'none' }}
        />
        <div style={mainShell}>
          <SectionTitle label={title} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 53 }}>
            <SearchBar value={search} onChange={setSearch} />
            <ActionBar view={view} onView={setView} onCreate={() => setCreateOpen(true)} />
          </div>
          {panel}
          <button
            type="button"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: queryKeys.teams.all });
              toast({ title: 'Teams refreshed' });
            }}
            style={{
              ...buttonBase,
              width: 235,
              height: 65,
              borderRadius: 50,
              margin: '52px auto 50px',
              display: 'flex',
              fontFamily: F_REGULAR,
              fontSize: 24,
            }}
          >
            REFRESH
            <img src={`${TEAMS_ASSETS}/arrow-stroke.svg`} alt="" aria-hidden="true" style={{ width: 16, height: 21, transform: 'rotate(-90deg)' }} />
          </button>
        </div>
        <FooterSection />
      </div>
      {createOpen && (
        <CreateTeamModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: queryKeys.teams.all })}
        />
      )}
      {view === 'list' && selectedTeamId && (
        <TeamViewModal
          teamId={selectedTeamId}
          onClose={() => setSelectedTeamId(null)}
          onChanged={() => queryClient.invalidateQueries({ queryKey: queryKeys.teams.all })}
          onProfile={setProfileUserId}
        />
      )}
      {inviteTeamId && (
        <InvitePlayerModal
          teamId={inviteTeamId}
          onClose={() => setInviteTeamId(null)}
          onInvited={() => queryClient.invalidateQueries({ queryKey: queryKeys.teams.all })}
        />
      )}
      <PlayerStatsModal
        open={Boolean(profileUserId)}
        userId={profileUserId ?? ''}
        onOpenChange={(open) => {
          if (!open) setProfileUserId(null);
        }}
      />
    </PublicLayout>
  );
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}
