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

const GRID_COLUMNS = '88px minmax(220px, 1.4fr) minmax(120px, 1fr) minmax(140px, 1fr) 200px';

export function TournamentTeamsTable({ teams, onJoin, onView }: TournamentTeamsTableProps) {
  return (
    <div
      className="relative w-full rounded-[14px] bg-[#282828]"
      data-testid="tournament-teams-table"
      style={{ minHeight: 260 }}
    >
      <div
        className="grid items-center px-[40px] pt-[36px] pb-[24px]"
        style={{ gridTemplateColumns: GRID_COLUMNS }}
      >
        <span aria-hidden="true" />
        <HeaderCell>NAME</HeaderCell>
        <HeaderCell>SIZE</HeaderCell>
        <HeaderCell>WIN RATE</HeaderCell>
        <span aria-hidden="true" />
      </div>

      <div className="mx-[40px] h-px bg-white/15" aria-hidden="true" />

      {teams.map((team, index) => {
        const buttonLabel = team.variant === 'view' ? 'VIEW' : 'JOIN UP';

        return (
          <div key={team.id} className="relative">
            <div
              className="grid items-center px-[40px] py-[20px]"
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              {team.avatarUrl ? (
                <img
                  src={team.avatarUrl}
                  alt=""
                  aria-hidden="true"
                  className="h-[68px] w-[68px] shrink-0 rounded-full object-cover"
                />
              ) : (
                <img
                  src={TOURNAMENT_ASSETS.teamAvatar}
                  alt=""
                  aria-hidden="true"
                  className="h-[68px] w-[68px] shrink-0"
                />
              )}

              <RowCell>{team.name}</RowCell>
              <RowCell>{team.size}</RowCell>
              <RowCell>{team.winRate}</RowCell>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => (team.variant === 'view' ? onView?.(team.id) : onJoin?.(team.id))}
                  className="flex h-[47px] w-[156px] items-center justify-center rounded-[16px] border border-[#ff1654] bg-[rgba(255,22,84,0.2)] text-[24px] leading-none text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  style={{ fontFamily: FONTS.expandedBold }}
                  aria-label={`${buttonLabel} ${team.name}`}
                >
                  {buttonLabel}
                </button>
              </div>
            </div>

            {index < teams.length - 1 ? (
              <div className="mx-[40px] h-px bg-white/15" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <span
      className="whitespace-nowrap text-center text-[24px] leading-none text-white"
      style={{ fontFamily: FONTS.bold }}
    >
      {children}
    </span>
  );
}

function RowCell({ children }: { children: ReactNode }) {
  return (
    <span
      className="truncate whitespace-nowrap text-center text-[24px] leading-none text-white"
      style={{ fontFamily: FONTS.expandedBold }}
    >
      {children}
    </span>
  );
}
