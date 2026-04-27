const FONT_BOLD =
  "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";

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
}

const ROW_HEIGHT = 107;
const HEADER_HEIGHT = 75;
const TABLE_PADDING_BOTTOM = 24;

export function TournamentTeamsTable({ teams, onJoin, onView }: TournamentTeamsTableProps) {
  const tableHeight = HEADER_HEIGHT + teams.length * ROW_HEIGHT + TABLE_PADDING_BOTTOM;

  return (
    <div className="relative w-[1448px] rounded-[14px] bg-[#282828]" style={{ height: `${tableHeight}px` }}>
      <p
        className="absolute -translate-x-1/2 whitespace-nowrap text-[24px] leading-none text-white"
        style={{ left: '199.5px', top: '37.5px', fontFamily: FONT_BOLD }}
      >
        NAME
      </p>
      <p
        className="absolute -translate-x-1/2 whitespace-nowrap text-[24px] leading-none text-white"
        style={{ left: '532.5px', top: '37.5px', fontFamily: FONT_BOLD }}
      >
        SIZE
      </p>
      <p
        className="absolute -translate-x-1/2 whitespace-nowrap text-[24px] leading-none text-white"
        style={{ left: '900.5px', top: '37.5px', fontFamily: FONT_BOLD }}
      >
        WIN RATE
      </p>

      <div className="absolute left-1/2 top-[75px] h-px w-[1350px] -translate-x-1/2 bg-white/12" aria-hidden="true" />

      {teams.map((team, index) => {
        const rowTop = HEADER_HEIGHT + index * ROW_HEIGHT;
        const rowCenter = rowTop + 33.5;
        const dividerTop = rowTop + ROW_HEIGHT;
        return (
          <div key={team.id}>
            <img
              src="/figma-assets/tournaments/team-avatar.svg"
              alt=""
              aria-hidden="true"
              className="absolute h-[68px] w-[68px]"
              style={{ left: '49px', top: `${rowTop}px` }}
            />

            <p
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[24px] leading-none text-white"
              style={{ left: '260.5px', top: `${rowCenter}px`, fontFamily: FONT_EXPANDED_BOLD }}
            >
              {team.name}
            </p>
            <p
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[24px] leading-none text-white"
              style={{ left: '532.5px', top: `${rowCenter}px`, fontFamily: FONT_EXPANDED_BOLD }}
            >
              {team.size}
            </p>
            <p
              className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[24px] leading-none text-white"
              style={{ left: '901px', top: `${rowCenter}px`, fontFamily: FONT_EXPANDED_BOLD }}
            >
              {team.winRate}
            </p>

            <button
              type="button"
              onClick={() => (team.variant === 'view' ? onView?.(team.id) : onJoin?.(team.id))}
              className="absolute flex h-[47px] w-[156px] items-center justify-center rounded-[16px] border border-solid border-[#ff1654] bg-[rgba(255,22,84,0.2)] text-[24px] leading-none text-white transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{ left: '1175px', top: `${rowTop + 10}px`, fontFamily: FONT_EXPANDED_BOLD }}
            >
              {team.variant === 'view' ? 'VIEW' : 'JOIN UP'}
            </button>

            {index < teams.length - 1 && (
              <div
                className="absolute left-1/2 h-px w-[1350px] -translate-x-1/2 bg-white/12"
                style={{ top: `${dividerTop}px` }}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
