import { Link } from 'react-router-dom';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { HighlightCard } from './HighlightCard';
import type { HighlightCardData, HighlightTab } from './types';

const FONT_EXPANDED =
  "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";
const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK = "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

interface HighlightsControlsProps {
  activeTab: HighlightTab;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onUploadClick: () => void;
}

interface HighlightsAllViewProps extends HighlightsControlsProps {
  items: HighlightCardData[];
  onVote: (item: HighlightCardData) => void;
  isVoting: boolean;
}

interface HighlightsRankingViewProps extends HighlightsControlsProps {
  mode: 'week' | 'month';
  winner: HighlightCardData;
  nominees: HighlightCardData[];
}

function TopNeon() {
  return (
    <img
      src="/figma-assets/figma-neon.png"
      alt=""
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 h-[146px] w-full object-cover"
    />
  );
}

function HighlightsTitle({ children, wide = false }: { children: string; wide?: boolean }) {
  const [titlePrefix, titleSuffix] = children.split(' - ');

  return (
    <div className="relative z-[2] max-w-full">
      <img
        src="/highlights/title-triangles.svg"
        alt=""
        aria-hidden="true"
        className="absolute -left-[49px] -top-[58px] h-[136px] w-[91px] xl:-left-[71px] xl:-top-[77px] xl:h-[186px] xl:w-[124px]"
      />
      <h1
        className="relative max-w-full text-[36px] leading-[43px] text-white sm:text-[56px] sm:leading-[66px] xl:whitespace-nowrap xl:text-[80px] xl:leading-[95px]"
        style={{ fontFamily: FONT_EXPANDED_BLACK }}
      >
        {titleSuffix ? (
          <>
            <span className="block xl:inline">{titlePrefix} -</span>{' '}
            <span className="block xl:inline">{titleSuffix}</span>
          </>
        ) : (
          children
        )}
      </h1>
      <img
        src="/highlights/title-underline.svg"
        alt=""
        aria-hidden="true"
        className={`mt-[-3px] h-[14px] max-w-full xl:mt-[-6px] xl:h-[21px] ${wide ? 'w-[780px]' : 'w-[620px]'}`}
      />
    </div>
  );
}

function TabButton({
  to,
  label,
  icon,
  active,
  tone,
}: {
  to: string;
  label: string;
  icon: string;
  active: boolean;
  tone: 'month' | 'week';
}) {
  const activeBg = tone === 'month' ? '#d8ff16' : '#625afa';
  const color = tone === 'month' && active ? '#0f0404' : '#ffffff';
  const widthClass = tone === 'month' ? 'sm:w-[250px] xl:w-[250px]' : 'sm:w-[230px] xl:w-[230px]';

  return (
    <Link
      to={to}
      className={`flex h-[47px] w-full items-center justify-center gap-[12px] rounded-[16px] border px-[17px] text-[20px] leading-[24px] no-underline sm:justify-start xl:gap-[15px] xl:text-[24px] xl:leading-[29px] ${widthClass}`}
      style={{
        borderColor: tone === 'month' ? '#d8ff16' : '#625afa',
        background: active ? activeBg : tone === 'month' ? 'rgba(216,255,22,0.2)' : 'rgba(98,90,250,0.2)',
        color,
        fontFamily: FONT_EXPANDED_BOLD,
      }}
    >
      <img src={icon} alt="" aria-hidden="true" className="h-[19px] w-[23px]" />
      <span>{label}</span>
    </Link>
  );
}

function HighlightsControls({ activeTab, searchTerm, onSearchChange, onUploadClick }: HighlightsControlsProps) {
  return (
    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap xl:gap-[17px]">
      <label className="relative block h-[47px] w-full sm:w-[400px]">
        <span className="sr-only">Search highlights</span>
        <input
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search by title or author"
          className="h-full w-full rounded-[12px] border border-white/[0.15] bg-[#282828] px-[18px] pr-[54px] text-[20px] text-white outline-none placeholder:text-white/50 focus:border-[#ff1654]"
          style={{ fontFamily: FONT_REGULAR }}
        />
        <img
          src="/highlights/icon-search.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-[18px] top-1/2 h-[26px] w-[18px] -translate-y-1/2"
        />
      </label>

      <button
        type="button"
        className="flex h-[47px] w-full items-center justify-center gap-[14px] rounded-[16px] border border-white/50 bg-[#282828]/80 text-[20px] leading-[24px] text-white sm:w-[211px] xl:text-[24px] xl:leading-[29px]"
        style={{ fontFamily: FONT_EXPANDED_BOLD }}
      >
        <span className="grid h-4 w-4 place-items-center rounded-full bg-white text-[13px] leading-none text-[#282828]">i</span>
        REWARDS
      </button>

      <TabButton
        to="/highlights/month"
        label="TOP MONTH"
        icon="/highlights/icon-top-month.svg"
        active={activeTab === 'month'}
        tone="month"
      />
      <TabButton
        to="/highlights/week"
        label="TOP WEEK"
        icon="/highlights/icon-top-week.svg"
        active={activeTab === 'week'}
        tone="week"
      />

      <button
        type="button"
        onClick={onUploadClick}
        className="flex h-[47px] w-full items-center justify-center gap-[12px] rounded-[16px] border border-[#ff1654] bg-[#ff1654]/20 text-[20px] leading-[24px] text-white sm:w-[182px] xl:text-[24px] xl:leading-[29px]"
        style={{ fontFamily: FONT_EXPANDED_BOLD }}
      >
        <img src="/highlights/icon-plus.svg" alt="" aria-hidden="true" className="h-[18px] w-[18px]" />
        UPLOAD
      </button>
    </div>
  );
}

export function HighlightsAllView({
  items,
  searchTerm,
  activeTab,
  isVoting,
  onSearchChange,
  onUploadClick,
  onVote,
}: HighlightsAllViewProps) {
  return (
    <div className="w-full bg-[#0f0404] text-white xl:min-w-[1920px]">
      <section className="relative overflow-hidden px-5 pb-20 pt-[172px] xl:min-h-[1910px] xl:px-0 xl:pb-0 xl:pt-0">
        <TopNeon />
        <div className="relative xl:absolute xl:left-[236px] xl:top-[233px]">
          <HighlightsTitle>HIGHLIGHTS</HighlightsTitle>
        </div>
        <div className="relative mt-9 xl:absolute xl:left-[236px] xl:top-[396px] xl:mt-0">
          <HighlightsControls
            activeTab={activeTab}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            onUploadClick={onUploadClick}
          />
        </div>

        <div className="relative mt-10 grid grid-cols-1 justify-items-center gap-y-12 sm:grid-cols-2 sm:gap-x-8 xl:absolute xl:left-[236px] xl:top-[496px] xl:mt-0 xl:grid-cols-3 xl:justify-items-start xl:gap-x-[124px] xl:gap-y-[53px]">
          {items.map((item) => (
            <HighlightCard
              key={item.id}
              item={item}
              disabled={isVoting}
              onVote={item.source === 'uploaded' ? () => onVote(item) : undefined}
            />
          ))}
        </div>

        {items.length === 0 ? (
          <p
            className="relative mt-10 text-[22px] text-white/60 xl:absolute xl:left-[236px] xl:top-[520px] xl:mt-0 xl:text-[24px]"
            style={{ fontFamily: FONT_EXPANDED }}
          >
            No highlights found.
          </p>
        ) : null}
      </section>
      <FooterSection />
    </div>
  );
}

export function HighlightsRankingView({
  mode,
  winner,
  nominees,
  searchTerm,
  activeTab,
  onSearchChange,
  onUploadClick,
}: HighlightsRankingViewProps) {
  const isWeek = mode === 'week';
  const title = isWeek ? 'HIGHLIGHTS - TOP WEEK' : 'HIGHLIGHTS - TOP MONTH';
  const nomineesTitle = isWeek ? 'THIS WEEK NOMINEES' : 'THIS MONTH NOMINEES';
  const heroCopy = isWeek ? 'Winner of the week\nearns EXTRA coins!*' : 'Winner of the month\ngets a FREE montage!*';
  const note = isWeek
    ? '*The winner of the week will receive 5 coins for free!'
    : '*The winner will choose the editor he likes the most.\nOLEBOY will pay for the video. No extra-fees.';
  const bottomCta = isWeek ? 'BEST OF THE MONTH' : 'FOR YOU';

  return (
    <div className="w-full bg-[#0f0404] text-white xl:min-w-[1920px]">
      <section className="relative overflow-hidden px-5 pb-20 pt-[172px] xl:min-h-[2529px] xl:px-0 xl:pb-0 xl:pt-0">
        <TopNeon />

        <div className="relative xl:absolute xl:left-[236px] xl:top-[233px]">
          <HighlightsTitle wide>{title}</HighlightsTitle>
        </div>
        <div className="relative mt-9 xl:absolute xl:left-[236px] xl:top-[396px] xl:mt-0">
          <HighlightsControls
            activeTab={activeTab}
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            onUploadClick={onUploadClick}
          />
        </div>

        <img
          src="/highlights/star-shape.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -left-[98px] top-[560px] h-[430px] w-[625px] -rotate-[15deg] object-contain opacity-90 xl:left-[166px] xl:top-[383px] xl:h-[596px] xl:w-[866px]"
        />
        <p
          className="relative mt-20 max-w-[350px] whitespace-pre-line text-[34px] leading-[36px] text-white sm:max-w-[520px] sm:text-[42px] sm:leading-[43px] xl:absolute xl:left-[236px] xl:top-[598px] xl:mt-0 xl:max-w-none xl:text-[48px] xl:leading-[47px]"
          style={{ fontFamily: FONT_EXPANDED_BOLD }}
        >
          {heroCopy}
        </p>
        <button
          type="button"
          onClick={() => document.getElementById('highlight-nominees')?.scrollIntoView({ behavior: 'smooth' })}
          className="relative z-[2] mt-8 flex h-[58px] w-full max-w-[292px] items-center justify-center gap-[14px] rounded-full border border-[#ff1654] bg-[#ff1654]/25 text-[28px] text-white shadow-[inset_0_4px_4px_rgba(255,255,255,0.14),inset_0_-4px_4px_rgba(0,0,0,0.25)] xl:absolute xl:left-[468px] xl:top-[727px] xl:mt-0 xl:h-[65px] xl:w-[292px] xl:max-w-none xl:text-[32px]"
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          NOMINEES
          <img src="/highlights/arrow-down.svg" alt="" aria-hidden="true" className="h-[27px] w-[19px]" />
        </button>
        <p
          className="relative z-[2] mt-10 max-w-[330px] whitespace-pre-line text-[12px] leading-[15px] text-white sm:max-w-[470px] sm:text-[13px] sm:leading-[16px] xl:absolute xl:left-[78px] xl:top-[855px] xl:mt-0 xl:max-w-none"
          style={{ fontFamily: FONT_EXPANDED }}
        >
          {note}
        </p>

        <div className="relative z-[2] mt-12 xl:absolute xl:left-[1153px] xl:top-[496px] xl:mt-0">
          <HighlightCard item={winner} size="large" />
        </div>

        <div id="highlight-nominees" className="relative mt-24 w-full bg-[#0f0404] xl:absolute xl:left-0 xl:top-[955px] xl:mt-0 xl:h-[955px]">
          <div className="relative xl:absolute xl:left-[236px] xl:top-[233px]">
            <HighlightsTitle wide>{nomineesTitle}</HighlightsTitle>
          </div>
          <div className="relative mt-12 grid grid-cols-1 justify-items-center gap-y-14 lg:grid-cols-2 lg:gap-x-10 xl:absolute xl:left-[348px] xl:top-[452px] xl:mt-0 xl:grid-cols-2 xl:justify-items-start xl:gap-x-[196px] xl:gap-y-[92px]">
            {nominees.map((item) => (
              <HighlightCard key={item.id} item={item} size="large" />
            ))}
          </div>
        </div>

        <Link
          to={isWeek ? '/highlights/month' : '/highlights'}
          className="relative z-[2] mx-auto mt-16 flex h-[58px] items-center justify-center gap-[14px] rounded-full border border-[#ff1654] bg-[#ff1654]/25 px-[28px] text-[22px] text-white no-underline shadow-[inset_0_4px_4px_rgba(255,255,255,0.14),inset_0_-4px_4px_rgba(0,0,0,0.25)] xl:absolute xl:left-1/2 xl:top-[2416px] xl:mt-0 xl:h-[65px] xl:-translate-x-1/2 xl:px-[33px] xl:text-[24px]"
          style={{ minWidth: isWeek ? 337 : 201, fontFamily: FONT_BOLD }}
        >
          {bottomCta}
          <img src="/highlights/arrow-right.svg" alt="" aria-hidden="true" className="h-[16px] w-[21px]" />
        </Link>
      </section>
      <FooterSection />
    </div>
  );
}

const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
