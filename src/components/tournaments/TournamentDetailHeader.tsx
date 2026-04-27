const FONT_EXPANDED =
  "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";

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
    <article className="relative h-[473px] w-[951px] rounded-[18px] border-[1.462px] border-solid border-[#ff1654] bg-[#282828]">
      <img
        className="absolute left-[40px] top-[40px] h-[89px] w-[59px]"
        src="/figma-assets/tournaments/triangles-card.svg"
        alt=""
        aria-hidden="true"
      />

      <h2
        className="absolute left-[80px] top-[55px] whitespace-nowrap leading-none text-white"
        style={{ fontFamily: FONT_EXPANDED_BLACK, fontSize: '53px' }}
      >
        {title}
      </h2>

      <div
        className="absolute left-[440px] top-[55px] flex h-[30px] w-[214px] items-center justify-center gap-[6px] rounded-[22px] border border-solid border-[#ff1654] bg-[rgba(255,22,84,0.2)]"
        style={{ fontFamily: FONT_EXPANDED, fontSize: '16px' }}
      >
        <span className="inline-block h-[12.6px] w-[10.9px] rounded-[2px] bg-[#ff1654]" aria-hidden="true" />
        <span className="text-white whitespace-nowrap">{matchId}</span>
      </div>
      <div
        className="absolute left-[678px] top-[55px] flex h-[30px] w-[183px] items-center justify-center rounded-[22px] border border-solid border-white/50 bg-[#282828]"
        style={{ fontFamily: FONT_EXPANDED, fontSize: '16px' }}
      >
        <span className="text-white/70 whitespace-nowrap">{matchTime}</span>
      </div>

      <div className="absolute left-[40px] top-[101px] flex items-center gap-[10px]">
        <Chip>
          <span style={{ fontFamily: FONT_EXPANDED }}>Entry: </span>
          <span style={{ fontFamily: FONT_EXPANDED_BOLD }}>{entry}</span>
        </Chip>
        <Chip>
          <span style={{ fontFamily: FONT_EXPANDED }}>Prize: </span>
          <span style={{ fontFamily: FONT_EXPANDED_BOLD }}>{prize}</span>
        </Chip>
        <Chip>
          <span style={{ fontFamily: FONT_EXPANDED }}>First to: </span>
          <span style={{ fontFamily: FONT_EXPANDED_BOLD }}>{firstTo}</span>
        </Chip>
        <Chip>
          <span style={{ fontFamily: FONT_EXPANDED }}>Platform: </span>
          <span style={{ fontFamily: FONT_EXPANDED_BOLD }}>{platform}</span>
        </Chip>
      </div>

      <h3
        className="absolute left-[40px] top-[195px] whitespace-nowrap leading-none text-white"
        style={{ fontFamily: FONT_EXPANDED_BLACK, fontSize: '53px' }}
      >
        Registrasion Progress
      </h3>

      <p
        className="absolute right-[40px] top-[260px] whitespace-nowrap text-white"
        style={{ fontFamily: FONT_EXPANDED_BLACK, fontSize: '16px' }}
      >
        {registrationProgress.current}/{registrationProgress.total} Players
      </p>

      <div className="absolute left-[40px] top-[290px] h-[25px] w-[851px] overflow-hidden rounded-[4px] bg-[#ff1654]">
        <div
          className="h-full bg-[rgba(119,254,92,0.79)]"
          style={{ width: `${greenWidth}%` }}
          aria-hidden="true"
        />
      </div>

      <p
        className="absolute left-[40px] top-[324px] whitespace-nowrap text-white"
        style={{ fontFamily: FONT_EXPANDED, fontSize: '15px' }}
      >
        {greenWidth.toFixed(0)}% FILLED
      </p>

      <button
        type="button"
        onClick={onRegister}
        disabled={registerDisabled}
        className="absolute left-1/2 top-[396px] flex h-[44px] w-[247px] -translate-x-1/2 items-center justify-center rounded-[8px] bg-[#ff1654] text-[20px] leading-none text-white transition-colors hover:bg-[#e61450] disabled:cursor-default disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        style={{ fontFamily: FONT_EXPANDED_BLACK }}
      >
        {registerLabel}
      </button>
    </article>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex h-[30px] items-center justify-center whitespace-nowrap rounded-[22px] border border-solid border-[#ff1654] px-[14px] text-[16px] text-white"
      style={{ fontFamily: FONT_EXPANDED }}
    >
      {children}
    </div>
  );
}
