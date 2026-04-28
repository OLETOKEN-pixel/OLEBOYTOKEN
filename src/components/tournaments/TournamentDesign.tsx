import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

export const TOURNAMENT_ASSETS = {
  neon: '/figma-assets/tournaments/bottom-neon.png',
  triangles: '/figma-assets/tournaments/triangles.svg',
  trianglesCard: '/figma-assets/tournaments/triangles-card.svg',
  outline: '/figma-assets/tournaments/outline.svg',
  plus: '/figma-assets/tournaments/plus-icon.svg',
  arrowStroke: '/figma-assets/tournaments/arrow-stroke.svg',
  cardDivider: '/figma-assets/tournaments/card-divider.svg',
  detailArrow: '/figma-assets/tournaments/detail-arrow.svg',
  infoCircle: '/figma-assets/tournaments/info-circle.svg',
  pinkDot: '/figma-assets/tournaments/pink-dot.svg',
  pinkDotSmall: '/figma-assets/tournaments/pink-dot-2.svg',
  prizeCrown: '/figma-assets/tournaments/prize-crown.svg',
  teamAvatar: '/figma-assets/tournaments/team-avatar.svg',
  rankStar1: '/figma-assets/tournaments/rank-star-1.svg',
  rankStar2: '/figma-assets/tournaments/rank-star-2.svg',
  rankStar3: '/figma-assets/tournaments/rank-star-3.svg',
} as const;

export const FONTS = {
  regular:
    "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif",
  bold:
    "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif",
  expanded:
    "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif",
  expandedBold:
    "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif",
  expandedBlack:
    "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif",
  wideBlack:
    "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif",
} as const;

export function TournamentPageShell({
  children,
  className,
  contentClassName,
  minHeight = 955,
  bottomNeonTop,
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  minHeight?: number;
  bottomNeonTop?: number;
}) {
  return (
    <section
      className={cn('relative isolate overflow-x-hidden bg-[#0f0404] text-white', className)}
      style={{ minHeight }}
    >
      <img
        className="pointer-events-none absolute left-1/2 top-0 z-0 h-[146px] w-screen -translate-x-1/2 object-cover"
        src={TOURNAMENT_ASSETS.neon}
        alt=""
        aria-hidden="true"
      />
      {bottomNeonTop === undefined ? null : <TournamentBottomNeon top={bottomNeonTop} />}
      <div
        className={cn('relative z-10 mx-auto w-[min(1532px,calc(100%_-_48px))]', contentClassName)}
      >
        {children}
      </div>
    </section>
  );
}

export function TournamentBottomNeon({
  className,
  top,
}: {
  className?: string;
  top?: number;
}) {
  return (
    <img
      className={cn(
        'pointer-events-none absolute left-1/2 z-[1] h-[146px] w-screen -translate-x-1/2 scale-y-[-1] object-cover',
        className,
      )}
      style={top === undefined ? { bottom: 0 } : { top }}
      src={TOURNAMENT_ASSETS.neon}
      alt=""
      aria-hidden="true"
    />
  );
}

export function TournamentTitle({
  children,
  outlineWidth = 806,
  className,
}: {
  children: ReactNode;
  outlineWidth?: number;
  className?: string;
}) {
  return (
    <div className={cn('relative h-[187px] w-full max-w-[1134px]', className)}>
      <img
        className="absolute left-0 top-0 h-[186px] w-[124px] object-contain"
        src={TOURNAMENT_ASSETS.triangles}
        alt=""
        aria-hidden="true"
      />
      <h1
        className="absolute left-[67px] top-[89px] whitespace-nowrap text-[clamp(44px,5.2vw,80px)] leading-none text-white"
        style={{ fontFamily: FONTS.expandedBlack }}
      >
        {children}
      </h1>
      <img
        className="absolute left-[67px] top-[168px] h-[16px] max-w-none object-fill"
        style={{ width: outlineWidth }}
        src={TOURNAMENT_ASSETS.outline}
        alt=""
        aria-hidden="true"
      />
    </div>
  );
}

export function FigmaPillButton({
  children,
  active,
  pink,
  className,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  pink?: boolean;
}) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-[47px] items-center justify-center whitespace-nowrap rounded-[16px] border border-white/50 px-5 text-center text-[24px] leading-none text-white transition hover:brightness-110 disabled:cursor-default disabled:opacity-50',
        pink ? 'bg-[#ff1654]' : 'bg-[#3d3d3d]',
        active && !pink && 'bg-[#3d3d3d]',
        className,
      )}
      style={{ fontFamily: FONTS.expanded, ...props.style }}
      {...props}
    >
      {children}
    </button>
  );
}

export function TournamentModalShell({
  open,
  title,
  eyebrow,
  children,
  footer,
  onClose,
  maxWidth = 903,
}: {
  open: boolean;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  maxWidth?: number;
}) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-10 backdrop-blur-[6px]"
      onClick={onClose}
      data-testid="tournament-modal-scrim"
    >
      <section
        className="relative min-h-[min(800px,calc(100vh-80px))] w-full overflow-hidden rounded-[18px] border-[1.462px] border-[#ff1654] bg-[#282828] text-white shadow-[0_0_70px_rgba(255,22,84,0.22)]"
        style={{ maxWidth, fontFamily: FONTS.regular }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-[#ff1654]/18 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-[#ff1654]/10 blur-3xl" />

        <header className="relative flex items-start justify-between gap-6 px-[38px] pb-6 pt-[34px]">
          <div>
            {eyebrow ? (
              <p
                className="mb-2 text-[15px] uppercase tracking-[0.18em] text-[#ff1654]"
                style={{ fontFamily: FONTS.expandedBold }}
              >
                {eyebrow}
              </p>
            ) : null}
            <h2
              className="text-[clamp(34px,4vw,53px)] leading-none text-white"
              style={{ fontFamily: FONTS.expandedBlack }}
            >
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[14px] border border-white/20 bg-black/20 text-[28px] leading-none text-white transition hover:border-[#ff1654] hover:bg-[#ff1654]/20"
            aria-label="Close"
            style={{ fontFamily: FONTS.expandedBold }}
          >
            x
          </button>
        </header>

        <div className="relative max-h-[calc(100vh-270px)] overflow-y-auto px-[38px] pb-8">
          {children}
        </div>

        {footer ? (
          <footer className="relative border-t border-white/10 bg-black/10 px-[38px] py-5">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

export function TournamentInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        'h-[47px] w-full rounded-[14px] border border-white/15 bg-[#0f0404]/70 px-4 text-[16px] text-white outline-none transition placeholder:text-white/30 focus:border-[#ff1654]',
        props.className,
      )}
      style={{ fontFamily: FONTS.expanded, ...props.style }}
    />
  );
}

export function TournamentSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        'h-[47px] w-full rounded-[14px] border border-white/15 bg-[#0f0404]/70 px-4 text-[16px] text-white outline-none transition focus:border-[#ff1654]',
        props.className,
      )}
      style={{ fontFamily: FONTS.expanded, ...props.style }}
    />
  );
}

export function TournamentTextarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        'w-full rounded-[14px] border border-white/15 bg-[#0f0404]/70 px-4 py-3 text-[15px] text-white outline-none transition placeholder:text-white/30 focus:border-[#ff1654]',
        props.className,
      )}
      style={{ fontFamily: FONTS.regular, ...props.style }}
    />
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p
      className="mb-2 text-[13px] uppercase tracking-[0.14em] text-white/58"
      style={{ fontFamily: FONTS.expandedBold }}
    >
      {children}
    </p>
  );
}
