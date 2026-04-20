import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MatchDetail from '@/pages/MatchDetail';
import type { Match, MatchParticipant } from '@/types';

const writeTextMock = vi.fn();

const {
  authState,
  matchState,
  setReadyMock,
  submitResultMock,
  cancelMatchMock,
  toastMock,
} = vi.hoisted(() => ({
  authState: {
    value: {
      user: { id: 'user-a-1' } as { id: string } | null,
    },
  },
  matchState: {
    value: {
      data: null as Match | null,
      isPending: false,
      error: null as unknown,
    },
  },
  setReadyMock: vi.fn(),
  submitResultMock: vi.fn(),
  cancelMatchMock: vi.fn(),
  toastMock: vi.fn(),
}));

vi.mock('@/components/layout/NavbarFigmaLoggedIn', () => ({
  NavbarFigmaLoggedIn: () => <nav data-testid="navbar-figma-logged-in" />,
}));

vi.mock('@/components/matches/MatchChat', () => ({
  MatchChat: ({ variant, matchId }: { variant?: string; matchId: string }) => (
    <div data-testid="mock-match-chat" data-variant={variant} data-match-id={matchId} />
  ),
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

vi.mock('@/hooks/useMatches', () => ({
  useMatchDetail: () => matchState.value,
  useSetPlayerReady: () => ({ mutateAsync: setReadyMock, isPending: false }),
  useSubmitResult: () => ({ mutateAsync: submitResultMock, isPending: false }),
  useCancelMatch: () => ({ mutateAsync: cancelMatchMock, isPending: false }),
}));

function participantFactory(overrides: Partial<MatchParticipant>): MatchParticipant {
  return {
    id: 'participant-1',
    match_id: 'match-ready',
    user_id: 'user-a-1',
    team_id: null,
    team_side: 'A',
    ready: false,
    ready_at: null,
    result_choice: null,
    result_at: null,
    status: 'joined',
    joined_at: '2026-04-18T10:00:00.000Z',
    profile: {
      username: 'Host',
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
      epic_username: 'HostEpic',
    },
    ...overrides,
  };
}

function todayAtLobbyTime(): string {
  const date = new Date();
  date.setHours(17, 23, 0, 0);
  return date.toISOString();
}

function matchFactory(participants: MatchParticipant[]): Match {
  return {
    id: 'match-ready',
    creator_id: 'user-a-1',
    game: 'Fortnite',
    region: 'EU',
    platform: 'All',
    mode: 'Box Fight',
    team_size: 3,
    first_to: 5,
    entry_fee: 0.5,
    is_private: false,
    private_code: '1111 - 2222 - 333',
    status: 'ready_check',
    expires_at: null,
    started_at: null,
    finished_at: null,
    created_at: todayAtLobbyTime(),
    creator: {
      username: 'Host',
      discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
      epic_username: 'HostEpic',
    },
    participants,
  } as Match;
}

function renderMatchDetail(children?: ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/matches/match-ready']}>
      <Routes>
        <Route path="/matches/:id" element={<MatchDetail />} />
        <Route path="/matches" element={<div>Matches page</div>} />
        <Route path="/rules" element={children ?? <div>Rules page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MatchDetail ready-up Figma lobby', () => {
  beforeEach(() => {
    setReadyMock.mockReset();
    setReadyMock.mockResolvedValue(undefined);
    submitResultMock.mockReset();
    cancelMatchMock.mockReset();
    toastMock.mockReset();
    writeTextMock.mockReset();
    writeTextMock.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });
    authState.value = { user: { id: 'user-a-1' } };
    matchState.value = {
      data: matchFactory([
        participantFactory({
          id: 'participant-a-1',
          user_id: 'user-a-1',
          team_side: 'A',
          profile: {
            username: 'Host',
            discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
            epic_username: 'HostEpic',
          },
        }),
        participantFactory({
          id: 'participant-b-1',
          user_id: 'user-b-1',
          team_side: 'B',
          profile: {
            username: 'Opponent',
            discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
            epic_username: 'OpponentEpic',
          },
        }),
      ]),
      isPending: false,
      error: null,
    };
  });

  it('renders the ready-up lobby with Figma chat, status, players, and ready count', () => {
    renderMatchDetail();

    expect(screen.getByTestId('match-ready-lobby')).toBeInTheDocument();
    expect(screen.getByText('3V3 BOXFIGHT')).toBeInTheDocument();
    expect(screen.getByText('Entry:')).toBeInTheDocument();
    expect(screen.getByText('0.50')).toBeInTheDocument();
    expect(screen.getByText('Prize:')).toBeInTheDocument();
    expect(screen.getByText('2.85')).toBeInTheDocument();
    expect(screen.getByText('First to:')).toBeInTheDocument();
    expect(screen.getByText('5+2')).toBeInTheDocument();
    expect(screen.getByText('Platform:')).toBeInTheDocument();
    expect(screen.getByText('ANY')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy map code 2640-2394-7508' })).toBeInTheDocument();
    expect(screen.getByText('Today, 5:23PM')).toBeInTheDocument();
    expect(screen.getByText('MATCH CHAT')).toBeInTheDocument();
    expect(screen.getByText('CREATED')).toBeInTheDocument();
    expect(screen.getByText('STARTED')).toBeInTheDocument();
    expect(screen.getByText('FINISHED')).toBeInTheDocument();
    expect(screen.getByTestId('match-ready-vs')).toBeInTheDocument();
    expect(screen.getByTestId('match-ready-vs-stroke')).toHaveStyle({
      backgroundColor: 'transparent',
      backgroundImage: 'linear-gradient(180.075deg, #FFFFFF 0%, #0F0404 100%)',
    });
    expect(screen.getByTestId('match-ready-vs-text')).toHaveStyle({
      backgroundColor: 'transparent',
      backgroundImage: 'linear-gradient(180.075deg, rgb(15, 4, 4) 10.117%, rgb(255, 255, 255) 99.722%)',
    });
    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByAltText('Match creator')).toBeInTheDocument();
    expect(screen.queryByText('Opponent')).not.toBeInTheDocument();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'READY (0/6)' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'SEE RULES' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'SEE RULES' })).toHaveStyle({ left: 'calc(36.667% - 244px)' });
    expect(screen.getByTestId('mock-match-chat')).toHaveAttribute('data-variant', 'figmaReady');
  });

  it('keeps the host identity hidden from opponents through ready-up', () => {
    authState.value = { user: { id: 'user-b-1' } };

    renderMatchDetail();

    expect(screen.getByText('Opponent')).toBeInTheDocument();
    expect(screen.queryByText('Host')).not.toBeInTheDocument();
    expect(screen.queryByText('HostEpic')).not.toBeInTheDocument();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(screen.queryByAltText('Match creator')).not.toBeInTheDocument();
  });

  it('copies the mode map code from the Figma lobby header', async () => {
    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Copy map code 2640-2394-7508' }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('2640-2394-7508');
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Map code copied',
      description: '2640-2394-7508',
    }));
  });

  it('opens Box Fight rules in the lobby overlay without navigating away', () => {
    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'SEE RULES' }));

    expect(screen.getByRole('dialog', { name: 'MATCH RULES' })).toBeInTheDocument();
    expect(screen.getByTestId('match-rules-content')).toHaveStyle({ overflow: 'hidden' });
    expect(screen.getByText('BOXFIGHT')).toBeInTheDocument();
    expect(screen.getAllByText('2640-2394-7508').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Elite Box Fights/)).toBeInTheDocument();
    expect(screen.getByText('Boxfight Rules')).toBeInTheDocument();
    expect(screen.getByText('You must not exploit bugs to keep extra loot from round to round.')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'GENERAL' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'GENERAL' }));
    expect(screen.getByText('General Rules')).toBeInTheDocument();
    expect(screen.getByText(/maximum of 10 minutes from the match starting/i)).toBeInTheDocument();
    expect(screen.getByTestId('match-ready-lobby')).toBeInTheDocument();
    expect(screen.queryByText('Rules page')).not.toBeInTheDocument();
  });

  it('opens Realistic rules for Realistic matches', () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        mode: 'Realistic',
      },
    };

    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'SEE RULES' }));

    expect(screen.getByText('REALISTIC')).toBeInTheDocument();
    expect(screen.getAllByText('9854-1829-8735').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/Finest Realistics/)).toBeInTheDocument();
    expect(screen.getByText('Realistic Rules')).toBeInTheDocument();
    expect(screen.getByText(/Opening chests, ammo crates, collecting floor loot/i)).toBeInTheDocument();
    expect(screen.getByText("'Zone Wars' and 'Comp Mode' options must be enabled.")).toBeInTheDocument();
  });

  it('opens Zone Wars rules and closes with Escape or outside click', () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        mode: 'Zone Wars',
      },
    };

    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'SEE RULES' }));

    expect(screen.getByText('ZONE WARS')).toBeInTheDocument();
    expect(screen.getAllByText('3537-4087-0888').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('If damage is dealt, the round counts regardless of the circumstances.')).toBeInTheDocument();
    expect(screen.getByText('If no players go through the portal, the round will not count.')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'MATCH RULES' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'SEE RULES' }));
    fireEvent.mouseDown(screen.getByTestId('match-rules-overlay'));
    expect(screen.queryByRole('dialog', { name: 'MATCH RULES' })).not.toBeInTheDocument();
  });

  it('reflects ready count changes in the Figma ready button', () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
            ready: true,
            profile: {
              username: 'Host',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
              epic_username: 'HostEpic',
            },
          }),
          participantFactory({
            id: 'participant-b-1',
            user_id: 'user-b-1',
            team_side: 'B',
          }),
        ],
      },
    };

    renderMatchDetail();

    expect(screen.getByRole('button', { name: 'READY (1/6)' })).toBeDisabled();
  });

  it('uses the pre-accept Figma lobby with cancel while the match is open', () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        status: 'open',
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
            profile: {
              username: 'Host',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
              epic_username: 'HostEpic',
            },
          }),
        ],
      },
    };

    renderMatchDetail();

    expect(screen.getByTestId('match-ready-lobby')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'READY (0/6)' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Wait for a player').length).toBeGreaterThan(0);
    expect(screen.queryByText('DELETE MATCH')).not.toBeInTheDocument();
    expect(screen.getByText('3V3 BOXFIGHT')).toBeInTheDocument();
  });

  it('cancels the open lobby from the Figma cancel button', async () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        status: 'open',
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
          }),
        ],
      },
    };
    cancelMatchMock.mockResolvedValue(undefined);

    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));

    await waitFor(() => {
      expect(cancelMatchMock).toHaveBeenCalledWith('match-ready');
    });
  });

  it('sets the current participant ready from the Figma ready button', async () => {
    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'READY (0/6)' }));

    await waitFor(() => {
      expect(setReadyMock).toHaveBeenCalledWith('match-ready');
    });
  });

  it('opens the profile tab from a visible player arrow', () => {
    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Open Host profile' }));

    expect(screen.getByTestId('mock-player-profile')).toHaveTextContent('PROFILE VIEW user-a-1');
  });

  it('does not open a profile from a masked opponent arrow before reveal', () => {
    renderMatchDetail();

    expect(screen.queryByRole('button', { name: 'Open Opponent profile' })).not.toBeInTheDocument();

    const unavailableButtons = screen.getAllByRole('button', { name: 'Player profile unavailable' });
    fireEvent.click(unavailableButtons[0]);

    expect(screen.queryByTestId('mock-player-profile')).not.toBeInTheDocument();
  });

  it('reveals all players and shows win/loss after all players are ready and the match starts', async () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        status: 'in_progress',
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
            ready: true,
            profile: {
              username: 'Host',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
              epic_username: 'HostEpic',
            },
          }),
          participantFactory({
            id: 'participant-b-1',
            user_id: 'user-b-1',
            team_side: 'B',
            ready: true,
            profile: {
              username: 'Opponent',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
              epic_username: 'OpponentEpic',
            },
          }),
        ],
      },
    };
    submitResultMock.mockResolvedValue(undefined);

    renderMatchDetail();

    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Opponent')).toBeInTheDocument();
    expect(screen.getByAltText('Match creator')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open Opponent profile' }));
    expect(screen.getByTestId('mock-player-profile')).toHaveTextContent('PROFILE VIEW user-b-1');

    expect(screen.getByLabelText('Started status active')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /READY/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WIN' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'LOSS' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'WIN' })).toHaveStyle({ left: 'calc(36.667% - 49px)' });
    expect(screen.getByRole('button', { name: 'LOSS' })).toHaveStyle({ left: 'calc(36.667% + 146px)' });

    fireEvent.click(screen.getByRole('button', { name: 'WIN' }));

    await waitFor(() => {
      expect(submitResultMock).toHaveBeenCalledWith({ matchId: 'match-ready', result: 'WIN', isTeam: true });
    });
  });

  it('copies a visible Epic username from a player card', async () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        status: 'in_progress',
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
            ready: true,
            profile: {
              username: 'Host',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/host/avatar.png',
              epic_username: 'HostEpic',
            },
          }),
          participantFactory({
            id: 'participant-b-1',
            user_id: 'user-b-1',
            team_side: 'B',
            ready: true,
            profile: {
              username: 'Opponent',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
              epic_username: 'OpponentEpic',
            },
          }),
        ],
      },
    };

    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Copy Epic username OpponentEpic' }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('OpponentEpic');
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Epic username copied',
      description: 'OpponentEpic',
    }));
  });

  it('lets a player declare loss after the match starts', async () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        status: 'in_progress',
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
            ready: true,
          }),
          participantFactory({
            id: 'participant-b-1',
            user_id: 'user-b-1',
            team_side: 'B',
            ready: true,
            profile: {
              username: 'Opponent',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
              epic_username: 'OpponentEpic',
            },
          }),
        ],
      },
    };
    submitResultMock.mockResolvedValue(undefined);

    renderMatchDetail();

    fireEvent.click(screen.getByRole('button', { name: 'LOSS' }));

    await waitFor(() => {
      expect(submitResultMock).toHaveBeenCalledWith({ matchId: 'match-ready', result: 'LOSS', isTeam: true });
    });
  });

  it('keeps the same Figma VS mark when the match is finished', () => {
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        status: 'completed',
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
            ready: true,
          }),
          participantFactory({
            id: 'participant-b-1',
            user_id: 'user-b-1',
            team_side: 'B',
            ready: true,
            profile: {
              username: 'Opponent',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
              epic_username: 'OpponentEpic',
            },
          }),
        ],
      },
    };

    renderMatchDetail();

    expect(screen.getByTestId('match-ready-vs')).toBeInTheDocument();
    expect(screen.getByLabelText('Finished status active')).toBeInTheDocument();
  });

  it('uses creator fallback so opponents see the host after the match starts', () => {
    authState.value = { user: { id: 'user-b-1' } };
    matchState.value = {
      ...matchState.value,
      data: {
        ...matchState.value.data!,
        status: 'in_progress',
        participants: [
          participantFactory({
            id: 'participant-a-1',
            user_id: 'user-a-1',
            team_side: 'A',
            ready: true,
            profile: {
              username: 'Host',
              discord_avatar_url: null,
              epic_username: undefined,
            },
          }),
          participantFactory({
            id: 'participant-b-1',
            user_id: 'user-b-1',
            team_side: 'B',
            ready: true,
            profile: {
              username: 'Opponent',
              discord_avatar_url: 'https://cdn.discordapp.com/avatars/opponent/avatar.png',
              epic_username: 'OpponentEpic',
            },
          }),
        ],
      },
    };

    const { container } = renderMatchDetail();

    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Opponent')).toBeInTheDocument();
    expect(container.querySelector('img[src="https://cdn.discordapp.com/avatars/host/avatar.png"]')).not.toBeNull();
  });
});
