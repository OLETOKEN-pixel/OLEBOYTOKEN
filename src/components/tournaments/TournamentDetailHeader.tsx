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
}

export function TournamentDetailHeader({
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
      <h3
        className="absolute left-[40px] top-[50px] whitespace-nowrap text-[44px] leading-none"
        style={{
          fontFamily: FONTS.expandedBold,
          textTransform: 'none',
          fontStyle: 'italic',
          letterSpacing: '0.01em',
        }}
      >
        Registrasion Progress
      </h3>

      <p
        className="absolute right-[40px] top-[235px] whitespace-nowrap text-[16px]"
        style={{ fontFamily: FONTS.expandedBlack }}
      >
        {registrationProgress.current}/{registrationProgress.total} Players
      </p>

      <div className="absolute left-[40px] top-[266px] h-[25px] w-[851px] overflow-hidden rounded-[4px] bg-[#ff1654]">
        <div className="h-full bg-[rgba(119,254,92,0.79)]" style={{ width: `${greenWidth}%` }} />
      </div>

      <p
        className="absolute left-[40px] top-[315px] whitespace-nowrap text-[15px]"
        style={{ fontFamily: FONTS.expanded }}
      >
        {greenWidth.toFixed(0)}% FILLED
      </p>

      <button
        type="button"
        onClick={onRegister}
        disabled={registerDisabled}
        className="absolute left-1/2 top-[388px] flex h-[44px] w-[247px] -translate-x-1/2 items-center justify-center rounded-[8px] bg-[#ff1654] text-[20px] leading-none text-white transition hover:bg-[#e61450] disabled:cursor-default disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={{ fontFamily: FONTS.wideBlack }}
      >
        {registerLabel}
      </button>
    </article>
  );
}
