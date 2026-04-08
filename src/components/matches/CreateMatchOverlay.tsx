import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Coins, Loader2, Lock, ShieldCheck, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { TeamSelector } from '@/components/teams/TeamSelector';
import { PaymentModeSelector } from '@/components/teams/PaymentModeSelector';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
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
import oleboyCoin from '@/assets/oleboy-coin.png';

type CreateStep = 'game' | 'tokens';

interface SelectedTeam extends Team {
  members: (TeamMember & { profile: Profile })[];
  memberBalances?: TeamMemberWithBalance[];
  acceptedMemberCount: number;
}

interface CreateMatchOverlayProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (matchId: string) => void;
}

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED = "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK = "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

const MODE_OPTIONS: Array<{ value: GameMode; label: string }> = [
  { value: 'Realistic', label: 'REALISTIC' },
  { value: 'Box Fight', label: 'BOX FIGHT' },
  { value: 'Zone Wars', label: 'ZONE WARS' },
];

const TEAM_SIZE_OPTIONS = [
  { value: 1, label: '1v1' },
  { value: 2, label: '2v2' },
  { value: 3, label: '3v3' },
  { value: 4, label: '4v4' },
] as const;

const PLATFORM_OPTIONS: Array<{ value: Platform; label: string }> = [
  { value: 'All', label: 'ANY' },
  { value: 'PC', label: 'PC' },
  { value: 'Console', label: 'CONSOLE' },
];

function formatAmount(value: number) {
  return value.toFixed(2);
}

function getInitialPlatform(preferredPlatform?: Platform | null): Platform {
  if (!preferredPlatform || preferredPlatform === 'Mobile') {
    return 'All';
  }

  return preferredPlatform;
}

function FigmaSectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[22px] text-white md:text-[24px]" style={{ fontFamily: FONT_EXPANDED }}>
      {children}
    </p>
  );
}

interface SelectionButtonProps {
  active: boolean;
  disabled?: boolean;
  label: string;
  onClick?: () => void;
  className?: string;
}

function SelectionButton({ active, disabled, label, onClick, className }: SelectionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'h-[59px] rounded-[18px] border px-4 text-center text-[22px] text-white transition-all duration-200 md:text-[28px]',
        active
          ? 'border-[#ff1654] bg-[rgba(255,22,84,0.34)] shadow-[0_0_0_1px_rgba(255,22,84,0.08)]'
          : 'border-transparent bg-[rgba(0,0,0,0.5)] hover:border-white/10 hover:bg-black/60',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
      style={{ fontFamily: FONT_EXPANDED_BOLD }}
    >
      {label}
    </button>
  );
}

function StatusNotice({
  variant = 'warning',
  children,
}: {
  variant?: 'warning' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-[18px] border px-4 py-3',
        variant === 'warning'
          ? 'border-[#ff1654]/35 bg-[rgba(255,22,84,0.08)]'
          : 'border-red-500/40 bg-red-500/10',
      )}
    >
      <div className="flex gap-3">
        <AlertCircle
          className={cn('mt-0.5 h-5 w-5 shrink-0', variant === 'warning' ? 'text-[#ff6a8f]' : 'text-red-400')}
        />
        <div className="text-sm text-white/85" style={{ fontFamily: FONT_REGULAR }}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function CreateMatchOverlay({ open, onClose, onCreated }: CreateMatchOverlayProps) {
  const { user, profile, wallet, isProfileComplete, refreshWallet } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<CreateStep>('game');
  const [mode, setMode] = useState<GameMode>('Box Fight');
  const [teamSize, setTeamSize] = useState<number>(1);
  const [platform, setPlatform] = useState<Platform>('All');
  const [region, setRegion] = useState<Region>('EU');
  const [entryFeeInput, setEntryFeeInput] = useState('1.00');
  const [creating, setCreating] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cover');
  const didHydratePreferences = useRef(false);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creating) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [creating, onClose, open]);

  useEffect(() => {
    if (!open) {
      didHydratePreferences.current = false;
      return;
    }

    setStep('game');
    setMode('Box Fight');
    setTeamSize(1);
    setPlatform('All');
    setRegion('EU');
    setEntryFeeInput('1.00');
    setCreating(false);
    setSelectedTeam(null);
    setPaymentMode('cover');
  }, [open]);

  useEffect(() => {
    if (!open || !profile || didHydratePreferences.current) {
      return;
    }

    setPlatform(getInitialPlatform(profile.preferred_platform));
    setRegion((profile.preferred_region as Region) || 'EU');
    didHydratePreferences.current = true;
  }, [open, profile]);

  const entryFee = useMemo(() => {
    const parsed = Number.parseFloat(entryFeeInput.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, [entryFeeInput]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const isEntryFeeValid = Number.isFinite(entryFee) && entryFee >= 0.5;
  const normalizedEntryFee = isEntryFeeValid ? Number(entryFee.toFixed(2)) : 0;
  const isTeamMatch = teamSize > 1;
  const playerCount = teamSize * 2;
  const totalCost = normalizedEntryFee * teamSize;
  const totalPool = normalizedEntryFee * playerCount;
  const prize = totalPool * 0.95;
  const walletBalance = wallet?.balance ?? 0;
  const canAffordSolo = walletBalance >= normalizedEntryFee;
  const canAffordCover = walletBalance >= totalCost;
  const canAffordSplit = selectedTeam?.memberBalances?.every((member) => member.balance >= normalizedEntryFee) ?? false;
  const canAfford = isTeamMatch ? (paymentMode === 'cover' ? canAffordCover : canAffordSplit) : canAffordSolo;
  const gameStepValid = !isTeamMatch || selectedTeam !== null;
  const finalCreateEnabled = Boolean(user && isProfileComplete && gameStepValid && isEntryFeeValid && canAfford);
  const currentPlatformLabel = PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ?? 'ANY';
  const teamCostLabel = paymentMode === 'cover' ? totalCost : normalizedEntryFee;
  const teamCostCopy =
    paymentMode === 'cover'
      ? `You will lock ${formatAmount(teamCostLabel)} OBT for your ${teamSize} players.`
      : `Each team member must hold ${formatAmount(teamCostLabel)} OBT.`;

  const resetTeamState = (size: number) => {
    setTeamSize(size);
    setSelectedTeam(null);
    setPaymentMode('cover');
  };

  const handleEntryFeeBlur = () => {
    if (!entryFeeInput.trim() || !Number.isFinite(entryFee)) {
      return;
    }

    setEntryFeeInput(Math.max(entryFee, 0.5).toFixed(2));
  };

  const handleNextStep = () => {
    if (!gameStepValid) {
      toast({
        title: 'Complete the game step',
        description: 'Select a team before continuing to the token step.',
        variant: 'destructive',
      });
      return;
    }

    setStep('tokens');
  };

  const handleCreate = async () => {
    if (!user) {
      return;
    }

    if (!isProfileComplete) {
      toast({
        title: 'Complete your profile',
        description: 'Add your Epic Games username before creating matches.',
        variant: 'destructive',
      });
      return;
    }

    if (!isEntryFeeValid) {
      toast({
        title: 'Invalid entry fee',
        description: 'Entry fee must be at least 0.50 OBT.',
        variant: 'destructive',
      });
      return;
    }

    if (!gameStepValid) {
      toast({
        title: 'Select a team',
        description: 'Team matches require a selected team before creation.',
        variant: 'destructive',
      });
      return;
    }

    if (!canAfford) {
      toast({
        title: 'Insufficient balance',
        description: isTeamMatch && paymentMode === 'split'
          ? 'One or more selected teammates do not have enough balance.'
          : 'You do not have enough balance to create this match.',
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
          p_entry_fee: normalizedEntryFee,
          p_region: region,
          p_platform: platform,
          p_mode: mode,
          p_team_size: teamSize,
          p_payment_mode: paymentMode,
        });

        if (error) {
          throw error;
        }

        const result = data as { success: boolean; error?: string; match_id?: string } | null;
        if (result && !result.success) {
          throw new Error(result.error);
        }

        matchId = result?.match_id;
      } else {
        const { data, error } = await supabase.rpc('create_match_1v1', {
          p_entry_fee: normalizedEntryFee,
          p_region: region,
          p_platform: platform,
          p_mode: mode,
        });

        if (error) {
          throw error;
        }

        const result = data as { success: boolean; error?: string; match_id?: string } | null;
        if (result && !result.success) {
          throw new Error(result.error);
        }

        matchId = result?.match_id;
      }

      await refreshWallet();

      toast({
        title: 'Match created',
        description: isTeamMatch ? 'Your team token is now live.' : 'Your token is now live.',
      });

      if (matchId && onCreated) {
        onCreated(matchId);
      } else {
        onClose();
      }
    } catch (error: unknown) {
      const description =
        error instanceof Error ? error.message : 'Failed to create match. Please try again.';

      console.error('Match creation error:', error);
      toast({
        title: 'Error',
        description,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const overlay = (
    <div
      className="fixed inset-0 z-40 overflow-y-auto bg-[rgba(15,4,4,0.72)] backdrop-blur-[4px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creating) {
          onClose();
        }
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[220px] bg-[radial-gradient(circle_at_top,rgba(255,22,84,0.18),transparent_64%)]"
      />

      <div className="mx-auto flex min-h-screen max-w-[1600px] items-start justify-center px-4 pb-12 pt-[140px] md:px-6 md:pt-[168px]">
        {!user ? (
          <section
            className="w-full max-w-[903px] rounded-[18px] border border-[#ff1654] bg-[#282828] px-6 py-8 shadow-[0_30px_100px_rgba(0,0,0,0.45)] md:px-12 md:py-12"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-match-title"
          >
            <div className="mx-auto max-w-[520px] text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#ff1654]/[0.14] text-[#ff1654]">
                <Lock className="h-7 w-7" />
              </div>
              <h1
                id="create-match-title"
                className="mt-8 text-[36px] leading-[0.95] text-white md:text-[64px]"
                style={{ fontFamily: FONT_EXPANDED_BOLD }}
              >
                SPECIFY DETAILS
              </h1>
              <p className="mt-6 text-base text-white/80 md:text-lg" style={{ fontFamily: FONT_REGULAR }}>
                Sign in to create a live match token and push it to the arena.
              </p>
              <div className="mt-10 rounded-[18px] border border-[#ff1654]/30 bg-black/30 px-5 py-4 text-left">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#ff6a8f]" />
                  <p className="text-sm text-white/80 md:text-base" style={{ fontFamily: FONT_REGULAR }}>
                    You need an authenticated wallet before locking entry fees and publishing a token.
                  </p>
                </div>
              </div>
              <Link
                to="/auth?next=%2Fmatches%2Fcreate"
                className="mx-auto mt-10 inline-flex h-[69px] w-full max-w-[361px] items-center justify-center rounded-[23px] bg-[#ff1654] text-[30px] text-white transition-transform duration-200 hover:scale-[1.01] md:text-[36px]"
                style={{ fontFamily: FONT_WIDE_BLACK }}
              >
                SIGN IN
              </Link>
            </div>
          </section>
        ) : (
          <section
            className="w-full max-w-[903px] rounded-[18px] border border-[#ff1654] bg-[#282828] shadow-[0_30px_100px_rgba(0,0,0,0.45)]"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-match-title"
            data-testid="create-match-panel"
          >
            <div className="max-h-[calc(100vh-220px)] overflow-y-auto px-5 py-8 sm:px-8 md:px-12 md:py-10">
              <div className="text-center">
                <h1
                  id="create-match-title"
                  className="text-[38px] leading-[0.95] text-white md:text-[64px]"
                  style={{ fontFamily: FONT_EXPANDED_BOLD }}
                >
                  SPECIFY DETAILS
                </h1>
                <div className="mt-8 flex items-center justify-center gap-7 md:gap-16" role="tablist" aria-label="Create match steps">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={step === 'game'}
                    onClick={() => setStep('game')}
                    className={cn(
                      'relative pb-3 text-[22px] text-white transition-colors md:text-[32px]',
                      step === 'game' ? 'text-white' : 'text-white/70',
                    )}
                    style={{ fontFamily: step === 'game' ? FONT_BOLD : FONT_REGULAR }}
                  >
                    GAME
                    {step === 'game' && (
                      <span className="absolute bottom-0 left-1/2 h-[2px] w-[110px] -translate-x-1/2 bg-[#ff1654] md:w-[150px]" />
                    )}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={step === 'tokens'}
                    onClick={() => {
                      if (step === 'tokens' || gameStepValid) {
                        setStep('tokens');
                      }
                    }}
                    className={cn(
                      'relative pb-3 text-[22px] transition-colors md:text-[32px]',
                      step === 'tokens' ? 'text-white' : 'text-white/70',
                    )}
                    style={{ fontFamily: step === 'tokens' ? FONT_BOLD : FONT_REGULAR }}
                  >
                    TOKENS
                    {step === 'tokens' && (
                      <span className="absolute bottom-0 left-1/2 h-[2px] w-[110px] -translate-x-1/2 bg-[#ff1654] md:w-[150px]" />
                    )}
                  </button>
                </div>
              </div>

              {step === 'game' ? (
                <div className="mt-8 space-y-8 md:mt-10">
                  <section>
                    <FigmaSectionLabel>Mode:</FigmaSectionLabel>
                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {MODE_OPTIONS.map((option) => (
                        <SelectionButton
                          key={option.value}
                          active={mode === option.value}
                          label={option.label}
                          onClick={() => setMode(option.value)}
                        />
                      ))}
                    </div>
                  </section>

                  <section>
                    <FigmaSectionLabel>Team size:</FigmaSectionLabel>
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {TEAM_SIZE_OPTIONS.map((option) => (
                        <SelectionButton
                          key={option.value}
                          active={teamSize === option.value}
                          label={option.label}
                          onClick={() => resetTeamState(option.value)}
                        />
                      ))}
                    </div>
                  </section>

                  <section>
                    <FigmaSectionLabel>Platform:</FigmaSectionLabel>
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                      {PLATFORM_OPTIONS.map((option) => (
                        <SelectionButton
                          key={option.value}
                          active={platform === option.value}
                          label={option.label}
                          onClick={() => setPlatform(option.value)}
                        />
                      ))}
                    </div>
                  </section>

                  {isTeamMatch && (
                    <section className="space-y-6">
                      <div>
                        <FigmaSectionLabel>Select team:</FigmaSectionLabel>
                        <div className="mt-4">
                          <TeamSelector
                            teamSize={teamSize}
                            entryFee={isEntryFeeValid ? normalizedEntryFee : 0.5}
                            selectedTeamId={selectedTeam?.id ?? null}
                            onSelectTeam={(team) => setSelectedTeam(team as SelectedTeam | null)}
                            paymentMode={paymentMode}
                          />
                        </div>
                      </div>

                      <div>
                        <FigmaSectionLabel>Payment mode:</FigmaSectionLabel>
                        <div className="mt-4">
                          <PaymentModeSelector
                            paymentMode={paymentMode}
                            onChangePaymentMode={setPaymentMode}
                            entryFee={isEntryFeeValid ? normalizedEntryFee : 0.5}
                            teamSize={teamSize}
                            memberBalances={selectedTeam?.memberBalances}
                            userBalance={walletBalance}
                          />
                        </div>
                      </div>

                      <div className="rounded-[18px] border border-white/10 bg-black/25 px-4 py-4">
                        <div className="flex items-start gap-3">
                          <Users className="mt-1 h-5 w-5 shrink-0 text-[#ff6a8f]" />
                          <div className="space-y-1">
                            <p className="text-sm text-white/95 md:text-base" style={{ fontFamily: FONT_EXPANDED }}>
                              TEAM PAYMENT
                            </p>
                            <p className="text-sm text-white/70" style={{ fontFamily: FONT_REGULAR }}>
                              {teamCostCopy}
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {!gameStepValid && (
                    <StatusNotice>
                      Select a team to unlock the token step for {teamSize}v{teamSize} matches.
                    </StatusNotice>
                  )}

                  <div className="mx-auto mt-2 h-px w-full max-w-[589px] bg-white/60" />

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleNextStep}
                      disabled={!gameStepValid}
                      className={cn(
                        'inline-flex h-[69px] w-full max-w-[361px] items-center justify-center gap-3 rounded-[23px] bg-[#ff1654] text-[30px] text-white transition-all duration-200 md:text-[36px]',
                        !gameStepValid && 'cursor-not-allowed opacity-45',
                      )}
                      style={{ fontFamily: FONT_WIDE_BLACK }}
                    >
                      NEXT STEP
                      <ArrowRight className="h-7 w-7 md:h-8 md:w-8" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-8 space-y-8 md:mt-10">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <section>
                      <FigmaSectionLabel>Entry fee:</FigmaSectionLabel>
                      <div className="mt-4 flex h-[59px] items-center rounded-[18px] bg-[rgba(0,0,0,0.5)] px-4">
                        <img src={oleboyCoin} alt="" className="h-[28px] w-[28px] shrink-0 object-contain" />
                        <input
                          aria-label="Entry fee"
                          inputMode="decimal"
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={entryFeeInput}
                          onChange={(event) => setEntryFeeInput(event.target.value.replace(',', '.'))}
                          onBlur={handleEntryFeeBlur}
                          className="ml-3 w-full bg-transparent text-right text-[24px] text-white outline-none md:text-[28px]"
                          style={{ fontFamily: FONT_EXPANDED_BOLD }}
                        />
                      </div>
                    </section>

                    <section>
                      <div className="flex items-baseline justify-between gap-3">
                        <FigmaSectionLabel>Total Pool:</FigmaSectionLabel>
                        <p className="text-[14px] text-[#ff1654] md:text-[16px]" style={{ fontFamily: FONT_EXPANDED }}>
                          ({playerCount} players)
                        </p>
                      </div>
                      <div className="mt-4 flex h-[59px] items-center rounded-[18px] bg-[rgba(0,0,0,0.5)] px-4">
                        <img src={oleboyCoin} alt="" className="h-[28px] w-[28px] shrink-0 object-contain" />
                        <p
                          className="ml-3 w-full text-right text-[24px] text-white md:text-[28px]"
                          style={{ fontFamily: FONT_EXPANDED_BOLD }}
                          data-testid="total-pool-value"
                        >
                          {formatAmount(totalPool)}
                        </p>
                      </div>
                    </section>
                  </div>

                  <section>
                    <FigmaSectionLabel>Prize:</FigmaSectionLabel>
                    <div className="mt-4 flex min-h-[91px] items-center rounded-[21px] bg-[linear-gradient(90deg,rgba(255,22,84,0.42)_0%,rgba(15,4,4,0.42)_65%),linear-gradient(90deg,rgba(15,4,4,0.32)_0%,rgba(15,4,4,0.32)_100%)] px-5 py-5">
                      <img src={oleboyCoin} alt="" className="h-[46px] w-[46px] shrink-0 object-contain" />
                      <p
                        className="ml-auto text-right text-[34px] text-white md:text-[42px]"
                        style={{ fontFamily: FONT_EXPANDED_BOLD }}
                        data-testid="prize-value"
                      >
                        {formatAmount(prize)}
                      </p>
                    </div>
                  </section>

                  <div className="rounded-[18px] border border-white/10 bg-black/25 px-4 py-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex items-start gap-3">
                        <Coins className="mt-1 h-5 w-5 shrink-0 text-[#ff6a8f]" />
                        <div className="space-y-1">
                          <p className="text-sm text-white/95 md:text-base" style={{ fontFamily: FONT_EXPANDED }}>
                            TOKEN SNAPSHOT
                          </p>
                          <p className="text-sm text-white/70" style={{ fontFamily: FONT_REGULAR }}>
                            Region locks to {region}. Platform stays on {currentPlatformLabel}. Mode publishes as {mode}.
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8 border border-white/10">
                            <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.username} />
                            <AvatarFallback className="bg-black/50 text-xs text-white">
                              {profile?.username?.charAt(0)?.toUpperCase() ?? 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/45" style={{ fontFamily: FONT_EXPANDED }}>
                              Available wallet
                            </p>
                            <p className="text-sm text-white" style={{ fontFamily: FONT_WIDE_BLACK }}>
                              {formatAmount(walletBalance)} OBT
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {!isProfileComplete && (
                    <StatusNotice>
                      Add your Epic Games username in{' '}
                      <Link to="/profile" className="underline underline-offset-4">
                        Profile
                      </Link>{' '}
                      before publishing a token.
                    </StatusNotice>
                  )}

                  {!isEntryFeeValid && (
                    <StatusNotice variant="error">
                      Entry fee must be at least 0.50 OBT.
                    </StatusNotice>
                  )}

                  {isEntryFeeValid && !canAfford && (
                    <StatusNotice variant="error">
                      {isTeamMatch && paymentMode === 'split' ? (
                        <>One or more selected teammates do not have enough balance for this token.</>
                      ) : (
                        <>
                          You need {formatAmount(isTeamMatch ? totalCost : normalizedEntryFee)} OBT to create this token.{' '}
                          <Link to="/buy" className="underline underline-offset-4">
                            Buy Coins
                          </Link>
                          .
                        </>
                      )}
                    </StatusNotice>
                  )}

                  <div className="mx-auto h-px w-full max-w-[589px] bg-white/60" />

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={!finalCreateEnabled || creating}
                      className={cn(
                        'inline-flex h-[69px] w-full max-w-[361px] items-center justify-center gap-3 rounded-[23px] bg-[#ff1654] text-[30px] text-white transition-all duration-200 md:text-[36px]',
                        (!finalCreateEnabled || creating) && 'cursor-not-allowed opacity-45',
                      )}
                      style={{ fontFamily: FONT_WIDE_BLACK }}
                    >
                      {creating ? (
                        <>
                          <Loader2 className="h-7 w-7 animate-spin md:h-8 md:w-8" />
                          CREATING
                        </>
                      ) : (
                        'CREATE TOKEN'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
