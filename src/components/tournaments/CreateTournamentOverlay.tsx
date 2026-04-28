import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  type Platform,
  type Region,
} from '@/types';
import {
  FieldLabel,
  FigmaPillButton,
  FONTS,
  TOURNAMENT_ASSETS,
  TournamentInput,
  TournamentModalShell,
  TournamentSelect,
  TournamentTextarea,
} from './TournamentDesign';

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

function defaultPrizeRows(seed: number, splitPercents: number[]): PrizeRow[] {
  return splitPercents.map((pct, idx) => ({
    position: idx + 1,
    amount: ((seed * pct) / 100).toFixed(2),
  }));
}

function isAdminRole(role?: string | null) {
  return role === 'admin';
}

function tomorrowRounded() {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setMinutes(0, 0, 0);
  return {
    date: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`,
    time: `${String(t.getHours()).padStart(2, '0')}:00`,
  };
}

export function CreateTournamentOverlay({ open, onClose, onCreated }: CreateTournamentOverlayProps) {
  const { profile, wallet } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const createMutation = useCreateTournament();
  const isAdmin = isAdminRole(profile?.role);
  const balance = wallet?.balance ?? 0;

  const [name, setName] = useState('');
  const [mode, setMode] = useState<GameMode>('Box Fight');
  const [teamSize, setTeamSize] = useState<number>(1);
  const [firstTo, setFirstTo] = useState<number>(3);
  const [region, setRegion] = useState<Region>('EU');
  const [platform, setPlatform] = useState<Platform>('All');
  const [capacity, setCapacity] = useState<number>(8);
  const [entryFee, setEntryFee] = useState('0');
  const [prizePool, setPrizePool] = useState('20');
  const [durationSeconds, setDurationSeconds] = useState<number>(3600);
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [rules, setRules] = useState('');
  const [activePresetIdx, setActivePresetIdx] = useState(1);
  const [prizeRows, setPrizeRows] = useState<PrizeRow[]>(() =>
    defaultPrizeRows(20, TOURNAMENT_PRIZE_PRESETS[1].splits),
  );

  useEffect(() => {
    if (!open) return;
    const start = tomorrowRounded();
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
    setStartDate(start.date);
    setStartTime(start.time);
    setRules('');
    setActivePresetIdx(1);
    setPrizeRows(defaultPrizeRows(20, TOURNAMENT_PRIZE_PRESETS[1].splits));
  }, [open]);

  useEffect(() => {
    if (activePresetIdx === -1) return;
    const seed = parseFloat(prizePool) || 0;
    setPrizeRows(defaultPrizeRows(seed, TOURNAMENT_PRIZE_PRESETS[activePresetIdx].splits));
  }, [prizePool, activePresetIdx]);

  const prizePoolNumber = parseFloat(prizePool) || 0;
  const entryFeeNumber = parseFloat(entryFee) || 0;
  const prizeRowsSum = useMemo(
    () => prizeRows.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0),
    [prizeRows],
  );
  const sumValid = parseFloat(prizeRowsSum.toFixed(2)) === parseFloat(prizePoolNumber.toFixed(2));
  const insufficientBalance = !isAdmin && prizePoolNumber > balance;

  const scheduledStartIso = useMemo<string | null>(() => {
    if (!startDate || !startTime) return null;
    const dt = new Date(`${startDate}T${startTime}`);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
  }, [startDate, startTime]);

  const startInPast =
    scheduledStartIso !== null && new Date(scheduledStartIso).getTime() < Date.now() - 60_000;

  const canSubmit =
    name.trim().length >= 3 &&
    prizePoolNumber >= 0 &&
    entryFeeNumber >= 0 &&
    sumValid &&
    !insufficientBalance &&
    !startInPast &&
    !createMutation.isPending;

  function applyPreset(idx: number) {
    setActivePresetIdx(idx);
    setPrizeRows(defaultPrizeRows(prizePoolNumber, TOURNAMENT_PRIZE_PRESETS[idx].splits));
  }

  function customizePrizeRows() {
    setActivePresetIdx(-1);
  }

  function addPrizeRow() {
    customizePrizeRows();
    setPrizeRows((rows) => [...rows, { position: rows.length + 1, amount: '0' }]);
  }

  function removePrizeRow(index: number) {
    customizePrizeRows();
    setPrizeRows((rows) =>
      rows.filter((_, i) => i !== index).map((row, i) => ({ ...row, position: i + 1 })),
    );
  }

  function updatePrizeRow(index: number, amount: string) {
    customizePrizeRows();
    setPrizeRows((rows) => rows.map((row, i) => (i === index ? { ...row, amount } : row)));
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    try {
      const tournamentId = await createMutation.mutateAsync({
        name: name.trim(),
        mode,
        team_size: teamSize,
        max_participants: capacity,
        entry_fee: entryFeeNumber,
        prize_pool: prizePoolNumber,
        duration_seconds: durationSeconds,
        scheduled_start_at: scheduledStartIso,
        first_to: firstTo,
        region,
        platform,
        rules: rules.trim() || undefined,
        prize_positions: prizeRows.map((row) => ({
          position: row.position,
          amount: parseFloat((parseFloat(row.amount) || 0).toFixed(2)),
        })),
      });
      toast({ title: 'Tournament created!' });
      onCreated?.(tournamentId);
      onClose();
      navigate(`/tournaments/${tournamentId}`);
    } catch (err) {
      toast({
        title: 'Failed to create tournament',
        description: err instanceof Error ? err.message : 'Failed to create tournament',
        variant: 'destructive',
      });
    }
  }

  return (
    <TournamentModalShell
      open={open}
      onClose={onClose}
      eyebrow="CREATE TOURNAMENT"
      title="SET YOUR ARENA"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-[13px] text-white/55" style={{ fontFamily: FONTS.expanded }}>
            {isAdmin ? 'ADMIN-FUNDED' : `BALANCE: ${balance.toFixed(2)}`} - SPLIT:{' '}
            <span className={sumValid ? 'text-[rgba(119,254,92,0.9)]' : 'text-[#ff1654]'}>
              {prizeRowsSum.toFixed(2)} / {prizePoolNumber.toFixed(2)}
            </span>
          </div>
          <FigmaPillButton
            pink
            className="w-[292px]"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Tournament'}
          </FigmaPillButton>
        </div>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="rounded-[18px] border border-[#ff1654] bg-[#0f0404]/45 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Tournament Name</FieldLabel>
                <TournamentInput
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  placeholder="e.g. Friday Night Box Fight"
                />
              </div>
              <div>
                <FieldLabel>Mode</FieldLabel>
                <Segmented
                  value={mode}
                  options={GAME_MODES.map((item) => ({ value: item, label: item.toUpperCase() }))}
                  onChange={(value) => setMode(value as GameMode)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-white/12 bg-[#0f0404]/45 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Team Size</FieldLabel>
                <Segmented
                  value={String(teamSize)}
                  options={TEAM_SIZES.map((size) => ({
                    value: String(size.value),
                    label: `${size.value}V${size.value}`,
                  }))}
                  onChange={(value) => setTeamSize(Number(value))}
                />
              </div>
              <div>
                <FieldLabel>First To</FieldLabel>
                <Segmented
                  value={String(firstTo)}
                  options={FIRST_TO_OPTIONS.map((option) => ({
                    value: String(option),
                    label: String(option),
                  }))}
                  onChange={(value) => setFirstTo(Number(value))}
                />
              </div>
              <div>
                <FieldLabel>Region</FieldLabel>
                <TournamentSelect value={region} onChange={(event) => setRegion(event.target.value as Region)}>
                  {REGIONS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </TournamentSelect>
              </div>
              <div>
                <FieldLabel>Platform</FieldLabel>
                <Segmented
                  value={platform}
                  options={PLATFORMS.map((item) => ({
                    value: item,
                    label: item === 'All' ? 'ANY' : item.toUpperCase(),
                  }))}
                  onChange={(value) => setPlatform(value as Platform)}
                />
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-white/12 bg-[#0f0404]/45 p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Start Date</FieldLabel>
                <div className="grid grid-cols-2 gap-2">
                  <TournamentInput type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  <TournamentInput type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
                </div>
                {startInPast ? (
                  <p className="mt-2 text-[12px] uppercase tracking-[0.1em] text-[#ff1654]" style={{ fontFamily: FONTS.expanded }}>
                    Start date must be in the future
                  </p>
                ) : null}
              </div>
              <div>
                <FieldLabel>Duration</FieldLabel>
                <Segmented
                  value={String(durationSeconds)}
                  options={TOURNAMENT_DURATION_PRESETS.map((item) => ({
                    value: String(item.value),
                    label: item.label.toUpperCase(),
                  }))}
                  onChange={(value) => setDurationSeconds(Number(value))}
                />
              </div>
              <div>
                <FieldLabel>Capacity</FieldLabel>
                <Segmented
                  value={String(capacity)}
                  options={TOURNAMENT_CAPACITY_PRESETS.map((item) => ({
                    value: String(item),
                    label: String(item),
                  }))}
                  onChange={(value) => setCapacity(Number(value))}
                />
              </div>
              <div>
                <FieldLabel>Entry Fee</FieldLabel>
                <div className="flex gap-2">
                  <TournamentInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={entryFee}
                    onChange={(event) => setEntryFee(event.target.value)}
                    aria-label="Entry fee"
                  />
                  <button
                    type="button"
                    onClick={() => setEntryFee('0')}
                    className="h-[47px] rounded-[14px] border border-[#ff1654] bg-[rgba(255,22,84,0.2)] px-4 text-[14px] uppercase text-white"
                    style={{ fontFamily: FONTS.expandedBold }}
                  >
                    Free
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[18px] border border-white/12 bg-[#0f0404]/45 p-5">
            <FieldLabel>Rules</FieldLabel>
            <TournamentTextarea
              rows={4}
              value={rules}
              maxLength={2000}
              onChange={(event) => setRules(event.target.value)}
              placeholder="Map rules, banned weapons, ready-up notes..."
            />
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-[18px] border border-[#ff1654] bg-[#0f0404]/45 p-5">
            <FieldLabel>Prize Pool Seed</FieldLabel>
            <TournamentInput
              type="number"
              min="0"
              step="0.01"
              value={prizePool}
              onChange={(event) => setPrizePool(event.target.value)}
              className={insufficientBalance ? 'border-[#ff1654]' : undefined}
            />
            {insufficientBalance ? (
              <p className="mt-2 text-[12px] uppercase tracking-[0.1em] text-[#ff1654]" style={{ fontFamily: FONTS.expanded }}>
                Insufficient balance
              </p>
            ) : null}
          </section>

          <section className="rounded-[18px] border border-white/12 bg-[#0f0404]/45 p-5">
            <FieldLabel>Prize Distribution</FieldLabel>
            <div className="mb-4 flex flex-wrap gap-2">
              {TOURNAMENT_PRIZE_PRESETS.map((preset, index) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(index)}
                  className={cn(
                    'rounded-[12px] border px-3 py-2 text-[12px] uppercase text-white transition hover:border-[#ff1654]',
                    activePresetIdx === index
                      ? 'border-[#ff1654] bg-[rgba(255,22,84,0.2)]'
                      : 'border-white/15 bg-black/20',
                  )}
                  style={{ fontFamily: FONTS.expandedBold }}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={addPrizeRow}
                className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 bg-black/20 px-3 py-2 text-[12px] uppercase text-white transition hover:border-[#ff1654]"
                style={{ fontFamily: FONTS.expandedBold }}
              >
                <img src={TOURNAMENT_ASSETS.plus} alt="" aria-hidden="true" className="h-3 w-3" />
                Position
              </button>
            </div>

            <div className="space-y-3">
              {prizeRows.map((row, index) => (
                <div key={`${row.position}-${index}`} className="flex items-center gap-3">
                  <span className="w-10 text-[20px] text-white" style={{ fontFamily: FONTS.expandedBlack }}>
                    #{row.position}
                  </span>
                  <TournamentInput
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(event) => updatePrizeRow(index, event.target.value)}
                    className="h-[42px]"
                  />
                  {prizeRows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => removePrizeRow(index)}
                      className="h-[42px] rounded-[12px] border border-white/15 px-3 text-[18px] text-white/65 transition hover:border-[#ff1654] hover:text-white"
                      aria-label={`Remove position ${row.position}`}
                    >
                      x
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </TournamentModalShell>
  );
}
function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'h-[47px] min-w-[64px] rounded-[14px] border px-4 text-[13px] uppercase text-white transition hover:border-[#ff1654]',
            value === option.value
              ? 'border-[#ff1654] bg-[rgba(255,22,84,0.2)]'
              : 'border-white/15 bg-[#0f0404]/70',
          )}
          style={{ fontFamily: FONTS.expandedBold }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
