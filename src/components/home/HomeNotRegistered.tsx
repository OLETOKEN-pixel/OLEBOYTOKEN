/**
 * HomeNotRegistered — pixel-perfect replica of the Figma "NO LOGGED USER" frame.
 * Frame: 1920×4457px — sections stacked vertically:
 *   1. First page  (Hero):           0–955px
 *   2. Second page (RANK UP!):       955–1910px
 *   3. Third page  (JOIN THE ARENA!):1910–2865px
 *   4. Fourth page (GET REWARDS!):   2865–3820px
 *   5. Giant OLEBOY gradient text
 *   5. Footer:                       3820px+
 *
 * All percentage-based horizontal values are relative to the 1920px Figma frame.
 * Sections 2–4 use individual positioned elements over the guide background.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SECTION_IDS = [
  'section-hero',
  'section-rank-up',
  'section-arena',
  'section-rewards',
  'section-footer',
];

const BASE_FONT = "'Base Neue Trial', 'Base Neue', sans-serif";

/** Navigation arrow button used in sections 2–4 */
function ArrowBtn({
  src,
  alt,
  onClick,
}: {
  src: string;
  alt: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={alt}
      style={{
        width: '63.1px',
        height: '63.1px',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      <img src={src} alt={alt} style={{ width: '100%', height: '100%', display: 'block' }} />
    </button>
  );
}

export function HomeNotRegistered() {
  const handleSignUp = useCallback(async () => {
    const currentOrigin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${currentOrigin}/auth/discord/callback`,
        scopes: 'identify email guilds.join',
      },
    });
  }, []);

  const scrollToSection = useCallback((index: number) => {
    const idx = Math.max(0, Math.min(index, SECTION_IDS.length - 1));
    const el = document.getElementById(SECTION_IDS[idx]);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div
      style={{
        background: '#0f0404',
        width: '100%',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* ══════════════════════════════════════════════════
          TOP NEON — full-width pink glow at page top
          ══════════════════════════════════════════════════ */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '146px',
          zIndex: 2,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <img
          src="/figma-assets/figma-neon.png"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* ══════════════════════════════════════════════════
          SECTION 1 — HERO (1920×955)
          ══════════════════════════════════════════════════ */}
      <section
        id="section-hero"
        style={{
          position: 'relative',
          width: '100%',
          height: '955px',
          background: '#0f0404',
          overflow: 'hidden',
        }}
      >
        {/* Zaps — 4 corner lightning bolts */}
        <img
          src="/figma-assets/figma-zaps.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-9.56%',
            top: '-30.37%',
            width: '119.19%',
            height: 'auto',
            aspectRatio: '2288.42 / 1373.5',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Bottom neon — glows at 827px from top, flipped */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 0,
            top: '827px',
            width: '100%',
            height: '146px',
            pointerEvents: 'none',
            zIndex: 2,
            overflow: 'hidden',
            transform: 'scaleY(-1)',
          }}
        >
          <img
            src="/figma-assets/figma-neon.png"
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Main text block — centered horizontally */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '356px',
            transform: 'translateX(-50%)',
            width: '686px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            zIndex: 3,
          }}
        >
          {/* OLEBOY — 128px Black */}
          <h1
            style={{
              fontFamily: BASE_FONT,
              fontWeight: 900,
              fontSize: '128px',
              lineHeight: 1,
              color: '#ffffff',
              margin: 0,
              textAlign: 'center',
            }}
          >
            OLEBOY
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: BASE_FONT,
              fontWeight: 400,
              fontSize: '30px',
              lineHeight: '35px',
              letterSpacing: '4.8px',
              color: '#ffffff',
              margin: '20px 0 0',
              textAlign: 'center',
            }}
          >
            Stake tokens. Win Matches.
            <br />
            Claim your victory.
          </p>

          {/* SIGN UP! button */}
          <button
            onClick={handleSignUp}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              marginTop: '56px',
              width: '285px',
              height: '69px',
              background: '#3b28cc',
              borderRadius: '29px',
              border: 'none',
              cursor: 'pointer',
              boxShadow:
                'inset 0px -3px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.15)',
            }}
          >
            <span
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 900,
                fontSize: '36px',
                color: '#ffffff',
                lineHeight: 1,
              }}
            >
              SIGN UP
            </span>
            <span
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 900,
                fontSize: '40px',
                color: '#ffffff',
                lineHeight: 1,
              }}
            >
              !
            </span>
            <img
              src="/figma-assets/figma-ds-icon1.png"
              alt="Discord"
              style={{ width: '52.9px', height: '38.9px', objectFit: 'contain' }}
            />
          </button>

          {/* Know More — pill button with arrows */}
          <button
            onClick={() => scrollToSection(1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              marginTop: '44px',
              width: '274px',
              height: '65px',
              background: 'rgba(255,22,84,0.23)',
              border: '1px solid #ff1654',
              borderRadius: '50px',
              cursor: 'pointer',
              boxShadow:
                'inset 0px -4px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.14)',
            }}
          >
            <img
              src="/figma-assets/figma-arrow-stroke.svg"
              alt=""
              aria-hidden="true"
              style={{ width: '16.3px', height: '21px' }}
            />
            <span
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 400,
                fontSize: '24px',
                color: '#ffffff',
              }}
            >
              Know More
            </span>
            <img
              src="/figma-assets/figma-arrow-stroke1.svg"
              alt=""
              aria-hidden="true"
              style={{ width: '15.7px', height: '21px' }}
            />
          </button>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 2 — RANK UP! (1920×955)
          ══════════════════════════════════════════════════ */}
      <section
        id="section-rank-up"
        style={{
          position: 'relative',
          width: '100%',
          height: '955px',
          overflow: 'hidden',
        }}
      >
        {/* Guide background — solid #0f0404 */}
        <img
          src="/figma-assets/figma-guide.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* Spaccato title decoration */}
        <img
          src="/figma-assets/figma-spaccato-title1.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(12% - 4.4px)',
            top: '157px',
            width: 'calc(846.854 / 1920 * 100%)',
            height: 'auto',
          }}
        />

        {/* RANK UP! title */}
        <p
          style={{
            position: 'absolute',
            left: 'calc(16% + 289.3px)',
            transform: 'translateX(-50%)',
            top: '228px',
            fontFamily: BASE_FONT,
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            lineHeight: 1,
            margin: 0,
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: '96px' }}>RANK UP</span>
          <span style={{ fontSize: '110px' }}>!</span>
        </p>

        {/* Star shape decoration — left, rotated */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(8% - 17.6px)',
            top: '252px',
            width: 'calc(866.424 / 1920 * 100%)',
            height: '596px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/figma-assets/figma-star-shape.svg"
            alt=""
            style={{
              transform: 'rotate(-15.44deg)',
              width: 'calc(788.09 / 866.424 * 100%)',
              height: 'auto',
            }}
          />
        </div>

        {/* Body text */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(16% - 7.2px)',
            top: '464px',
            fontFamily: BASE_FONT,
            fontWeight: 700,
            fontSize: '48px',
            lineHeight: 1.2,
            color: '#ffffff',
            zIndex: 2,
            whiteSpace: 'nowrap',
          }}
        >
          <p style={{ margin: '0 0 4px' }}>Dominate the</p>
          <p style={{ margin: 0 }}>
            leaderboard and
            <br />
            claim your legacy.
          </p>
        </div>

        {/* Animation / content area — right side */}
        <img
          src="/figma-assets/figma-animation.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(64% - 1.27px)',
            top: '480px',
            width: 'calc(408.932 / 1920 * 100%)',
            height: 'auto',
            aspectRatio: '408.932 / 230.024',
          }}
        />

        {/* Spaccato bottom — far right */}
        <img
          src="/figma-assets/figma-spaccato-bottom.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(80% + 44px)',
            top: '602px',
            width: 'calc(137.847 / 1920 * 100%)',
            height: 'auto',
          }}
        />

        {/* Navigation arrows */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(44% + 42.2px)',
            top: '842px',
            display: 'flex',
            gap: 'calc(4% + 6.2px)',
          }}
        >
          <ArrowBtn
            src="/figma-assets/figma-bw-arrow2.svg"
            alt="Previous section"
            onClick={() => scrollToSection(0)}
          />
          <ArrowBtn
            src="/figma-assets/figma-fw-arrow2.svg"
            alt="Next section"
            onClick={() => scrollToSection(2)}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 3 — JOIN THE ARENA! (1920×955)
          ══════════════════════════════════════════════════ */}
      <section
        id="section-arena"
        style={{
          position: 'relative',
          width: '100%',
          height: '955px',
          overflow: 'hidden',
        }}
      >
        {/* Guide background */}
        <img
          src="/figma-assets/figma-guide.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* JOIN THE ARENA! title — right-aligned */}
        <p
          style={{
            position: 'absolute',
            left: 'calc(28% + 1088.4px)',
            transform: 'translateX(-100%)',
            top: '203px',
            fontFamily: BASE_FONT,
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            lineHeight: 1,
            margin: 0,
            zIndex: 2,
            textAlign: 'right',
          }}
        >
          <span style={{ fontSize: '96px' }}>JOIN THE ARENA</span>
          <span style={{ fontSize: '110px' }}>!</span>
        </p>

        {/* Outline decoration — thin horizontal element spanning section */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(28% + 20.4px)',
            top: '319px',
            width: 'calc(1436.682 / 1920 * 100%)',
            height: '25.5px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
          }}
        >
          <img
            src="/figma-assets/figma-outline.svg"
            alt=""
            style={{
              transform: 'rotate(90deg) scaleY(-1)',
              width: '25.5px',
              height: 'calc(1436.682 / 1920 * 100vw)',
            }}
          />
        </div>

        {/* Star 1 decoration — center-right, rotated */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(44% + 43.2px)',
            top: '271px',
            width: 'calc(813.516 / 1920 * 100%)',
            height: '506px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/figma-assets/figma-star1.svg"
            alt=""
            style={{
              transform: 'rotate(-8.84deg)',
              width: 'calc(762.061 / 813.516 * 100%)',
              height: 'auto',
            }}
          />
        </div>

        {/* Rectangle11 (content area) — left side, flipped */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(16% + 3.8px)',
            top: '454px',
            width: 'calc(408.932 / 1920 * 100%)',
            height: 'auto',
            aspectRatio: '408.932 / 230.024',
            transform: 'scaleY(-1) rotate(180deg)',
          }}
        >
          <img
            src="/figma-assets/figma-rectangle11.svg"
            alt=""
            style={{ width: '100%', height: '100%', display: 'block' }}
          />
        </div>

        {/* Body text — right-aligned */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(48% + 708.4px)',
            transform: 'translateX(-100%)',
            top: '438px',
            fontFamily: BASE_FONT,
            fontWeight: 700,
            fontSize: '48px',
            lineHeight: 1.2,
            color: '#ffffff',
            textAlign: 'right',
            zIndex: 2,
            whiteSpace: 'nowrap',
          }}
        >
          <p style={{ margin: '0 0 4px' }}>Build your team,</p>
          <p style={{ margin: 0 }}>
            complete challenges
            <br />
            and get rewarded.
          </p>
        </div>

        {/* Spaccato bottom1 — left, flipped */}
        <img
          src="/figma-assets/figma-spaccato-bottom1.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(12% - 5.4px)',
            top: '536px',
            width: 'calc(137.847 / 1920 * 100%)',
            height: 'auto',
            transform: 'scaleY(-1) rotate(180deg)',
          }}
        />

        {/* Navigation arrows */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(44% + 42.2px)',
            top: '842px',
            display: 'flex',
            gap: 'calc(4% + 6.2px)',
          }}
        >
          <ArrowBtn
            src="/figma-assets/figma-bw-arrow1.svg"
            alt="Previous section"
            onClick={() => scrollToSection(1)}
          />
          <ArrowBtn
            src="/figma-assets/figma-fw-arrow1.svg"
            alt="Next section"
            onClick={() => scrollToSection(3)}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          SECTION 4 — GET REWARDS! (1920×955)
          ══════════════════════════════════════════════════ */}
      <section
        id="section-rewards"
        style={{
          position: 'relative',
          width: '100%',
          height: '955px',
          overflow: 'hidden',
        }}
      >
        {/* Guide background */}
        <img
          src="/figma-assets/figma-guide.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* Spaccato title decoration */}
        <img
          src="/figma-assets/figma-spaccato-title.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(12% - 4.4px)',
            top: '157px',
            width: 'calc(1321.928 / 1920 * 100%)',
            height: 'auto',
          }}
        />

        {/* GET REWARDS! title */}
        <p
          style={{
            position: 'absolute',
            left: 'calc(16% + 461.3px)',
            transform: 'translateX(-50%)',
            top: '228px',
            fontFamily: BASE_FONT,
            fontWeight: 900,
            fontStyle: 'italic',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            lineHeight: 1,
            margin: 0,
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: '96px' }}>GET REWARDS</span>
          <span style={{ fontSize: '110px' }}>!</span>
        </p>

        {/* Vector19 — rotated lightning-bolt shape, left */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(12% - 6.4px)',
            top: '286px',
            width: 'calc(660.187 / 1920 * 100%)',
            height: '651px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/figma-assets/figma-vector19.svg"
            alt=""
            style={{
              transform: 'rotate(46.25deg)',
              width: 'calc(313.81 / 660.187 * 100%)',
              height: 'auto',
            }}
          />
        </div>

        {/* Body text */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(16% + 2.8px)',
            top: '464px',
            fontFamily: BASE_FONT,
            fontWeight: 700,
            fontSize: '48px',
            lineHeight: 1.2,
            color: '#ffffff',
            zIndex: 2,
            whiteSpace: 'nowrap',
          }}
        >
          <p style={{ margin: '0 0 4px' }}>Complete tasks</p>
          <p style={{ margin: 0 }}>
            &amp; win matches to
            <br />
            get OBCoins.
          </p>
        </div>

        {/* Animation / content area — right side */}
        <img
          src="/figma-assets/figma-animation.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(64% - 1.27px)',
            top: '480px',
            width: 'calc(408.932 / 1920 * 100%)',
            height: 'auto',
            aspectRatio: '408.932 / 230.024',
          }}
        />

        {/* Spaccato bottom — far right */}
        <img
          src="/figma-assets/figma-spaccato-bottom.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: 'calc(80% + 44px)',
            top: '602px',
            width: 'calc(137.847 / 1920 * 100%)',
            height: 'auto',
          }}
        />

        {/* Navigation arrows */}
        <div
          style={{
            position: 'absolute',
            left: 'calc(44% + 42.2px)',
            top: '842px',
            display: 'flex',
            gap: 'calc(4% + 6.2px)',
          }}
        >
          <ArrowBtn
            src="/figma-assets/figma-bw-arrow.svg"
            alt="Previous section"
            onClick={() => scrollToSection(2)}
          />
          <ArrowBtn
            src="/figma-assets/figma-fw-arrow.svg"
            alt="Next section"
            onClick={() => scrollToSection(4)}
          />
        </div>
      </section>

      {/* ══════════════════════════════════════════════════
          GIANT OLEBOY — gradient text above footer
          Figma: 347px font, gradient from #0f0404 → white
          ══════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
          background: '#0f0404',
          paddingTop: 'clamp(40px, 4vw, 80px)',
        }}
      >
        <div
          aria-hidden="true"
          style={{
            fontFamily: BASE_FONT,
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: 'clamp(80px, 18vw, 347px)',
            lineHeight: 0.9,
            background: 'linear-gradient(180.075deg, #0f0404 10%, #ffffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            paddingLeft: '4.2%',
            paddingBottom: 'clamp(10px, 1vw, 20px)',
            userSelect: 'none',
          }}
        >
          OLEBOY
        </div>
      </div>

      {/* ══════════════════════════════════════════════════
          FOOTER — bg #0f0404, white top border
          ══════════════════════════════════════════════════ */}
      <footer
        id="section-footer"
        style={{
          position: 'relative',
          width: '100%',
          background: '#0f0404',
          borderTop: '0.5px solid #ffffff',
          padding: '60px 0 40px',
        }}
      >
        {/* Footer columns */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            maxWidth: '1532px',
            margin: '0 auto',
            padding: '0 10.1%',
            gap: '40px',
          }}
        >
          {/* Column 1: BTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* BTS - Marv */}
            <div>
              <p
                style={{
                  fontFamily: BASE_FONT,
                  fontWeight: 900,
                  fontStyle: 'italic',
                  fontSize: '24px',
                  color: '#ff1654',
                  margin: '0 0 12px',
                  whiteSpace: 'nowrap',
                }}
              >
                BTS - Marv
              </p>
              <a
                href="https://x.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: BASE_FONT,
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                  display: 'block',
                }}
              >
                X/Twitter
              </a>
            </div>

            {/* BTS - Tom */}
            <div>
              <p
                style={{
                  fontFamily: BASE_FONT,
                  fontWeight: 900,
                  fontStyle: 'italic',
                  fontSize: '24px',
                  color: '#ff1654',
                  margin: '0 0 12px',
                  whiteSpace: 'nowrap',
                }}
              >
                BTS - Tom
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <a
                  href="https://x.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: BASE_FONT,
                    fontWeight: 400,
                    fontSize: '16px',
                    color: '#e6e6e6',
                    textDecoration: 'underline',
                  }}
                >
                  X/Twitter
                </a>
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: BASE_FONT,
                    fontWeight: 400,
                    fontSize: '16px',
                    color: '#e6e6e6',
                    textDecoration: 'underline',
                  }}
                >
                  Instagram
                </a>
              </div>
            </div>
          </div>

          {/* Column 2: SOCIALS */}
          <div>
            <p
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 900,
                fontStyle: 'italic',
                fontSize: '24px',
                color: '#ff1654',
                margin: '0 0 12px',
                whiteSpace: 'nowrap',
              }}
            >
              SOCIALS
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <a
                href="https://x.com/oleboytokens"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: BASE_FONT,
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                }}
              >
                X/Twitter
              </a>
              <a
                href="https://www.tiktok.com/@oleboytokens"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: BASE_FONT,
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                }}
              >
                TikTok
              </a>
              <a
                href="https://discord.gg/2XVffNDPAE"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: BASE_FONT,
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                }}
              >
                Discord
              </a>
            </div>
          </div>

          {/* Column 3: CONTACT US */}
          <div>
            <p
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 900,
                fontStyle: 'italic',
                fontSize: '24px',
                color: '#ff1654',
                margin: '0 0 12px',
                whiteSpace: 'nowrap',
              }}
            >
              CONTACT US
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <a
                href="mailto:coolowner.2025@gmail.com"
                style={{
                  fontFamily: BASE_FONT,
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                }}
              >
                coolowner.2025@gmail.com
              </a>
              <a
                href="mailto:letterio.tomasini@gmail.com"
                style={{
                  fontFamily: BASE_FONT,
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                }}
              >
                letterio.tomasini@gmail.com
              </a>
            </div>
          </div>

          {/* Column 4: PRIVACY */}
          <div>
            <p
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 900,
                fontStyle: 'italic',
                fontSize: '24px',
                color: '#ff1654',
                margin: '0 0 12px',
                whiteSpace: 'nowrap',
              }}
            >
              PRIVACY
            </p>
            <a
              href="/terms"
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 400,
                fontSize: '16px',
                color: '#e6e6e6',
                textDecoration: 'underline',
              }}
            >
              Terms &amp; Privacy
            </a>
          </div>
        </div>

        {/* Copyright row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '6px',
            maxWidth: '1920px',
            margin: '0 auto',
            padding: '40px 44px 0',
          }}
        >
          <img
            src="/figma-assets/figma-copyright.png"
            alt="©"
            style={{ width: '23px', height: '23px', filter: 'invert(1)' }}
          />
          <span
            style={{
              fontFamily: BASE_FONT,
              fontWeight: 400,
              fontSize: '24px',
              color: '#e6e6e6',
            }}
          >
            2026 OLEBOY. All Rights Reserved.
          </span>
        </div>
      </footer>
    </div>
  );
}
