import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamSelector } from '@/components/teams/TeamSelector';
import { PaymentModeSelector } from '@/components/teams/PaymentModeSelector';

const { mockUseEligibleTeams } = vi.hoisted(() => ({
  mockUseEligibleTeams: vi.fn(),
}));

vi.mock('@/hooks/useEligibleTeams', () => ({
  useEligibleTeams: mockUseEligibleTeams,
}));

const mockTeam = {
  id: 'team-1',
  name: 'BESTPLAYER EU',
  tag: 'BPE',
  description: null,
  logo_url: 'https://cdn.example.com/team-logo.png',
  max_members: 2,
  owner_id: 'owner-1',
  created_at: '',
  updated_at: '',
  acceptedMemberCount: 2,
  members: [
    {
      id: 'member-1',
      team_id: 'team-1',
      user_id: 'user-1',
      role: 'owner',
      status: 'accepted',
      invited_by: null,
      created_at: '',
      updated_at: '',
      profile: {
        id: 'profile-1',
        user_id: 'user-1',
        username: 'marv',
        email: '',
        avatar_url: null,
        epic_username: 'Marv17_',
        epic_account_id: null,
        epic_linked_at: null,
        twitter_account_id: null,
        twitter_username: null,
        twitter_linked_at: null,
        twitch_account_id: null,
        twitch_username: null,
        twitch_linked_at: null,
        preferred_region: 'EU',
        preferred_platform: 'PC',
        role: 'user',
        is_banned: false,
        paypal_email: null,
        iban: null,
        created_at: '',
        updated_at: '',
        discord_user_id: null,
        discord_username: null,
        discord_display_name: null,
        discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-1/avatar.png',
        discord_linked_at: null,
      },
    },
    {
      id: 'member-2',
      team_id: 'team-1',
      user_id: 'user-2',
      role: 'member',
      status: 'accepted',
      invited_by: null,
      created_at: '',
      updated_at: '',
      profile: {
        id: 'profile-2',
        user_id: 'user-2',
        username: 'owener1',
        email: '',
        avatar_url: null,
        epic_username: 'owner_epic',
        epic_account_id: null,
        epic_linked_at: null,
        twitter_account_id: null,
        twitter_username: null,
        twitter_linked_at: null,
        twitch_account_id: null,
        twitch_username: null,
        twitch_linked_at: null,
        preferred_region: 'EU',
        preferred_platform: 'PC',
        role: 'user',
        is_banned: false,
        paypal_email: null,
        iban: null,
        created_at: '',
        updated_at: '',
        discord_user_id: null,
        discord_username: null,
        discord_display_name: null,
        discord_avatar_url: 'https://cdn.discordapp.com/avatars/user-2/avatar.png',
        discord_linked_at: null,
      },
    },
  ],
  memberBalances: [
    {
      user_id: 'user-1',
      username: 'marv',
      avatar_url: 'https://cdn.discordapp.com/avatars/user-1/avatar.png',
      role: 'owner',
      balance: 10,
      has_sufficient_balance: true,
    },
    {
      user_id: 'user-2',
      username: 'owener1',
      avatar_url: 'https://cdn.discordapp.com/avatars/user-2/avatar.png',
      role: 'member',
      balance: 10,
      has_sufficient_balance: true,
    },
  ],
};

function renderTeamSelector(onSelectTeam = vi.fn()) {
  return render(
    <MemoryRouter>
      <TeamSelector
        teamSize={2}
        entryFee={5}
        selectedTeamId={null}
        onSelectTeam={onSelectTeam}
        paymentMode="cover"
      />
    </MemoryRouter>,
  );
}

describe('TeamSelector', () => {
  beforeEach(() => {
    mockUseEligibleTeams.mockReturnValue({
      eligibleTeams: [mockTeam],
      loading: false,
    });
  });

  it('renders real team logo, ready count, and real member avatars', () => {
    const { container } = renderTeamSelector();

    expect(screen.getByAltText('BESTPLAYER EU logo')).toHaveAttribute('src', mockTeam.logo_url);
    expect(screen.getByText('BESTPLAYER EU')).toBeInTheDocument();
    expect(screen.getByText('2/2 READY')).toBeInTheDocument();
    expect(screen.getByText('5.00 EACH')).toBeInTheDocument();
    expect(container.querySelector('[data-avatar-url="https://cdn.discordapp.com/avatars/user-1/avatar.png"]')).toBeTruthy();
    expect(container.querySelector('[data-avatar-url="https://cdn.discordapp.com/avatars/user-2/avatar.png"]')).toBeTruthy();
  });

  it('selects an eligible team', () => {
    const onSelectTeam = vi.fn();

    renderTeamSelector(onSelectTeam);
    fireEvent.click(screen.getByRole('button', { name: /bestplayer eu/i }));

    expect(onSelectTeam).toHaveBeenCalledWith(expect.objectContaining({ id: 'team-1' }));
  });

  it('shows a clean empty state with manage teams link', () => {
    mockUseEligibleTeams.mockReturnValue({
      eligibleTeams: [],
      loading: false,
    });

    renderTeamSelector();

    expect(screen.getByText('NO READY TEAM')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'MANAGE TEAMS' })).toHaveAttribute('href', '/teams');
  });
});

describe('PaymentModeSelector', () => {
  it('shows clear total and each amounts', () => {
    render(
      <PaymentModeSelector
        paymentMode="cover"
        onChangePaymentMode={vi.fn()}
        entryFee={5}
        teamSize={2}
        userBalance={100}
        memberBalances={mockTeam.memberBalances}
      />,
    );

    expect(screen.getByText('COVER ALL')).toBeInTheDocument();
    expect(screen.getByText('SPLIT PAY')).toBeInTheDocument();
    expect(screen.getByText('10.00')).toBeInTheDocument();
    expect(screen.getByText('TOTAL')).toBeInTheDocument();
    expect(screen.getByText('5.00')).toBeInTheDocument();
    expect(screen.getByText('EACH')).toBeInTheDocument();
  });

  it('shows insufficient split members with avatar and name', () => {
    const { container } = render(
      <PaymentModeSelector
        paymentMode="cover"
        onChangePaymentMode={vi.fn()}
        entryFee={5}
        teamSize={2}
        userBalance={100}
        memberBalances={[
          {
            user_id: 'user-2',
            username: 'owener1',
            avatar_url: 'https://cdn.discordapp.com/avatars/user-2/avatar.png',
            role: 'member',
            balance: 1,
            has_sufficient_balance: false,
          },
        ]}
      />,
    );

    expect(screen.getByText('Not enough balance')).toBeInTheDocument();
    expect(screen.getByText('owener1')).toBeInTheDocument();
    expect(container.querySelector('[data-avatar-url="https://cdn.discordapp.com/avatars/user-2/avatar.png"]')).toBeTruthy();
  });
});
