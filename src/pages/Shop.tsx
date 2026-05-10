import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useWalletPurchase } from '@/contexts/WalletPurchaseContext';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useShopCatalog } from '@/hooks/useShopCatalog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { ShopCardRail } from '@/components/shop/ShopCardRail';
import type { ShopActionKey, ShopCardViewModel } from '@/lib/shopCatalog';
import { extractFunctionErrorMessage } from '@/lib/oauth';
import { redirectToCheckout } from '@/lib/checkoutRedirect';
import { createShopCheckout } from '@/lib/shopCheckout';
import { supabase } from '@/integrations/supabase/client';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial', sans-serif";
const FONT_BOLD_OBLIQUE = "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', sans-serif";
const FONT_HEAD = "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', sans-serif";
const REWARD_ASSET_VERSION = '?v=3';

const SHOP_ASSETS = {
  topNeon: '/figma-assets/figma-neon.png',
  titleLockup: '/figma-assets/shop-spaccato-title.svg',
  titleOutline: '/figma-assets/shop/title-outline.svg',
  titleTriangles: '/figma-assets/shop/title-triangles.svg',
  searchIcon: '/figma-assets/shop/search-icon.svg',
  vipHeroMask: '/figma-assets/shop/vip-hero-mask.svg',
  vipHeroOverlay: '/figma-assets/shop/vip-hero-overlay.svg',
  rewardTrianglesLeft: `/figma-assets/shop/reward-triangles-left.svg${REWARD_ASSET_VERSION}`,
  rewardTrianglesRight: `/figma-assets/shop/reward-triangles-right.svg${REWARD_ASSET_VERSION}`,
  rewardVectorLarge: `/figma-assets/shop/reward-vector-large.svg${REWARD_ASSET_VERSION}`,
  rewardVectorSmall: `/figma-assets/shop/reward-vector-small.svg${REWARD_ASSET_VERSION}`,
  rewardStarShape: `/figma-assets/shop/reward-star-shape.svg${REWARD_ASSET_VERSION}`,
  arrowStroke: '/figma-assets/figma-arrow-stroke.svg',
  mousepad: `/figma-assets/shop/reward-mousepad.png${REWARD_ASSET_VERSION}`,
  walletCoin: '/coin.png',
  vipIcon: '/showreel/vip-icon.svg',
};

const DESKTOP_PAGE_WIDTH = 1920;
const DESKTOP_PAGE_HEIGHT = 2547;
const DESKTOP_SHELL_WIDTH = 1532;
const DESKTOP_CONTENT_LEFT = 42;
const DESKTOP_CONTENT_WIDTH = 1448;
const DESKTOP_FOOTER_TOP = 1910;

const desktopPageStyle: CSSProperties = {
  width: `${DESKTOP_PAGE_WIDTH}px`,
  height: `${DESKTOP_PAGE_HEIGHT}px`,
  background: '#0f0404',
  color: '#ffffff',
  position: 'relative',
  overflow: 'hidden',
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function matchesQuery(card: ShopCardViewModel, query: string) {
  if (!query) return true;
  return card.searchText.includes(query);
}

function TitleLockup() {
  return (
    <div style={{ position: 'relative', width: 476, height: 187, overflow: 'hidden' }}>
      <img
        src={SHOP_ASSETS.titleLockup}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
      />
      <h1
        style={{
          position: 'absolute',
          left: 71,
          top: 77,
          margin: 0,
          fontFamily: FONT_HEAD,
          fontSize: '80px',
          lineHeight: '95px',
          fontWeight: 900,
          fontStyle: 'oblique',
          letterSpacing: 0,
        }}
      >
        SHOP
      </h1>
    </div>
  );
}

function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label
      style={{
        width: 400,
        height: 47,
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.15)',
        background: '#282828',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 14px 0 18px',
        boxSizing: 'border-box',
      }}
    >
      <input
        value={value}
        onChange={onChange}
        aria-label="Search for items by title or price"
        placeholder="Search for items by title or price"
        style={{
          flex: 1,
          border: 0,
          outline: 'none',
          background: 'transparent',
          color: '#ffffff',
          opacity: 0.5,
          fontFamily: FONT_REGULAR,
          fontSize: 20,
          lineHeight: '24px',
          minWidth: 0,
        }}
      />
      <img src={SHOP_ASSETS.searchIcon} alt="" aria-hidden="true" style={{ width: 18, height: 26, display: 'block' }} />
    </label>
  );
}

function ActionPill({
  label,
  onClick,
  kind,
}: {
  label: 'POLICY' | 'WALLET';
  onClick: () => void;
  kind: 'policy' | 'wallet';
}) {
  const isWallet = kind === 'wallet';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: isWallet ? 190 : 173,
        height: 47,
        borderRadius: 16,
        border: `1px solid ${isWallet ? '#ff1654' : 'rgba(255,255,255,0.3)'}`,
        background: isWallet ? 'rgba(255,22,84,0.12)' : '#282828',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        color: '#ffffff',
        fontFamily: FONT_EXPANDED_BOLD,
        fontSize: 20,
        lineHeight: '24px',
        whiteSpace: 'nowrap',
      }}
    >
      {isWallet ? (
        <img
          src={SHOP_ASSETS.walletCoin}
          alt=""
          aria-hidden="true"
          data-wallet-coin="true"
          style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            borderRadius: '999px',
            background: '#ffffff',
            opacity: 0.9,
            boxShadow: '0 0 0 3px rgba(255,255,255,0.1) inset',
            display: 'block',
          }}
        />
      )}
      <span>{label}</span>
    </button>
  );
}

function BannerDecoration({
  left,
  top,
  width,
  height,
  innerWidth,
  innerHeight,
  rotation,
  src,
  imageInset = 0,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  innerWidth: number;
  innerHeight: number;
  rotation: number;
  src: string;
  imageInset?: CSSProperties['inset'];
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left,
        top,
        width,
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: innerWidth,
          height: innerHeight,
          position: 'relative',
          flex: '0 0 auto',
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: imageInset,
            pointerEvents: 'none',
          }}
        >
          <img
            src={src}
            alt=""
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function KnowMoreButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: 247,
        height: 65,
        borderRadius: 50,
        border: '1px solid #ff1654',
        background: 'rgba(255,22,84,0.23)',
        boxShadow: 'inset 0px -4px 4px rgba(0,0,0,0.25), inset 0px 4px 4px rgba(255,255,255,0.14)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 15,
        cursor: 'pointer',
        color: '#ffffff',
      }}
    >
      <span style={{ fontFamily: FONT_REGULAR, fontSize: 24, lineHeight: '29px' }}>KNOW MORE</span>
      <img
        src={SHOP_ASSETS.arrowStroke}
        alt=""
        aria-hidden="true"
        style={{ width: 15.653, height: 21.071, transform: 'rotate(-90deg)', display: 'block' }}
      />
    </button>
  );
}

function DesktopHeroVip({ onKnowMore }: { onKnowMore: () => void }) {
  return (
    <section
      style={{
        width: DESKTOP_CONTENT_WIDTH,
        height: 225,
        position: 'relative',
        overflow: 'visible',
        background: 'transparent',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #ff1654 0%, #0f0404 100%)',
          opacity: 0.5,
          filter: 'blur(110.65px)',
          transform: 'scale(1.08)',
          transformOrigin: 'center',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: '#0f0404',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, #ff1654 0%, #0f0404 100%)',
            pointerEvents: 'none',
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 282.966,
            top: -141,
            width: 1251.741,
            height: 421.215,
            overflow: 'hidden',
            WebkitMaskImage: `url(${SHOP_ASSETS.vipHeroMask})`,
            WebkitMaskPosition: '-283px 141px',
            WebkitMaskSize: '1448px 225px',
            WebkitMaskRepeat: 'no-repeat',
            maskImage: `url(${SHOP_ASSETS.vipHeroMask})`,
            maskPosition: '-283px 141px',
            maskSize: '1448px 225px',
            maskRepeat: 'no-repeat',
            pointerEvents: 'none',
          }}
        >
          <img
            src={SHOP_ASSETS.vipHeroOverlay}
            alt=""
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              display: 'block',
              maxWidth: 'none',
            }}
          />
        </div>

        <p
          style={{
            position: 'absolute',
            left: 52,
            top: 48,
            margin: 0,
            fontFamily: FONT_BOLD,
            fontSize: 96,
            lineHeight: '96px',
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          GET VIP NOW!
        </p>

        <div style={{ position: 'absolute', left: 1124.09, top: 80 }}>
          <KnowMoreButton onClick={onKnowMore} />
        </div>
      </div>
    </section>
  );
}

function DesktopHeroRewards({ onKnowMore }: { onKnowMore: () => void }) {
  return (
    <section
      style={{
        width: DESKTOP_CONTENT_WIDTH,
        height: 225,
        position: 'relative',
        overflow: 'visible',
        background: 'transparent',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #ff1654 0%, #0f0404 100%)',
          opacity: 0.5,
          filter: 'blur(110.65px)',
          transform: 'scale(1.08)',
          transformOrigin: 'center',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          background: '#0f0404',
          isolation: 'isolate',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, #ff1654 0%, #0f0404 100%)',
            pointerEvents: 'none',
          }}
        />

        <BannerDecoration
          left={674.962}
          top={105.01}
          width={97.498}
          height={123.28}
          innerWidth={72.312}
          innerHeight={108.466}
          rotation={-165.28}
          src={SHOP_ASSETS.rewardTrianglesLeft}
          imageInset="0 -1.43% 0 0"
        />
        <BannerDecoration
          left={282.966}
          top={-53}
          width={186.392}
          height={226.288}
          innerWidth={129.65}
          innerHeight={194.467}
          rotation={19.2}
          src={SHOP_ASSETS.rewardTrianglesRight}
        />
        <BannerDecoration
          left={1306.068}
          top={-100}
          width={228.74}
          height={256.896}
          innerWidth={118.059}
          innerHeight={230.82}
          rotation={34.83}
          src={SHOP_ASSETS.rewardVectorLarge}
          imageInset="-3.55% -6.95%"
        />
        <BannerDecoration
          left={1050.09}
          top={145}
          width={120.396}
          height={135.216}
          innerWidth={62.139}
          innerHeight={121.49}
          rotation={-145.17}
          src={SHOP_ASSETS.rewardVectorSmall}
          imageInset="-6.75% -13.2%"
        />
        <BannerDecoration
          left={765.932}
          top={-141}
          width={451.005}
          height={310.452}
          innerWidth={410.229}
          innerHeight={208.751}
          rotation={-15.44}
          src={SHOP_ASSETS.rewardStarShape}
          imageInset="-3.95% -1.79% -3.88% -1.79%"
        />
        <img
          src={SHOP_ASSETS.mousepad}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 791.932,
            top: 29,
            width: 179,
            height: 168,
            objectFit: 'contain',
            display: 'block',
            pointerEvents: 'none',
          }}
        />

        <p
          style={{
            position: 'absolute',
            left: 51,
            top: 46,
            margin: 0,
            fontFamily: FONT_BOLD,
            color: '#ffffff',
            lineHeight: 1,
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: 96, lineHeight: '96px' }}>REACH </span>
          <span style={{ fontSize: 40, lineHeight: '40px' }}>LVL.</span>
          <span style={{ fontSize: 96, lineHeight: '96px' }}>100!</span>
          <br />
          <span style={{ fontSize: 24, lineHeight: '24px' }}>FOR CRAZY REWARDS...</span>
        </p>

        <div style={{ position: 'absolute', left: 1124.09, top: 80, zIndex: 2 }}>
          <KnowMoreButton onClick={onKnowMore} />
        </div>
      </div>
    </section>
  );
}

function MobileHero({
  title,
  subtitle,
  onKnowMore,
  vip = false,
}: {
  title: string;
  subtitle?: string;
  onKnowMore: () => void;
  vip?: boolean;
}) {
  return (
    <section
      style={{
        position: 'relative',
        minHeight: 148,
        borderRadius: 18,
        overflow: 'hidden',
        padding: '24px 20px 18px',
        background: 'linear-gradient(90deg, #ff1654 0%, #5f0820 48%, #180003 100%)',
      }}
    >
      {vip ? (
        <img
          src={SHOP_ASSETS.vipHeroOverlay}
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', right: -32, top: -18, width: 290, height: 188, opacity: 0.7, pointerEvents: 'none' }}
        />
      ) : (
        <img
          src={SHOP_ASSETS.mousepad}
          alt=""
          aria-hidden="true"
          style={{ position: 'absolute', right: 28, top: 28, width: 92, height: 78, objectFit: 'contain', pointerEvents: 'none' }}
        />
      )}

      <div style={{ position: 'relative', zIndex: 2 }}>
        <p
          style={{
            margin: 0,
            fontFamily: FONT_BOLD,
            fontSize: vip ? '46px' : '38px',
            lineHeight: vip ? '44px' : '40px',
            color: '#ffffff',
          }}
        >
          {title}
        </p>
        {subtitle ? (
          <p style={{ margin: '8px 0 0', fontFamily: FONT_EXPANDED_BOLD, fontSize: '16px', lineHeight: '18px', color: '#ffffff' }}>
            {subtitle}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onKnowMore}
          style={{
            marginTop: 18,
            minWidth: 162,
            height: 46,
            borderRadius: 999,
            border: '1px solid #ff1654',
            background: 'rgba(255,22,84,0.23)',
            color: '#ffffff',
            fontFamily: FONT_REGULAR,
            fontSize: '18px',
            lineHeight: '22px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
          }}
        >
          KNOW MORE
          <img src={SHOP_ASSETS.arrowStroke} alt="" aria-hidden="true" style={{ width: 12, height: 16, transform: 'rotate(-90deg)' }} />
        </button>
      </div>
    </section>
  );
}

function CardEyebrow({ card }: { card: ShopCardViewModel }) {
  const label = card.kind === 'coin_pack'
    ? 'COINS'
    : card.kind === 'vip_membership'
      ? 'VIP'
      : card.kind === 'physical_reward'
        ? 'UNLOCK'
        : card.kind === 'physical_product'
          ? 'MERCH'
          : 'ACTION';

  return (
    <span
      style={{
        position: 'absolute',
        left: 14,
        top: 12,
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(0,0,0,0.22)',
        padding: '5px 10px',
        fontFamily: FONT_EXPANDED_BOLD,
        fontSize: 11,
        lineHeight: '13px',
        letterSpacing: '0.14em',
        color: '#ff8ead',
      }}
    >
      {label}
    </span>
  );
}

function CatalogCard({
  card,
  compact = false,
  onAction,
  disabled,
}: {
  card: ShopCardViewModel;
  compact?: boolean;
  onAction: (card: ShopCardViewModel) => void;
  disabled?: boolean;
}) {
  const width = compact ? 158 : 226.563;
  const height = compact ? 194 : 271.875;
  const badgeBottom = compact ? 18 : 24;
  const imageSize = compact ? 88 : 124;
  const titleSize = compact ? 18 : 22;
  const valueSize = compact ? 20 : 30;
  const displayValue = card.unlockLabel ?? card.priceLabel ?? card.badgeLabel ?? card.ctaLabel;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAction(card)}
      data-shop-card={card.id}
      data-shop-card-kind={card.kind}
      data-shop-claim-status={card.claimStatus ?? ''}
      style={{
        width,
        height,
        borderRadius: compact ? 18 : 17.219,
        background: '#3a0000',
        position: 'relative',
        overflow: 'hidden',
        flex: '0 0 auto',
        border: '1px solid rgba(255,255,255,0.08)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: 0,
        opacity: disabled ? 0.65 : 1,
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(255,22,84,0.18) 0%, rgba(58,0,0,0.92) 100%)',
        }}
      />
      <CardEyebrow card={card} />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: compact ? 52 : 60,
          width: imageSize,
          height: imageSize,
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={card.image}
          alt={card.title}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            filter: card.kind === 'action_card' ? 'drop-shadow(0 0 14px rgba(255,22,84,0.3))' : 'none',
          }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: badgeBottom,
          display: 'grid',
          gap: compact ? 6 : 8,
          textAlign: 'left',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: FONT_EXPANDED_BOLD,
              fontSize: titleSize,
              lineHeight: compact ? '20px' : '24px',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {card.title}
          </p>
          {card.subtitle ? (
            <p
              style={{
                margin: compact ? '4px 0 0' : '2px 0 0',
                fontFamily: FONT_REGULAR,
                fontSize: compact ? 12 : 14,
                lineHeight: compact ? '14px' : '18px',
                color: 'rgba(255,255,255,0.64)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {card.subtitle}
            </p>
          ) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {card.kind === 'coin_pack' || card.kind === 'vip_membership' ? (
            <img src={SHOP_ASSETS.walletCoin} alt="" aria-hidden="true" style={{ width: compact ? 18 : 22, height: compact ? 18 : 22, objectFit: 'contain' }} />
          ) : null}
          <span
            style={{
              fontFamily: card.kind === 'physical_reward' ? FONT_BOLD_OBLIQUE : FONT_EXPANDED_BOLD,
              fontSize: valueSize,
              lineHeight: compact ? '22px' : '37px',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            {displayValue}
          </span>
        </div>
      </div>
    </button>
  );
}

function CardRow({
  cards,
  onAction,
  compact = false,
  disabled,
}: {
  cards: ShopCardViewModel[];
  onAction: (card: ShopCardViewModel) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: compact ? 14 : 24,
        flexWrap: compact ? 'nowrap' : 'wrap',
      }}
    >
      {cards.map((card) => (
        <CatalogCard key={card.slotId} card={card} compact={compact} onAction={onAction} disabled={disabled} />
      ))}
    </div>
  );
}

function MobileFooter() {
  const groupTitle: CSSProperties = {
    margin: 0,
    fontFamily: FONT_HEAD,
    fontSize: '20px',
    lineHeight: '24px',
    color: '#ff1654',
  };

  const linkStyle: CSSProperties = {
    fontFamily: FONT_REGULAR,
    fontSize: '14px',
    lineHeight: '20px',
    color: '#e6e6e6',
    textDecoration: 'underline',
  };

  return (
    <section
      style={{
        position: 'relative',
        marginTop: 72,
        padding: '40px 20px 34px',
        borderTop: '0.5px solid #ffffff',
        background: '#0f0404',
        overflow: 'hidden',
      }}
    >
      <p
        aria-hidden="true"
        style={{
          margin: 0,
          fontFamily: FONT_HEAD,
          fontSize: '112px',
          lineHeight: '0.9',
          backgroundImage: 'linear-gradient(180.075deg, rgb(15, 4, 4) 10.117%, rgb(255, 255, 255) 99.722%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
          position: 'absolute',
          top: '-6px',
          left: '20px',
          zIndex: 1,
          pointerEvents: 'none',
        }}
      >
        OLEBOY
      </p>

      <div style={{ position: 'relative', zIndex: 2, display: 'grid', gap: 24, paddingTop: 96 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <p style={groupTitle}>SOCIALS</p>
          <a href="https://x.com/oleboytokens" rel="noopener noreferrer" target="_blank" style={linkStyle}>X/Twitter</a>
          <a href="https://www.tiktok.com/@oleboytokens" rel="noopener noreferrer" target="_blank" style={linkStyle}>TikTok</a>
          <a href="https://discord.gg/2XVffNDPAE" rel="noopener noreferrer" target="_blank" style={linkStyle}>Discord</a>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <p style={groupTitle}>CONTACT US</p>
          <a href="mailto:coolowner.2025@gmail.com" style={linkStyle}>coolowner.2025@gmail.com</a>
          <a href="mailto:letterio.tomasini@gmail.com" style={linkStyle}>letterio.tomasini@gmail.com</a>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          <p style={groupTitle}>PRIVACY</p>
          <Link to="/terms" style={linkStyle}>Terms &amp; Conditions</Link>
        </div>

        <p style={{ margin: '8px 0 0', fontFamily: FONT_REGULAR, fontSize: '14px', lineHeight: '18px', color: '#e6e6e6' }}>
          {'\u00A9'} 2026 OLEBOY. All Rights Reserved.
        </p>
      </div>
    </section>
  );
}

function useShopCardActions({
  claimReward,
}: {
  claimReward: (itemId: string) => Promise<{ success?: boolean; error?: string; status?: string; claim_id?: string } | null>;
}) {
  const navigate = useNavigate();
  const { user, refreshWallet } = useAuth();
  const { toast } = useToast();
  const { openWalletPurchase } = useWalletPurchase();

  const runActionKey = useCallback((actionKey: ShopActionKey | null) => {
    switch (actionKey) {
      case 'open_wallet_coins':
        openWalletPurchase('coins');
        return;
      case 'open_wallet_vip':
        openWalletPurchase('vip');
        return;
      case 'open_challenges':
        navigate('/challenges');
        return;
      case 'open_matches':
        navigate('/matches');
        return;
      case 'open_teams':
        navigate('/teams');
        return;
      case 'open_shop':
        navigate('/shop');
        return;
      default:
        return;
    }
  }, [navigate, openWalletPurchase]);

  const startCheckout = useCallback(async (card: ShopCardViewModel) => {
    const checkoutUrl = await createShopCheckout({
      itemId: card.id,
      slotId: card.slotId,
      slug: card.slug,
      kind: card.kind,
      coinAmount: card.coinAmount,
    });
    redirectToCheckout(checkoutUrl);
  }, []);

  const purchaseVip = useCallback(async (itemId: string) => {
    const { data, error } = await supabase.rpc('purchase_shop_wallet_item', {
      p_item_id: itemId,
    });

    if (error) throw error;

    const result = data as { success?: boolean; error?: string } | null;
    if (!result?.success) {
      throw new Error(result?.error || 'Unable to activate VIP.');
    }

    await refreshWallet();
    toast({
      title: 'VIP updated',
      description: 'Your VIP membership has been refreshed.',
    });
  }, [refreshWallet, toast]);

  const handleCardAction = useCallback(async (card: ShopCardViewModel) => {
    try {
      if (card.kind === 'action_card') {
        runActionKey(card.actionKey);
        return;
      }

      if ((card.kind === 'coin_pack' || card.kind === 'physical_product') && !user) {
        navigate('/auth');
        return;
      }

      if (card.kind === 'coin_pack' || card.kind === 'physical_product') {
        await startCheckout(card);
        return;
      }

      if (card.kind === 'vip_membership') {
        if (!user) {
          navigate('/auth');
          return;
        }
        await purchaseVip(card.id);
        return;
      }

      if (card.kind === 'physical_reward') {
        if (!user) {
          navigate('/auth');
          return;
        }
        if (card.isLocked || card.isClaimed) {
          return;
        }

        const result = await claimReward(card.id);
        if (!result?.success) {
          throw new Error(result?.error || 'Unable to claim reward.');
        }

        toast({
          title: 'Reward claimed',
          description: `${card.title} is now pending admin review.`,
        });
      }
    } catch (error) {
      const message = await extractFunctionErrorMessage(error, 'Unable to complete this shop action.');
      toast({
        title: 'Shop error',
        description: message,
        variant: 'destructive',
      });
    }
  }, [claimReward, navigate, purchaseVip, runActionKey, startCheckout, toast, user]);

  return {
    handleCardAction,
  };
}

function DesktopShopContent() {
  const navigate = useNavigate();
  const rewardRowRef = useRef<HTMLDivElement | null>(null);
  const { openWalletPurchase } = useWalletPurchase();
  const { isAdmin } = useAdminStatus();
  const { featuredCards, unlockCards, catalog, claimReward, isClaiming } = useShopCatalog();
  const { handleCardAction } = useShopCardActions({ claimReward });
  const [search, setSearch] = useState('');

  const handleEditCard = useCallback(
    (card: ShopCardViewModel) => {
      navigate(`/admin/shop?slot=${encodeURIComponent(card.slotId)}&surface=${encodeURIComponent(card.surfaceKey)}&item=${encodeURIComponent(card.id)}`);
    },
    [navigate],
  );

  const query = normalizeQuery(search);
  const filteredFeaturedCards = useMemo(() => featuredCards.filter((card) => matchesQuery(card, query)), [featuredCards, query]);
  const filteredUnlockCards = useMemo(() => unlockCards.filter((card) => matchesQuery(card, query)), [unlockCards, query]);

  return (
    <div data-testid="shop-page" style={desktopPageStyle}>
      <img
        src={SHOP_ASSETS.topNeon}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 146, objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
      />

      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: 0,
          width: DESKTOP_SHELL_WIDTH,
          height: DESKTOP_FOOTER_TOP,
          transform: 'translateX(-50%)',
          zIndex: 2,
        }}
      >
        <div style={{ position: 'absolute', left: -29, top: 156 }}>
          <TitleLockup />
        </div>

        <div style={{ position: 'absolute', left: DESKTOP_CONTENT_LEFT, top: 396 }}>
          <SearchBar value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>

        <div style={{ position: 'absolute', left: 1116.09, top: 395 }}>
          <ActionPill kind="policy" label="POLICY" onClick={() => navigate('/privacy')} />
        </div>

        <div style={{ position: 'absolute', left: 1299.078, top: 395 }}>
          <ActionPill kind="wallet" label="WALLET" onClick={() => openWalletPurchase('coins')} />
        </div>

        <div style={{ position: 'absolute', left: DESKTOP_CONTENT_LEFT, top: 496 }}>
          <DesktopHeroVip onKnowMore={() => openWalletPurchase('vip')} />
        </div>

        <div style={{ position: 'absolute', left: DESKTOP_CONTENT_LEFT, top: 874, width: DESKTOP_CONTENT_WIDTH }}>
          <ShopCardRail
            cards={filteredFeaturedCards}
            onAction={handleCardAction}
            onEdit={isAdmin ? handleEditCard : undefined}
          />
        </div>

        <div style={{ position: 'absolute', left: DESKTOP_CONTENT_LEFT, top: 1233 }}>
          <DesktopHeroRewards onKnowMore={() => rewardRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        </div>

        <div ref={rewardRowRef} style={{ position: 'absolute', left: DESKTOP_CONTENT_LEFT, top: 1546, width: DESKTOP_CONTENT_WIDTH }}>
          <ShopCardRail
            cards={filteredUnlockCards}
            onAction={handleCardAction}
            disabled={isClaiming}
            onEdit={isAdmin ? handleEditCard : undefined}
          />
        </div>

        <div
          style={{
            position: 'absolute',
            left: DESKTOP_CONTENT_LEFT,
            top: 1850,
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            color: 'rgba(255,255,255,0.66)',
            fontFamily: FONT_REGULAR,
            fontSize: 18,
          }}
        >
          <span>LIVE VIEWER</span>
          <span style={{ color: '#ffffff', fontFamily: FONT_EXPANDED_BOLD }}>
            {catalog.viewer.isVip ? 'VIP' : 'BASE'}
          </span>
          <span>LVL {catalog.viewer.level}</span>
        </div>
      </div>

      <div style={{ position: 'absolute', left: 0, top: DESKTOP_FOOTER_TOP, width: '100%' }}>
        <FooterSection />
      </div>
    </div>
  );
}

function MobileShopContent() {
  const navigate = useNavigate();
  const rewardRowRef = useRef<HTMLDivElement | null>(null);
  const { openWalletPurchase } = useWalletPurchase();
  const { isAdmin } = useAdminStatus();
  const { featuredCards, unlockCards, claimReward, isClaiming } = useShopCatalog();
  const { handleCardAction } = useShopCardActions({ claimReward });
  const [search, setSearch] = useState('');

  const handleEditCard = useCallback(
    (card: ShopCardViewModel) => {
      navigate(`/admin/shop?slot=${encodeURIComponent(card.slotId)}&surface=${encodeURIComponent(card.surfaceKey)}&item=${encodeURIComponent(card.id)}`);
    },
    [navigate],
  );

  const query = normalizeQuery(search);
  const filteredFeaturedCards = useMemo(() => featuredCards.filter((card) => matchesQuery(card, query)), [featuredCards, query]);
  const filteredUnlockCards = useMemo(() => unlockCards.filter((card) => matchesQuery(card, query)), [unlockCards, query]);

  return (
    <div data-testid="shop-page" style={{ minHeight: '100vh', background: '#0f0404', color: '#ffffff', overflowX: 'hidden' }}>
      <div style={{ padding: '96px 20px 0', position: 'relative' }}>
        <img src={SHOP_ASSETS.topNeon} alt="" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 90, objectFit: 'cover', pointerEvents: 'none' }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ position: 'relative', minHeight: 118, marginBottom: 30 }}>
            <img src={SHOP_ASSETS.titleTriangles} alt="" aria-hidden="true" style={{ position: 'absolute', left: -12, top: -2, width: 74, height: 112 }} />
            <h1 style={{ margin: 0, paddingLeft: 48, paddingTop: 38, fontFamily: FONT_HEAD, fontSize: '54px', lineHeight: '56px' }}>SHOP</h1>
            <img src={SHOP_ASSETS.titleOutline} alt="" aria-hidden="true" style={{ position: 'absolute', left: 38, top: 95, width: 120, height: 6 }} />
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            <SearchBar value={search} onChange={(event) => setSearch(event.target.value)} />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <ActionPill kind="policy" label="POLICY" onClick={() => navigate('/privacy')} />
              <ActionPill kind="wallet" label="WALLET" onClick={() => openWalletPurchase('coins')} />
            </div>
          </div>

          <div style={{ marginTop: 28 }}>
            <MobileHero title="GET VIP NOW!" vip onKnowMore={() => openWalletPurchase('vip')} />
          </div>

          <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '22px 0 6px' }}>
            <ShopCardRail
              cards={filteredFeaturedCards}
              compact
              onAction={handleCardAction}
              onEdit={isAdmin ? handleEditCard : undefined}
              marqueeWhenOverflow={false}
            />
          </div>

          <div style={{ marginTop: 28 }}>
            <MobileHero title="REACH LVL.100!" subtitle="FOR CRAZY REWARDS..." onKnowMore={() => rewardRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
          </div>

          <div ref={rewardRowRef} style={{ overflowX: 'auto', padding: '22px 0 6px' }}>
            <ShopCardRail
              cards={filteredUnlockCards}
              compact
              onAction={handleCardAction}
              disabled={isClaiming}
              onEdit={isAdmin ? handleEditCard : undefined}
              marqueeWhenOverflow={false}
            />
          </div>
        </div>
      </div>

      <MobileFooter />
    </div>
  );
}

export default function Shop() {
  const isMobile = useIsMobile();

  return (
    <PublicLayout scaleToFigmaFrame={!isMobile}>
      {isMobile ? <MobileShopContent /> : <DesktopShopContent />}
    </PublicLayout>
  );
}
