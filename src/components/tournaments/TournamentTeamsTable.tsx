import type { ReactNode } from 'react';
import { FONTS, TOURNAMENT_ASSETS } from './TournamentDesign';

export interface TournamentTeamsTableProps {
  teams: TournamentTeamRow[];
  onJoin?: (teamId: string) => void;
  onView?: (teamId: string) => void;
}

export interface TournamentTeamRow {
  id: string;
  name: string;
  size: string;
  winRate: string;
  variant: 'view' | 'join';
  avatarUrl?: string | null;
}

const ROW_STEP = 107;
const FIRST_ROW_TOP = 93;
const FIRST_ROW_CENTER = 126.5;
const FIRST_BUTTON_TOP = 103;
const FIRST_DIVIDER_TOP = 182;

export function TournamentTeamsTable({ teams, onJoin, onView }: TournamentTeamsTableProps) {
  const tableHeight = Math.max(1136, FIRST_ROW_TOP + Math.max(teams.length, 1) * ROW_STEP + 40);

  return (
    <div
      className="relative w-[1448px] shrink-0 rounded-[14px] bg-[#282828]"
      style={{ height: tableHeight }}
      data-testid="tournament-teams-table"
    >
      <HeaderCell left={199.5}>NAME</HeaderCell>
      <HeaderCell left={532.5}>SIZE</HeaderCell>
      <HeaderCell left={900.5}>WIN RATE</HeaderCell>
      <div className="absolute left-1/2 top-[75px] h-px w-[1350px] -translate-x-1/2 bg-white/12" />

      {teams.map((team, index) => {
        const rowTop = FIRST_ROW_TOP + index * ROW_STEP;
        const rowCenter = FIRST_ROW_CENTER + index * ROW_STEP;
        const buttonTop = FIRST_BUTTON_TOP + index * ROW_STEP;
        const dividerTop = FIRST_DIVIDER_TOP + index * ROW_STEP;
        const buttonLabel = team.variant === 'view' ? 'VIEW' : 'JOIN UP';

        return (
          <div key={team.id}>
            {team.avatarUrl ? (
              <img
                src={team.avatarUrl}
                alt=""
                aria-hidden="true"
                className="absolute h-[68px] w-[68px] rounded-full object-cover"
                style={{ left: 49, top: rowTop }}
              />
            ) : (
              <img
                src={TOURNAMENT_ASSETS.teamAvatar}
                alt=""
                aria-hidden="true"
                className="absolute h-[68px] w-[68px]"
                style={{ left: 49, top: rowTop }}
              />
            )}

            <RowCell left={260.5} top={rowCenter}>{team.name}</RowCell>
            <RowCell left={532.5} top={rowCenter}>{team.size}</RowCell>
            <RowCell left={901} top={rowCenter}>{team.winRate}</RowCell>

            <button
              type="button"
              onClick={() => (team.variant === 'view' ? onView?.(team.id) : onJoin?.(team.id))}
              className="absolute flex h-[47px] w-[156px] items-center justify-center rounded-[16px] border border-[#ff1654] bg-[rgba(255,22,84,0.2)] text-[24px] leading-none text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{ left: 1175, top: buttonTop, fontFamily: FONTS.expandedBold }}
              aria-label={`${buttonLabel} ${team.name}`}
            >
              {buttonLabel}
            </button>

            {index < teams.length - 1 ? (
              <div
                className="absolute left-1/2 h-px w-[1350px] -translate-x-1/2 bg-white/12"
                style={{ top: dividerTop }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function HeaderCell({ children, left }: { children: ReactNode; left: number }) {
  return (
    <p
      className="absolute -translate-x-1/2 whitespace-nowrap text-[24px] leading-none text-white"
      style={{ left, top: 37.5, fontFamily: FONTS.bold }}
    >
      {children}
    </p>
  );
}

function RowCell({ children, left, top }: { children: ReactNode; left: number; top: number }) {
  return (
    <p
      className="absolute max-w-[260px] -translate-x-1/2 -translate-y-1/2 truncate whitespace-nowrap text-[24px] leading-none text-white"
      style={{ left, top, fontFamily: FONTS.expandedBold }}
    >
      {children}
    </p>
  );
}
