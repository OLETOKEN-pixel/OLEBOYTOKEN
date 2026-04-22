import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Teams from '@/pages/Teams';

const {
  authState,
  fromMock,
  rpcMock,
  storageFromMock,
  toastMock,
} = vi.hoisted(() => ({
  authState: {
    value: {
      user: { id: 'user-current' },
      profile: { user_id: 'user-current', username: 'Owner' },
      wallet: { balance: 10 },
    },
  },
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
  storageFromMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/components/layout/PublicLayout', () => ({
  PublicLayout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/home/sections/FooterSection', () => ({
  FooterSection: () => <footer data-testid="teams-footer" />,
}));

vi.mock('@/components/player/PlayerStatsModal', () => ({
  PlayerStatsModal: ({ open, userId }: { open: boolean; userId: string }) => (
    open ? <div data-testid="mock-player-profile">PROFILE VIEW {userId}</div> : null
  ),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => authState.value,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
    storage: {
      from: storageFromMock,
    },
  },
}));

const teamsPayload = {
  success: true,
  teams: [
    {
      id: 'team-red',
      name: 'Redline',
      tag: 'RED',
      logo_url: null,
      max_members: 4,
      owner_id: 'user-owner',
      created_at: '2026-04-22T10:00:00.000Z',
      member_count: 2,
      total_matches: 4,
      wins: 3,
      losses: 1,
      win_rate: 75,
      current_user_status: null,
      can_request: true,
    },
    {
      id: 'team-full',
      name: 'Full Stack',
      tag: 'FULL',
      logo_url: null,
      max_members: 3,
      owner_id: 'user-full',
      created_at: '2026-04-22T10:00:00.000Z',
      member_count: 3,
      total_matches: 0,
      wins: 0,
      losses: 0,
      win_rate: 0,
      current_user_status: 'accepted',
      can_request: false,
    },
  ],
};

const detailPayload = {
  success: true,
  team: {
    id: 'team-red',
    name: 'Redline',
    tag: 'RED',
    logo_url: null,
    owner_id: 'user-owner',
    max_members: 4,
    member_count: 2,
    total_matches: 4,
    wins: 3,
    losses: 1,
    win_rate: 75,
    current_user_role: null,
    current_user_status: null,
    can_manage: false,
    can_kick: false,
    can_request: true,
  },
  members: [
    {
      id: 'member-owner',
      team_id: 'team-red',
      user_id: 'user-owner',
      role: 'owner',
      status: 'accepted',
      created_at: '2026-04-22T10:00:00.000Z',
      username: 'Owner',
      avatar_url: null,
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-owner/avatar.png',
      epic_username: 'OwnerEpic',
      total_xp: 1200,
    },
  ],
};

const managedDetailPayload = {
  success: true,
  team: {
    ...detailPayload.team,
    current_user_role: 'owner',
    current_user_status: 'accepted',
    can_manage: true,
    can_kick: true,
    can_request: false,
  },
  members: [
    detailPayload.members[0],
    {
      id: 'member-mary',
      team_id: 'team-red',
      user_id: 'user-mary',
      role: 'member',
      status: 'accepted',
      created_at: '2026-04-22T10:01:00.000Z',
      username: 'Mary',
      avatar_url: null,
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-mary/avatar.png',
      epic_username: 'MaryEpic',
      total_xp: 2500,
    },
  ],
};

const invitesPayload = {
  success: true,
  sent: [
    {
      id: 'sent-1',
      kind: 'invite',
      team_id: 'team-red',
      team_name: 'Redline',
      team_logo_url: null,
      target_user_id: 'user-sent',
      target_username: 'SentPlayer',
      target_avatar_url: null,
      target_epic_username: 'SentEpic',
      target_total_xp: 0,
      status: 'pending',
      created_at: '2026-04-22T10:02:00.000Z',
      win_rate: 75,
    },
  ],
  received: [
    {
      id: 'request-1',
      kind: 'request',
      team_id: 'team-red',
      team_name: 'Redline',
      team_logo_url: null,
      target_user_id: 'user-mary',
      target_username: 'Mary',
      target_avatar_url: 'https://cdn.discordapp.com/avatars/user-mary/avatar.png',
      target_epic_username: 'MaryEpic',
      target_total_xp: 2500,
      status: 'pending',
      created_at: '2026-04-22T10:03:00.000Z',
      win_rate: 75,
    },
  ],
};

function thenableQuery(result: unknown) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return chain;
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderTeams() {
  return render(<Teams />, { wrapper: createWrapper() });
}

describe('Teams page', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    storageFromMock.mockReset();
    toastMock.mockReset();

    fromMock.mockReturnValue(thenableQuery({ data: [{ team_id: 'team-red' }], error: null }));
    storageFromMock.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage/team-logo.png' } }),
    });
    rpcMock.mockImplementation(async (name: string) => {
      if (name === 'get_teams_page') return { data: teamsPayload, error: null };
      if (name === 'get_team_detail') return { data: detailPayload, error: null };
      if (name === 'get_team_invites') return { data: invitesPayload, error: null };
      if (name === 'create_team') return { data: { success: true, team_id: 'team-new' }, error: null };
      if (name === 'request_join_team') return { data: { success: true }, error: null };
      if (name === 'respond_to_team_request') return { data: { success: true }, error: null };
      if (name === 'respond_to_invite') return { data: { success: true }, error: null };
      if (name === 'remove_team_member') return { data: { success: true }, error: null };
      return { data: { success: true }, error: null };
    });
  });

  it('renders the public team list with search, refresh and Figma actions', async () => {
    renderTeams();

    expect(await screen.findByText('Redline')).toBeInTheDocument();
    expect(screen.getByText('2/4')).toBeInTheDocument();
    expect(screen.getByText('75.00%')).toBeInTheDocument();
    expect(screen.getByText('REQUEST JOIN')).toBeInTheDocument();
    expect(screen.getByText('VIEW TEAM')).toBeInTheDocument();
    expect(screen.queryByText('ACCEPTED')).not.toBeInTheDocument();
    expect(document.querySelector('img[src="/figma-assets/teams/title-outline-teams.svg"]')).not.toBeNull();
    expect(screen.getByRole('textbox')).toHaveAttribute('placeholder', 'Search a team');
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    expect(screen.getByTestId('teams-footer')).toBeInTheDocument();
  });

  it('creates a Trio team through the create modal', async () => {
    renderTeams();

    fireEvent.click(await screen.findByRole('button', { name: /^CREATE$/i }));
    fireEvent.change(screen.getByPlaceholderText("Insert your team's name"), { target: { value: 'New Squad' } });
    fireEvent.click(screen.getByRole('button', { name: 'Trio' }));
    fireEvent.click(screen.getByRole('button', { name: 'CREATE TEAM' }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('create_team', {
        p_name: 'New Squad',
        p_max_members: 3,
        p_logo_url: null,
      });
    });
  });

  it('opens team detail and sends a public join request', async () => {
    renderTeams();

    fireEvent.click(await screen.findByText('Redline'));
    fireEvent.click(await screen.findByRole('button', { name: 'JOIN TEAM' }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('request_join_team', { p_team_id: 'team-red' });
    });
  });

  it('shows received requests and lets managers accept them', async () => {
    renderTeams();

    fireEvent.click(await screen.findByRole('button', { name: 'INVITES' }));
    expect(document.querySelector('img[src="/figma-assets/teams/title-outline-invites.svg"]')).not.toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'RECEIVED' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Accept Mary' }));

    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('respond_to_team_request', {
        p_team_id: 'team-red',
        p_user_id: 'user-mary',
        p_action: 'accept',
      });
    });
  });

  it('shows my team members and opens member profile view', async () => {
    rpcMock.mockImplementation(async (name: string) => {
      if (name === 'get_teams_page') return { data: teamsPayload, error: null };
      if (name === 'get_team_detail') return { data: managedDetailPayload, error: null };
      return { data: { success: true }, error: null };
    });

    renderTeams();

    fireEvent.click(await screen.findByRole('button', { name: 'MY TEAM' }));
    expect(document.querySelector('img[src="/figma-assets/teams/title-outline-my-team.svg"]')).not.toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Mary' }));

    expect(await screen.findByTestId('mock-player-profile')).toHaveTextContent('PROFILE VIEW user-mary');
  });
});
