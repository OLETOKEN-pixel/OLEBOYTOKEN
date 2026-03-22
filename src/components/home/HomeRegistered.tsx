/**
 * HomeRegistered — Logged-in user home page
 * Frame: 1920x3820px (4 sections, 955px each)
 *
 * Follows the same inline-style, absolute-positioning patterns
 * established in HomeNotRegistered.tsx.
 */

import { useCallback } from 'react';

// ─── Asset URLs ─────────────────────────────────────────────────────────────
const A_NEON = '/figma-assets/figma-neon.png';
const A_GUIDE = '/figma-assets/figma-guide.svg';
const A_BW_ARROW = '/figma-assets/figma-bw-arrow.svg';
const A_FW_ARROW = '/figma-assets/figma-fw-arrow.svg';
const A_STAR_SHAPE = '/figma-assets/figma-star-shape.svg';
const A_SPAC_TITLE_4 = '/figma-assets/figma-spaccato-title-s4.svg';

// ─── Font ────────────────────────────────────────────────────────────────────
const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base Neue Expanded', 'Base Neue Trial', 'Base Neue', sans-serif";

// ─── Section background ──────────────────────────────────────────────────────
const SECTION_BG = 'radial-gradient(ellipse at 50% 40%, #1a0a0a 0%, #0f0404 50%, #080202 100%)';

// ─── Section scroll IDs ─────────────────────────────────────────────────────
const IDS = ['s-hero', 's-matches', 's-leaderboard', 's-challenges'];

// ─── Props ───────────────────────────────────────────────────────────────────
interface HomeRegisteredProps {
  displayName: string;
}

export function HomeRegistered({ displayName }: HomeRegisteredProps) {
  const scrollTo = useCallback((i: number) => {
    const el = document.getElementById(IDS[Math.max(0, Math.min(i, IDS.length - 1))]);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div style={{ width: '100%', background: '#0f0404', overflowX: 'hidden' }}>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="s-hero"
        style={{
          position: 'relative',
          minHeight: '100vh',
          height: '955px',
          width: '100%',
          background: SECTION_BG,
          overflow: 'hidden',
        }}
      >
        {/* TOP NEON */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '146px',
            pointerEvents: 'none',
            zIndex: 3,
          }}
        >
          <img src={A_NEON} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* ZAPS — 2 lightning bolts only (LB left-bottom, RT right-top) */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-9.56%',
            top: '-290px',
            width: '119.19%',
            height: '1373.5px',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <svg
            viewBox="0 0 2288.42 1373.5"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <path d="M317.78 1162.75L103.273 1322.33L8.98886 1220.33L138.149 1133.86L182.208 1161.81L104.995 1078.27L545.918 875.212L279.561 1100.15L244.428 1083.39L317.78 1162.75Z" fill="#FF1654"/>
            <path d="M1973.05 196.038L2152.46 42.0506L2242.11 125.883L2133.48 210.131L2092.82 188.315L2166.23 256.969L1789.62 463.501L2010.72 248.726L2042.79 261.259L1973.05 196.038Z" fill="#FF1654"/>
          </svg>
        </div>

        {/* BOTTOM NEON — at bottom of hero, flipped */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            bottom: '-18px',
            width: '100%',
            height: '146px',
            pointerEvents: 'none',
            zIndex: 3,
            transform: 'scaleY(-1)',
          }}
        >
          <img src={A_NEON} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* Decorative triangle */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(8% + 37.4px)',
            top: '174px',
            width: 0,
            height: 0,
            borderLeft: '22px solid transparent',
            borderRight: '22px solid transparent',
            borderBottom: '44px solid #ff1654',
            transform: 'rotate(-15deg)',
            zIndex: 4,
          }}
        />

        {/* Welcome text */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(12% - 7.4px)',
            top: '191px',
            zIndex: 4,
          }}
        >
          <span
            style={{
              fontFamily: F,
              fontWeight: 700,
              fontSize: '50px',
              lineHeight: 'normal',
              color: '#ffffff',
            }}
          >
            Welcome
          </span>
          <span
            style={{
              fontFamily: FE,
              fontWeight: 900,
              fontSize: '64px',
              lineHeight: 'normal',
              color: '#ffffff',
            }}
          >
            {', '}
          </span>
          <span
            style={{
              fontFamily: FE,
              fontWeight: 900,
              fontStyle: 'oblique',
              fontSize: '64px',
              lineHeight: 'normal',
              color: '#ffffff',
            }}
          >
            {displayName}
          </span>
        </div>

        {/* Welcome outline — tapered triangle line matching Figma */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(12% - 10.4px)',
            top: '257px',
            width: '845px',
            height: '16.5px',
            background: '#ff1654',
            clipPath: 'polygon(0% 50%, 100% 0%, 100% 100%)',
            zIndex: 4,
          }}
        />

        {/* News card */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(12% + 16.6px)',
            top: '295px',
            width: '1425px',
            height: '475px',
            background: '#181818',
            borderRadius: '8px',
            zIndex: 4,
          }}
        >
          {/* Card text */}
          <p
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: '361px',
              fontFamily: FE,
              fontWeight: 700,
              fontSize: '48px',
              lineHeight: 'normal',
              color: '#ffffff',
              textAlign: 'center',
              margin: 0,
            }}
          >
            Watch the launch video!
          </p>

          {/* Pagination dots */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              top: '430px',
              display: 'flex',
              gap: '10px',
            }}
          >
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ffffff' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
          </div>
        </div>

        {/* "See sections" button */}
        <button
          onClick={() => scrollTo(1)}
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: '827px',
            width: '274px',
            height: '65px',
            background: 'rgba(255,22,84,0.23)',
            border: '1px solid #ff1654',
            borderRadius: '50px',
            boxShadow: 'inset 0px -4px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.14)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            padding: 0,
            zIndex: 5,
          }}
        >
          <img src="/figma-assets/figma-arrow-stroke.svg" alt="" aria-hidden style={{ width: '16.312px', height: '21.071px', flexShrink: 0 }} />
          <span
            style={{
              fontFamily: F,
              fontWeight: 400,
              fontSize: '24px',
              lineHeight: 'normal',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            See sections
          </span>
          <img src="/figma-assets/figma-arrow-stroke1.svg" alt="" aria-hidden style={{ width: '15.653px', height: '21.071px', flexShrink: 0 }} />
        </button>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — LIVE MATCHES
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="s-matches"
        style={{
          position: 'relative',
          minHeight: '100vh',
          height: '955px',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Background guide SVG */}
        <img src={A_GUIDE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* Spaccato title decoration */}
        <div style={{ position: 'absolute', left: 'calc(16% - 68px)', top: '143px', width: '1263px', height: '207px', pointerEvents: 'none' }}>
          <img src={A_SPAC_TITLE_4} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* LIVE MATCHES title */}
        <p
          style={{
            position: 'absolute',
            left: 'calc(16% - 2.2px)',
            top: '229px',
            fontFamily: FE,
            fontWeight: 900,
            fontStyle: 'oblique',
            fontSize: '96px',
            lineHeight: 'normal',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            margin: 0,
            zIndex: 2,
          }}
        >
          LIVE MATCHES
        </p>

        {/* Star shape — decorative */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(48% + 9.4px)',
            top: '269px',
            width: '866.424px',
            height: '596.408px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ transform: 'rotate(-15.44deg)', flexShrink: 0 }}>
            <img src={A_STAR_SHAPE} alt="" aria-hidden style={{ display: 'block', width: '788.09px', height: '401.031px' }} />
          </div>
        </div>

        {/* ─── Match Card 1 (bigger, left) ─── */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(12% - 1.4px)',
            top: '367px',
            width: '300px',
            height: '400px',
            background: '#282828',
            border: '1px solid #ff1654',
            borderRadius: '12px',
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            padding: '20px',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <p style={{ fontFamily: FE, fontWeight: 900, fontSize: '32px', color: '#ffffff', margin: 0, textAlign: 'center' }}>
            BUILD FIGHT
          </p>
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.15)', margin: '12px 0' }} />

          {/* First to */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
            <span style={{ fontFamily: F, fontWeight: 400, fontSize: '20px', color: 'rgba(255,255,255,0.6)' }}>First to</span>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: '30px', color: '#ffffff' }}>5+2</span>
          </div>

          {/* Platform */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
            <span style={{ fontFamily: F, fontWeight: 400, fontSize: '20px', color: 'rgba(255,255,255,0.6)' }}>Platform</span>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: '24px', color: '#ffffff' }}>PS5</span>
          </div>

          {/* Entry fee / Prize */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Entry fee</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffb800, #ff8c00)' }} />
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: '20px', color: '#ffffff' }}>0.75</span>
              </div>
            </div>
            <span style={{ fontFamily: F, fontSize: '20px', color: 'rgba(255,255,255,0.4)' }}>|</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Prize</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffb800, #ff8c00)' }} />
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: '20px', color: '#ffffff' }}>1.40</span>
              </div>
            </div>
          </div>

          {/* Expires in */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
            <span style={{ fontFamily: F, fontWeight: 400, fontSize: '16px', color: 'rgba(255,255,255,0.6)' }}>Expires in</span>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="8" y1="4" x2="8" y2="8.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="8" x2="11" y2="10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: '16px', color: '#ffffff' }}>23:00</span>
          </div>

          {/* Accept token button */}
          <button
            style={{
              marginTop: 'auto',
              width: '100%',
              height: '44px',
              background: '#ff1654',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: F,
              fontWeight: 700,
              fontSize: '20px',
              color: '#ffffff',
            }}
          >
            Accept token
          </button>
        </div>

        {/* ─── Match Card 2 (smaller, right) ─── */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(32% + 6.6px)',
            top: '456px',
            width: '233px',
            height: '311px',
            background: '#282828',
            border: '1px solid #ff1654',
            borderRadius: '12px',
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            boxSizing: 'border-box',
          }}
        >
          {/* Header */}
          <p style={{ fontFamily: FE, fontWeight: 900, fontSize: '25px', color: '#ffffff', margin: 0, textAlign: 'center' }}>
            REALISTIC 1V1
          </p>
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.15)', margin: '10px 0' }} />

          {/* First to */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
            <span style={{ fontFamily: F, fontWeight: 400, fontSize: '16px', color: 'rgba(255,255,255,0.6)' }}>First to</span>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: '23px', color: '#ffffff' }}>5+2</span>
          </div>

          {/* Platform */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <span style={{ fontFamily: F, fontWeight: 400, fontSize: '16px', color: 'rgba(255,255,255,0.6)' }}>Platform</span>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: '19px', color: '#ffffff' }}>PS5</span>
          </div>

          {/* Entry fee / Prize */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Entry fee</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffb800, #ff8c00)' }} />
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: '16px', color: '#ffffff' }}>0.75</span>
              </div>
            </div>
            <span style={{ fontFamily: F, fontSize: '16px', color: 'rgba(255,255,255,0.4)' }}>|</span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>Prize</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <div style={{ width: '13px', height: '13px', borderRadius: '50%', background: 'linear-gradient(135deg, #ffb800, #ff8c00)' }} />
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: '16px', color: '#ffffff' }}>1.40</span>
              </div>
            </div>
          </div>

          {/* Expires in */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', marginBottom: '12px' }}>
            <span style={{ fontFamily: F, fontWeight: 400, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Expires in</span>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
              <line x1="8" y1="4" x2="8" y2="8.5" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="8" y1="8" x2="11" y2="10" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: F, fontWeight: 700, fontSize: '13px', color: '#ffffff' }}>23:00</span>
          </div>

          {/* Accept token button */}
          <button
            style={{
              marginTop: 'auto',
              width: '100%',
              height: '34px',
              background: '#ff1654',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontFamily: F,
              fontWeight: 700,
              fontSize: '16px',
              color: '#ffffff',
            }}
          >
            Accept token
          </button>
        </div>

        {/* Body text — right side */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(56% + 554.8px)',
            transform: 'translateX(-100%)',
            top: '570px',
            fontFamily: FE,
            fontWeight: 700,
            fontSize: '48px',
            lineHeight: 'normal',
            color: '#ffffff',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <p style={{ margin: 0 }}>Find an opponent.</p>
          <p style={{ margin: 0 }}>
            {"Let's see who's"}
            <br />
            {'built different'}
            <span style={{ fontSize: '55px' }}>!</span>
          </p>
        </div>

        {/* PLAY button */}
        <button
          onClick={() => {}}
          style={{
            position: 'absolute',
            left: 'calc(64% + 13.2px)',
            top: '675px',
            width: '214px',
            height: '65px',
            background: 'rgba(255,22,84,0.23)',
            border: '1px solid #ff1654',
            borderRadius: '50px',
            boxShadow: 'inset 0px -4px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.14)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: 0,
            zIndex: 4,
          }}
        >
          <span
            style={{
              fontFamily: FE,
              fontWeight: 900,
              fontSize: '32px',
              lineHeight: 'normal',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            PLAY
          </span>
          <img src="/figma-assets/figma-arrow-stroke1.svg" alt="" aria-hidden style={{ width: '15.653px', height: '21.071px', flexShrink: 0 }} />
        </button>

        {/* Navigation arrows */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '826px', display: 'flex', gap: '20px', zIndex: 5 }}>
          <button onClick={() => scrollTo(0)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_BW_ARROW} alt="Previous section" style={{ width: '100%', height: '100%' }} />
          </button>
          <button onClick={() => scrollTo(2)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_FW_ARROW} alt="Next section" style={{ width: '100%', height: '100%' }} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — LEADERBOARD
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="s-leaderboard"
        style={{
          position: 'relative',
          minHeight: '100vh',
          height: '955px',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Background guide SVG */}
        <img src={A_GUIDE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* Spaccato title decoration */}
        <div style={{ position: 'absolute', left: 'calc(16% - 68px)', top: '143px', width: '1277px', height: '207px', pointerEvents: 'none' }}>
          <img src={A_SPAC_TITLE_4} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* LEADERBOARD title */}
        <p
          style={{
            position: 'absolute',
            left: 'calc(16% - 2.2px)',
            top: '229px',
            fontFamily: FE,
            fontWeight: 900,
            fontStyle: 'oblique',
            fontSize: '96px',
            lineHeight: 'normal',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            margin: 0,
            zIndex: 2,
          }}
        >
          LEADERBOARD
        </p>

        {/* Star shape — decorative */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(48% + 9.4px)',
            top: '269px',
            width: '866.424px',
            height: '596.408px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ transform: 'rotate(-15.44deg)', flexShrink: 0 }}>
            <img src={A_STAR_SHAPE} alt="" aria-hidden style={{ display: 'block', width: '788.09px', height: '401.031px' }} />
          </div>
        </div>

        {/* ─── Podium: 2nd place (left, shorter) ─── */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(12% + 48.6px)',
            top: '478px',
            width: '167px',
            height: '300px',
            background: '#282828',
            border: '1px solid #ff1654',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '18px 12px',
            boxSizing: 'border-box',
          }}
        >
          {/* Profile pic placeholder */}
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #3b28cc, #6f5cff)', flexShrink: 0, marginBottom: '10px' }} />
          <p style={{ margin: 0, fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '18px', color: '#ff1654' }}>
            2°{' '}
            <span style={{ color: '#ffffff' }}>MarvFN</span>
          </p>
          <div style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Win rate</span>
              <span style={{ fontFamily: F, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>65%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Rounds won</span>
              <span style={{ fontFamily: F, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>198</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Earnings</span>
              <span style={{ fontFamily: F, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>1.500</span>
            </div>
          </div>
        </div>

        {/* ─── Podium: 1st place (center, taller) ─── */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(24% + 5.2px)',
            top: '400px',
            width: '210px',
            height: '378px',
            background: '#282828',
            border: '1px solid #ff1654',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '20px 14px',
            boxSizing: 'border-box',
          }}
        >
          {/* Profile pic placeholder */}
          <div style={{ width: '146px', height: '146px', borderRadius: '50%', background: 'linear-gradient(135deg, #ff1654, #ff6b35)', flexShrink: 0, marginBottom: '12px' }} />
          <p style={{ margin: 0, fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '22px', color: '#ff1654' }}>
            1°{' '}
            <span style={{ color: '#ffffff' }}>LIGHTVSLS</span>
          </p>
          <div style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '15px', color: 'rgba(255,255,255,0.6)' }}>Win rate</span>
              <span style={{ fontFamily: F, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>70%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '15px', color: 'rgba(255,255,255,0.6)' }}>Rounds won</span>
              <span style={{ fontFamily: F, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>253</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '15px', color: 'rgba(255,255,255,0.6)' }}>Earnings</span>
              <span style={{ fontFamily: F, fontSize: '15px', fontWeight: 700, color: '#ffffff' }}>2.000</span>
            </div>
          </div>
        </div>

        {/* ─── Podium: 3rd place (right, shorter) ─── */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(36% + 4.8px)',
            top: '478px',
            width: '167px',
            height: '300px',
            background: '#282828',
            border: '1px solid #ff1654',
            borderRadius: '16px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            zIndex: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '18px 12px',
            boxSizing: 'border-box',
          }}
        >
          {/* Profile pic placeholder */}
          <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'linear-gradient(135deg, #28cc5c, #35ffa0)', flexShrink: 0, marginBottom: '10px' }} />
          <p style={{ margin: 0, fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '18px', color: '#ff1654' }}>
            3°{' '}
            <span style={{ color: '#ffffff' }}>TomTom</span>
          </p>
          <div style={{ marginTop: 'auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Win rate</span>
              <span style={{ fontFamily: F, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>60%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Rounds won</span>
              <span style={{ fontFamily: F, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>175</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: F, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>Earnings</span>
              <span style={{ fontFamily: F, fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>1.200</span>
            </div>
          </div>
        </div>

        {/* Body text — right side */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(56% + 554.8px)',
            transform: 'translateX(-100%)',
            top: '570px',
            fontFamily: FE,
            fontWeight: 700,
            fontSize: '48px',
            lineHeight: 'normal',
            color: '#ffffff',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <p style={{ margin: 0 }}>Get on top of the</p>
          <p style={{ margin: 0 }}>
            leaderboard.
            <br />
            {'Weekly rewards'}
            <span style={{ fontSize: '55px' }}>!</span>
          </p>
        </div>

        {/* LEVEL UP button */}
        <button
          onClick={() => {}}
          style={{
            position: 'absolute',
            left: 'calc(64% - 3.8px)',
            top: '675px',
            width: '278px',
            height: '65px',
            background: 'rgba(255,22,84,0.23)',
            border: '1px solid #ff1654',
            borderRadius: '50px',
            boxShadow: 'inset 0px -4px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.14)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: 0,
            zIndex: 4,
          }}
        >
          <span
            style={{
              fontFamily: FE,
              fontWeight: 900,
              fontSize: '32px',
              lineHeight: 'normal',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            LEVEL UP
          </span>
          <img src="/figma-assets/figma-arrow-stroke1.svg" alt="" aria-hidden style={{ width: '15.653px', height: '21.071px', flexShrink: 0 }} />
        </button>

        {/* Navigation arrows */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '826px', display: 'flex', gap: '20px', zIndex: 5 }}>
          <button onClick={() => scrollTo(1)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_BW_ARROW} alt="Previous section" style={{ width: '100%', height: '100%' }} />
          </button>
          <button onClick={() => scrollTo(3)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_FW_ARROW} alt="Next section" style={{ width: '100%', height: '100%' }} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — CHALLENGES
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="s-challenges"
        style={{
          position: 'relative',
          minHeight: '100vh',
          height: '955px',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Background guide SVG */}
        <img src={A_GUIDE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

        {/* Spaccato title decoration */}
        <div style={{ position: 'absolute', left: 'calc(16% - 68px)', top: '143px', width: '1159px', height: '207px', pointerEvents: 'none' }}>
          <img src={A_SPAC_TITLE_4} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* CHALLENGES title */}
        <p
          style={{
            position: 'absolute',
            left: 'calc(16% - 2.2px)',
            top: '229px',
            fontFamily: FE,
            fontWeight: 900,
            fontStyle: 'oblique',
            fontSize: '96px',
            lineHeight: 'normal',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            margin: 0,
            zIndex: 2,
          }}
        >
          CHALLENGES
        </p>

        {/* Star shape — decorative */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(48% + 9.4px)',
            top: '269px',
            width: '866.424px',
            height: '596.408px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ transform: 'rotate(-15.44deg)', flexShrink: 0 }}>
            <img src={A_STAR_SHAPE} alt="" aria-hidden style={{ display: 'block', width: '788.09px', height: '401.031px' }} />
          </div>
        </div>

        {/* ─── Task list card ─── */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(12% - 1.4px)',
            top: '397px',
            width: '675px',
            height: '382px',
            background: '#282828',
            border: '1px solid #ff1654',
            borderRadius: '12px',
            zIndex: 3,
            overflow: 'hidden',
          }}
        >
          {/* Left column: XP circle + Next level */}
          <div style={{ position: 'absolute', left: '50px', top: '33px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* XP Circle */}
            <div style={{ position: 'relative', width: '158px', height: '158px' }}>
              {/* Outer ring (progress) */}
              <svg width="158" height="158" viewBox="0 0 158 158" style={{ position: 'absolute', inset: 0 }}>
                {/* Background ring */}
                <circle cx="79" cy="79" r="70" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                {/* Progress ring */}
                <circle
                  cx="79"
                  cy="79"
                  r="70"
                  fill="none"
                  stroke="#ff1654"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 70 * 0.75} ${2 * Math.PI * 70 * 0.25}`}
                  strokeDashoffset={2 * Math.PI * 70 * 0.25}
                  transform="rotate(-90 79 79)"
                />
              </svg>
              {/* Center text */}
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: F, fontWeight: 700, fontSize: '34px', color: '#ffffff', lineHeight: 1 }}>999</span>
                <span style={{ fontFamily: F, fontWeight: 400, fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginTop: '4px' }}>750XP left</span>
              </div>
            </div>

            {/* Next level box */}
            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>LVL.1000</span>
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #ff1654 0%, #3b28cc 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontFamily: FE, fontWeight: 900, fontSize: '28px', color: '#ffffff' }}>1K</span>
              </div>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: '13px', color: '#ff1654', marginTop: '6px' }}>+20OBC</span>
            </div>
          </div>

          {/* Right column: Task rows */}
          <div style={{ position: 'absolute', left: '258px', top: '33px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Task 1 — unchecked */}
            <div style={{ width: '393px', height: '47px', background: '#181818', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '14px', color: '#ffffff', marginLeft: '10px', flex: 1 }}>Play 3 matches</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: '12px', color: '#ff1654' }}>+300XP</span>
            </div>

            {/* Task 2 — checked */}
            <div style={{ width: '393px', height: '47px', background: '#181818', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#22c55e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                  <path d="M1 6L5.5 10.5L15 1" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginLeft: '10px', flex: 1, textDecoration: 'line-through' }}>Win a game without losing a round</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>+80XP</span>
            </div>

            {/* Task 3 — checked */}
            <div style={{ width: '393px', height: '47px', background: '#181818', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#22c55e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
                  <path d="M1 6L5.5 10.5L15 1" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.5)', marginLeft: '10px', flex: 1, textDecoration: 'line-through' }}>Post a highlight</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>+150XP</span>
            </div>

            {/* Task 4 — unchecked */}
            <div style={{ width: '393px', height: '47px', background: '#181818', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '14px', color: '#ffffff', marginLeft: '10px', flex: 1 }}>Refer a friend</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: '12px', color: '#ff1654' }}>+500XP</span>
            </div>

            {/* Divider */}
            <div style={{ width: '393px', height: '1px', background: 'rgba(255,255,255,0.1)', margin: '2px 0' }} />

            {/* Task 5 — dimmer */}
            <div style={{ width: '393px', height: '47px', background: '#181818', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box', opacity: 0.5 }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginLeft: '10px', flex: 1 }}>Shop a cosmetic</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>+5.000XP</span>
            </div>

            {/* Task 6 — dimmer */}
            <div style={{ width: '393px', height: '47px', background: '#181818', borderRadius: '8px', display: 'flex', alignItems: 'center', padding: '0 12px', boxSizing: 'border-box', opacity: 0.5 }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', border: '2px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <span style={{ fontFamily: F, fontWeight: 400, fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginLeft: '10px', flex: 1 }}>Abibi Yallah</span>
              <span style={{ fontFamily: F, fontWeight: 700, fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>+800XP</span>
            </div>
          </div>
        </div>

        {/* Body text — right side */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(56% + 554.8px)',
            transform: 'translateX(-100%)',
            top: '570px',
            fontFamily: FE,
            fontWeight: 700,
            fontSize: '48px',
            lineHeight: 'normal',
            color: '#ffffff',
            textAlign: 'right',
            whiteSpace: 'nowrap',
            zIndex: 2,
          }}
        >
          <p style={{ margin: 0 }}>Complete the tasks.</p>
          <p style={{ margin: 0 }}>
            Get rewarded with
            <br />
            {'XP and OBC'}
            <span style={{ fontSize: '55px' }}>!</span>
          </p>
        </div>

        {/* LEVEL UP button */}
        <button
          onClick={() => {}}
          style={{
            position: 'absolute',
            left: 'calc(64% - 3.8px)',
            top: '675px',
            width: '278px',
            height: '65px',
            background: 'rgba(255,22,84,0.23)',
            border: '1px solid #ff1654',
            borderRadius: '50px',
            boxShadow: 'inset 0px -4px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.14)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: 0,
            zIndex: 4,
          }}
        >
          <span
            style={{
              fontFamily: FE,
              fontWeight: 900,
              fontSize: '32px',
              lineHeight: 'normal',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            LEVEL UP
          </span>
          <img src="/figma-assets/figma-arrow-stroke1.svg" alt="" aria-hidden style={{ width: '15.653px', height: '21.071px', flexShrink: 0 }} />
        </button>

        {/* Navigation arrows */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '826px', display: 'flex', gap: '20px', zIndex: 5 }}>
          <button onClick={() => scrollTo(2)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_BW_ARROW} alt="Previous section" style={{ width: '100%', height: '100%' }} />
          </button>
          <button onClick={() => scrollTo(0)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_FW_ARROW} alt="Back to top" style={{ width: '100%', height: '100%' }} />
          </button>
        </div>
      </section>
    </div>
  );
}
