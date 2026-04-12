import { cn } from '@/lib/utils';

interface MatchesLiveCardProps {
  title: string;
  firstTo: string;
  platform: string;
  entryFee: string;
  prize: string;
  expiresIn: string;
  onAccept?: () => void;
  variant?: 'compact' | 'page';
}

const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_WIDE_BLACK =
  "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

const VARIANT_STYLES = {
  compact: {
    article: 'min-h-[292px] rounded-[24px] border-[#ff1654]/60 p-5',
    title: 'text-[27px]',
    divider: 'mt-2 h-[3px] w-[192px]',
    metricGap: 'mt-5 gap-x-5 gap-y-5',
    label: 'text-[17px]',
    value: 'text-[21px]',
    largeValue: 'text-[30px]',
    platform: 'text-[23px]',
    action: 'mt-5 h-[50px] rounded-[15px] text-[20px]',
    triangles: 'h-[22px] w-[15px]',
    dot: 'h-[17px] w-[17px]',
    prizeIcon: 'h-[18px] w-[21px]',
    arrow: 'h-[11px] w-[16px]',
  },
} as const;

export function MatchesLiveCard({
  title,
  firstTo,
  platform,
  entryFee,
  prize,
  expiresIn,
  onAccept,
  variant = 'compact',
}: MatchesLiveCardProps) {
  if (variant === 'page') {
    return (
      <article className="relative h-[400px] w-[300px] overflow-hidden rounded-[8px] border border-[#ff1654] bg-[#272727] shadow-[0_4px_4px_rgba(0,0,0,0.25)]">
        <header>
          <h2
            className="absolute left-1/2 top-[25px] -translate-x-1/2 whitespace-nowrap text-[32px] leading-none text-white"
            style={{ fontFamily: FONT_WIDE_BLACK }}
          >
            {title}
          </h2>
          <img
            className="absolute left-[20px] top-[78px] h-px w-[259px] object-cover"
            src="/figma-assets/matches-card-divider.svg"
            alt=""
            aria-hidden="true"
          />
        </header>

        <div className="absolute left-[38px] top-[107px] h-[60px] w-[79px]">
          <span className="absolute left-0 top-0 whitespace-nowrap text-[20px] leading-none text-white" style={{ fontFamily: FONT_REGULAR }}>
            First to
          </span>
          <img
            className="absolute left-0 top-[28px] h-[28px] w-[19px]"
            src="/figma-assets/matches-first-to-triangles.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="absolute left-[22px] top-[24px] whitespace-nowrap text-[30px] leading-none text-white" style={{ fontFamily: FONT_BOLD }}>
            {firstTo}
          </span>
        </div>

        <div className="absolute left-[170px] top-[107px] h-[56px] w-[86px]">
          <span className="absolute left-0 top-0 whitespace-nowrap text-center text-[20px] leading-none text-white" style={{ fontFamily: FONT_REGULAR }}>
            Platform
          </span>
          <span className="absolute left-0 top-[27px] whitespace-nowrap text-[24px] leading-none text-white" style={{ fontFamily: FONT_BOLD }}>
            {platform}
          </span>
        </div>

        <div className="absolute left-[38px] top-[187px] h-[55px] w-[232px]">
          <span className="absolute left-0 top-0 whitespace-nowrap text-[20px] leading-none text-white" style={{ fontFamily: FONT_REGULAR }}>
            Entry fee
          </span>
          <span className="absolute left-[132px] top-0 whitespace-nowrap text-[20px] leading-none text-white" style={{ fontFamily: FONT_REGULAR }}>
            Prize
          </span>
          <img
            className="absolute left-0 top-[31px] h-[19px] w-[19px]"
            src="/figma-assets/matches-entry-dot.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="absolute left-[24px] top-[26px] whitespace-nowrap text-[24px] leading-none text-white" style={{ fontFamily: FONT_WIDE_BLACK }}>
            {entryFee}
          </span>
          <img
            className="absolute left-[100px] top-[35px] h-[11px] w-[16px] -rotate-90"
            src="/figma-assets/figma-arrow-stroke.svg"
            alt=""
            aria-hidden="true"
          />
          <img
            className="absolute left-[132px] top-[31px] h-[19px] w-[23px]"
            src="/figma-assets/matches-prize-icon.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="absolute left-[166px] top-[26px] whitespace-nowrap text-[24px] leading-none text-white" style={{ fontFamily: FONT_WIDE_BLACK }}>
            {prize}
          </span>
        </div>

        <div className="absolute left-[38px] top-[261px] h-[55px] w-[104px]">
          <span className="absolute left-0 top-0 whitespace-nowrap text-[20px] leading-none text-white" style={{ fontFamily: FONT_REGULAR }}>
            Expires in
          </span>
          <img
            className="absolute left-0 top-[31px] h-[19px] w-[19px]"
            src="/figma-assets/matches-expiry-dot.svg"
            alt=""
            aria-hidden="true"
          />
          <span className="absolute left-[24px] top-[26px] whitespace-nowrap text-[24px] leading-none text-white" style={{ fontFamily: FONT_WIDE_BLACK }}>
            {expiresIn}
          </span>
        </div>

        {onAccept ? (
          <button
            className="absolute left-[26px] top-[335px] h-[44px] w-[247px] rounded-[8px] border-none bg-[#ff1654] text-[20px] leading-none text-white"
            style={{ fontFamily: FONT_WIDE_BLACK }}
            type="button"
            onClick={onAccept}
          >
            Accept token
          </button>
        ) : (
          <div
            className="absolute left-[26px] top-[335px] flex h-[44px] w-[247px] items-center justify-center rounded-[8px] bg-[#ff1654] text-[20px] leading-none text-white"
            style={{ fontFamily: FONT_WIDE_BLACK }}
            aria-hidden="true"
          >
            Accept token
          </div>
        )}
      </article>
    );
  }

  const styles = VARIANT_STYLES[variant];
  const metricLabelClass = cn('uppercase leading-none text-white/92', styles.label);
  const metricValueClass = cn('leading-none text-white', styles.value);

  return (
    <article
      className={cn(
        'flex h-full w-full flex-col overflow-hidden border bg-[#272727] shadow-[0_16px_36px_rgba(0,0,0,0.32)]',
        styles.article,
      )}
    >
      <header>
        <h2
          className={cn('leading-none text-white', styles.title)}
          style={{ fontFamily: FONT_WIDE_BLACK }}
        >
          {title}
        </h2>
        <img
          className={cn('object-contain object-left', styles.divider)}
          src="/figma-assets/matches-card-divider.svg"
          alt=""
          aria-hidden="true"
        />
      </header>

      <div className={cn('grid grid-cols-2', styles.metricGap)}>
        <div className="space-y-3">
          <span className={metricLabelClass} style={{ fontFamily: FONT_REGULAR }}>
            First to
          </span>
          <div className="flex items-center gap-3">
            <img
              className={styles.triangles}
              src="/figma-assets/matches-first-to-triangles.svg"
              alt=""
              aria-hidden="true"
            />
            <span
              className={cn('leading-none text-white', styles.largeValue)}
              style={{ fontFamily: FONT_BOLD }}
            >
              {firstTo}
            </span>
          </div>
        </div>

        <div className="space-y-3 text-left">
          <span className={metricLabelClass} style={{ fontFamily: FONT_REGULAR }}>
            Platform
          </span>
          <span
            className={cn('block leading-none text-white', styles.platform)}
            style={{ fontFamily: FONT_BOLD }}
          >
            {platform}
          </span>
        </div>

        <div className="col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <span className={metricLabelClass} style={{ fontFamily: FONT_REGULAR }}>
              Entry fee
            </span>
            <span className={metricLabelClass} style={{ fontFamily: FONT_REGULAR }}>
              Prize
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                className={styles.dot}
                src="/figma-assets/matches-entry-dot.svg"
                alt=""
                aria-hidden="true"
              />
              <span className={metricValueClass} style={{ fontFamily: FONT_WIDE_BLACK }}>
                {entryFee}
              </span>
            </div>

            <img
              className={cn('-rotate-90 opacity-90', styles.arrow)}
              src="/figma-assets/figma-arrow-stroke.svg"
              alt=""
              aria-hidden="true"
            />

            <div className="flex items-center gap-3">
              <img
                className={styles.prizeIcon}
                src="/figma-assets/matches-prize-icon.svg"
                alt=""
                aria-hidden="true"
              />
              <span className={metricValueClass} style={{ fontFamily: FONT_WIDE_BLACK }}>
                {prize}
              </span>
            </div>
          </div>
        </div>

        <div className="col-span-2 space-y-3">
          <span className={metricLabelClass} style={{ fontFamily: FONT_REGULAR }}>
            Expires in
          </span>
          <div className="flex items-center gap-3">
            <img
              className={styles.dot}
              src="/figma-assets/matches-expiry-dot.svg"
              alt=""
              aria-hidden="true"
            />
            <span className={metricValueClass} style={{ fontFamily: FONT_WIDE_BLACK }}>
              {expiresIn}
            </span>
          </div>
        </div>
      </div>

      {onAccept ? (
        <button
          className={cn(
            'w-full border border-[#ff1654] bg-[rgba(255,22,84,0.22)] text-white shadow-[inset_0px_4px_4px_rgba(255,255,255,0.14),inset_0px_-4px_4px_rgba(0,0,0,0.25)] transition hover:bg-[rgba(255,22,84,0.3)]',
            styles.action,
          )}
          style={{ fontFamily: FONT_WIDE_BLACK }}
          type="button"
          onClick={onAccept}
        >
          Accept token
        </button>
      ) : (
        <div
          className={cn(
            'mt-auto flex w-full items-center justify-center border border-[#ff1654]/55 bg-[rgba(255,22,84,0.16)] text-white/92 shadow-[inset_0px_4px_4px_rgba(255,255,255,0.08),inset_0px_-4px_4px_rgba(0,0,0,0.2)]',
            styles.action,
          )}
          style={{ fontFamily: FONT_WIDE_BLACK }}
          aria-hidden="true"
        >
          Accept token
        </div>
      )}
    </article>
  );
}
