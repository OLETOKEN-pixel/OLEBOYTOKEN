import { formatCompactLikeCount } from './highlightHelpers';
import type { HighlightCardData } from './types';

const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_RANK =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";

interface HighlightCardProps {
  item: HighlightCardData;
  size?: 'grid' | 'large' | 'modal';
  onVote?: () => void;
  disabled?: boolean;
}

const sizeClasses = {
  grid: {
    card: 'w-[min(100%,400px)] xl:w-[400px]',
    media: 'aspect-video h-auto xl:aspect-auto xl:h-[225px]',
    avatar: 'h-12 w-12',
    bodyTop: 'mt-4',
    title: 'text-[24px] leading-[24px]',
    author: 'text-[14px]',
    like: 'h-8 w-[97px] text-[16px]',
  },
  large: {
    card: 'w-[min(100%,531px)] xl:w-[531px]',
    media: 'aspect-video h-auto xl:aspect-auto xl:h-[299px]',
    avatar: 'h-16 w-16',
    bodyTop: 'mt-5',
    title: 'text-[24px] leading-[27px]',
    author: 'text-[14px]',
    like: 'h-[39px] w-[118px] text-[19px]',
  },
  modal: {
    card: 'w-[260px]',
    media: 'h-[146px]',
    avatar: 'h-9 w-9',
    bodyTop: 'mt-2',
    title: 'text-[18px] leading-[19px]',
    author: 'text-[11px]',
    like: 'h-7 w-[78px] text-[13px]',
  },
} as const;

export function HighlightCard({ item, size = 'grid', onVote, disabled = false }: HighlightCardProps) {
  const s = sizeClasses[size];
  const interactiveLike = Boolean(onVote);
  const rankColor = item.rank === 1 ? '#f3c54a' : item.rank === 2 ? '#d6d6d6' : '#b01847';

  return (
    <article
      className={`highlight-card relative ${s.card}`}
      data-highlight-id={item.id}
      data-highlight-title={item.title}
      data-highlight-rank={item.rank ?? ''}
    >
      {item.rank ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-[20px] -top-[20px] z-[3] grid h-[78px] w-[78px] place-items-center xl:-left-[36px] xl:-top-[36px] xl:h-[108px] xl:w-[108px]"
        >
          <div
            className="absolute inset-0"
            style={{
              background: rankColor,
              clipPath:
                'polygon(50% 0%, 61% 27%, 90% 14%, 73% 42%, 100% 50%, 73% 58%, 90% 86%, 61% 73%, 50% 100%, 39% 73%, 10% 86%, 27% 58%, 0% 50%, 27% 42%, 10% 14%, 39% 27%)',
              opacity: item.rank === 1 ? 0.78 : 0.36,
            }}
          />
          <span
            className="relative -translate-y-1 text-[24px] leading-none text-white xl:text-[32px]"
            style={{ fontFamily: FONT_RANK }}
          >
            #{item.rank}
          </span>
        </div>
      ) : null}

      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`group relative block overflow-hidden rounded-[11px] ${s.media}`}
        aria-label={`Watch ${item.title}`}
      >
        <img
          data-testid="highlight-thumbnail"
          src={item.thumbnailSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"
        />
        <img
          aria-hidden="true"
          src={item.thumbnailSrc}
          alt=""
          className="pointer-events-none absolute inset-0 -z-10 h-full w-full rounded-[11px] object-cover opacity-50 blur-[55px]"
        />
      </a>

      <div className={`relative flex items-start gap-4 ${s.bodyTop}`}>
        <img src={item.authorAvatarSrc} alt="" className={`${s.avatar} shrink-0 rounded-full object-cover`} />

        <div className="min-w-0 flex-1">
          <h2
            className={`line-clamp-2 max-w-[240px] text-white ${s.title}`}
            style={{ fontFamily: FONT_EXPANDED_BOLD }}
          >
            {item.title}
          </h2>
          <p
            className={`mt-1 truncate text-white/50 ${s.author}`}
            style={{ fontFamily: FONT_BOLD }}
          >
            {item.author}
          </p>
        </div>

        <button
          type="button"
          aria-label={`${item.isLiked ? 'Remove like from' : 'Like'} ${item.title}`}
          disabled={!interactiveLike || disabled}
          onClick={onVote}
          className={`mt-2 flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#ff1654] bg-[#282828] text-center text-white disabled:cursor-default ${s.like}`}
          style={{ fontFamily: FONT_EXPANDED_BOLD }}
        >
          <img
            src={item.isLiked ? '/highlights/like-hot.svg' : '/highlights/like-muted.svg'}
            alt=""
            aria-hidden="true"
            className="h-[16px] w-[18px]"
          />
          <span>{formatCompactLikeCount(item.likeCount)}</span>
        </button>
      </div>
    </article>
  );
}
