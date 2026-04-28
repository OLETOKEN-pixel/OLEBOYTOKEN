import type { ReactNode } from 'react';
import { FONTS } from './TournamentDesign';

export interface TournamentDetailHeaderProps {
  registrationProgress: {
    current: number;
    total: number;
    percent: number;
  };
  registerLabel?: string;
  registerDisabled?: boolean;
  onRegister?: () => void;
  twitchPanel?: ReactNode;
}

export function TournamentDetailHeader({
  registrationProgress,
  registerLabel = 'Register',
  registerDisabled = false,
  onRegister,
  twitchPanel,
}: TournamentDetailHeaderProps) {
  const greenWidth = Math.max(0, Math.min(100, registrationProgress.percent));
  const hasTwitchPanel = Boolean(twitchPanel);

  return (
    <article
      className={`relative w-[951px] rounded-[18px] border-[1.462px] border-[#ff1654] bg-[#282828] text-white ${
        hasTwitchPanel ? 'h-[558px]' : 'h-[473px]'
      }`}
      data-testid="tournament-detail-header"
    >
      <h3
        className={`absolute left-[40px] whitespace-nowrap text-[56px] leading-[1] text-white ${
          hasTwitchPanel ? 'top-[24px]' : 'top-[48px]'
        }`}
        style={{
          fontFamily: FONTS.expandedBlack,
          textTransform: 'none',
          fontStyle: 'italic',
          fontWeight: 900,
          letterSpacing: '-0.015em',
        }}
      >
        Registrasion Progress
      </h3>

      <p
        className={`absolute right-[60px] whitespace-nowrap text-[16px] text-white ${
          hasTwitchPanel ? 'top-[96px]' : 'top-[235px]'
        }`}
        style={{ fontFamily: FONTS.expandedBlack }}
      >
        {registrationProgress.current}/{registrationProgress.total} Players
      </p>

      <div
        className={`absolute left-[40px] h-[25px] w-[851px] overflow-hidden rounded-[4px] bg-[#ff1654] ${
          hasTwitchPanel ? 'top-[126px]' : 'top-[266px]'
        }`}
      >
        <div className="h-full bg-[rgba(119,254,92,0.79)]" style={{ width: `${greenWidth}%` }} />
      </div>

      <p
        className={`absolute left-[40px] whitespace-nowrap text-[15px] ${
          hasTwitchPanel ? 'top-[160px]' : 'top-[315px]'
        }`}
        style={{ fontFamily: FONTS.expanded }}
      >
        {greenWidth.toFixed(0)}% FILLED
      </p>

      <button
        type="button"
        onClick={onRegister}
        disabled={registerDisabled}
        className={`absolute left-1/2 flex h-[44px] w-[247px] -translate-x-1/2 items-center justify-center rounded-[8px] bg-[#ff1654] text-[20px] leading-none text-white transition hover:bg-[#e61450] disabled:cursor-default disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
          hasTwitchPanel ? 'top-[176px]' : 'top-[388px]'
        }`}
        style={{ fontFamily: FONTS.wideBlack }}
      >
        {registerLabel}
      </button>

      {hasTwitchPanel ? (
        <div className="absolute left-[40px] top-[248px]">
          {twitchPanel}
        </div>
      ) : null}
    </article>
  );
}
