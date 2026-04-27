// OLEBOY TOKEN - Type Definitions

export type UserRole = 'user' | 'admin';

export type Region = 'EU' | 'NA-East' | 'NA-West' | 'OCE' | 'BR' | 'ASIA' | 'ME';

export type Platform = 'PC' | 'Console' | 'Mobile' | 'All';

export type GameMode = 'Box Fight' | 'Realistic' | 'Zone Wars';

export type TeamSize = 1 | 2 | 3 | 4;

export const TEAM_SIZES: { value: TeamSize; label: string }[] = [
  { value: 1, label: '1v1 (Solo)' },
  { value: 2, label: '2v2 (Duos)' },
  { value: 3, label: '3v3 (Trios)' },
  { value: 4, label: '4v4 (Squads)' },
];

// New comprehensive match status
export type MatchStatus = 
  | 'open'           // Match pubblico, in attesa di avversario
  | 'ready_check'    // Avversario joinato, fase ready-up
  | 'in_progress'    // Tutti ready, partita in corso
  | 'result_pending' // In attesa dichiarazione risultati
  | 'completed'      // Match concluso con payout
  | 'disputed'       // Conflitto risultati
  | 'canceled'       // Cancellato dall'host (solo se open)
  | 'admin_resolved' // Risolto da admin
  // Legacy states for backwards compatibility
  | 'joined'
  | 'full'
  | 'started'
  | 'finished'
  | 'expired';

export type TransactionType = 'deposit' | 'lock' | 'unlock' | 'payout' | 'refund' | 'fee';

export type TeamMemberRole = 'owner' | 'captain' | 'member';

export type TeamMemberStatus = 'pending' | 'accepted' | 'rejected';

export type MatchResultStatus = 'pending' | 'confirmed' | 'disputed' | 'resolved';

export type TeamSide = 'A' | 'B';

export type ResultChoice = 'WIN' | 'LOSS';

export type PaymentMode = 'cover' | 'split';

export type NotificationType = 'team_invite' | 'team_join_request' | 'invite_accepted' | 'invite_declined' | 'removed_from_team' | 'member_left' | 'match_result';

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  epic_username: string | null;
  epic_account_id: string | null;
  epic_linked_at: string | null;
  // Twitter (X) fields
  twitter_account_id: string | null;
  twitter_username: string | null;
  twitter_linked_at: string | null;
  // Twitch fields
  twitch_account_id: string | null;
  twitch_username: string | null;
  twitch_linked_at: string | null;
  preferred_region: Region;
  preferred_platform: Platform;
  role: UserRole;
  is_banned: boolean;
  paypal_email: string | null;
  iban: string | null;
  created_at: string;
  updated_at: string;
  // Discord fields
  discord_user_id: string | null;
  discord_username: string | null;
  discord_display_name: string | null;
  discord_avatar_url: string | null;
  discord_linked_at: string | null;
}

// Partial profile for list views (returned by joins with limited fields)
export interface ProfileSummary {
  user_id?: string;
  username: string;
  avatar_url?: string | null;
  discord_avatar_url?: string | null;
  epic_username?: string | null;
  discord_display_name?: string | null;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'approved' | 'rejected' | 'failed' | 'completed';

export interface WithdrawalDestinationSnapshot {
  type?: 'paypal' | 'bank_account' | 'card' | 'unknown';
  email?: string | null;
  brand?: string | null;
  bank_name?: string | null;
  country?: string | null;
  currency?: string | null;
  last4?: string | null;
  default_for_currency?: boolean | null;
}

export interface WithdrawalRequest {
  id: string;
  user_id: string;
  amount: number;
  payment_method: 'paypal' | 'bank' | 'stripe';
  payment_details: string;
  status: WithdrawalStatus;
  admin_notes: string | null;
  fee_amount: number;
  currency: string;
  paypal_batch_id: string | null;
  paypal_item_id: string | null;
  paypal_item_status: string | null;
  paypal_error_name: string | null;
  paypal_error_message: string | null;
  stripe_transfer_id: string | null;
  stripe_payout_id: string | null;
  stripe_transfer_reversal_id: string | null;
  stripe_error_code: string | null;
  stripe_error_message: string | null;
  payout_destination_snapshot: WithdrawalDestinationSnapshot | null;
  transaction_id: string | null;
  created_at: string;
  processed_at: string | null;
  processed_by: string | null;
  profile?: Profile;
}

export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  locked_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  match_id: string | null;
  stripe_session_id: string | null;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  tag: string;
  description: string | null;
  logo_url: string | null;
  max_members?: number | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
  owner?: Profile;
  members?: TeamMember[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  payload: {
    team_id?: string;
    team_name?: string;
    team_tag?: string;
    invited_by_user_id?: string;
    invited_by_username?: string;
    match_id?: string;
    [key: string]: unknown;
  };
  is_read: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  creator_id: string;
  game: string;
  region: Region;
  platform: Platform;
  mode: GameMode;
  team_size: number;
  first_to: number;
  entry_fee: number;
  is_private: boolean;
  private_code: string | null;
  status: MatchStatus;
  expires_at: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  team_a_id?: string | null;
  team_b_id?: string | null;
  payment_mode_host?: PaymentMode;
  payment_mode_joiner?: PaymentMode;
  // Persistent captain IDs - single source of truth
  captain_a_user_id?: string | null;
  captain_b_user_id?: string | null;
  creator?: Profile | ProfileSummary;
  participants?: MatchParticipant[];
  result?: MatchResult;
  team_a?: Team;
  team_b?: Team;
}

export interface MatchParticipant {
  id: string;
  match_id: string;
  user_id: string;
  team_id: string | null;
  team_side: TeamSide | null;
  ready: boolean;
  ready_at: string | null;
  result_choice: ResultChoice | null;
  result_at: string | null;
  status: 'joined' | 'ready' | 'playing' | 'finished' | 'left';
  joined_at: string;
  profile?: Profile | ProfileSummary;
  team?: Team;
}

export interface MatchResult {
  id: string;
  match_id: string;
  winner_user_id: string | null;
  winner_team_id: string | null;
  loser_confirmed: boolean;
  winner_confirmed: boolean;
  proof_url: string | null;
  dispute_reason: string | null;
  admin_notes: string | null;
  resolved_by: string | null;
  status: MatchResultStatus;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  message: string;
  is_deleted: boolean;
  deleted_by: string | null;
  created_at: string;
  profile?: Profile;
}

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  discord_avatar_url?: string | null;
  wins: number;
  total_matches: number;
  total_earnings: number;
}

// =====================================================================
// TOURNAMENTS
// =====================================================================

export type TournamentStatus =
  | 'registering'
  | 'ready_up'
  | 'running'
  | 'completed'
  | 'cancelled';

export interface Tournament {
  id: string;
  name: string;
  creator_id: string;
  mode: GameMode;
  team_size: number;
  first_to: number;
  region: Region;
  platform: Platform;
  max_participants: number;
  entry_fee: number;
  prize_pool_seed: number;
  prize_pool_total: number;
  duration_seconds: number;
  rules: string | null;
  creator_is_admin: boolean;
  status: TournamentStatus;
  scheduled_start_at: string | null;
  ready_up_deadline: string | null;
  started_at: string | null;
  ends_at: string | null;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  creator?: ProfileSummary;
  participants?: TournamentParticipant[];
  prize_positions?: TournamentPrizePosition[];
  participant_count?: number;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string | null;
  team_id: string | null;
  payer_user_id: string;
  paid_amount: number;
  joined_at: string;
  ready: boolean;
  ready_at: string | null;
  matches_played: number;
  wins: number;
  losses: number;
  points: number;
  current_match_id: string | null;
  eliminated: boolean;
  user?: ProfileSummary;
  team?: Team;
}

export interface TournamentPrizePosition {
  id: string;
  tournament_id: string;
  position: number;
  amount: number;
}

export interface TournamentPayout {
  id: string;
  tournament_id: string;
  participant_id: string;
  position: number;
  amount: number;
  paid_at: string;
}

export const TOURNAMENT_DURATION_PRESETS: Array<{ value: number; label: string }> = [
  { value: 1800, label: '30 min' },
  { value: 3600, label: '1 hour' },
  { value: 7200, label: '2 hours' },
  { value: 14400, label: '4 hours' },
];

export const TOURNAMENT_CAPACITY_PRESETS = [4, 8, 16, 32, 64, 128] as const;

export const TOURNAMENT_PRIZE_PRESETS: Array<{
  label: string;
  splits: number[]; // percentages summing to 100
}> = [
  { label: 'Winner takes all', splits: [100] },
  { label: 'Top 3 (50/30/20)', splits: [50, 30, 20] },
  { label: 'Top 5 (40/25/15/12/8)', splits: [40, 25, 15, 12, 8] },
];

export const TOURNAMENT_STATUS_LABELS: Record<TournamentStatus, string> = {
  registering: 'REGISTERING',
  ready_up: 'READY UP',
  running: 'LIVE',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

// Coin package for shop
export interface CoinPackage {
  id: string;
  coins: number;
  price: number;
  popular?: boolean;
  bonus?: number;
}

// Team with balance info for payment checks
export interface TeamMemberWithBalance {
  user_id: string;
  username: string;
  avatar_url: string | null;
  role: string;
  balance: number;
  has_sufficient_balance: boolean;
}

export interface TeamPageRow {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  max_members: number;
  owner_id: string;
  created_at: string | null;
  member_count: number;
  total_matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  current_user_status: TeamMemberStatus | null;
  can_request: boolean;
}

export interface TeamPageMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRole;
  status: TeamMemberStatus;
  created_at: string | null;
  username: string;
  avatar_url: string | null;
  discord_avatar_url: string | null;
  epic_username: string | null;
  total_xp: number;
}

export interface TeamDetailView {
  id: string;
  name: string;
  tag: string;
  logo_url: string | null;
  owner_id: string;
  max_members: number;
  member_count: number;
  total_matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  current_user_role: TeamMemberRole | null;
  current_user_status: TeamMemberStatus | null;
  can_manage: boolean;
  can_kick: boolean;
  can_request: boolean;
}

export type TeamInviteKind = 'invite' | 'request';

export interface TeamInviteRow {
  id: string;
  kind: TeamInviteKind;
  team_id: string;
  team_name: string;
  team_logo_url: string | null;
  target_user_id: string;
  target_username: string;
  target_avatar_url: string | null;
  target_epic_username: string | null;
  target_total_xp: number;
  status: TeamMemberStatus;
  created_at: string | null;
  win_rate: number;
}

// Constants
export const REGIONS: Region[] = ['EU', 'NA-East', 'NA-West', 'OCE', 'BR', 'ASIA', 'ME'];

export const PLATFORMS: Platform[] = ['PC', 'Console', 'Mobile', 'All'];

export const GAME_MODES: GameMode[] = ['Box Fight', 'Realistic', 'Zone Wars'];

export const FIRST_TO_OPTIONS = [1, 3, 5, 7, 10] as const;

export const ENTRY_FEE_PRESETS = [0.5, 1, 5, 10, 25, 50] as const;

export const PLATFORM_FEE = 0.05; // 5%

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'pack-3', coins: 3, price: 3 },
  { id: 'pack-5', coins: 5, price: 5 },
  { id: 'pack-10', coins: 10, price: 10, popular: true },
  { id: 'pack-15', coins: 15, price: 15 },
  { id: 'pack-25', coins: 25, price: 25 },
  { id: 'pack-50', coins: 50, price: 50, bonus: 5 },
];

// Status labels for UI
export const MATCH_STATUS_LABELS: Record<MatchStatus, string> = {
  open: 'OPEN',
  ready_check: 'READY CHECK',
  in_progress: 'IN PROGRESS',
  result_pending: 'AWAITING RESULT',
  completed: 'COMPLETED',
  disputed: 'DISPUTED',
  canceled: 'CANCELED',
  admin_resolved: 'RESOLVED',
  joined: 'JOINED',
  full: 'FULL',
  started: 'LIVE',
  finished: 'FINISHED',
  expired: 'EXPIRED',
};

// Helper to check if match requires user action
export const matchRequiresAction = (match: Match, userId: string): boolean => {
  const participant = match.participants?.find(p => p.user_id === userId);
  if (!participant) return false;
  
  if (match.status === 'ready_check' && !participant.ready) return true;
  if ((match.status === 'in_progress' || match.status === 'result_pending') && !participant.result_choice) return true;
  
  return false;
};
