import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEligibleTeams } from '@/hooks/useEligibleTeams';
import type { Tournament } from '@/types';
import {
  FieldLabel,
  FigmaPillButton,
  FONTS,
  TOURNAMENT_ASSETS,
  TournamentModalShell,
} from './TournamentDesign';

interface TournamentRegisterOverlayProps {
  open: boolean;
  tournament: Tournament;
  busy: boolean;
  onClose: () => void;
  onConfirm: (teamId?: string) => Promise<void>;
}

export function TournamentRegisterOverlay({
  open,
  tournament,
  busy,
  onClose,
  onConfirm,
}: TournamentRegisterOverlayProps) {
  const { user } = useAuth();
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const teamSize = Number(tournament.team_size);
  const entryFee = Number(tournament.entry_fee);
  const isTeamTournament = teamSize > 1;
  const { eligibleTeams, loading } = useEligibleTeams(teamSize, entryFee);
  const ownerTeams = useMemo(
    () => eligibleTeams.filter((team) => team.owner_id === user?.id),
    [eligibleTeams, user?.id],
  );

  useEffect(() => {
    if (open) setSelectedTeamId(null);
  }, [open]);

  const canConfirm = !busy && (!isTeamTournament || !!selectedTeamId);

  return (
    <TournamentModalShell
      open={open}
      onClose={onClose}
      eyebrow="TOURNAMENT REGISTER"
      title={isTeamTournament ? `SELECT ${teamSize}V${teamSize} TEAM` : 'CONFIRM ENTRY'}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-[14px] text-white/55" style={{ fontFamily: FONTS.expanded }}>
            Entry {entryFee === 0 ? 'free' : `${entryFee.toFixed(2)} coins`} - Prize{' '}
            {Number(tournament.prize_pool_total).toFixed(2)}
          </p>
          <div className="flex gap-3">
            <FigmaPillButton className="w-[160px]" onClick={onClose}>
              Cancel
            </FigmaPillButton>
            <FigmaPillButton
              pink
              className="w-[247px]"
              disabled={!canConfirm}
              onClick={() => onConfirm(selectedTeamId ?? undefined)}
            >
              {busy ? 'Working...' : 'Register'}
            </FigmaPillButton>
          </div>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Mode" value={`${teamSize}V${teamSize}`} />
            <Stat label="First to" value={String(tournament.first_to)} />
            <Stat label="Platform" value={tournament.platform === 'All' ? 'ANY' : tournament.platform} />
            <Stat label="Status" value={tournament.status.toUpperCase()} />
          </div>

          {!isTeamTournament ? (
            <div className="rounded-[18px] border border-[#ff1654]/50 bg-[#0f0404]/55 p-6">
              <FieldLabel>Solo registration</FieldLabel>
              <p className="text-[22px] leading-[1.15] text-white" style={{ fontFamily: FONTS.expandedBold }}>
                You are registering as a solo player. The tournament system keeps pairing players once ready-up starts.
              </p>
            </div>
          ) : loading ? (
            <div className="flex min-h-[280px] items-center justify-center rounded-[18px] border border-white/10 bg-[#0f0404]/55 text-[20px] text-white/60" style={{ fontFamily: FONTS.expanded }}>
              LOADING TEAMS...
            </div>
          ) : ownerTeams.length === 0 ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[18px] border border-[#ff1654]/45 bg-[#0f0404]/55 px-6 text-center">
              <p className="text-[30px] text-white" style={{ fontFamily: FONTS.expandedBlack }}>
                NO OWNER TEAM READY
              </p>
              <p className="mt-3 max-w-[560px] text-[16px] text-white/65" style={{ fontFamily: FONTS.regular }}>
                You need to own a team with exactly {teamSize} accepted players before registering this tournament.
              </p>
              <Link
                to="/teams"
                className="mt-5 inline-flex h-[47px] items-center justify-center rounded-[16px] border border-[#ff1654] bg-[rgba(255,22,84,0.2)] px-8 text-[20px] text-white no-underline"
                style={{ fontFamily: FONTS.expandedBold }}
                onClick={onClose}
              >
                MANAGE TEAMS
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <FieldLabel>Choose team</FieldLabel>
              {ownerTeams.map((team) => {
                const selected = selectedTeamId === team.id;
                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeamId(selected ? null : team.id)}
                    className="flex w-full items-center gap-4 rounded-[18px] border p-4 text-left transition hover:border-[#ff1654]/70"
                    style={{
                      borderColor: selected ? '#ff1654' : 'rgba(255,255,255,0.12)',
                      background: selected ? 'rgba(255,22,84,0.18)' : 'rgba(15,4,4,0.55)',
                    }}
                  >
                    <div className="flex h-[68px] w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10">
                      {team.logo_url ? (
                        <img src={team.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <img src={TOURNAMENT_ASSETS.teamAvatar} alt="" aria-hidden="true" className="h-full w-full" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[24px] leading-none text-white" style={{ fontFamily: FONTS.expandedBold }}>
                        {team.name}
                      </p>
                      <p className="mt-2 text-[14px] uppercase tracking-[0.1em] text-white/55" style={{ fontFamily: FONTS.expanded }}>
                        {team.acceptedMemberCount}/{teamSize} players ready
                      </p>
                    </div>
                    <span className="h-[19px] w-[19px] rounded-full bg-[#ff1654]" aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <aside className="rounded-[18px] border border-[#ff1654] bg-[#0f0404]/55 p-5">
          <FieldLabel>Registration Progress</FieldLabel>
          <p className="text-[42px] leading-none text-white" style={{ fontFamily: FONTS.expandedBlack }}>
            {(tournament.participants?.length ?? tournament.participant_count ?? 0)}/{tournament.max_participants}
          </p>
          <div className="mt-5 h-[25px] overflow-hidden rounded-[4px] bg-[#ff1654]">
            <div
              className="h-full bg-[rgba(119,254,92,0.79)]"
              style={{
                width: `${Math.min(
                  100,
                  (((tournament.participants?.length ?? tournament.participant_count ?? 0) / tournament.max_participants) * 100),
                )}%`,
              }}
            />
          </div>
          <p className="mt-5 text-[15px] leading-[1.3] text-white/60" style={{ fontFamily: FONTS.regular }}>
            Registration closes when the bracket is full or when the scheduled start reaches ready-up.
          </p>
        </aside>
      </div>
    </TournamentModalShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-[#ff1654] bg-[#0f0404]/45 px-4 py-3">
      <p className="text-[12px] uppercase tracking-[0.12em] text-white/50" style={{ fontFamily: FONTS.expanded }}>
        {label}
      </p>
      <p className="mt-1 truncate text-[19px] text-white" style={{ fontFamily: FONTS.expandedBold }}>
        {value}
      </p>
    </div>
  );
}
