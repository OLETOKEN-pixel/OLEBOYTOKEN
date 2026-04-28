import type { ReactNode } from 'react';
import { FONTS, TOURNAMENT_ASSETS } from './TournamentDesign';

export interface TournamentDetailHeaderProps {
  title: string;
  entry: string;
  prize: string;
  firstTo: string;
  platform: string;
  matchId: string;
  matchTime: string;
  registrationProgress: {
    current: number;
    total: number;
    percent: number;
  };
  registerLabel?: string;
  registerDisabled?: boolean;
  onRegister?: () => void;
}

export function TournamentDetailHeader({
  title,
  entry,
  prize,
  firstTo,
  platform,
  matchId,
  matchTime,
  registrationProgress,
  registerLabel = 'Register',
  registerDisabled = false,
  onRegister,
}: TournamentDetailHeaderProps) {
  const greenWidth = Math.max(0, Math.min(100, registrationProgress.percent));

  return (
    <article
      className="relative h-[473px] w-[951px] rounded-[18px] border-[1.462px] border-[#ff1654] bg-[#282828] text-white"
      data-testid="tournament-detail-header"
    >
      <img
        className="absolute left-[40px] top-[40px] h-[89px] w-[59px]"
        src={TOURNAMENT_ASSETS.trianglesCard}
        alt=""
        aria-hidden="true"
      />

      <h2
        className="absolute left-[80px] top-[55px] max-w-[350px] truncate whitespace-nowrap text-[53px] leading-none"
        style={{ fontFamily: FONTS.expandedBlack }}
      >
        {title}
      </h2>

      <div
        className="absolute left-[440px] top-[55px] flex h-[30px] w-[214px] items-center justify-center gap-[6px] rounded-[22px] border border-[#ff1654] bg-[rgba(255,22,84,0.2)] text-[16px]"
        style={{ fontFamily: FONTS.expanded }}
      >
        <span className="inline-block h-[12.6px] w-[10.9px] rounded-[2px] bg-[#ff1654]" aria-hidden="true" />
        <span className="truncate text-white">{matchId}</span>
      </div>

      <div
        className="absolute left-[678px] top-[55px] flex h-[30px] w-[183px] items-center justify-center rounded-[22px] border border-white/50 bg-[#282828] text-[16px]"
        style={{ fontFamily: FONTS.expanded }}
      >
        <span className="truncate text-white/70">{matchTime}</span>
      </div>

      <div className="absolute left-[40px] top-[101px] flex items-center gap-[10px]">
        <Chip>
          <span>Entry: </span>
          <strong>{entry}</strong>
        </Chip>
        <Chip>
          <span>Prize: </span>
          <strong>{prize}</strong>
        </Chip>
        <Chip>
          <span>First to: </span>
          <strong>{firstTo}</strong>
        </Chip>
        <Chip>
          <span>Platform: </span>
          <strong>{platform}</strong>
        </Chip>
      </div>

      <h3
        className="absolute left-[40px] top-[195px] whitespace-nowrap text-[53px] leading-none"
        style={{ fontFamily: FONTS.expandedBlack }}
      >
        Registrasion Progress
      </h3>

      <p
        className="absolute right-[40px] top-[260px] whitespace-nowrap text-[16px]"
        style={{ fontFamily: FONTS.expandedBlack }}
      >
        {registrationProgress.current}/{registrationProgress.total} Players
      </p>

      <div className="absolute left-[40px] top-[290px] h-[25px] w-[851px] overflow-hidden rounded-[4px] bg-[#ff1654]">
        <div className="h-full bg-[rgba(119,254,92,0.79)]" style={{ width: `${greenWidth}%` }} />
      </div>

      <p
        className="absolute left-[40px] top-[324px] whitespace-nowrap text-[15px]"
        style={{ fontFamily: FONTS.expanded }}
      >
        {greenWidth.toFixed(0)}% FILLED
      </p>

      <button
        type="button"
        onClick={onRegister}
        disabled={registerDisabled}
        className="absolute left-1/2 top-[396px] flex h-[44px] w-[247px] -translate-x-1/2 items-center justify-center rounded-[8px] bg-[#ff1654] text-[20px] leading-none text-white transition hover:bg-[#e61450] disabled:cursor-default disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={{ fontFamily: FONTS.wideBlack }}
      >
        {registerLabel}
      </button>
    </article>
  );
}
function Chip({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex h-[30px] items-center justify-center whitespace-nowrap rounded-[22px] border border-[#ff1654] px-[14px] text-[16px] text-white"
      style={{ fontFamily: FONTS.expanded }}
    >
      {children}
    </div>
  );
}
