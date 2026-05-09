import type { CSSProperties } from 'react';
import type { ShopCardViewModel } from '@/lib/shopCatalog';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial', sans-serif";
const FONT_BOLD_OBLIQUE = "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', sans-serif";

const WALLET_COIN_ASSET = '/coin.png';

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
  const titleSize = compact ? (isUnlock ? 17 : 18) : (isUnlock ? 24 : 23);
  const subtitleSize = compact ? 11 : 14;
  const valueSize = compact ? (isUnlock ? 18 : 20) : (isUnlock ? 28 : 30);
  const imageBox = compact
    ? (isUnlock ? { width: 70, height: 70, top: 58 } : { width: 90, height: 90, top: 50 })
    : (isUnlock ? { width: 110, height: 110, top: 62 } : { width: 126, height: 126, top: 54 });
  const secondaryBox = compact
    ? { width: 52, height: 52, top: 44, right: 14 }
    : { width: 72, height: 72, top: 52, right: 18 };
  const displayValue = card.unlockLabel ?? card.priceLabel ?? card.ctaLabel;

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

      {card.showBadge ? (
        <span
          style={{
            position: 'absolute',
            left: compact ? 12 : 14,
            top: compact ? 12 : 13,
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(0,0,0,0.28)',
            padding: compact ? '4px 9px' : '5px 10px',
            fontFamily: FONT_EXPANDED_BOLD,
            fontSize: compact ? 10 : 11,
            lineHeight: compact ? '12px' : '13px',
            letterSpacing: '0.14em',
            color: '#ff8ead',
            zIndex: 2,
          }}
        >
          {card.badgeLabel}
        </span>
      ) : null}

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
          left: '50%',
          top: imageBox.top,
          width: imageBox.width,
          height: imageBox.height,
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        <img
          src={card.primaryImage}
          alt={card.title}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            display: 'block',
            filter: isUnlock ? 'drop-shadow(0 14px 20px rgba(0,0,0,0.16))' : 'drop-shadow(0 10px 18px rgba(255,22,84,0.18))',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: compact ? 14 : 16,
          right: compact ? 14 : 16,
          bottom: compact ? 16 : 18,
          display: 'grid',
          gap: compact ? 5 : 7,
          textAlign: 'left',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: isUnlock ? FONT_BOLD : FONT_EXPANDED_BOLD,
              fontSize: titleSize,
              lineHeight: compact ? '19px' : isUnlock ? '25px' : '24px',
              color: '#ffffff',
              ...clampTextLines(2),
            }}
          >
            {card.title}
          </p>

          {card.showSubtitle && card.subtitle ? (
            <p
              style={{
                margin: compact ? '3px 0 0' : '4px 0 0',
                fontFamily: FONT_REGULAR,
                fontSize: subtitleSize,
                lineHeight: compact ? '13px' : '18px',
                color: 'rgba(255,255,255,0.72)',
                textTransform: 'uppercase',
                letterSpacing: compact ? '0.03em' : '0.02em',
                ...clampTextLines(1),
              }}
            >
              {card.subtitle}
            </p>
          ) : null}

          {card.showSupportingText && card.supportingText ? (
            <p
              style={{
                margin: compact ? '5px 0 0' : '6px 0 0',
                fontFamily: FONT_REGULAR,
                fontSize: compact ? 10 : 12,
                lineHeight: compact ? '12px' : '15px',
                color: 'rgba(255,255,255,0.78)',
                textTransform: 'uppercase',
                ...clampTextLines(compact ? 2 : 1),
              }}
            >
              {card.supportingText}
            </p>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 6 : 8 }}>
          {(card.kind === 'coin_pack' || card.kind === 'vip_membership' || card.kind === 'physical_product') ? (
            <img
              src={WALLET_COIN_ASSET}
              alt=""
              aria-hidden="true"
              style={{
                width: compact ? 16 : 22,
                height: compact ? 16 : 22,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          ) : null}
          <span
            style={{
              fontFamily: card.kind === 'physical_reward' ? FONT_BOLD_OBLIQUE : FONT_EXPANDED_BOLD,
              fontSize: valueSize,
              lineHeight: compact ? '22px' : card.kind === 'physical_reward' ? '30px' : '37px',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            {displayValue}
          </span>
        </div>
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
