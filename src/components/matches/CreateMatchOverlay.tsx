import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2, Lock, ShieldCheck, Users } from 'lucide-react';
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

type CreateStep = 'game' | 'teams' | 'tokens';

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

const FRAME_WIDTH = 903;
const FRAME_HEIGHT = 800;
const MODAL_SIDE_GAP = 32;

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

const TOKEN_ENTRY_FEE_PRESETS = [0.5, 1, 5, 10, 50] as const;

function formatAmount(value: number) {
  return value.toFixed(2);
}

function getInitialPlatform(preferredPlatform?: Platform | null): Platform {
  if (!preferredPlatform || preferredPlatform === 'Mobile') {
    return 'All';
  }

  return preferredPlatform;
}

function useViewportSize(active: boolean) {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : FRAME_WIDTH,
    height: typeof window !== 'undefined' ? window.innerHeight : FRAME_HEIGHT,
  }));

  useEffect(() => {
    if (!active || typeof window === 'undefined') {
      return;
    }

    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
    };
  }, [active]);

  return viewport;
}

function FigmaSectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[24px] text-white" style={{ fontFamily: FONT_EXPANDED }}>
      {children}
    </p>
  );
}

interface SelectionButtonProps {
  active: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}

function SelectionButton({ active, label, onClick, className }: SelectionButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'h-[59px] rounded-[18px] border px-4 text-center text-[28px] text-white transition-all duration-200',
        active
          ? 'border-[#ff1654] bg-[rgba(255,22,84,0.34)] shadow-[0_0_0_1px_rgba(255,22,84,0.08)]'
          : 'border-transparent bg-[rgba(0,0,0,0.5)] hover:border-white/10 hover:bg-black/60',
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

function StepTabs({
  activeStep,
  hasTeamsStep,
  onSelect,
}: {
  activeStep: CreateStep;
  hasTeamsStep: boolean;
  onSelect: (step: CreateStep) => void;
}) {
  const tabs: Array<{ id: CreateStep; label: string }> = hasTeamsStep
    ? [
        { id: 'game', label: 'GAME' },
        { id: 'teams', label: 'TEAMS' },
        { id: 'tokens', label: 'TOKENS' },
      ]
    : [
        { id: 'game', label: 'GAME' },
        { id: 'tokens', label: 'TOKENS' },
      ];

  return (
    <div className="mt-[35px] flex items-center justify-center gap-[80px]" role="tablist" aria-label="Create match steps">
      {tabs.map((tab) => {
        const isActive = activeStep === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(tab.id)}
            className={cn('relative pb-[11px] text-[32px] transition-colors', isActive ? 'text-white' : 'text-white/70')}
            style={{ fontFamily: isActive ? FONT_BOLD : FONT_REGULAR }}
          >
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-1/2 h-[2px] w-[150px] -translate-x-1/2 bg-[#ff1654]" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function FooterAction({
  label,
  onClick,
  disabled,
  loading,
  spacing = 'default',
}: {
  label: 'NEXT STEP' | 'CREATE TOKEN';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  spacing?: 'default' | 'tight';
}) {
  return (
    <div className={spacing === 'tight' ? 'mt-auto pt-[14px]' : 'mt-auto pt-[20px]'}>
      <div className="mx-auto h-px w-[589px] bg-white/60" />
      <div className={spacing === 'tight' ? 'mt-[14px] flex justify-center' : 'mt-[19px] flex justify-center'}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className={cn(
            'inline-flex h-[69px] w-[361px] items-center justify-center gap-3 rounded-[23px] bg-[#ff1654] text-[36px] text-white transition-all duration-200',
            (disabled || loading) && 'cursor-not-allowed opacity-45',
          )}
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          {loading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              CREATING
            </>
          ) : (
            <>
              {label}
              {label === 'NEXT STEP' && <ArrowRight className="h-8 w-8" />}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export function CreateMatchOverlay({ open, onClose, onCreated }: CreateMatchOverlayProps) {
  const { user, profile, wallet, isProfileComplete, refreshWallet } = useAuth();
  const { toast } = useToast();
  const viewport = useViewportSize(open);
  const [step, setStep] = useState<CreateStep>('game');
  const [mode, setMode] = useState<GameMode>('Box Fight');
  const [teamSize, setTeamSize] = useState<number>(1);
  const [platform, setPlatform] = useState<Platform>('All');
  const [region, setRegion] = useState<Region>('EU');
  const [entryFeeInput, setEntryFeeInput] = useState('5.00');
  const [creating, setCreating] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cover');
  const [termsAccepted, setTermsAccepted] = useState(true);
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
    setEntryFeeInput('5.00');
    setCreating(false);
    setSelectedTeam(null);
    setPaymentMode('cover');
    setTermsAccepted(true);
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

  const isTeamMatch = teamSize > 1;
  const hasTeamsStep = isTeamMatch;
  const isEntryFeeValid = Number.isFinite(entryFee) && entryFee >= 0.5;
  const normalizedEntryFee = isEntryFeeValid ? Number(entryFee.toFixed(2)) : 0;
  const playerCount = teamSize * 2;
  const totalCost = normalizedEntryFee * teamSize;
  const totalPool = normalizedEntryFee * playerCount;
  const platformFeeAmount = totalPool * 0.05;
  const prize = totalPool - platformFeeAmount;
  const walletBalance = wallet?.balance ?? 0;
  const teamsStepValid = !hasTeamsStep || selectedTeam !== null;
  const canAffordSolo = walletBalance >= normalizedEntryFee;
  const canAffordCover = walletBalance >= totalCost;
  const canAffordSplit = selectedTeam?.memberBalances?.every((member) => member.balance >= normalizedEntryFee) ?? false;
  const canAfford = isTeamMatch ? (paymentMode === 'cover' ? canAffordCover : canAffordSplit) : canAffordSolo;
  const isPresetEntryFee = isEntryFeeValid && TOKEN_ENTRY_FEE_PRESETS.some((fee) => normalizedEntryFee === fee);
  const finalCreateEnabled = Boolean(user && isProfileComplete && teamsStepValid && isEntryFeeValid && canAfford && termsAccepted);
  const teamCostLabel = paymentMode === 'cover' ? totalCost : normalizedEntryFee;
  const teamCostCopy =
    paymentMode === 'cover'
      ? `You will lock ${formatAmount(teamCostLabel)} OBT for your ${teamSize} players.`
      : `Each team member must hold ${formatAmount(teamCostLabel)} OBT.`;

  const rawScale = Math.min(
    (viewport.width - MODAL_SIDE_GAP) / FRAME_WIDTH,
    (viewport.height - MODAL_SIDE_GAP) / FRAME_HEIGHT,
  );
  const frameScale = Math.max(0.1, Math.min(1, rawScale));

  const resetTeamState = (size: number) => {
    setTeamSize(size);
    setSelectedTeam(null);
    setPaymentMode('cover');
    if (size === 1 && step === 'teams') {
      setStep('game');
    }
  };

  const handleTabSelect = (target: CreateStep) => {
    if (target === 'game') {
      setStep('game');
      return;
    }

    if (target === 'teams' && hasTeamsStep) {
      setStep('teams');
      return;
    }

    if (target === 'tokens') {
      if (!hasTeamsStep || teamsStepValid) {
        setStep('tokens');
      }
    }
  };

  const handleEntryFeeBlur = () => {
    if (!entryFeeInput.trim() || !Number.isFinite(entryFee)) {
      return;
    }

    setEntryFeeInput(Math.max(entryFee, 0.5).toFixed(2));
  };

  const handlePresetEntryFee = (value: number) => {
    setEntryFeeInput(value.toFixed(2));
  };

  const handleAllIn = () => {
    const allInFee = isTeamMatch && paymentMode === 'cover' ? walletBalance / teamSize : walletBalance;

    if (Number.isFinite(allInFee) && allInFee > 0) {
      setEntryFeeInput(allInFee.toFixed(2));
    }
  };

  const handleNextStep = () => {
    if (step === 'game') {
      setStep(hasTeamsStep ? 'teams' : 'tokens');
      return;
    }

    if (step === 'teams') {
      if (!teamsStepValid) {
        toast({
          title: 'Select a team',
          description: 'Choose a team before continuing to the token step.',
          variant: 'destructive',
        });
        return;
      }

      setStep('tokens');
    }
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

    if (!termsAccepted) {
      toast({
        title: 'Terms required',
        description: 'Accept the Terms & Conditions before creating a token.',
        variant: 'destructive',
      });
      return;
    }

    if (!teamsStepValid) {
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

  const renderGameStep = () => (
    <div className="mt-[31px] flex flex-1 flex-col">
      <div className="space-y-[30px]">
        <section>
          <FigmaSectionLabel>Mode:</FigmaSectionLabel>
          <div className="mt-[8px] grid grid-cols-3 gap-[18px]">
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
          <div className="mt-[8px] grid grid-cols-4 gap-[30px]">
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
          <div className="mt-[13px] grid grid-cols-3 gap-[26px]">
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
      </div>

      <FooterAction label="NEXT STEP" onClick={handleNextStep} />
    </div>
  );

  const renderTeamsStep = () => (
    <div className="mt-[24px] flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <section className="shrink-0">
          <FigmaSectionLabel>Select team:</FigmaSectionLabel>
          <div className="mt-[12px] h-[158px] overflow-y-auto pr-2">
            <TeamSelector
              teamSize={teamSize}
              entryFee={isEntryFeeValid ? normalizedEntryFee : 0.5}
              selectedTeamId={selectedTeam?.id ?? null}
              onSelectTeam={(team) => setSelectedTeam(team as SelectedTeam | null)}
              paymentMode={paymentMode}
            />
          </div>
        </section>

        <section className="mt-[14px] shrink-0">
          <FigmaSectionLabel>Payment mode:</FigmaSectionLabel>
          <div className="mt-[12px]">
            <PaymentModeSelector
              paymentMode={paymentMode}
              onChangePaymentMode={setPaymentMode}
              entryFee={isEntryFeeValid ? normalizedEntryFee : 0.5}
              teamSize={teamSize}
              memberBalances={selectedTeam?.memberBalances}
              userBalance={walletBalance}
            />
          </div>
        </section>

        <div className="mt-[12px] shrink-0 rounded-[18px] border border-white/10 bg-black/25 px-4 py-3">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a8f]" />
            <div className="space-y-1">
              <p className="text-[15px] text-white/95" style={{ fontFamily: FONT_EXPANDED }}>
                TEAM PAYMENT
              </p>
              <p className="text-[13px] leading-[1.15] text-white/70" style={{ fontFamily: FONT_REGULAR }}>
                {teamCostCopy}
              </p>
            </div>
          </div>
        </div>

        {!teamsStepValid && (
          <div className="mt-[10px] shrink-0">
            <StatusNotice>
              Select a team to unlock the token step for {teamSize}v{teamSize} matches.
            </StatusNotice>
          </div>
        )}
      </div>

      <FooterAction label="NEXT STEP" onClick={handleNextStep} disabled={!teamsStepValid} spacing="tight" />
    </div>
  );

  const renderTokensStep = () => (
    <div className="mt-[31px] flex flex-1 flex-col">
      <section>
        <FigmaSectionLabel>Entry fee:</FigmaSectionLabel>
        <div className="mt-[8px] grid grid-cols-5 gap-x-[10px] gap-y-[12px]">
          {TOKEN_ENTRY_FEE_PRESETS.map((fee) => {
            const isActive = isEntryFeeValid && normalizedEntryFee === fee;

            return (
              <button
                key={fee}
                type="button"
                aria-pressed={isActive}
                onClick={() => handlePresetEntryFee(fee)}
                className={cn(
                  'flex h-[59px] items-center gap-[10px] rounded-[18px] border px-[13px] text-left text-[28px] text-white transition-all duration-200',
                  isActive
                    ? 'border-[#ff1654] bg-[rgba(255,22,84,0.34)]'
                    : 'border-transparent bg-[rgba(0,0,0,0.5)] hover:border-white/10',
                )}
                style={{ fontFamily: FONT_EXPANDED_BOLD }}
              >
                <span className="h-[14px] w-[14px] shrink-0 rounded-full bg-[#ff1654]" aria-hidden="true" />
                {formatAmount(fee)}
              </button>
            );
          })}

          <label className="col-span-2 flex h-[59px] items-center gap-[16px] rounded-[18px] bg-[rgba(0,0,0,0.5)] px-[13px]">
            <span className="h-[14px] w-[14px] shrink-0 rounded-full bg-[#ff1654]" aria-hidden="true" />
            <input
              aria-label="Custom entry fee"
              inputMode="decimal"
              type="number"
              min="0.5"
              step="0.5"
              value={isPresetEntryFee ? '' : entryFeeInput}
              onChange={(event) => setEntryFeeInput(event.target.value.replace(',', '.'))}
              onBlur={handleEntryFeeBlur}
              placeholder="Custom amount"
              className="min-w-0 flex-1 bg-transparent text-right text-[24px] text-white outline-none placeholder:text-[#515151]"
              style={{ fontFamily: FONT_REGULAR }}
            />
          </label>

          <button
            type="button"
            onClick={handleAllIn}
            className="h-[59px] rounded-[18px] bg-[#ff1654] text-center text-[28px] text-white transition-all duration-200 hover:brightness-110"
            style={{ fontFamily: FONT_EXPANDED_BOLD }}
          >
            ALL IN
          </button>

          <Link
            to="/wallet"
            className="col-span-2 flex h-[59px] items-center justify-center rounded-[18px] bg-[#ff1654] text-center text-[28px] text-white no-underline transition-all duration-200 hover:brightness-110"
            style={{ fontFamily: FONT_EXPANDED_BOLD }}
          >
            GET MORE OBC
          </Link>
        </div>
      </section>

      <section className="mt-[26px]">
        <div className="grid grid-cols-2 gap-[13px] px-[7px]">
          <FigmaSectionLabel>Total pool:</FigmaSectionLabel>
          <FigmaSectionLabel>Prize:</FigmaSectionLabel>
        </div>

        <div className="mt-[6px] grid grid-cols-2 gap-[13px]">
          <div className="relative flex h-[91px] items-center overflow-hidden rounded-[21px] bg-[rgba(0,0,0,0.5)] px-[19px]">
            <span className="h-[51px] w-[51px] shrink-0 rounded-full bg-[#ff1654]" aria-hidden="true" />
            <p
              className="ml-[13px] text-[42px] leading-none text-white"
              style={{ fontFamily: FONT_EXPANDED_BOLD }}
              data-testid="total-pool-value"
            >
              {formatAmount(totalPool)}
            </p>
            <span
              className="absolute bottom-[18px] right-[26px] text-[12px] leading-none text-[#ff1654]/60"
              style={{ fontFamily: FONT_EXPANDED_BOLD }}
            >
              ({playerCount} players)
            </span>
          </div>

          <div className="relative flex h-[91px] items-center overflow-hidden rounded-[21px] border border-[#ff1654] bg-[linear-gradient(90deg,rgba(255,22,84,0.42)_0%,rgba(15,4,4,0.42)_65%),linear-gradient(90deg,rgba(15,4,4,0.32)_0%,rgba(15,4,4,0.32)_100%)] px-[19px]">
            <span className="h-[51px] w-[51px] shrink-0 rounded-full bg-[#ff1654]" aria-hidden="true" />
            <p
              className="ml-[13px] text-[42px] leading-none text-white"
              style={{ fontFamily: FONT_EXPANDED_BOLD }}
              data-testid="prize-value"
            >
              {formatAmount(prize)}
            </p>
            <div
              className="absolute bottom-[19px] right-[13px] flex flex-col items-end gap-[5px] leading-none"
              style={{ fontFamily: FONT_EXPANDED_BOLD }}
            >
              <span className="text-[12px] text-[#ff1654]/60">OBT Fee (5%)</span>
              <span className="inline-flex items-center gap-[9px] text-[20px] text-white">
                <i className="h-[13px] w-[13px] rounded-full bg-[#ff1654]" aria-hidden="true" />
                {formatAmount(platformFeeAmount)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-[18px] min-h-[86px] space-y-3">
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
                <Link to="/wallet" className="underline underline-offset-4">
                  Get More OBC
                </Link>
                .
              </>
            )}
          </StatusNotice>
        )}
      </div>

      <label className="mx-auto mt-auto flex w-fit items-center gap-[13px] text-[20px] text-white" style={{ fontFamily: FONT_REGULAR }}>
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => setTermsAccepted(event.target.checked)}
          className="peer sr-only"
        />
        <span className="relative h-[44px] w-[44px] shrink-0 rounded-[8px] bg-[#ff1654] after:absolute after:left-[15px] after:top-[8px] after:hidden after:h-[22px] after:w-[12px] after:rotate-45 after:border-b-[5px] after:border-r-[5px] after:border-white peer-checked:after:block" />
        <span>
          Accept our{' '}
          <Link to="/terms" className="text-white underline underline-offset-2">
            Terms & Conditions
          </Link>
        </span>
      </label>

      <FooterAction label="CREATE TOKEN" onClick={handleCreate} disabled={!finalCreateEnabled} loading={creating} spacing="tight" />
    </div>
  );

  const renderAuthenticatedFrame = () => (
    <section
      className="h-full w-full overflow-hidden rounded-[18px] border border-[#ff1654] bg-[#282828] shadow-[0_30px_100px_rgba(0,0,0,0.45)]"
      onMouseDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-match-title"
      data-testid="create-match-panel"
    >
      <div className="flex h-full flex-col px-[49px] pb-[35px] pt-[37px]">
        <div className="text-center">
          <h1
            id="create-match-title"
            className="text-[64px] leading-[0.95] text-white"
            style={{ fontFamily: FONT_EXPANDED_BOLD }}
          >
            SPECIFY DETAILS
          </h1>
          <StepTabs activeStep={step} hasTeamsStep={hasTeamsStep} onSelect={handleTabSelect} />
        </div>

        {step === 'game' && renderGameStep()}
        {step === 'teams' && renderTeamsStep()}
        {step === 'tokens' && renderTokensStep()}
      </div>
    </section>
  );

  const renderSignedOutFrame = () => (
    <section
      className="h-full w-full overflow-hidden rounded-[18px] border border-[#ff1654] bg-[#282828] shadow-[0_30px_100px_rgba(0,0,0,0.45)]"
      onMouseDown={(event) => event.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-match-title"
    >
      <div className="flex h-full flex-col items-center justify-center px-[110px] text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#ff1654]/[0.14] text-[#ff1654]">
          <Lock className="h-7 w-7" />
        </div>
        <h1
          id="create-match-title"
          className="mt-8 text-[64px] leading-[0.95] text-white"
          style={{ fontFamily: FONT_EXPANDED_BOLD }}
        >
          SPECIFY DETAILS
        </h1>
        <p className="mt-6 text-lg text-white/80" style={{ fontFamily: FONT_REGULAR }}>
          Sign in to create a live match token and push it to the arena.
        </p>
        <div className="mt-10 rounded-[18px] border border-[#ff1654]/30 bg-black/30 px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#ff6a8f]" />
            <p className="text-base text-white/80" style={{ fontFamily: FONT_REGULAR }}>
              You need an authenticated wallet before locking entry fees and publishing a token.
            </p>
          </div>
        </div>
        <Link
          to="/auth?next=%2Fmatches%2Fcreate"
          className="mt-10 inline-flex h-[69px] w-[361px] items-center justify-center rounded-[23px] bg-[#ff1654] text-[36px] text-white transition-transform duration-200 hover:scale-[1.01]"
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          SIGN IN
        </Link>
      </div>
    </section>
  );

  const overlay = (
    <div
      className="fixed inset-0 z-[70] overflow-hidden"
      data-testid="create-match-overlay"
    >
      <div
        className="absolute inset-0 bg-[rgba(15,4,4,0.7)]"
        data-testid="create-match-scrim"
        onMouseDown={() => {
          if (!creating) {
            onClose();
          }
        }}
      />

      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: FRAME_WIDTH,
          height: FRAME_HEIGHT,
          transform: `translate(-50%, -50%) scale(${frameScale})`,
          transformOrigin: 'center center',
        }}
      >
        {user ? renderAuthenticatedFrame() : renderSignedOutFrame()}
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
