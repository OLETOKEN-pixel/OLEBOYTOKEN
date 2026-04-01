import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Coins,
  Crosshair,
  Loader2,
  Lock,
  MapPin,
  Monitor,
  Shield,
  Target,
  Users,
  X,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useEligibleTeams } from '@/hooks/useEligibleTeams';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type {
  GameMode,
  PaymentMode,
  Platform,
  Profile,
  Region,
  Team,
  TeamMember,
  TeamMemberWithBalance,
} from '@/types';
import {
  ENTRY_FEE_PRESETS,
  FIRST_TO_OPTIONS,
  GAME_MODES,
  PLATFORM_FEE,
  PLATFORMS,
  REGIONS,
  TEAM_SIZES,
} from '@/types';

interface EligibleTeam extends Team {
  members: (TeamMember & { profile: Profile })[];
  memberBalances?: TeamMemberWithBalance[];
  acceptedMemberCount: number;
}

interface CreateMatchOverlayProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (matchId: string) => void;
}

export function CreateMatchOverlay({ open, onClose, onCreated }: CreateMatchOverlayProps) {
  const { user, wallet, isProfileComplete, refreshWallet } = useAuth();
  const { toast } = useToast();

  const [isPrivate, setIsPrivate] = useState(false);
  const [entryFee, setEntryFee] = useState<number>(1);
  const [customFee, setCustomFee] = useState('');
  const [region, setRegion] = useState<Region>('EU');
  const [platform, setPlatform] = useState<Platform>('All');
  const [mode, setMode] = useState<GameMode>('Box Fight');
  const [teamSize, setTeamSize] = useState(1);
  const [firstTo, setFirstTo] = useState(3);
  const [creating, setCreating] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cover');

  const parsedCustomFee = Number.parseFloat(customFee);
  const actualFee =
    customFee.trim().length > 0 && Number.isFinite(parsedCustomFee) ? parsedCustomFee : entryFee;
  const isValidFee = Number.isFinite(actualFee) && actualFee >= 0.5;
  const isTeamMatch = teamSize > 1;

  const { eligibleTeams, loading: teamsLoading } = useEligibleTeams(
    isTeamMatch ? teamSize : 0,
    isTeamMatch && isValidFee ? actualFee : undefined
  );

  const selectedTeam = useMemo(
    () => (eligibleTeams as EligibleTeam[]).find((team) => team.id === selectedTeamId) ?? null,
    [eligibleTeams, selectedTeamId]
  );

  useEffect(() => {
    if (selectedTeamId && !selectedTeam) {
      setSelectedTeamId(null);
    }
  }, [selectedTeam, selectedTeamId]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creating) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [creating, onClose, open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const walletBalance = wallet?.balance ?? 0;
  const totalCost = isTeamMatch ? actualFee * teamSize : actualFee;
  const grossPool = totalCost * 2;
  const prizePool = grossPool * (1 - PLATFORM_FEE);
  const platformFeeAmount = grossPool * PLATFORM_FEE;
  const canAffordSolo = walletBalance >= actualFee;
  const canAffordCover = walletBalance >= totalCost;
  const canAffordSplit = selectedTeam?.memberBalances?.every((member) => member.balance >= actualFee) ?? false;
  const canAfford = isTeamMatch ? (paymentMode === 'cover' ? canAffordCover : canAffordSplit) : canAffordSolo;
  const canCreate = isValidFee && (isTeamMatch ? selectedTeam !== null && canAfford : canAfford);

  const handleTeamSizeChange = (size: number) => {
    setTeamSize(size);
    setSelectedTeamId(null);

    if (size === 1) {
      setPaymentMode('cover');
    }
  };

  const handleCreate = async () => {
    if (!user) {
      return;
    }

    if (!isProfileComplete) {
      toast({
        title: 'Epic Games connection required',
        description: 'Connect Epic Games in your profile before creating a match.',
        variant: 'destructive',
      });
      return;
    }

    if (!isValidFee) {
      toast({
        title: 'Invalid entry fee',
        description: 'The minimum entry fee is 0.50 OBT.',
        variant: 'destructive',
      });
      return;
    }

    if (!canCreate) {
      toast({
        title: 'Cannot create match',
        description:
          isTeamMatch && !selectedTeam
            ? 'Select an eligible team before continuing.'
            : 'Your wallet or team balance is not enough for this setup.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    try {
      let matchId: string | undefined;

      if (isTeamMatch && selectedTeam) {
        const { data, error } = await supabase.rpc('create_team_match', {
          p_team_id: selectedTeam.id,
          p_entry_fee: actualFee,
          p_region: region,
          p_platform: platform,
          p_mode: mode,
          p_team_size: teamSize,
          p_first_to: firstTo,
          p_payment_mode: paymentMode,
          p_is_private: isPrivate,
        });

        if (error) {
          throw error;
        }

        const result = data as { success: boolean; error?: string; match_id?: string } | null;
        if (result && !result.success) {
          throw new Error(result.error || 'Failed to create team match');
        }

        matchId = result?.match_id;
      } else {
        const { data, error } = await supabase.rpc('create_match_1v1', {
          p_entry_fee: actualFee,
          p_region: region,
          p_platform: platform,
          p_mode: mode,
          p_first_to: firstTo,
          p_is_private: isPrivate,
        });

        if (error) {
          throw error;
        }

        const result = data as { success: boolean; error?: string; match_id?: string } | null;
        if (result && !result.success) {
          throw new Error(result.error || 'Failed to create match');
        }

        matchId = result?.match_id;
      }

      await refreshWallet();

      toast({
        title: 'Match created',
        description: 'Your live match is now on the board.',
      });

      if (matchId && onCreated) {
        onCreated(matchId);
      } else {
        onClose();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create match. Please try again.';

      toast({
        title: 'Creation failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const overlay = (
    <div
      className="fixed inset-0 z-[120] bg-black/[0.78] backdrop-blur-[10px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creating) {
          onClose();
        }
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,22,84,0.18),transparent_42%)]" />

      <div
        className="absolute left-1/2 top-1/2 h-[min(880px,calc(100vh-32px))] w-[min(1180px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[30px] border border-white/10 bg-[#12080b]/95 shadow-[0_40px_120px_rgba(0,0,0,0.6)]"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-match-title"
      >
        <div className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,#ff1654_0%,rgba(255,22,84,0.24)_58%,rgba(255,22,84,0)_100%)]" />
        <div className="absolute right-[-120px] top-[-120px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(255,22,84,0.18)_0%,rgba(255,22,84,0)_72%)]" />
        <div className="absolute bottom-[-140px] left-[-120px] h-[340px] w-[340px] rounded-full bg-[radial-gradient(circle,rgba(255,22,84,0.14)_0%,rgba(255,22,84,0)_72%)]" />

        <button
          type="button"
          onClick={onClose}
          disabled={creating}
          className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.05] text-white/[0.72] transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Close create match overlay"
        >
          <X className="h-5 w-5" />
        </button>

        {!user ? (
          <div className="relative flex h-full items-center justify-center p-6">
            <div className="w-full max-w-[430px] rounded-[26px] border border-white/10 bg-black/25 p-8 text-center shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#ff1654]/[0.14] text-[#ff1654]">
                <Lock className="h-7 w-7" />
              </div>
              <p className="mt-6 text-sm font-display uppercase tracking-[0.18em] text-white/[0.42]">
                Sign In Required
              </p>
              <h2
                id="create-match-title"
                className="mt-4 text-4xl uppercase text-white"
                style={{ fontFamily: "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', sans-serif" }}
              >
                CREATE MATCH
              </h2>
              <p className="mt-4 text-base leading-6 text-white/[0.62]">
                Log in with Discord to open a live arena, lock your entry fee and publish the match to the board.
              </p>
              <Link
                to="/auth?next=%2Fmatches%2Fcreate"
                className="btn-premium mt-8 inline-flex h-12 items-center justify-center rounded-[14px] px-6 text-sm font-semibold uppercase tracking-[0.08em] no-underline"
              >
                Continue With Discord
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative grid h-full grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px] max-[980px]:grid-cols-1">
            <div className="overflow-y-auto px-7 pb-7 pt-7 xl:px-8 xl:pb-8">
              <div className="flex items-start justify-between gap-6 border-b border-white/[0.08] pb-6 pr-14">
                <div>
                  <p className="text-sm font-display uppercase tracking-[0.18em] text-[#ff9ab3]">
                    OBT Matchmaker
                  </p>
                  <h2
                    id="create-match-title"
                    className="mt-3 text-[46px] uppercase leading-none text-white xl:text-[54px]"
                    style={{ fontFamily: "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', sans-serif" }}
                  >
                    Create Match
                  </h2>
                  <p className="mt-3 max-w-[720px] text-[17px] leading-6 text-white/[0.62] xl:text-[18px]">
                    Open a live arena with the original OBT match rules. Entry fees, team payments and prize pool
                    calculations use the real backend flow already wired to Supabase.
                  </p>
                </div>

                <div className="hidden rounded-[18px] border border-white/10 bg-white/[0.04] px-4 py-3 text-right max-[980px]:hidden">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-white/[0.38]">Wallet</p>
                  <div className="mt-2">
                    <CoinDisplay amount={walletBalance} size="lg" />
                  </div>
                </div>
              </div>

              {!isProfileComplete && (
                <div className="mt-6 flex items-start gap-3 rounded-[20px] border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">
                  <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.08em]">Epic Games Missing</p>
                    <p className="mt-1 text-sm leading-6 text-amber-100/80">
                      Match creation still follows the original rule set and requires an Epic Games connection on your
                      profile before the RPC can proceed.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-6 space-y-5">
                <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 xl:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#ff1654]/[0.14] text-[#ff1654]">
                      <Coins className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-[24px] uppercase leading-none text-white" style={{ fontFamily: "'Base_Neue_Trial:Expanded', 'Base Neue Trial', sans-serif" }}>
                        Entry Fee
                      </h3>
                      <p className="mt-1 text-sm text-white/[0.48]">Choose the stake per player for this match.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {ENTRY_FEE_PRESETS.map((fee) => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => {
                          setEntryFee(fee);
                          setCustomFee('');
                        }}
                        className={cn(
                          'h-12 rounded-[14px] border text-sm font-semibold transition',
                          entryFee === fee && customFee.trim().length === 0
                            ? 'border-[#ff1654] bg-[#ff1654] text-white shadow-[0_0_22px_rgba(255,22,84,0.28)]'
                            : 'border-white/[0.12] bg-black/20 text-white/[0.72] hover:border-[#ff1654]/[0.65] hover:text-white'
                        )}
                      >
                        {fee.toFixed(fee % 1 === 0 ? 0 : 1)}
                      </button>
                    ))}
                  </div>

                  <div className="mt-4">
                    <input
                      type="number"
                      value={customFee}
                      onChange={(event) => setCustomFee(event.target.value)}
                      min={0.5}
                      step={0.5}
                      placeholder="Custom amount"
                      className="h-12 w-full rounded-[14px] border border-white/[0.12] bg-black/20 px-4 text-base text-white outline-none transition placeholder:text-white/[0.28] focus:border-[#ff1654]"
                    />
                    <p className="mt-2 text-xs uppercase tracking-[0.12em] text-white/[0.32]">Minimum 0.50 OBT</p>
                  </div>
                </section>

                <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 xl:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-cyan-500/[0.12] text-cyan-300">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-[24px] uppercase leading-none text-white" style={{ fontFamily: "'Base_Neue_Trial:Expanded', 'Base Neue Trial', sans-serif" }}>
                        Match Format
                      </h3>
                      <p className="mt-1 text-sm text-white/[0.48]">Select the lobby size and who covers the entry.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TEAM_SIZES.map((sizeOption) => (
                      <button
                        key={sizeOption.value}
                        type="button"
                        onClick={() => handleTeamSizeChange(sizeOption.value)}
                        className={cn(
                          'h-14 rounded-[16px] border px-3 text-center text-sm font-semibold uppercase transition',
                          teamSize === sizeOption.value
                            ? 'border-[#ff1654] bg-[#ff1654] text-white shadow-[0_0_22px_rgba(255,22,84,0.28)]'
                            : 'border-white/[0.12] bg-black/20 text-white/[0.72] hover:border-[#ff1654]/[0.65] hover:text-white'
                        )}
                      >
                        {sizeOption.value}v{sizeOption.value}
                      </button>
                    ))}
                  </div>

                  {isTeamMatch && (
                    <div className="mt-6">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-white/[0.38]">Eligible Teams</p>
                          <p className="mt-1 text-sm text-white/[0.58]">
                            Teams need exactly {teamSize} accepted members for this format.
                          </p>
                        </div>
                        {teamsLoading && <span className="text-xs uppercase tracking-[0.16em] text-white/[0.35]">Loading…</span>}
                      </div>

                      {teamsLoading ? (
                        <div className="rounded-[18px] border border-white/10 bg-black/20 p-5 text-sm text-white/[0.46]">
                          Checking your eligible teams and member balances…
                        </div>
                      ) : (eligibleTeams as EligibleTeam[]).length === 0 ? (
                        <div className="rounded-[18px] border border-dashed border-white/[0.12] bg-black/20 p-5 text-sm leading-6 text-white/[0.56]">
                          No eligible team found for {teamSize}v{teamSize}. Create or complete a team with exactly{' '}
                          {teamSize} accepted members to unlock team match creation.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(eligibleTeams as EligibleTeam[]).map((team) => {
                            const insufficientMembers =
                              paymentMode === 'split'
                                ? team.memberBalances?.filter((member) => member.balance < actualFee) ?? []
                                : [];
                            const canSelect = paymentMode === 'cover' || insufficientMembers.length === 0;
                            const isSelected = selectedTeamId === team.id;

                            return (
                              <button
                                key={team.id}
                                type="button"
                                onClick={() => {
                                  if (canSelect) {
                                    setSelectedTeamId(isSelected ? null : team.id);
                                  }
                                }}
                                className={cn(
                                  'w-full rounded-[20px] border px-4 py-4 text-left transition',
                                  isSelected
                                    ? 'border-[#ff1654] bg-[#ff1654]/10 shadow-[0_0_18px_rgba(255,22,84,0.18)]'
                                    : 'border-white/10 bg-black/20 hover:border-white/[0.22]',
                                  !canSelect && 'cursor-not-allowed opacity-[0.55]'
                                )}
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <div className="flex items-center gap-3">
                                      <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/[0.06] text-sm font-semibold uppercase text-white">
                                        {team.tag || team.name.slice(0, 3)}
                                      </div>
                                      <div>
                                        <p className="text-base font-semibold uppercase text-white">{team.name}</p>
                                        <p className="text-xs uppercase tracking-[0.14em] text-white/[0.42]">
                                          {team.acceptedMemberCount} accepted members
                                        </p>
                                      </div>
                                    </div>

                                    {paymentMode === 'split' && insufficientMembers.length > 0 && (
                                      <div className="mt-3 flex items-start gap-2 rounded-[14px] border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100/86">
                                        <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                                        <span>
                                          Insufficient split balance: {insufficientMembers.map((member) => member.username).join(', ')}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex -space-x-2">
                                    {team.members.slice(0, 4).map((member) => (
                                      <Avatar key={member.id} className="h-9 w-9 border-2 border-[#12080b]">
                                        <AvatarImage src={member.profile?.avatar_url ?? undefined} />
                                        <AvatarFallback className="bg-white/10 text-xs uppercase text-white">
                                          {member.profile?.username?.slice(0, 1) ?? '?'}
                                        </AvatarFallback>
                                      </Avatar>
                                    ))}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {selectedTeam && (
                        <div className="mt-6">
                          <p className="mb-3 text-xs uppercase tracking-[0.16em] text-white/[0.38]">Payment Mode</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            <button
                              type="button"
                              onClick={() => setPaymentMode('cover')}
                              className={cn(
                                'rounded-[20px] border p-4 text-left transition',
                                paymentMode === 'cover'
                                  ? 'border-[#ff1654] bg-[#ff1654]/10'
                                  : 'border-white/10 bg-black/20 hover:border-white/[0.22]'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold uppercase text-white">Cover All</p>
                                  <p className="mt-1 text-sm leading-5 text-white/[0.52]">
                                    You pay the full team entry and carry the lobby cost.
                                  </p>
                                </div>
                                <CoinDisplay amount={totalCost} size="md" />
                              </div>
                              {!canAffordCover && (
                                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-amber-200/86">
                                  Need {totalCost.toFixed(2)} OBT in your wallet.
                                </p>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                if (selectedTeam.memberBalances?.every((member) => member.balance >= actualFee)) {
                                  setPaymentMode('split');
                                }
                              }}
                              className={cn(
                                'rounded-[20px] border p-4 text-left transition',
                                paymentMode === 'split'
                                  ? 'border-[#ff1654] bg-[#ff1654]/10'
                                  : 'border-white/10 bg-black/20 hover:border-white/[0.22]',
                                !selectedTeam.memberBalances?.every((member) => member.balance >= actualFee) &&
                                  'opacity-60'
                              )}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold uppercase text-white">Split</p>
                                  <p className="mt-1 text-sm leading-5 text-white/[0.52]">
                                    Each accepted member pays their own entry fee.
                                  </p>
                                </div>
                                <CoinDisplay amount={actualFee} size="md" />
                              </div>
                              {!canAffordSplit && (
                                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-amber-200/86">
                                  Every member needs {actualFee.toFixed(2)} OBT available.
                                </p>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </section>

                <section className="rounded-[24px] border border-white/10 bg-white/[0.035] p-5 xl:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/[0.08] text-white">
                      <Shield className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-[24px] uppercase leading-none text-white" style={{ fontFamily: "'Base_Neue_Trial:Expanded', 'Base Neue Trial', sans-serif" }}>
                        Match Rules
                      </h3>
                      <p className="mt-1 text-sm text-white/[0.48]">Configure the live lobby exactly like the legacy flow.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/[0.42]">
                        <MapPin className="h-4 w-4" />
                        Region
                      </span>
                      <select
                        value={region}
                        onChange={(event) => setRegion(event.target.value as Region)}
                        className="h-12 w-full rounded-[14px] border border-white/[0.12] bg-black/20 px-4 text-base text-white outline-none transition focus:border-[#ff1654]"
                      >
                        {REGIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/[0.42]">
                        <Monitor className="h-4 w-4" />
                        Platform
                      </span>
                      <select
                        value={platform}
                        onChange={(event) => setPlatform(event.target.value as Platform)}
                        className="h-12 w-full rounded-[14px] border border-white/[0.12] bg-black/20 px-4 text-base text-white outline-none transition focus:border-[#ff1654]"
                      >
                        {PLATFORMS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/[0.42]">
                        <Crosshair className="h-4 w-4" />
                        Mode
                      </span>
                      <select
                        value={mode}
                        onChange={(event) => setMode(event.target.value as GameMode)}
                        className="h-12 w-full rounded-[14px] border border-white/[0.12] bg-black/20 px-4 text-base text-white outline-none transition focus:border-[#ff1654]"
                      >
                        {GAME_MODES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/[0.42]">
                        <Target className="h-4 w-4" />
                        First To
                      </span>
                      <select
                        value={String(firstTo)}
                        onChange={(event) => setFirstTo(Number.parseInt(event.target.value, 10))}
                        className="h-12 w-full rounded-[14px] border border-white/[0.12] bg-black/20 px-4 text-base text-white outline-none transition focus:border-[#ff1654]"
                      >
                        {FIRST_TO_OPTIONS.map((option) => (
                          <option key={option} value={String(option)}>
                            First to {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 flex items-center justify-between rounded-[18px] border border-white/10 bg-black/20 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <Lock className="mt-0.5 h-5 w-5 text-white/[0.46]" />
                      <div>
                        <p className="text-sm font-semibold uppercase text-white">Private Match</p>
                        <p className="mt-1 text-sm leading-5 text-white/[0.48]">
                          Only players with the invite link can join this arena.
                        </p>
                      </div>
                    </div>
                    <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                  </div>
                </section>
              </div>
            </div>

            <aside className="relative flex flex-col border-l border-white/[0.08] bg-black/[0.18] px-6 pb-6 pt-7 xl:px-7 max-[980px]:border-l-0 max-[980px]:border-t max-[980px]:border-white/[0.08]">
              <div>
                <p className="text-sm font-display uppercase tracking-[0.18em] text-white/[0.42]">Live Summary</p>
                <div className="mt-5 rounded-[22px] border border-[#ff1654]/[0.26] bg-[#ff1654]/[0.08] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-[0.16em] text-white/[0.48]">Available Wallet</span>
                    <CoinDisplay amount={walletBalance} size="md" />
                  </div>

                  <div className="mt-4 space-y-3 text-sm text-white/[0.72]">
                    <div className="flex items-center justify-between gap-4">
                      <span>Entry Fee</span>
                      <CoinDisplay amount={actualFee} size="sm" />
                    </div>

                    {isTeamMatch && (
                      <div className="flex items-center justify-between gap-4">
                        <span>Team Cost ({teamSize} players)</span>
                        <CoinDisplay amount={totalCost} size="sm" />
                      </div>
                    )}

                    {isTeamMatch && selectedTeam && (
                      <div className="flex items-center justify-between gap-4">
                        <span>Payment Mode</span>
                        <span className="text-xs uppercase tracking-[0.16em] text-white">
                          {paymentMode === 'cover' ? 'Cover All' : 'Split'}
                        </span>
                      </div>
                    )}

                    <div className="h-px bg-white/10" />

                    <div className="flex items-center justify-between gap-4">
                      <span>Total Prize Pool</span>
                      <CoinDisplay amount={prizePool} size="md" />
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span>Platform Fee</span>
                      <CoinDisplay amount={platformFeeAmount} size="sm" className="text-white/[0.62]" />
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-[20px] border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/[0.38]">Match Rules Snapshot</p>
                  <ul className="mt-4 space-y-3 text-sm leading-6 text-white/[0.64]">
                    <li>Entry funds are locked immediately at creation time.</li>
                    <li>Prize pool is calculated with the platform fee already deducted.</li>
                    <li>Team matches follow the original cover or split payment logic.</li>
                  </ul>
                </div>

                {(!canCreate || !isValidFee) && (
                  <div className="mt-5 rounded-[20px] border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100/88">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 flex-none" />
                      <div>
                        {!isValidFee ? (
                          <span>Set a valid entry fee of at least 0.50 OBT to continue.</span>
                        ) : isTeamMatch && !selectedTeam ? (
                          <span>Select an eligible team before creating the live arena.</span>
                        ) : paymentMode === 'cover' ? (
                          <span>You need enough OBT in your wallet to cover this match setup.</span>
                        ) : (
                          <span>Every selected team member needs enough OBT for split payment.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-6">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating || !canCreate}
                  className={cn(
                    'flex h-14 w-full items-center justify-center gap-3 rounded-[16px] border border-[#ff1654] bg-[#ff1654] text-sm font-semibold uppercase tracking-[0.12em] text-white transition',
                    creating || !canCreate
                      ? 'cursor-not-allowed opacity-50'
                      : 'shadow-[0_0_24px_rgba(255,22,84,0.28)] hover:brightness-110'
                  )}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Creating Match
                    </>
                  ) : (
                    'Create Match'
                  )}
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
