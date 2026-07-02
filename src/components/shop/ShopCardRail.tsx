import type { CSSProperties } from 'react';
import type { ShopCardViewModel } from '@/lib/shopCatalog';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD_OBLIQUE = "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', sans-serif";

export const SHOP_DESKTOP_CARD_WIDTH = 226.563;
export const SHOP_DESKTOP_CARD_HEIGHT = 271.875;
export const SHOP_DESKTOP_CARD_RADIUS = 17.219;
export const SHOP_DESKTOP_CARD_GAP = 77.4;
export const SHOP_MOBILE_CARD_WIDTH = 158;
export const SHOP_MOBILE_CARD_HEIGHT = 194;
export const SHOP_MOBILE_CARD_GAP = 14;

type ShopCardTileProps = {
  card: ShopCardViewModel;
  compact?: boolean;
  disabled?: boolean;
  onAction?: (card: ShopCardViewModel) => void;
  onEdit?: (card: ShopCardViewModel) => void;
};

type ShopCardRailProps = {
  cards: ShopCardViewModel[];
  compact?: boolean;
  disabled?: boolean;
  forceMarquee?: boolean;
  marqueeWhenOverflow?: boolean;
  onAction?: (card: ShopCardViewModel) => void;
  onEdit?: (card: ShopCardViewModel) => void;
};

function clampTextLines(lines: number): CSSProperties {
  return {
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: lines,
    overflow: 'hidden',
  };
}

// Same gradient-clipped oblique treatment as the wallet overlay tiles
// (CoinPackageButton in WalletPurchaseContext.tsx) so shop cards and
// wallet read as one family.
function gradientHeroStyle(fontSize: number): CSSProperties {
  return {
    background: 'linear-gradient(180deg, #ffffff 0%, #ff1654 100%)',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    fontFamily: FONT_BOLD_OBLIQUE,
    fontSize,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  };
}

function quietLabelStyle(compact: boolean): CSSProperties {
  return {
    margin: 0,
    fontFamily: FONT_REGULAR,
    fontSize: compact ? 10 : 12,
    lineHeight: compact ? '13px' : '16px',
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: compact ? '0.16em' : '0.2em',
    textAlign: 'center',
    padding: '0 12px',
    maxWidth: '100%',
    ...clampTextLines(1),
  };
}

const FIGURE_GLOW: CSSProperties = {
  position: 'absolute',
  inset: '-20%',
  background: 'radial-gradient(closest-side, rgba(255,22,84,0.30), rgba(255,22,84,0) 72%)',
  pointerEvents: 'none',
};

function CoinBadgeFigure({
  amount,
  size,
  multiplierFontSize,
  image,
  alt,
}: {
  amount: number;
  size: number;
  multiplierFontSize: number;
  image: string;
  alt: string;
}) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <div aria-hidden="true" style={FIGURE_GLOW} />
      <img
        src={image}
        alt={alt}
        style={{ position: 'relative', width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
      />
      <span
        style={{
          position: 'absolute',
          left: size - 2,
          top: Math.round(size * 0.6),
          transform: 'translateX(-100%)',
          display: 'inline-block',
          minWidth: size >= 100 ? 48 : 34,
          paddingRight: 4,
          textAlign: 'right',
          overflow: 'visible',
          ...gradientHeroStyle(multiplierFontSize),
        }}
      >
        {`x${amount}`}
      </span>
    </div>
  );
}

function ShopCardTile({
  card,
  compact = false,
  disabled,
  onAction,
  onEdit,
}: ShopCardTileProps) {
  const width = compact ? SHOP_MOBILE_CARD_WIDTH : SHOP_DESKTOP_CARD_WIDTH;
  const height = compact ? SHOP_MOBILE_CARD_HEIGHT : SHOP_DESKTOP_CARD_HEIGHT;
  const radius = compact ? 18 : SHOP_DESKTOP_CARD_RADIUS;
  const isUnlock = card.templateKey === 'unlock-card';
  const isCoinPack = card.kind === 'coin_pack';
  const figureSize = compact ? 80 : isCoinPack ? 124 : 118;
  const secondaryBox = compact
    ? { width: 52, height: 52, top: 44, right: 14 }
    : { width: 72, height: 72, top: 52, right: 18 };
  const displayValue = card.unlockLabel ?? card.priceLabel ?? card.ctaLabel;

  // Centered stack: figure + gradient hero + price + quiet label.
  // Coin packs carry the hero (x3, x5, …) on the coin itself, wallet-style.
  const heroLabel = isCoinPack
    ? null
    : card.kind === 'physical_reward'
      ? displayValue
      : card.kind === 'vip_membership'
        ? card.title
        : card.kind === 'action_card'
          ? card.ctaLabel
          : null;
  const heroBaseSize = card.kind === 'physical_reward' ? (compact ? 24 : 34) : (compact ? 20 : 30);
  const heroSize = heroLabel && heroLabel.length > 8 ? Math.round(heroBaseSize * 0.72) : heroBaseSize;
  const showPrice = Boolean(card.priceLabel)
    && card.kind !== 'physical_reward'
    && card.kind !== 'action_card';
  const priceSize = card.kind === 'vip_membership' ? (compact ? 16 : 22) : (compact ? 20 : 28);
  const quietLabel = isCoinPack
    ? (card.showSubtitle && card.subtitle ? card.subtitle : null)
    : card.kind === 'vip_membership'
      ? (card.subtitle || null)
      : card.title;

  return (
    <div
      data-shop-card={card.id}
      data-shop-slot={card.slotId}
      data-shop-card-kind={card.kind}
      data-shop-card-template={card.templateKey}
      data-shop-claim-status={card.claimStatus ?? ''}
      style={{
        width,
        height,
        borderRadius: radius,
        position: 'relative',
        overflow: 'hidden',
        flex: '0 0 auto',
        border: '1px solid rgba(255,255,255,0.08)',
        background: isUnlock
          ? 'linear-gradient(180deg, rgba(119,0,10,0.96) 0%, rgba(78,0,0,0.96) 100%)'
          : 'linear-gradient(180deg, rgba(110,0,14,0.95) 0%, rgba(74,0,0,0.96) 100%)',
        boxShadow: '0 12px 34px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: isUnlock
            ? 'linear-gradient(180deg, rgba(255,22,84,0.18) 0%, rgba(255,22,84,0.02) 34%, rgba(15,4,4,0.2) 100%)'
            : 'linear-gradient(180deg, rgba(255,22,84,0.22) 0%, rgba(255,22,84,0.03) 44%, rgba(15,4,4,0.14) 100%)',
        }}
      />

      {card.showSecondaryImage && card.secondaryImage ? (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: secondaryBox.top,
            right: secondaryBox.right,
            width: secondaryBox.width,
            height: secondaryBox.height,
            pointerEvents: 'none',
            opacity: 0.98,
          }}
        >
          <img
            src={card.secondaryImage}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          />
        </div>
      ) : null}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        {isCoinPack ? (
          <CoinBadgeFigure
            amount={card.coinAmount ?? 0}
            size={figureSize}
            multiplierFontSize={compact ? 22 : 34}
            image={card.primaryImage || '/coin.png'}
            alt={card.title}
          />
        ) : (
          <div
            style={{
              position: 'relative',
              width: figureSize,
              height: figureSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div aria-hidden="true" style={FIGURE_GLOW} />
            <img
              src={card.primaryImage}
              alt={card.title}
              style={{
                position: 'relative',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                display: 'block',
                filter: 'drop-shadow(0 0 16px rgba(255,22,84,0.32)) drop-shadow(0 12px 22px rgba(0,0,0,0.30))',
              }}
            />
          </div>
        )}

        {heroLabel ? (
          <span style={{ ...gradientHeroStyle(heroSize), marginTop: compact ? 12 : 18 }}>
            {heroLabel}
          </span>
        ) : null}

        {showPrice ? (
          <span
            style={{
              marginTop: heroLabel ? (compact ? 8 : 10) : (compact ? 14 : 20),
              fontFamily: FONT_EXPANDED_BOLD,
              fontSize: priceSize,
              lineHeight: 1,
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            {card.priceLabel}
          </span>
        ) : null}

        {quietLabel ? (
          <p style={{ ...quietLabelStyle(compact), marginTop: compact ? 6 : 10 }}>{quietLabel}</p>
        ) : null}
      </div>

      {onAction ? (
        <button
          type="button"
          aria-label={card.ctaLabel || card.title}
          disabled={disabled}
          onClick={() => onAction(card)}
          style={{
            position: 'absolute',
            inset: 0,
            border: 0,
            background: 'transparent',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: 0,
            opacity: disabled ? 0.72 : 1,
          }}
        />
      ) : null}

      {onEdit ? (
        <button
          type="button"
          aria-label={`Edit ${card.title}`}
          onClick={() => onEdit(card)}
          style={{
            position: 'absolute',
            top: compact ? 10 : 12,
            right: compact ? 10 : 12,
            zIndex: 3,
            border: '1px solid rgba(255,255,255,0.18)',
            background: 'rgba(15,4,4,0.78)',
            color: '#ffffff',
            borderRadius: 999,
            padding: compact ? '5px 8px' : '6px 10px',
            fontFamily: FONT_EXPANDED_BOLD,
            fontSize: compact ? 9 : 10,
            lineHeight: '12px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Edit
        </button>
      ) : null}
    </div>
  );
}

export function ShopCardRail({
  cards,
  compact = false,
  disabled,
  forceMarquee = false,
  marqueeWhenOverflow = true,
  onAction,
  onEdit,
}: ShopCardRailProps) {
  const gap = compact ? SHOP_MOBILE_CARD_GAP : SHOP_DESKTOP_CARD_GAP;
  const shouldMarquee = cards.length > 0 && (forceMarquee || (marqueeWhenOverflow && cards.length > 5));
  const cardHeight = compact ? SHOP_MOBILE_CARD_HEIGHT : SHOP_DESKTOP_CARD_HEIGHT;
  const renderList = shouldMarquee ? [...cards, ...cards] : cards;

  if (shouldMarquee) {
    return (
      <div
        className="group overflow-hidden"
        data-shop-rail-mode="marquee"
        style={{ width: '100%', height: cardHeight }}
      >
        <div
          className="flex h-full w-max animate-marquee group-hover:[animation-play-state:paused]"
          style={{ animationDuration: compact ? '18s' : '24s', willChange: 'transform' }}
        >
          {renderList.map((card, index) => (
            <div
              key={`${card.slotId}-${index}`}
              aria-hidden={index >= cards.length}
              style={{ marginRight: gap }}
            >
              <ShopCardTile
                card={card}
                compact={compact}
                disabled={disabled}
                onAction={onAction}
                onEdit={index < cards.length ? onEdit : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      data-shop-rail-mode="fixed"
      style={{
        display: 'flex',
        gap,
        flexWrap: 'nowrap',
        width: '100%',
      }}
    >
      {cards.map((card) => (
        <ShopCardTile
          key={card.slotId}
          card={card}
          compact={compact}
          disabled={disabled}
          onAction={onAction}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
