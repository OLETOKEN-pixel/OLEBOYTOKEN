import { useEffect, useMemo, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCreateTournament } from '@/hooks/useTournaments';
import { cn } from '@/lib/utils';
import {
  TOURNAMENT_PRIZE_PRESETS,
  type GameMode,
  type Platform,
  type Region,
} from '@/types';

type CreateStep = 'game' | 'tokens' | 'details' | 'prize';

interface PrizeRow {
  position: number;
  amount: string;
}

interface CreateTournamentOverlayProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (tournamentId: string) => void;
}

const FRAME_WIDTH = 903;
const FRAME_HEIGHT = 800;
const MODAL_SIDE_GAP = 32;

const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED =
  "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

const REGIONS: Region[] = ['EU', 'NA-East', 'NA-West', 'OCE', 'BR', 'ASIA', 'ME'];
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
const FIRST_TO_PRESETS = [1, 3, 5] as const;
const CAPACITY_PRESETS = [40, 80, 120] as const;
const DURATION_PRESETS = [
  { value: 1800, label: '30m' },
  { value: 4800, label: '80m' },
  { value: 7200, label: '120m' },
] as const;
const CREATE_STEPS = [
  { id: 'game' as const, label: 'GAME' },
  { id: 'tokens' as const, label: 'TOKENS' },
  { id: 'details' as const, label: 'DETAILS' },
  { id: 'prize' as const, label: 'PRIZE' },
] as const;

function isAdminProfile(role?: string | null) {
  return role === 'admin';
}

function defaultPrizeRows(seed: number, splitPercents: number[]): PrizeRow[] {
  return splitPercents.map((pct, idx) => ({
    position: idx + 1,
    amount: ((seed * pct) / 100).toFixed(2),
  }));
}

function parsePositiveInteger(value: string, min: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min ? parsed : null;
}

function buildDefaultStart() {
  const value = new Date();
  value.setDate(value.getDate() + 1);
  value.setMinutes(0, 0, 0);

  return {
    date: `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`,
    time: `${String(value.getHours()).padStart(2, '0')}:00`,
  };
}

function buildTournamentName(mode: GameMode, teamSize: number, firstTo: number) {
  return `${mode.toUpperCase()} ${teamSize}V${teamSize} FT${firstTo}`;
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

function StepTabs({ activeStep, onSelect }: { activeStep: CreateStep; onSelect: (step: CreateStep) => void }) {
  return (
    <div className="mt-[35px] flex items-center justify-center gap-[58px]" role="tablist" aria-label="Create tournament steps">
      {CREATE_STEPS.map((tab) => {
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
}: {
  label: 'NEXT STEP' | 'CREATE TOURNAMENT';
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <div className="mt-auto pt-[20px]">
      <div className="mx-auto h-px w-[589px] bg-white/60" />
      <div className="mt-[19px] flex justify-center">
        <button
          type="button"
          onClick={onClick}
          disabled={disabled || loading}
          className={cn(
            'inline-flex h-[69px] items-center justify-center gap-3 rounded-[23px] bg-[#ff1654] px-8 text-[36px] text-white transition-all duration-200',
            label === 'NEXT STEP' ? 'w-[361px]' : 'w-[495px]',
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
            label
          )}
        </button>
      </div>
    </div>
  );
}

interface InlineCustomSelectionProps {
  active: boolean;
  value: string;
  onActivate: () => void;
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  testId?: string;
}

function InlineCustomSelection({
  active,
  value,
  onActivate,
  onChange,
  ariaLabel,
  className,
  testId,
}: InlineCustomSelectionProps) {
  if (!active) {
    return (
      <SelectionButton
        active={false}
        label="CUSTOM"
        onClick={onActivate}
        className={cn('text-[20px] tracking-[0.14em]', className)}
      />
    );
  }

  return (
    <div
      className={cn(
        'flex h-[59px] items-center rounded-[18px] border border-[#ff1654] bg-[rgba(255,22,84,0.34)] px-6',
        className,
      )}
      data-testid={testId}
      onClick={(event) => {
        const input = event.currentTarget.querySelector('input');
        input?.focus();
      }}
    >
      <input
        aria-label={ariaLabel}
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ''))}
        inputMode="numeric"
        placeholder="VALUE"
        className="w-full appearance-none border-0 bg-transparent text-center text-[28px] text-white outline-none ring-0 placeholder:text-white/55 focus:border-0 focus:outline-none focus:ring-0"
        style={{ fontFamily: FONT_EXPANDED_BOLD }}
      />
    </div>
  );
}

function FigmaField({
  children,
  className,
  testId,
}: {
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        'flex h-[68px] items-center rounded-[18px] border border-[#ff1654] bg-[rgba(0,0,0,0.38)] px-5',
        className,
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

function FigmaTextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  inputMode,
  className,
  min,
  step,
  maxLength,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: InputHTMLAttributes<HTMLInputElement>['inputMode'];
  className?: string;
  min?: string;
  step?: string;
  maxLength?: number;
  testId?: string;
}) {
  return (
    <FigmaField className={className} testId={testId}>
      <input
        type={type}
        min={min}
        step={step}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputMode={inputMode}
        placeholder={placeholder}
        className="w-full appearance-none border-0 bg-transparent text-[28px] text-white outline-none ring-0 placeholder:text-white/36 focus:border-0 focus:outline-none focus:ring-0"
        style={{ fontFamily: FONT_EXPANDED_BOLD }}
      />
    </FigmaField>
  );
}

function FigmaSelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <FigmaField className="relative pr-14">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-full w-full appearance-none border-0 bg-transparent text-[28px] text-white outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0"
        style={{ fontFamily: FONT_EXPANDED_BOLD }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 text-[20px] text-white/70"
        style={{ fontFamily: FONT_BOLD }}
      >
        v
      </span>
    </FigmaField>
  );
}

export function CreateTournamentOverlay({ open, onClose, onCreated }: CreateTournamentOverlayProps) {
  const { user, profile, wallet } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const createMutation = useCreateTournament();
  const viewport = useViewportSize(open);

  const isAdmin = isAdminProfile(profile?.role);
  const balance = wallet?.balance ?? 0;

  const [step, setStep] = useState<CreateStep>('game');
  const [mode, setMode] = useState<GameMode>('Box Fight');
  const [teamSize, setTeamSize] = useState<number>(3);
  const [platform, setPlatform] = useState<Platform>('All');
  const [firstToSelection, setFirstToSelection] = useState<number | 'custom'>(3);
  const [customFirstToInput, setCustomFirstToInput] = useState('7');
  const [capacitySelection, setCapacitySelection] = useState<number | 'custom'>(80);
  const [customCapacityInput, setCustomCapacityInput] = useState('160');
  const [durationSelection, setDurationSelection] = useState<number | 'custom'>(4800);
  const [customDurationInput, setCustomDurationInput] = useState('90');
  const [name, setName] = useState('');
  const [nameEditedManually, setNameEditedManually] = useState(false);
  const [region, setRegion] = useState<Region>('EU');
  const [entryFee, setEntryFee] = useState('0');
  const [prizePool, setPrizePool] = useState('20');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [rules, setRules] = useState('');
  const [prizeRows, setPrizeRows] = useState<PrizeRow[]>(() =>
    defaultPrizeRows(20, TOURNAMENT_PRIZE_PRESETS[1].splits),
  );
  const [activePresetIdx, setActivePresetIdx] = useState<number>(1);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !createMutation.isPending) {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [createMutation.isPending, onClose, open]);

  useEffect(() => {
    if (!open) {
      setNameEditedManually(false);
      return;
    }

    const nextStart = buildDefaultStart();

    setStep('game');
    setMode('Box Fight');
    setTeamSize(3);
    setPlatform('All');
    setFirstToSelection(3);
    setCustomFirstToInput('7');
    setCapacitySelection(80);
    setCustomCapacityInput('160');
    setDurationSelection(4800);
    setCustomDurationInput('90');
    setName('');
    setNameEditedManually(false);
    setRegion((profile?.preferred_region as Region) || 'EU');
    setEntryFee('0');
    setPrizePool('20');
    setStartDate(nextStart.date);
    setStartTime(nextStart.time);
    setRules('');
    setPrizeRows(defaultPrizeRows(20, TOURNAMENT_PRIZE_PRESETS[1].splits));
    setActivePresetIdx(1);
  }, [open, profile?.preferred_region]);

  const resolvedFirstTo = useMemo(
    () => (firstToSelection === 'custom' ? parsePositiveInteger(customFirstToInput, 1) : firstToSelection),
    [customFirstToInput, firstToSelection],
  );
  const resolvedCapacity = useMemo(
    () => (capacitySelection === 'custom' ? parsePositiveInteger(customCapacityInput, 2) : capacitySelection),
    [capacitySelection, customCapacityInput],
  );
  const resolvedDurationSeconds = useMemo(() => {
    if (durationSelection !== 'custom') {
      return durationSelection;
    }

    const minutes = parsePositiveInteger(customDurationInput, 1);
    return minutes === null ? null : minutes * 60;
  }, [customDurationInput, durationSelection]);

  useEffect(() => {
    if (nameEditedManually) {
      return;
    }

    setName(buildTournamentName(mode, teamSize, resolvedFirstTo ?? 3));
  }, [mode, nameEditedManually, resolvedFirstTo, teamSize]);

  useEffect(() => {
    if (activePresetIdx === -1) {
      return;
    }

    const seed = Number.parseFloat(prizePool.replace(',', '.')) || 0;
    setPrizeRows(defaultPrizeRows(seed, TOURNAMENT_PRIZE_PRESETS[activePresetIdx].splits));
  }, [activePresetIdx, prizePool]);

  const entryNum = useMemo(() => {
    const parsed = Number.parseFloat(entryFee.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [entryFee]);

  const seedNum = useMemo(() => {
    const parsed = Number.parseFloat(prizePool.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }, [prizePool]);

  const prizeRowsSum = useMemo(
    () => prizeRows.reduce((sum, row) => sum + (Number.parseFloat(row.amount) || 0), 0),
    [prizeRows],
  );
  const sumValid =
    Number.parseFloat(prizeRowsSum.toFixed(2)) === Number.parseFloat(seedNum.toFixed(2));
  const insufficientBalance = !isAdmin && seedNum > balance;

  const scheduledStartIso = useMemo(() => {
    if (!startDate || !startTime) {
      return null;
    }

    const dateTime = new Date(`${startDate}T${startTime}`);
    return Number.isNaN(dateTime.getTime()) ? null : dateTime.toISOString();
  }, [startDate, startTime]);

  const startInPast =
    scheduledStartIso !== null && new Date(scheduledStartIso).getTime() < Date.now() - 60_000;
  const tokensStepValid =
    resolvedFirstTo !== null &&
    resolvedCapacity !== null &&
    resolvedDurationSeconds !== null;
  const detailsStepValid =
    name.trim().length >= 3 &&
    scheduledStartIso !== null &&
    !startInPast;
  const canSubmit =
    detailsStepValid &&
    tokensStepValid &&
    sumValid &&
    !insufficientBalance &&
    !createMutation.isPending;

  const rawScale = Math.min(
    (viewport.width - MODAL_SIDE_GAP) / FRAME_WIDTH,
    (viewport.height - MODAL_SIDE_GAP) / FRAME_HEIGHT,
  );
  const frameScale = Math.max(0.1, Math.min(1, rawScale));

  function applyPreset(idx: number) {
    setActivePresetIdx(idx);
    setPrizeRows(defaultPrizeRows(seedNum, TOURNAMENT_PRIZE_PRESETS[idx].splits));
  }

  function customizePrizeRows() {
    setActivePresetIdx(-1);
  }

  function addRow() {
    customizePrizeRows();
    setPrizeRows((rows) => [...rows, { position: rows.length + 1, amount: '0' }]);
  }

  function removeRow(idx: number) {
    customizePrizeRows();
    setPrizeRows((rows) =>
      rows.filter((_, index) => index !== idx).map((row, index) => ({ ...row, position: index + 1 })),
    );
  }

  function updateRowAmount(idx: number, amount: string) {
    customizePrizeRows();
    setPrizeRows((rows) => rows.map((row, index) => (index === idx ? { ...row, amount } : row)));
  }

  function handleTabSelect(target: CreateStep) {
    if (target === 'details' && !tokensStepValid) {
      toast({
        title: 'Complete token settings',
        description: 'Set valid values for first to, capacity, and duration before opening details.',
        variant: 'destructive',
      });
      return;
    }

    if (target === 'prize') {
      if (!tokensStepValid) {
        toast({
          title: 'Complete token settings',
          description: 'Set valid values for first to, capacity, and duration before opening prize setup.',
          variant: 'destructive',
        });
        return;
      }

      if (!detailsStepValid) {
        toast({
          title: 'Complete tournament details',
          description: 'Set tournament name, date, and time before opening prize setup.',
          variant: 'destructive',
        });
        return;
      }
    }

    setStep(target);
  }

  function handleTokensNext() {
    if (!tokensStepValid) {
      toast({
        title: 'Complete token settings',
        description: 'Set valid values for first to, capacity, and duration before continuing.',
        variant: 'destructive',
      });
      return;
    }

    setStep('details');
  }

  function handleDetailsNext() {
    if (!detailsStepValid) {
      toast({
        title: 'Complete tournament details',
        description: 'Set tournament name, date, and time before continuing.',
        variant: 'destructive',
      });
      return;
    }

    setStep('prize');
  }

  async function handleSubmit() {
    if (!user || resolvedFirstTo === null || resolvedCapacity === null || resolvedDurationSeconds === null) {
      return;
    }

    try {
      const tournamentId = await createMutation.mutateAsync({
        name: name.trim(),
        mode,
        team_size: teamSize,
        max_participants: resolvedCapacity,
        entry_fee: entryNum,
        prize_pool: seedNum,
        duration_seconds: resolvedDurationSeconds,
        scheduled_start_at: scheduledStartIso,
        first_to: resolvedFirstTo,
        region,
        platform,
        rules: rules.trim() || undefined,
        prize_positions: prizeRows.map((row) => ({
          position: row.position,
          amount: Number.parseFloat((Number.parseFloat(row.amount) || 0).toFixed(2)),
        })),
      });

      toast({ title: 'Tournament created!' });
      onCreated?.(tournamentId);
      onClose();
      navigate(`/tournaments/${tournamentId}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : 'Failed to create tournament';

      toast({
        title: 'Failed to create tournament',
        description: message,
        variant: 'destructive',
      });
    }
  }

  if (!open || typeof document === 'undefined') {
    return null;
  }

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
                onClick={() => setTeamSize(option.value)}
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

      <FooterAction label="NEXT STEP" onClick={() => setStep('tokens')} />
    </div>
  );

  const renderTokensStep = () => (
    <div className="mt-[31px] flex flex-1 flex-col">
      <div className="space-y-[30px]">
        <section>
          <FigmaSectionLabel>First to:</FigmaSectionLabel>
          <div className="mt-[18px] grid grid-cols-[86px_86px_86px_minmax(0,1fr)] gap-[13px]" data-testid="first-to-options">
            {FIRST_TO_PRESETS.map((value) => (
              <SelectionButton
                key={value}
                active={firstToSelection === value}
                label={String(value)}
                onClick={() => setFirstToSelection(value)}
                className="w-[86px] px-0"
              />
            ))}
            <InlineCustomSelection
              active={firstToSelection === 'custom'}
              value={customFirstToInput}
              onActivate={() => setFirstToSelection('custom')}
              onChange={setCustomFirstToInput}
              ariaLabel="Custom first to"
              className="w-full justify-self-stretch px-6"
              testId="custom-first-to-inline"
            />
          </div>
        </section>

        <section>
          <FigmaSectionLabel>Capacity:</FigmaSectionLabel>
          <div className="mt-[18px] grid grid-cols-[138px_138px_138px_minmax(0,1fr)] gap-[28px]" data-testid="capacity-options">
            {CAPACITY_PRESETS.map((value) => (
              <SelectionButton
                key={value}
                active={capacitySelection === value}
                label={String(value)}
                onClick={() => setCapacitySelection(value)}
                className="w-[138px] px-0"
              />
            ))}
            <InlineCustomSelection
              active={capacitySelection === 'custom'}
              value={customCapacityInput}
              onActivate={() => setCapacitySelection('custom')}
              onChange={setCustomCapacityInput}
              ariaLabel="Custom capacity"
              className="w-full justify-self-stretch px-6"
              testId="custom-capacity-inline"
            />
          </div>
        </section>

        <section>
          <FigmaSectionLabel>Duration:</FigmaSectionLabel>
          <div className="mt-[18px] grid grid-cols-[138px_138px_138px_minmax(0,1fr)] gap-[28px]" data-testid="duration-options">
            {DURATION_PRESETS.map((option) => (
              <SelectionButton
                key={option.value}
                active={durationSelection === option.value}
                label={option.label}
                onClick={() => setDurationSelection(option.value)}
                className="w-[138px] px-0"
              />
            ))}
            <InlineCustomSelection
              active={durationSelection === 'custom'}
              value={customDurationInput}
              onActivate={() => setDurationSelection('custom')}
              onChange={setCustomDurationInput}
              ariaLabel="Custom duration"
              className="w-full justify-self-stretch px-6"
              testId="custom-duration-inline"
            />
          </div>
        </section>
      </div>

      <FooterAction label="NEXT STEP" onClick={handleTokensNext} disabled={!tokensStepValid} />
    </div>
  );

  const renderDetailsStep = () => (
    <div className="mt-[28px] flex flex-1 flex-col">
      <div className="space-y-[26px]">
        <section>
          <FigmaSectionLabel>Tournament name:</FigmaSectionLabel>
          <FigmaTextInput
            value={name}
            onChange={(value) => {
              setNameEditedManually(true);
              setName(value);
            }}
            maxLength={60}
            placeholder="e.g. Friday Night Box Fight"
            className="mt-[10px]"
            testId="tournament-name-field"
          />
        </section>

        <div className="grid grid-cols-2 gap-[26px]">
          <section>
            <FigmaSectionLabel>Region:</FigmaSectionLabel>
            <div className="mt-[10px]">
              <FigmaSelectField
                value={region}
                onChange={(value) => setRegion(value as Region)}
                options={REGIONS.map((value) => ({ value, label: value }))}
              />
            </div>
          </section>

          <section>
            <FigmaSectionLabel>Entry fee:</FigmaSectionLabel>
            <div className="mt-[10px] grid grid-cols-[minmax(0,1fr)_120px] gap-[18px]">
              <FigmaTextInput type="number" min="0" step="0.01" value={entryFee} onChange={setEntryFee} placeholder="0" />
              <SelectionButton
                active={entryNum === 0}
                label="FREE"
                onClick={() => setEntryFee('0')}
                className="h-[68px] px-0 text-[24px]"
              />
            </div>
          </section>
        </div>

        <div className="grid grid-cols-2 gap-[26px]">
          <section>
            <FigmaSectionLabel>Start date:</FigmaSectionLabel>
            <FigmaTextInput
              type="date"
              value={startDate}
              onChange={setStartDate}
              className="mt-[10px]"
              testId="tournament-start-date-field"
            />
          </section>

          <section>
            <FigmaSectionLabel>Start time:</FigmaSectionLabel>
            <FigmaTextInput
              type="time"
              value={startTime}
              onChange={setStartTime}
              className="mt-[10px]"
              testId="tournament-start-time-field"
            />
          </section>
        </div>

        {startInPast && (
          <p className="flex items-center gap-2 text-[15px] text-red-400" style={{ fontFamily: FONT_REGULAR }}>
            <AlertCircle className="h-4 w-4 shrink-0" />
            Start date must be in the future.
          </p>
        )}
      </div>

      <FooterAction label="NEXT STEP" onClick={handleDetailsNext} disabled={!detailsStepValid} />
    </div>
  );

  const renderPrizeStep = () => (
    <div className="mt-[28px] flex flex-1 flex-col">
      <div className="space-y-[24px]">
        <div className="grid grid-cols-[minmax(0,1fr)_270px] gap-[26px]">
          <section>
            <FigmaSectionLabel>{`Prize pool${!isAdmin ? ` (balance ${balance.toFixed(2)})` : ''}:`}</FigmaSectionLabel>
            <FigmaTextInput
              type="number"
              min="0"
              step="0.01"
              value={prizePool}
              onChange={setPrizePool}
              className={cn('mt-[10px]', insufficientBalance && 'border-red-500')}
              testId="tournament-prize-pool-field"
            />
            {insufficientBalance && (
              <p className="mt-2 flex items-center gap-2 text-[15px] text-red-400" style={{ fontFamily: FONT_REGULAR }}>
                <AlertCircle className="h-4 w-4 shrink-0" />
                Insufficient balance for this prize pool.
              </p>
            )}
          </section>

          <section>
            <FigmaSectionLabel>Rules:</FigmaSectionLabel>
            <div className="mt-[10px] rounded-[18px] border border-[#ff1654] bg-[rgba(0,0,0,0.38)] p-4">
              <textarea
                value={rules}
                onChange={(event) => setRules(event.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="Map rules, banned weapons, or schedule notes."
                className="h-[118px] w-full resize-none appearance-none border-0 bg-transparent text-[18px] text-white outline-none ring-0 placeholder:text-white/36 focus:border-0 focus:outline-none focus:ring-0"
                style={{ fontFamily: FONT_REGULAR }}
              />
            </div>
          </section>
        </div>

        <section>
          <FigmaSectionLabel>Prize preset:</FigmaSectionLabel>
          <div className="mt-[10px] grid grid-cols-3 gap-[18px]">
            {TOURNAMENT_PRIZE_PRESETS.map((preset, idx) => (
              <SelectionButton
                key={preset.label}
                active={activePresetIdx === idx}
                label={preset.label.toUpperCase()}
                onClick={() => applyPreset(idx)}
                className="text-[22px] leading-[1.05]"
              />
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-end justify-between">
            <FigmaSectionLabel>Prize distribution:</FigmaSectionLabel>
            <div className="text-right text-[15px]" style={{ fontFamily: FONT_REGULAR }}>
              <div className="text-white/70">
                Sum <span className="text-white">{prizeRowsSum.toFixed(2)}</span> / {seedNum.toFixed(2)}
              </div>
              <div className={sumValid ? 'text-emerald-400' : 'text-red-400'}>
                {sumValid ? 'Valid split' : 'Must equal prize pool'}
              </div>
            </div>
          </div>

          <div className="mt-[10px] grid grid-cols-3 gap-[16px]" data-testid="prize-distribution-grid">
            {prizeRows.map((row, idx) => (
              <div
                key={`${row.position}-${idx}`}
                className="rounded-[18px] border border-[#ff1654] bg-[rgba(0,0,0,0.38)] px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[14px] uppercase tracking-[0.12em] text-white/55" style={{ fontFamily: FONT_EXPANDED }}>
                    Position {row.position}
                  </span>
                  {prizeRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(idx)}
                      className="rounded-full p-1 text-white/35 transition-colors hover:bg-white/5 hover:text-red-400"
                      aria-label={`Remove prize position ${row.position}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount}
                  onChange={(event) => updateRowAmount(idx, event.target.value)}
                  className="mt-[8px] w-full appearance-none border-0 bg-transparent text-[30px] text-white outline-none ring-0 placeholder:text-white/36 focus:border-0 focus:outline-none focus:ring-0"
                  style={{ fontFamily: FONT_EXPANDED_BOLD }}
                />
                <p className="mt-1 text-[14px] uppercase tracking-[0.12em] text-white/45" style={{ fontFamily: FONT_EXPANDED }}>
                  coins
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-[14px] inline-flex h-[48px] items-center gap-2 rounded-[18px] border border-[#ff1654] bg-[rgba(255,22,84,0.18)] px-5 text-[18px] text-white transition-colors hover:bg-[rgba(255,22,84,0.28)]"
            style={{ fontFamily: FONT_EXPANDED_BOLD }}
          >
            <Plus className="h-4 w-4" />
            ADD POSITION
          </button>
        </section>
      </div>

      <FooterAction
        label="CREATE TOURNAMENT"
        onClick={handleSubmit}
        disabled={!canSubmit}
        loading={createMutation.isPending}
      />
    </div>
  );

  const overlay = (
    <div className="fixed inset-0 z-[70] overflow-hidden" data-testid="create-tournament-overlay">
      <div
        className="absolute inset-0 bg-[rgba(15,4,4,0.7)]"
        data-testid="create-tournament-scrim"
        onMouseDown={() => {
          if (!createMutation.isPending) {
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
        <section
          className="h-full w-full overflow-hidden rounded-[18px] border border-[#ff1654] bg-[#282828] shadow-[0_30px_100px_rgba(0,0,0,0.45)]"
          onMouseDown={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-tournament-title"
          data-testid="create-tournament-panel"
        >
          <div className="flex h-full flex-col px-[49px] pb-[35px] pt-[37px] text-white">
            <div className="text-center">
              <h1
                id="create-tournament-title"
                className="text-[64px] leading-[0.95] text-white"
                style={{ fontFamily: FONT_EXPANDED_BOLD }}
              >
                SET TOURNAMEMNTS
              </h1>
              <StepTabs activeStep={step} onSelect={handleTabSelect} />
            </div>

            {step === 'game' && renderGameStep()}
            {step === 'tokens' && renderTokensStep()}
            {step === 'details' && renderDetailsStep()}
            {step === 'prize' && renderPrizeStep()}
          </div>
        </section>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
