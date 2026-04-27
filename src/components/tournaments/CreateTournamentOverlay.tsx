import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useCreateTournament } from '@/hooks/useTournaments';
import { cn } from '@/lib/utils';
import {
  GAME_MODES,
  TEAM_SIZES,
  TOURNAMENT_CAPACITY_PRESETS,
  TOURNAMENT_DURATION_PRESETS,
  TOURNAMENT_PRIZE_PRESETS,
  type GameMode,
  type Region,
  type Platform,
} from '@/types';

const FONT_REGULAR = "'Base Neue Trial', sans-serif";
const FONT_EXPANDED = "'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK = "'Base Neue Trial', sans-serif";

const REGIONS: Region[] = ['EU', 'NA-East', 'NA-West', 'OCE', 'BR', 'ASIA', 'ME'];
const PLATFORMS: Platform[] = ['All', 'PC', 'Console', 'Mobile'];
const FIRST_TO_OPTIONS = [1, 3, 5, 7, 10] as const;

interface PrizeRow {
  position: number;
  amount: string;
}

interface CreateTournamentOverlayProps {
  open: boolean;
  onClose: () => void;
  onCreated?: (tournamentId: string) => void;
}

function isAdminProfile(role?: string | null) {
  return role === 'admin';
}

function defaultPrizeRows(seed: number, splitPercents: number[]): PrizeRow[] {
  return splitPercents.map((pct, idx) => ({
    position: idx + 1,
    amount: ((seed * pct) / 100).toFixed(2),
  }));
}

export function CreateTournamentOverlay({ open, onClose, onCreated }: CreateTournamentOverlayProps) {
  const { profile, wallet } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const createMutation = useCreateTournament();

  const isAdmin = isAdminProfile(profile?.role);
  const balance = wallet?.balance ?? 0;

  const [name, setName] = useState('');
  const [mode, setMode] = useState<GameMode>('Box Fight');
  const [teamSize, setTeamSize] = useState<number>(1);
  const [firstTo, setFirstTo] = useState<number>(3);
  const [region, setRegion] = useState<Region>('EU');
  const [platform, setPlatform] = useState<Platform>('All');
  const [capacity, setCapacity] = useState<number>(8);
  const [entryFee, setEntryFee] = useState<string>('0');
  const [prizePool, setPrizePool] = useState<string>('20');
  const [durationSeconds, setDurationSeconds] = useState<number>(3600);
  const [startDate, setStartDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [rules, setRules] = useState<string>('');
  const [prizeRows, setPrizeRows] = useState<PrizeRow[]>(() =>
    defaultPrizeRows(20, TOURNAMENT_PRIZE_PRESETS[1].splits)
  );
  const [activePresetIdx, setActivePresetIdx] = useState<number>(1);

  // Reset form when opened
  useEffect(() => {
    if (open) {
      setName('');
      setMode('Box Fight');
      setTeamSize(1);
      setFirstTo(3);
      setRegion('EU');
      setPlatform('All');
      setCapacity(8);
      setEntryFee('0');
      setPrizePool('20');
      setDurationSeconds(3600);
      // Default start: tomorrow at the current time, rounded to next hour
      {
        const t = new Date();
        t.setDate(t.getDate() + 1);
        t.setMinutes(0, 0, 0);
        const yyyy = t.getFullYear();
        const mm = String(t.getMonth() + 1).padStart(2, '0');
        const dd = String(t.getDate()).padStart(2, '0');
        const hh = String(t.getHours()).padStart(2, '0');
        setStartDate(`${yyyy}-${mm}-${dd}`);
        setStartTime(`${hh}:00`);
      }
      setRules('');
      setPrizeRows(defaultPrizeRows(20, TOURNAMENT_PRIZE_PRESETS[1].splits));
      setActivePresetIdx(1);
    }
  }, [open]);

  // Re-apply preset when prize pool changes (only if a preset is active)
  useEffect(() => {
    if (activePresetIdx === -1) return;
    const seed = parseFloat(prizePool) || 0;
    setPrizeRows(defaultPrizeRows(seed, TOURNAMENT_PRIZE_PRESETS[activePresetIdx].splits));
  }, [prizePool, activePresetIdx]);

  // Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const seedNum = parseFloat(prizePool) || 0;
  const entryNum = parseFloat(entryFee) || 0;
  const prizeRowsSum = useMemo(
    () => prizeRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
    [prizeRows]
  );
  // Match the SQL ROUND(v_sum,2) = ROUND(p_prize_pool,2) check exactly
  const sumValid =
    parseFloat(prizeRowsSum.toFixed(2)) === parseFloat(seedNum.toFixed(2));

  const insufficientBalance = !isAdmin && seedNum > balance;

  // Combine date + time into ISO. Empty inputs => null (creator must start manually).
  const scheduledStartIso = useMemo<string | null>(() => {
    if (!startDate || !startTime) return null;
    const dt = new Date(`${startDate}T${startTime}`);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }, [startDate, startTime]);

  const startInPast =
    scheduledStartIso !== null && new Date(scheduledStartIso).getTime() < Date.now() - 60_000;

  const canSubmit =
    name.trim().length >= 3 &&
    seedNum >= 0 &&
    sumValid &&
    !insufficientBalance &&
    !startInPast &&
    !createMutation.isPending;

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
      rows.filter((_, i) => i !== idx).map((r, i) => ({ ...r, position: i + 1 }))
    );
  }

  function updateRowAmount(idx: number, amount: string) {
    customizePrizeRows();
    setPrizeRows((rows) => rows.map((r, i) => (i === idx ? { ...r, amount } : r)));
  }

  async function handleSubmit() {
    try {
      const tournamentId = await createMutation.mutateAsync({
        name: name.trim(),
        mode,
        team_size: teamSize,
        max_participants: capacity,
        entry_fee: entryNum,
        prize_pool: seedNum,
        duration_seconds: durationSeconds,
        scheduled_start_at: scheduledStartIso,
        first_to: firstTo,
        region,
        platform,
        rules: rules.trim() || undefined,
        // Send amounts as numbers rounded to 2dp so SQL ROUND() matches
        prize_positions: prizeRows.map((r) => ({
          position: r.position,
          amount: parseFloat((parseFloat(r.amount) || 0).toFixed(2)),
        })),
      });
      toast({ title: '🏆 Tournament created!' });
      onCreated?.(tournamentId);
      onClose();
      navigate(`/tournaments/${tournamentId}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : 'Failed to create tournament';
      toast({
        title: 'Failed to create tournament',
        description: message,
        variant: 'destructive',
      });
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto"
      style={{ background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-12 w-full max-w-[860px] rounded-2xl border border-[#ff1654]/40 bg-[#0f0404] px-8 py-8 text-white shadow-[0_0_60px_rgba(255,22,84,0.25)]"
        style={{ fontFamily: FONT_REGULAR }}
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p
              className="text-[14px] uppercase tracking-[0.2em] text-[#ff1654]"
              style={{ fontFamily: FONT_EXPANDED_BOLD }}
            >
              CREATE TOURNAMENT
            </p>
            <h2
              className="mt-1 text-[32px] leading-none"
              style={{ fontFamily: FONT_WIDE_BLACK }}
            >
              SET YOUR ARENA
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/15 p-2 transition-colors hover:border-white/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Admin badge */}
        {isAdmin && (
          <div className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
            <ShieldCheck className="h-4 w-4" />
            Admin mode — your wallet will not be debited for the prize pool seed.
          </div>
        )}

        {/* Name */}
        <Section label="TOURNAMENT NAME">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="e.g. Friday Night Box Fight"
            className="h-11 w-full rounded-lg border border-white/15 bg-[#1a0a0a] px-4 text-[15px] outline-none transition-colors focus:border-[#ff1654]"
          />
        </Section>

        {/* Mode + size */}
        <div className="grid grid-cols-2 gap-4">
          <Section label="MODE">
            <SegButtons
              value={mode}
              options={GAME_MODES.map((m) => ({ value: m, label: m.toUpperCase() }))}
              onChange={(v) => setMode(v as GameMode)}
            />
          </Section>
          <Section label="TEAM SIZE">
            <SegButtons
              value={String(teamSize)}
              options={TEAM_SIZES.map((s) => ({
                value: String(s.value),
                label: `${s.value}V${s.value}`,
              }))}
              onChange={(v) => setTeamSize(Number(v))}
            />
          </Section>
        </div>

        {/* First to + capacity */}
        <div className="grid grid-cols-2 gap-4">
          <Section label="FIRST TO">
            <SegButtons
              value={String(firstTo)}
              options={FIRST_TO_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
              onChange={(v) => setFirstTo(Number(v))}
            />
          </Section>
          <Section label="CAPACITY">
            <SegButtons
              value={String(capacity)}
              options={TOURNAMENT_CAPACITY_PRESETS.map((n) => ({
                value: String(n),
                label: String(n),
              }))}
              onChange={(v) => setCapacity(Number(v))}
            />
          </Section>
        </div>

        {/* Region + platform */}
        <div className="grid grid-cols-2 gap-4">
          <Section label="REGION">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value as Region)}
              className="h-11 w-full rounded-lg border border-white/15 bg-[#1a0a0a] px-4 text-[15px] outline-none focus:border-[#ff1654]"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Section>
          <Section label="PLATFORM">
            <SegButtons
              value={platform}
              options={PLATFORMS.map((p) => ({
                value: p,
                label: p === 'All' ? 'ANY' : p.toUpperCase(),
              }))}
              onChange={(v) => setPlatform(v as Platform)}
            />
          </Section>
        </div>

        {/* Start date + duration */}
        <div className="grid grid-cols-2 gap-4">
          <Section label="START DATE">
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 w-1/2 rounded-lg border border-white/15 bg-[#1a0a0a] px-3 text-[15px] text-white outline-none focus:border-[#ff1654]"
              />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-11 w-1/2 rounded-lg border border-white/15 bg-[#1a0a0a] px-3 text-[15px] text-white outline-none focus:border-[#ff1654]"
              />
            </div>
            {startInPast && (
              <p className="mt-1 flex items-center gap-1 text-[12px] text-red-400">
                <AlertCircle className="h-3 w-3" /> Start date must be in the future
              </p>
            )}
            {!startInPast && scheduledStartIso && (
              <p className="mt-1 text-[11px] text-white/40">
                Registration auto-opens to ready-up at this time.
              </p>
            )}
          </Section>
          <Section label="DURATION">
            <SegButtons
              value={String(durationSeconds)}
              options={TOURNAMENT_DURATION_PRESETS.map((d) => ({
                value: String(d.value),
                label: d.label.toUpperCase(),
              }))}
              onChange={(v) => setDurationSeconds(Number(v))}
            />
          </Section>
        </div>

        {/* Entry fee + prize pool */}
        <div className="grid grid-cols-2 gap-4">
          <Section label="ENTRY FEE (PER PLAYER/TEAM)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                className="h-11 w-full rounded-lg border border-white/15 bg-[#1a0a0a] px-4 text-[15px] outline-none focus:border-[#ff1654]"
              />
              <button
                type="button"
                onClick={() => setEntryFee('0')}
                className={cn(
                  'h-11 whitespace-nowrap rounded-lg border px-3 text-[12px] uppercase transition-colors',
                  entryNum === 0
                    ? 'border-[#ff1654] bg-[#ff1654]/20 text-white'
                    : 'border-white/15 text-white/70 hover:border-white/40'
                )}
              >
                FREE
              </button>
            </div>
          </Section>
          <Section
            label={`PRIZE POOL (SEED) ${
              !isAdmin ? `— BALANCE: ${balance.toFixed(2)}` : ''
            }`}
          >
            <input
              type="number"
              step="0.01"
              min="0"
              value={prizePool}
              onChange={(e) => setPrizePool(e.target.value)}
              className={cn(
                'h-11 w-full rounded-lg border bg-[#1a0a0a] px-4 text-[15px] outline-none',
                insufficientBalance ? 'border-red-500' : 'border-white/15 focus:border-[#ff1654]'
              )}
            />
            {insufficientBalance && (
              <p className="mt-1 flex items-center gap-1 text-[12px] text-red-400">
                <AlertCircle className="h-3 w-3" /> Insufficient balance
              </p>
            )}
          </Section>
        </div>

        {/* Prize positions */}
        <Section label="PRIZE DISTRIBUTION">
          <div className="mb-3 flex flex-wrap gap-2">
            {TOURNAMENT_PRIZE_PRESETS.map((preset, idx) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(idx)}
                className={cn(
                  'h-9 rounded-lg border px-3 text-[12px] uppercase transition-colors',
                  activePresetIdx === idx
                    ? 'border-[#ff1654] bg-[#ff1654]/20 text-white'
                    : 'border-white/15 text-white/70 hover:border-white/40'
                )}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="flex h-9 items-center gap-1 rounded-lg border border-white/15 px-3 text-[12px] uppercase text-white/70 transition-colors hover:border-white/40"
            >
              <Plus className="h-3 w-3" /> Position
            </button>
          </div>

          <div className="space-y-2">
            {prizeRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-12 text-center text-[14px] text-white/60">
                  #{row.position}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={row.amount}
                  onChange={(e) => updateRowAmount(idx, e.target.value)}
                  className="h-10 w-32 rounded-lg border border-white/15 bg-[#1a0a0a] px-3 text-[14px] outline-none focus:border-[#ff1654]"
                />
                <span className="text-[12px] text-white/50">coins</span>
                {prizeRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="ml-auto rounded-md p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-red-400"
                    aria-label="Remove position"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between text-[13px]">
            <span className="text-white/60">
              Sum: <span className="text-white">{prizeRowsSum.toFixed(2)}</span> /{' '}
              {seedNum.toFixed(2)}
            </span>
            <span className={sumValid ? 'text-emerald-400' : 'text-red-400'}>
              {sumValid ? '✓ valid split' : 'must equal prize pool'}
            </span>
          </div>
        </Section>

        {/* Rules */}
        <Section label="RULES (OPTIONAL)">
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Map rules, banned weapons, etc."
            className="w-full rounded-lg border border-white/15 bg-[#1a0a0a] px-4 py-3 text-[14px] outline-none focus:border-[#ff1654]"
          />
        </Section>

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={cn(
            'mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg text-[16px] uppercase transition-colors',
            canSubmit
              ? 'bg-[#ff1654] text-white hover:bg-[#ff1654]/90'
              : 'cursor-not-allowed bg-white/10 text-white/40'
          )}
          style={{ fontFamily: FONT_EXPANDED_BOLD }}
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              CREATE TOURNAMENT
              {!isAdmin && seedNum > 0 && (
                <span className="text-[12px] opacity-80">— {seedNum.toFixed(2)} coins</span>
              )}
            </>
          )}
        </button>
      </div>
    </div>,
    document.body
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p
        className="mb-2 text-[12px] uppercase tracking-[0.15em] text-white/60"
        style={{ fontFamily: FONT_EXPANDED }}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

interface SegButtonsProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function SegButtons({ value, options, onChange }: SegButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-11 min-w-[64px] rounded-lg border px-4 text-[13px] uppercase transition-colors',
            value === opt.value
              ? 'border-[#ff1654] bg-[#ff1654]/20 text-white'
              : 'border-white/15 text-white/70 hover:border-white/40'
          )}
          style={{ fontFamily: FONT_EXPANDED_BOLD }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
