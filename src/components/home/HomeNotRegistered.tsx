/**
 * HomeNotRegistered — 1:1 replica del frame Figma "NO LOGGED USER" (node 41:2)
 * Frame originale: 1920×4457px
 *
 * Fixes applied:
 * - Pill-shaped navbar with glassmorphism (in NavbarFigma.tsx)
 * - Radial gradient backgrounds instead of flat black
 * - Correct font: Base Neue Trial
 * - Video placeholder boxes styled as dark panels
 * - Pure HTML arrow buttons instead of image-based
 * - OLEBOY footer text with gradient + opacity
 * - Sections contained with overflow: hidden
 * - Decorative shapes rendered as filled SVGs
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { getCurrentPathWithQueryAndHash, startDiscordAuth } from '@/lib/oauth';

// ─── Asset URLs ─────────────────────────────────────────────────────────────
const A_NEON          = '/figma-assets/figma-neon.png';
const A_ZAPS          = '/figma-assets/figma-zaps.svg';
const A_DS_BTN        = '/figma-assets/figma-ds-icon-hero.png';
// Section 2 - RANK UP
const A_GUIDE         = '/figma-assets/figma-guide.svg';
const A_SPAC_BOTTOM   = '/figma-assets/figma-spaccato-bottom.svg';
const A_ANIMATION     = '/figma-assets/figma-animation.svg';
const A_STAR_SHAPE    = '/figma-assets/figma-star-shape.svg';
const A_SPAC_TITLE_2  = '/figma-assets/figma-spaccato-title-s2.svg';
// Section 3 - JOIN THE ARENA
const A_ANIMATION_S3  = '/figma-assets/figma-animation-s3.svg';
const A_SPAC_BOTTOM_S3= '/figma-assets/figma-spaccato-bottom-s3.svg';
const A_STAR_S3       = '/figma-assets/figma-star-s3.svg';
const A_OUTLINE_S3    = '/figma-assets/figma-outline-s3.svg';
// Section 4 - GET REWARDS
const A_VECTOR19      = '/figma-assets/figma-vector19.svg';
const A_SPAC_TITLE_4  = '/figma-assets/figma-spaccato-title-s4.svg';
// Footer
const A_COPYRIGHT     = '/figma-assets/figma-copyright.png';

// ─── Font ────────────────────────────────────────────────────────────────────
const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base Neue Expanded', 'Base Neue Trial', 'Base Neue', sans-serif";

// ─── Section background ──────────────────────────────────────────────────────
const SECTION_BG = 'radial-gradient(ellipse at 50% 40%, #1a0a0a 0%, #0f0404 50%, #080202 100%)';

// ─── Section scroll IDs ─────────────────────────────────────────────────────
const IDS = ['s-hero', 's-rank', 's-arena', 's-rewards', 's-footer'];

// ─── Asset URLs for navigation arrows ────────────────────────────────────────
const A_BW_ARROW = '/figma-assets/figma-bw-arrow.svg';
const A_FW_ARROW = '/figma-assets/figma-fw-arrow.svg';

export function HomeNotRegistered() {
  const handleSignUp = useCallback(async () => {
    try {
      await startDiscordAuth(getCurrentPathWithQueryAndHash());
    } catch (error) {
      console.error('Discord sign-up error:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to start Discord login. Please try again.');
    }
  }, []);

  const scrollTo = useCallback((i: number) => {
    const el = document.getElementById(IDS[Math.max(0, Math.min(i, IDS.length - 1))]);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div style={{ width: '100%', background: '#0f0404', overflowX: 'hidden' }}>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1 — HERO (First page)
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

        {/* ZAPS — lightning bolts overlay */}
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
          <img src={A_ZAPS} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
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

        {/* Main content centered */}
        <div
          style={{
            position: 'absolute',
            top: '356px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 4,
          }}
        >
          {/* OLEBOY title */}
          <p
            style={{
              fontFamily: F,
              fontWeight: 900,
              fontSize: '128px',
              lineHeight: 'normal',
              color: '#ffffff',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            OLEBOY
          </p>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: F,
              fontWeight: 400,
              fontSize: '30px',
              lineHeight: '35px',
              letterSpacing: '4.8px',
              color: '#ffffff',
              textAlign: 'center',
              width: '686px',
              margin: '0',
              marginTop: '-2px',
            }}
          >
            Stake tokens. Win Matches.
            <br />
            Claim your victory.
          </p>

          {/* SIGN UP BUTTON */}
          <button
            onClick={handleSignUp}
            style={{
              marginTop: '32px',
              width: '285px',
              height: '69px',
              background: '#3b28cc',
              borderRadius: '29px',
              boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.15), inset 0px -3px 4px 0px rgba(0,0,0,0.25)',
              cursor: 'pointer',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              padding: 0,
            }}
          >
            <span
              style={{
                fontFamily: F,
                fontWeight: 900,
                color: '#ffffff',
                fontSize: 0,
                lineHeight: 0,
              }}
            >
              <span style={{ fontSize: '36px', lineHeight: 'normal' }}>SIGN UP</span>
              <span style={{ fontSize: '40px', lineHeight: 'normal' }}>!</span>
            </span>
            <img src={A_DS_BTN} alt="" aria-hidden style={{ width: '52.907px', height: '38.932px' }} />
          </button>

          {/* KNOW MORE BUTTON */}
          <button
            onClick={() => scrollTo(1)}
            style={{
              marginTop: '139px',
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
              Know More
            </span>
            <img src="/figma-assets/figma-arrow-stroke1.svg" alt="" aria-hidden style={{ width: '15.653px', height: '21.071px', flexShrink: 0 }} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2 — RANK UP! (Second page)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="s-rank"
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

        {/* Spaccato title decoration — triangles only */}
        <div style={{ position: 'absolute', left: 'calc(16% - 68px)', top: '157px', width: '843px', height: '207.862px', pointerEvents: 'none' }}>
          <img src={A_SPAC_TITLE_2} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* RANK UP! title + outline wrapper */}
        <div
          style={{
            position: 'absolute',
            left: '16%',
            top: '228.89px',
            zIndex: 2,
          }}
        >
          <p
            style={{
              fontFamily: FE,
              fontWeight: 900,
              fontStyle: 'oblique',
              fontSize: 0,
              lineHeight: 0,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            <span style={{ fontSize: '96px', lineHeight: 'normal' }}>RANK UP!</span>
          </p>
          {/* Pink outline — matches text width exactly */}
          <div
            style={{
              width: '100%',
              height: '17.75px',
              marginTop: '8px',
              background: '#FF1654',
              clipPath: 'polygon(0% 50%, 100% 0%, 100% 100%)',
            }}
          />
        </div>

        {/* Star shape — decorative */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(8% - 17.6px)',
            top: '297px',
            width: '45.1%',
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

        {/* Body text */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(16% - 7.2px)',
            top: '509px',
            fontFamily: FE,
            fontWeight: 700,
            fontSize: '48px',
            lineHeight: 'normal',
            color: '#ffffff',
            zIndex: 2,
          }}
        >
          <p style={{ margin: 0 }}>Dominate the</p>
          <p style={{ margin: 0 }}>
            leaderboard and
            <br />
            claim your legacy.
          </p>
        </div>

        {/* Animation placeholder (video area) */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(64% - 1.27px)',
            top: '480.21px',
            width: '408.932px',
            height: '230.024px',
            background: 'rgba(30, 30, 40, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <img src={A_ANIMATION} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '8px' }} />
        </div>

        {/* Spaccato bottom decoration */}
        <div style={{ position: 'absolute', left: 'calc(80% + 44px)', top: '602px', width: '137.847px', height: '206.33px', pointerEvents: 'none' }}>
          <img src={A_SPAC_BOTTOM} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* Navigation arrows */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '842px', display: 'flex', gap: '20px', zIndex: 5 }}>
          <button onClick={() => scrollTo(0)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_BW_ARROW} alt="Previous section" style={{ width: '100%', height: '100%' }} />
          </button>
          <button onClick={() => scrollTo(2)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_FW_ARROW} alt="Next section" style={{ width: '100%', height: '100%' }} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3 — JOIN THE ARENA! (Third page)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="s-arena"
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

        {/* JOIN THE ARENA! title + outline wrapper — right-aligned */}
        <div
          style={{
            position: 'absolute',
            right: 'calc(100% - 84%)',
            top: '203px',
            zIndex: 2,
          }}
        >
          <p
            style={{
              fontFamily: FE,
              fontWeight: 900,
              fontStyle: 'oblique',
              fontSize: 0,
              lineHeight: 0,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              margin: 0,
              textAlign: 'right',
            }}
          >
            <span style={{ fontSize: '96px', lineHeight: 'normal' }}>JOIN THE ARENA!</span>
          </p>
          {/* Pink outline — matches text width exactly */}
          <div
            style={{
              width: '100%',
              height: '17.75px',
              marginTop: '13px',
              background: '#FF1654',
              clipPath: 'polygon(0% 50%, 100% 0%, 100% 100%)',
            }}
          />
        </div>

        {/* Star decoration */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(44% + 43.2px)',
            top: '316px',
            width: '42.4%',
            height: '506.117px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ transform: 'rotate(-8.84deg)', flexShrink: 0 }}>
            <img src={A_STAR_S3} alt="" aria-hidden style={{ display: 'block', width: '762.061px', height: '393.648px' }} />
          </div>
        </div>

        {/* Animation placeholder (video area) — left side, mirrored */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(16% + 3.8px)',
            top: '454px',
            width: '408.932px',
            height: '230.024px',
            background: 'rgba(30, 30, 40, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            backdropFilter: 'blur(8px)',
            transform: 'scaleX(-1)',
          }}
        >
          <img src={A_ANIMATION_S3} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '8px' }} />
        </div>

        {/* Spaccato bottom — left side, mirrored */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(12% - 5.4px)',
            top: '581px',
            width: '137.847px',
            height: '206.33px',
            transform: 'scaleX(-1)',
            pointerEvents: 'none',
          }}
        >
          <img src={A_SPAC_BOTTOM_S3} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* Body text — right aligned */}
        <div
          style={{
            position: 'absolute',
            right: 'calc(100% - 48% - 708.4px)',
            top: '483px',
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
          <p style={{ margin: 0 }}>Build your team,</p>
          <p style={{ margin: 0 }}>
            complete challenges
            <br />
            and get rewarded.
          </p>
        </div>

        {/* Navigation arrows */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '842px', display: 'flex', gap: '20px', zIndex: 5 }}>
          <button onClick={() => scrollTo(1)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_BW_ARROW} alt="Previous section" style={{ width: '100%', height: '100%' }} />
          </button>
          <button onClick={() => scrollTo(3)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_FW_ARROW} alt="Next section" style={{ width: '100%', height: '100%' }} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4 — GET REWARDS! (Fourth page)
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="s-rewards"
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

        {/* Spaccato title decoration — triangles only */}
        <div style={{ position: 'absolute', left: 'calc(16% - 66px)', top: '157px', width: '1299px', height: '207.861px', pointerEvents: 'none' }}>
          <img src={A_SPAC_TITLE_4} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* GET REWARDS! title + outline wrapper */}
        <div
          style={{
            position: 'absolute',
            left: '16%',
            top: '228px',
            zIndex: 2,
          }}
        >
          <p
            style={{
              fontFamily: FE,
              fontWeight: 900,
              fontStyle: 'oblique',
              fontSize: 0,
              lineHeight: 0,
              color: '#ffffff',
              whiteSpace: 'nowrap',
              margin: 0,
            }}
          >
            <span style={{ fontSize: '96px', lineHeight: 'normal' }}>GET REWARDS!</span>
          </p>
          {/* Pink outline — matches text width exactly */}
          <div
            style={{
              width: '100%',
              height: '17.75px',
              marginTop: '8px',
              background: '#FF1654',
              clipPath: 'polygon(0% 50%, 100% 0%, 100% 100%)',
            }}
          />
        </div>

        {/* Vector 19 — decorative star shape */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(12% - 6.4px)',
            top: '331px',
            width: '34.4%',
            height: '650.974px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <div style={{ transform: 'rotate(46.25deg)', flexShrink: 0 }}>
            <img src={A_VECTOR19} alt="" aria-hidden style={{ display: 'block', width: '313.81px', height: '613.539px' }} />
          </div>
        </div>

        {/* Body text */}
        <p
          style={{
            position: 'absolute',
            left: 'calc(16% + 2.8px)',
            top: '509px',
            fontFamily: FE,
            fontWeight: 700,
            fontSize: '48px',
            lineHeight: 'normal',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            margin: 0,
            zIndex: 2,
          }}
        >
          Complete tasks
          <br />
          {'& win matches to'}
          <br />
          get OBCoins.
        </p>

        {/* Animation placeholder (video area) */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(64% - 1.27px)',
            top: '480.21px',
            width: '408.932px',
            height: '230.024px',
            background: 'rgba(30, 30, 40, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <img src={A_ANIMATION} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '8px' }} />
        </div>

        {/* Spaccato bottom decoration */}
        <div style={{ position: 'absolute', left: 'calc(80% + 44px)', top: '602px', width: '137.847px', height: '206.33px', pointerEvents: 'none' }}>
          <img src={A_SPAC_BOTTOM} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>

        {/* Navigation arrows */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '842px', display: 'flex', gap: '20px', zIndex: 5 }}>
          <button onClick={() => scrollTo(2)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_BW_ARROW} alt="Previous section" style={{ width: '100%', height: '100%' }} />
          </button>
          <button onClick={() => scrollTo(4)} style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0, width: '63.107px', height: '63.107px' }}>
            <img src={A_FW_ARROW} alt="Next section" style={{ width: '100%', height: '100%' }} />
          </button>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5 — FOOTER
          ═══════════════════════════════════════════════════════════════════════ */}
      <section
        id="s-footer"
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '636.66px',
          background: '#0f0404',
          borderTop: '0.5px solid #ffffff',
          overflow: 'hidden',
        }}
      >
        {/* Giant OLEBOY text — stroke layer (gradient stroke: #FFF → #0F0404, inside 1.74px) */}
        <p
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(4% + 4.2px)',
            top: '-18px',
            fontFamily: FE,
            fontWeight: 900,
            fontStyle: 'oblique',
            fontSize: '347.059px',
            lineHeight: 'normal',
            whiteSpace: 'nowrap',
            margin: 0,
            WebkitTextStroke: '3.48px transparent',
            background: 'linear-gradient(180.075deg, #FFFFFF 0%, #0F0404 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          OLEBOY
        </p>
        {/* Giant OLEBOY text — fill layer (Figma-exact gradient) */}
        <p
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(4% + 4.2px)',
            top: '-18px',
            fontFamily: FE,
            fontWeight: 900,
            fontStyle: 'oblique',
            fontSize: '347.059px',
            lineHeight: 'normal',
            whiteSpace: 'nowrap',
            margin: 0,
            backgroundImage: 'linear-gradient(180.075deg, rgb(15, 4, 4) 10.117%, rgb(255, 255, 255) 99.722%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          OLEBOY
        </p>

        {/* Footer content — positioned relative to footer section */}
        {/* BTS MARV */}
        <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '395px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>BTS - Marv</p>
        <a href="https://x.com" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '437px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>X/Twitter</a>

        {/* BTS TOM */}
        <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '495px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>BTS - Tom</p>
        <a href="https://x.com" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '537px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>X/Twitter</a>
        <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '569px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>Instagram</a>

        {/* SOCIALS */}
        <p style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '395px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>SOCIALS</p>
        <a href="https://x.com/oleboytokens" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '436.92px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>X/Twitter</a>
        <a href="https://www.tiktok.com/@oleboytokens" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '468.75px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>TikTok</a>
        <a href="https://discord.gg/2XVffNDPAE" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '499.79px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>Discord</a>

        {/* CONTACT US */}
        <p style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '397px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>CONTACT US</p>
        <a href="mailto:coolowner.2025@gmail.com" style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '439px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>coolowner.2025@gmail.com</a>
        <a href="mailto:letterio.tomasini@gmail.com" style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '471px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>letterio.tomasini@gmail.com</a>

        {/* PRIVACY */}
        <p style={{ position: 'absolute', left: 'calc(80% + 26px)', top: '397px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>PRIVACY</p>
        <a href="/terms" style={{ position: 'absolute', left: 'calc(80% + 29px)', top: '439px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>Terms &amp; Privacy</a>

        {/* COPYRIGHT */}
        <div style={{ position: 'absolute', left: 'calc(76% + 25.8px)', top: '588px', width: '23px', height: '23px', zIndex: 2 }}>
          <img src={A_COPYRIGHT} alt="©" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'invert(1)' }} />
        </div>
        <p style={{ position: 'absolute', left: 'calc(76% + 48.8px)', top: '585px', fontFamily: F, fontWeight: 400, fontSize: '24px', color: '#e6e6e6', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>
          {' '}2026 OLEBOY. All Rights Reserved.
        </p>
      </section>
    </div>
  );
}
