import type { Tournament } from '@/types';
import {
  FieldLabel,
  FigmaPillButton,
  FONTS,
  TournamentModalShell,
} from './TournamentDesign';

interface TournamentRulesOverlayProps {
  open: boolean;
  tournament: Tournament;
  onClose: () => void;
}

export function TournamentRulesOverlay({ open, tournament, onClose }: TournamentRulesOverlayProps) {
  const rules = tournament.rules?.trim();

  return (
    <TournamentModalShell
      open={open}
      onClose={onClose}
      eyebrow="TOURNAMENT RULES"
      title={`${tournament.team_size}V${tournament.team_size} ${tournament.mode.toUpperCase()}`}
      footer={
        <div className="flex justify-end">
          <FigmaPillButton pink className="w-[247px]" onClick={onClose}>
            Close
          </FigmaPillButton>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="rounded-[18px] border border-[#ff1654] bg-[#0f0404]/55 p-6">
          <FieldLabel>Rules</FieldLabel>
          {rules ? (
            <p className="whitespace-pre-wrap text-[20px] leading-[1.35] text-white" style={{ fontFamily: FONTS.regular }}>
              {rules}
            </p>
          ) : (
            <p className="text-[22px] leading-[1.2] text-white/70" style={{ fontFamily: FONTS.expandedBold }}>
              No custom rules were added. Follow the standard OLEBOY match rules and ready-up flow.
            </p>
          )}
        </div>

        <aside className="rounded-[18px] border border-white/15 bg-[#0f0404]/55 p-5">
          <FieldLabel>Format</FieldLabel>
          <dl className="space-y-4 text-white">
            <RuleStat label="Entry" value={Number(tournament.entry_fee) === 0 ? 'free' : Number(tournament.entry_fee).toFixed(2)} />
            <RuleStat label="Prize" value={Number(tournament.prize_pool_total).toFixed(2)} />
            <RuleStat label="First to" value={String(tournament.first_to)} />
            <RuleStat label="Platform" value={tournament.platform === 'All' ? 'ANY' : tournament.platform} />
          </dl>
        </aside>
      </div>
    </TournamentModalShell>
  );
}
function RuleStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[12px] uppercase tracking-[0.12em] text-white/45" style={{ fontFamily: FONTS.expanded }}>
        {label}
      </dt>
      <dd className="mt-1 text-[24px] leading-none text-white" style={{ fontFamily: FONTS.expandedBold }}>
        {value}
      </dd>
    </div>
  );
}
