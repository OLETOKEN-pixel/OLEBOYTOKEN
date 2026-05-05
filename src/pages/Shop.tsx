import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useWalletPurchase } from '@/contexts/WalletPurchaseContext';
import { useIsMobile } from '@/hooks/use-mobile';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial', sans-serif";
const FONT_BOLD_OBLIQUE = "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED = "'Base_Neue_Trial:Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', sans-serif";
const FONT_HEAD = "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', sans-serif";

const SHOP_ASSETS = {
  topNeon: '/figma-assets/figma-neon.png',
  titleOutline: '/figma-assets/shop/title-outline.svg',
  titleTriangles: '/figma-assets/shop/title-triangles.svg',
  searchIcon: '/figma-assets/shop/search-icon.svg',
  rewardFigure: '/figma-assets/shop/reward-figure.png',
  vipHeroOverlay: '/figma-assets/shop/vip-hero-overlay.svg',
  rewardTrianglesLeft: '/figma-assets/shop/reward-triangles-left.svg',
  rewardTrianglesRight: '/figma-assets/shop/reward-triangles-right.svg',
  rewardVectorLarge: '/figma-assets/shop/reward-vector-large.svg',
  rewardVectorSmall: '/figma-assets/shop/reward-vector-small.svg',
  arrowStroke: '/figma-assets/figma-arrow-stroke.svg',
  starShape: '/figma-assets/figma-star-shape.svg',
  mousepad: '/shop/tappetino.png',
};

type ShopCard = {
  id: string;
  title: string;
  keywords: string[];
  kind: 'reward-figure' | 'price-only' | 'coin-stack';
  badge: string;
};

const vipCards: ShopCard[] = Array.from({ length: 5 }, (_, index) => ({
  id: `vip-${index + 1}`,
  title: '500',
  keywords: ['500', 'reward', 'statue', 'coins'],
  kind: 'reward-figure',
  badge: '500',
}));

const rewardCards: ShopCard[] = [
  {
    id: 'reward-price',
    title: '€9,99',
    keywords: ['9,99', '9.99', 'reward', 'price'],
    kind: 'price-only',
    badge: '€9,99',
  },
  ...Array.from({ length: 4 }, (_, index) => ({
    id: `reward-${index + 1}`,
    title: 'x100',
    keywords: ['9,99', '9.99', '100', 'x100', 'coins'],
    kind: 'coin-stack' as const,
    badge: '€9,99',
  })),
];

const desktopPageStyle: CSSProperties = {
  width: '1920px',
  minHeight: '2547px',
  background: '#0f0404',
  color: '#ffffff',
  position: 'relative',
  overflow: 'hidden',
};

function normalizeQuery(value: string) {
  return value.trim().toLowerCase();
}

function matchesQuery(card: ShopCard, query: string) {
  if (!query) return true;
  return [card.title, ...card.keywords].some((value) => value.toLowerCase().includes(query));
}

function TitleLockup() {
  return (
    <div style={{ position: 'relative', height: 187, marginLeft: '-71px' }}>
      <img
        src={SHOP_ASSETS.titleTriangles}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0, width: 124, height: 186, display: 'block' }}
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

      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 59.76,
          top: 166.91,
          width: 415.601,
          height: 19.874,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: 18.421,
            height: 415.539,
            position: 'relative',
            flex: '0 0 auto',
            transform: 'rotate(89.8deg) scaleY(-1)',
          }}
        >
          <img
            src={SHOP_ASSETS.titleOutline}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
          />
        </div>
      </div>
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
  const policy = kind === 'policy';

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: policy ? 173 : 191,
        height: 47,
        borderRadius: 16,
        border: `1px solid ${policy ? 'rgba(255,255,255,0.5)' : '#ff1654'}`,
        background: policy ? 'rgba(40,40,40,0.8)' : 'rgba(255,22,84,0.2)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        cursor: 'pointer',
        color: '#ffffff',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: policy ? 16 : 23,
          height: policy ? 16 : 23,
          borderRadius: '999px',
          background: policy ? '#ffffff' : '#ff1654',
          color: policy ? 'rgba(40,40,40,0.8)' : 'transparent',
          display: 'grid',
          placeItems: 'center',
          fontFamily: FONT_EXPANDED_BOLD,
          fontSize: policy ? 13 : 0,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {policy ? 'i' : ''}
      </span>
      <span
        style={{
          fontFamily: FONT_EXPANDED_BOLD,
          fontSize: 24,
          lineHeight: '29px',
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
    </button>
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

function FigureCard({ card }: { card: ShopCard }) {
  return (
    <div
      data-shop-card={card.id}
      style={{
        width: 226.563,
        height: 271.875,
        borderRadius: 17.219,
        background: '#3a0000',
        position: 'relative',
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      <img
        src={SHOP_ASSETS.rewardFigure}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 5,
          top: 9,
          width: 232.906,
          height: 232.906,
          objectFit: 'contain',
          display: 'block',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'absolute',
          left: 54.36,
          top: 215.13,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 24.469,
            height: 24.469,
            borderRadius: '999px',
            background: '#ff1654',
            boxShadow: '0 0 8px rgba(255,22,84,0.34)',
            display: 'block',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontFamily: FONT_EXPANDED_BOLD,
            fontSize: 30.908,
            lineHeight: '37px',
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          {card.badge}
        </span>
      </div>
    </div>
  );
}

function PriceOnlyCard({ card }: { card: ShopCard }) {
  return (
    <div
      data-shop-card={card.id}
      style={{
        width: 226.563,
        height: 271.875,
        borderRadius: 17.219,
        background: '#3a0000',
        position: 'relative',
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 21.2,
          transform: 'translateX(-50%)',
          fontFamily: FONT_EXPANDED_BOLD,
          fontSize: 30.908,
          lineHeight: '37px',
          color: '#ffffff',
          whiteSpace: 'nowrap',
        }}
      >
        {card.badge}
      </span>
    </div>
  );
}

function CoinStackCard({ card }: { card: ShopCard }) {
  return (
    <div
      data-shop-card={card.id}
      style={{
        width: 226.563,
        height: 271.875,
        borderRadius: 17.219,
        background: '#3a0000',
        position: 'relative',
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 53,
          top: 65,
          width: 88,
          height: 88,
          borderRadius: '999px',
          background: '#ff1654',
          boxShadow: '0 0 18px rgba(255,22,84,0.34)',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 131,
          top: 40,
          width: 41,
          height: 41,
          borderRadius: '999px',
          background: '#ff4e7d',
        }}
      />
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 105,
          top: 41,
          width: 21,
          height: 21,
          borderRadius: '999px',
          background: '#ff4e7d',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: 120,
          top: 127,
          transform: 'translateX(-50%)',
          fontFamily: FONT_BOLD_OBLIQUE,
          fontSize: 30.908,
          lineHeight: '37px',
          color: '#ffffff',
          backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #ff1654 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          whiteSpace: 'nowrap',
        }}
      >
        x100
      </span>
      <span
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 21.2,
          transform: 'translateX(-50%)',
          fontFamily: FONT_EXPANDED_BOLD,
          fontSize: 30.908,
          lineHeight: '37px',
          color: '#ffffff',
          whiteSpace: 'nowrap',
        }}
      >
        {card.badge}
      </span>
    </div>
  );
}

function CardRow({ cards }: { cards: ShopCard[] }) {
  return (
    <div
      style={{
        width: 1448,
        minHeight: 271.875,
        display: 'flex',
        gap: 45,
        alignItems: 'flex-start',
      }}
    >
      {cards.map((card) => {
        if (card.kind === 'reward-figure') return <FigureCard key={card.id} card={card} />;
        if (card.kind === 'price-only') return <PriceOnlyCard key={card.id} card={card} />;
        return <CoinStackCard key={card.id} card={card} />;
      })}
    </div>
  );
}

function DesktopHeroVip({ onKnowMore }: { onKnowMore: () => void }) {
  return (
    <section
      style={{
        width: 1448,
        height: 225,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #ff1654 0%, #80102e 42%, #33000d 72%, #140005 100%)',
      }}
    >
      <img
        src={SHOP_ASSETS.vipHeroOverlay}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 443,
          top: -141,
          width: 1251.741,
          height: 421.215,
          display: 'block',
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />

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

      <div style={{ position: 'absolute', right: 63, top: 80 }}>
        <KnowMoreButton onClick={onKnowMore} />
      </div>
    </section>
  );
}

function DesktopHeroRewards({ onKnowMore }: { onKnowMore: () => void }) {
  return (
    <section
      style={{
        width: 1448,
        height: 225,
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #ff1654 0%, #86112f 34%, #36000d 72%, #140005 100%)',
      }}
    >
      <img
        src={SHOP_ASSETS.rewardTrianglesLeft}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 448, top: 102, width: 97.498, height: 123.28, display: 'block', pointerEvents: 'none' }}
      />
      <img
        src={SHOP_ASSETS.rewardTrianglesRight}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 391, top: 0, width: 186.392, height: 226.288, display: 'block', pointerEvents: 'none' }}
      />
      <img
        src={SHOP_ASSETS.rewardVectorLarge}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', right: 154, top: 20, width: 228.74, height: 256.896, display: 'block', pointerEvents: 'none' }}
      />
      <img
        src={SHOP_ASSETS.rewardVectorSmall}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', right: 367, top: 145, width: 120.396, height: 135.216, display: 'block', pointerEvents: 'none' }}
      />
      <img
        src={SHOP_ASSETS.starShape}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 655, top: -12, width: 451.005, height: 310.452, display: 'block', pointerEvents: 'none', transform: 'rotate(-15.44deg)' }}
      />
      <img
        src={SHOP_ASSETS.mousepad}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 810, top: 29, width: 179, height: 168, objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
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
        }}
      >
        <span style={{ fontSize: 96, lineHeight: '96px' }}>REACH </span>
        <span style={{ fontSize: 40, lineHeight: '40px' }}>LVL.</span>
        <span style={{ fontSize: 96, lineHeight: '96px' }}>100!</span>
        <br />
        <span style={{ fontSize: 24, lineHeight: '24px' }}>FOR CRAZY REWARDS...</span>
      </p>

      <div style={{ position: 'absolute', right: 63, top: 80 }}>
        <KnowMoreButton onClick={onKnowMore} />
      </div>
    </section>
  );
}

function DesktopShopContent() {
  const navigate = useNavigate();
  const { openWalletPurchase } = useWalletPurchase();
  const rewardRowRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');

  const query = normalizeQuery(search);
  const filteredVipCards = useMemo(() => vipCards.filter((card) => matchesQuery(card, query)), [query]);
  const filteredRewardCards = useMemo(() => rewardCards.filter((card) => matchesQuery(card, query)), [query]);

  return (
    <div data-testid="shop-page" style={desktopPageStyle}>
      <img
        src={SHOP_ASSETS.topNeon}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 146, objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
      />
      <img
        src={SHOP_ASSETS.topNeon}
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', left: 0, top: 827, width: 1920, height: 146, objectFit: 'cover', display: 'block', pointerEvents: 'none', transform: 'scaleY(-1)' }}
      />

      <div style={{ width: 1532, margin: '0 auto', paddingTop: 156, position: 'relative', zIndex: 2 }}>
        <TitleLockup />

        <div
          style={{
            marginTop: 53,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <SearchBar value={search} onChange={(event) => setSearch(event.target.value)} />
          <div style={{ display: 'flex', gap: 18 }}>
            <ActionPill kind="policy" label="POLICY" onClick={() => navigate('/privacy')} />
            <ActionPill kind="wallet" label="WALLET" onClick={() => openWalletPurchase('coins')} />
          </div>
        </div>

        <div style={{ width: 1448, marginTop: 54 }}>
          <DesktopHeroVip onKnowMore={() => openWalletPurchase('vip')} />
        </div>

        <div style={{ width: 1448, marginTop: 153 }}>
          <CardRow cards={filteredVipCards} />
        </div>

        <div style={{ width: 1448, marginTop: 87 }}>
          <DesktopHeroRewards onKnowMore={() => rewardRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} />
        </div>

        <div ref={rewardRowRef} style={{ width: 1448, marginTop: 88 }}>
          <CardRow cards={filteredRewardCards} />
        </div>
      </div>

      <div style={{ marginTop: 92 }}>
        <FooterSection />
      </div>
    </div>
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
        <>
          <img src={SHOP_ASSETS.starShape} alt="" aria-hidden="true" style={{ position: 'absolute', right: 36, top: -18, width: 136, height: 96, opacity: 0.72, pointerEvents: 'none' }} />
          <img src={SHOP_ASSETS.mousepad} alt="" aria-hidden="true" style={{ position: 'absolute', right: 28, top: 28, width: 92, height: 78, objectFit: 'contain', pointerEvents: 'none' }} />
        </>
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

function MobileCard({ card }: { card: ShopCard }) {
  const isFigure = card.kind === 'reward-figure';
  const isPriceOnly = card.kind === 'price-only';

  return (
    <div
      style={{
        width: 158,
        height: 194,
        borderRadius: 18,
        background: '#3a0000',
        position: 'relative',
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      {isFigure ? (
        <img src={SHOP_ASSETS.rewardFigure} alt="" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', padding: '10px 8px 28px' }} />
      ) : isPriceOnly ? null : (
        <>
          <span aria-hidden="true" style={{ position: 'absolute', left: 34, top: 50, width: 62, height: 62, borderRadius: '999px', background: '#ff1654' }} />
          <span aria-hidden="true" style={{ position: 'absolute', left: 90, top: 34, width: 29, height: 29, borderRadius: '999px', background: '#ff4e7d' }} />
          <span aria-hidden="true" style={{ position: 'absolute', left: 71, top: 35, width: 15, height: 15, borderRadius: '999px', background: '#ff4e7d' }} />
          <span
            style={{
              position: 'absolute',
              left: 77,
              top: 98,
              transform: 'translateX(-50%)',
              fontFamily: FONT_BOLD_OBLIQUE,
              fontSize: 22,
              lineHeight: '26px',
              backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #ff1654 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            x100
          </span>
        </>
      )}

      <div
        style={{
          position: 'absolute',
          left: '50%',
          bottom: 16,
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: isFigure ? 6 : 0,
        }}
      >
        {isFigure ? <span aria-hidden="true" style={{ width: 16, height: 16, borderRadius: '999px', background: '#ff1654', display: 'block' }} /> : null}
        <span style={{ fontFamily: FONT_EXPANDED_BOLD, fontSize: 26, lineHeight: '31px', color: '#ffffff', whiteSpace: 'nowrap' }}>
          {isFigure ? card.badge : '€9,99'}
        </span>
      </div>
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

function MobileShopContent() {
  const navigate = useNavigate();
  const { openWalletPurchase } = useWalletPurchase();
  const rewardRowRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState('');

  const query = normalizeQuery(search);
  const filteredVipCards = useMemo(() => vipCards.filter((card) => matchesQuery(card, query)), [query]);
  const filteredRewardCards = useMemo(() => rewardCards.filter((card) => matchesQuery(card, query)), [query]);

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
            {filteredVipCards.map((card) => (
              <MobileCard key={card.id} card={card} />
            ))}
          </div>

          <div style={{ marginTop: 28 }}>
            <MobileHero title="REACH LVL.100!" subtitle="FOR CRAZY REWARDS..." onKnowMore={() => rewardRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
          </div>

          <div ref={rewardRowRef} style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '22px 0 6px' }}>
            {filteredRewardCards.map((card) => (
              <MobileCard key={card.id} card={card} />
            ))}
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
