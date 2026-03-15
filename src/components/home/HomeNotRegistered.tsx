/**
 * HomeNotRegistered — pixel-perfect replica of the Figma "NO LOGGED" frame.
 * Frame: 1920×4457px — 5 sections stacked vertically:
 *   1. First page (Hero): 0–955px
 *   2. Second page (RANK UP!): 955–1910px
 *   3. Third page (JOIN THE ARENA!): 1910–2865px
 *   4. Fourth page (GET REWARDS!): 2865–3843px
 *   5. Footer: 3820–4457px
 *
 * All sections use full-width SVG backgrounds exported from Figma.
 * Decorative lightning bolts overlay the hero.
 * Navbar is handled by PublicLayout (NavbarFigma).
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const SECTION_IDS = ['section-hero', 'section-rank-up', 'section-arena', 'section-rewards', 'section-footer'];

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
    const clampedIndex = Math.max(0, Math.min(index, SECTION_IDS.length - 1));
    const el = document.getElementById(SECTION_IDS[clampedIndex]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <div style={{ background: '#04080f', width: '100%', overflowX: 'hidden', position: 'relative' }}>

      {/* ══════════════════════════════════════════════════════
          TOP NEON GRADIENT — from #ff1654/20 to transparent
          Figma: y=0, h=146, full width
          ══════════════════════════════════════════════════════ */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '146px',
          background: 'linear-gradient(to bottom, rgba(255,22,84,0.20), transparent)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — HERO (First page: 1920×955)
          Background: #0f0404
          Zaps overlay, center text, sign up button, know more
          ══════════════════════════════════════════════════════ */}
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
        {/* Zaps — 4 corner lightning bolts
            Figma: left=-183.62 top=-290 w=2288.42 h=1373.50 on a 1920px frame
            We scale proportionally to viewport width so bolts stay at edges */}
        <img
          src="/figma-assets/9-130.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '-9.56%',
            top: '-30.37%',
            width: '119.19%',
            height: 'auto',
            aspectRatio: '2288.42 / 1373.50',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* BOTTOM NEON — gradient at bottom of hero */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '827px',
            width: '100%',
            height: '146px',
            background: 'linear-gradient(to bottom, rgba(255,22,84,0.20), transparent)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />

        {/* Main Text block — centered */}
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
            zIndex: 2,
          }}
        >
          {/* OLEBOY — 96px black weight */}
          <h1
            style={{
              fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
              fontWeight: 900,
              fontSize: '96px',
              lineHeight: 1,
              color: '#ffffff',
              margin: 0,
              textAlign: 'center',
              letterSpacing: '-0.01em',
            }}
          >
            OLEBOY
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
              fontWeight: 400,
              fontSize: '32px',
              lineHeight: 1.35,
              color: '#ffffff',
              margin: '16px 0 0 0',
              textAlign: 'center',
              whiteSpace: 'pre-line',
            }}
          >
            Stake tokens. Win Matches.<br/>Claim your victory.
          </p>

          {/* SIGN UP BUTTON — 285×69, #3b28cc, rounded 29px */}
          <div
            onClick={handleSignUp}
            style={{
              position: 'relative',
              width: '285px',
              height: '69px',
              marginTop: '56px',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: '285px',
                height: '69px',
                background: '#3b28cc',
                borderRadius: '29px',
                boxShadow: 'inset 0px -3px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
              }}
            >
              <span
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 900,
                  fontSize: '36px',
                  color: '#ffffff',
                  textAlign: 'center',
                }}
              >
                SIGN UP!
              </span>
              {/* Discord icon inline SVG */}
              <svg width="53" height="39" viewBox="0 0 24 24" fill="white">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.133 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
          </div>

          {/* Know More — pill button with arrows */}
          <div
            onClick={() => {
              const el = document.getElementById('section-rank-up');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            style={{
              marginTop: '44px',
              cursor: 'pointer',
            }}
          >
            <img
              src="/figma-assets/9-119.svg"
              alt="Know More"
              style={{
                width: '303px',
                height: '65px',
              }}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — RANK UP! (Second page: 1920×955)
          Full SVG background with all content embedded
          ══════════════════════════════════════════════════════ */}
      <section
        id="section-rank-up"
        style={{
          position: 'relative',
          width: '100%',
          height: '955px',
          overflow: 'hidden',
        }}
      >
        <img
          src="/figma-assets/9-87.svg"
          alt="Rank Up section"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        {/* Up arrow overlay — cx=918 cy=850 r=31 on 1920×955 */}
        <div
          onClick={() => scrollToSection(0)}
          style={{
            position: 'absolute',
            left: 'calc(918 / 1920 * 100% - 31 / 1920 * 100%)',
            top: 'calc(850 / 955 * 100% - 31 / 955 * 100%)',
            width: 'calc(62 / 1920 * 100%)',
            height: 'calc(62 / 955 * 100%)',
            cursor: 'pointer',
            borderRadius: '50%',
            zIndex: 2,
          }}
        />
        {/* Down arrow overlay — cx=1001 cy=850 r=31 on 1920×955 */}
        <div
          onClick={() => scrollToSection(2)}
          style={{
            position: 'absolute',
            left: 'calc(1001 / 1920 * 100% - 31 / 1920 * 100%)',
            top: 'calc(850 / 955 * 100% - 31 / 955 * 100%)',
            width: 'calc(62 / 1920 * 100%)',
            height: 'calc(62 / 955 * 100%)',
            cursor: 'pointer',
            borderRadius: '50%',
            zIndex: 2,
          }}
        />
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — JOIN THE ARENA! (Third page: 1920×955)
          Full SVG background with all content embedded
          ══════════════════════════════════════════════════════ */}
      <section
        id="section-arena"
        style={{
          position: 'relative',
          width: '100%',
          height: '955px',
          overflow: 'hidden',
        }}
      >
        <img
          src="/figma-assets/9-66.svg"
          alt="Join the Arena section"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        {/* Up arrow overlay — cx=918.5 cy=821.5 r=31 on 1920×955 */}
        <div
          onClick={() => scrollToSection(1)}
          style={{
            position: 'absolute',
            left: 'calc(918.5 / 1920 * 100% - 31 / 1920 * 100%)',
            top: 'calc(821.5 / 955 * 100% - 31 / 955 * 100%)',
            width: 'calc(62 / 1920 * 100%)',
            height: 'calc(62 / 955 * 100%)',
            cursor: 'pointer',
            borderRadius: '50%',
            zIndex: 2,
          }}
        />
        {/* Down arrow overlay — cx=1001.5 cy=821.5 r=31 on 1920×955 */}
        <div
          onClick={() => scrollToSection(3)}
          style={{
            position: 'absolute',
            left: 'calc(1001.5 / 1920 * 100% - 31 / 1920 * 100%)',
            top: 'calc(821.5 / 955 * 100% - 31 / 955 * 100%)',
            width: 'calc(62 / 1920 * 100%)',
            height: 'calc(62 / 955 * 100%)',
            cursor: 'pointer',
            borderRadius: '50%',
            zIndex: 2,
          }}
        />
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 4 — GET REWARDS! (Fourth page: 1920×978)
          Full SVG background with all content embedded
          ══════════════════════════════════════════════════════ */}
      <section
        id="section-rewards"
        style={{
          position: 'relative',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <img
          src="/figma-assets/9-37.svg"
          alt="Get Rewards section"
          style={{
            width: '100%',
            height: 'auto',
            display: 'block',
          }}
        />
        {/* Up arrow overlay — cx=918.5 cy=819.5 r=31 on 1920×955 */}
        <div
          onClick={() => scrollToSection(2)}
          style={{
            position: 'absolute',
            left: 'calc(918.5 / 1920 * 100% - 31 / 1920 * 100%)',
            top: 'calc(819.5 / 955 * 100% - 31 / 955 * 100%)',
            width: 'calc(62 / 1920 * 100%)',
            height: 'calc(62 / 955 * 100%)',
            cursor: 'pointer',
            borderRadius: '50%',
            zIndex: 2,
          }}
        />
        {/* Down arrow overlay — cx=1001.5 cy=819.5 r=31 on 1920×955 */}
        <div
          onClick={() => scrollToSection(4)}
          style={{
            position: 'absolute',
            left: 'calc(1001.5 / 1920 * 100% - 31 / 1920 * 100%)',
            top: 'calc(819.5 / 955 * 100% - 31 / 955 * 100%)',
            width: 'calc(62 / 1920 * 100%)',
            height: 'calc(62 / 955 * 100%)',
            cursor: 'pointer',
            borderRadius: '50%',
            zIndex: 2,
          }}
        />
      </section>

      {/* ══════════════════════════════════════════════════════
          OLEBOY GIANT TEXT — gradient text overlapping footer
          Figma: left=81, top=3802, 347px font, gradient from #0f0404 to white
          ══════════════════════════════════════════════════════ */}
      {/* OLEBOY GIANT TEXT — Figma: left=81, top=3802 on 1920px frame
          The text sits above the footer with proper spacing.
          Figma font-size: 347px on 1920px = ~18vw */}
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
          style={{
            fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
            fontWeight: 900,
            fontSize: 'clamp(80px, 18vw, 347px)',
            lineHeight: 0.9,
            background: 'linear-gradient(to bottom, #0f0404 0%, #ffffff 100%)',
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

      {/* ══════════════════════════════════════════════════════
          FOOTER — 1920×637, bg #0f0404, white top border
          ══════════════════════════════════════════════════════ */}
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
            padding: '0 194px',
            gap: '40px',
          }}
        >
          {/* Column 1: BTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {/* BTS - Marv */}
            <div>
              <div
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 900,
                  fontSize: '24px',
                  color: '#ff1654',
                  marginBottom: '12px',
                }}
              >
                BTS - Marv
              </div>
              <div
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                X/Twitter
              </div>
            </div>

            {/* BTS - Tom */}
            <div>
              <div
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 900,
                  fontSize: '24px',
                  color: '#ff1654',
                  marginBottom: '12px',
                }}
              >
                BTS - Tom
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  style={{
                    fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                    fontWeight: 400,
                    fontSize: '16px',
                    color: '#e6e6e6',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  X/Twitter
                </div>
                <div
                  style={{
                    fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                    fontWeight: 400,
                    fontSize: '16px',
                    color: '#e6e6e6',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                  }}
                >
                  Instagram
                </div>
              </div>
            </div>
          </div>

          {/* Column 2: SOCIALS */}
          <div>
            <div
              style={{
                fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                fontWeight: 900,
                fontSize: '24px',
                color: '#ff1654',
                marginBottom: '12px',
              }}
            >
              SOCIALS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <a
                href="https://x.com/oleboytokens"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                X/Twitter
              </a>
              <a
                href="https://www.tiktok.com/@oleboytokens"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                TikTok
              </a>
              <a
                href="https://discord.gg/2XVffNDPAE"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                Discord
              </a>
            </div>
          </div>

          {/* Column 3: CONTACT US */}
          <div>
            <div
              style={{
                fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                fontWeight: 900,
                fontSize: '24px',
                color: '#ff1654',
                marginBottom: '12px',
              }}
            >
              CONTACT US
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                coolowner.2025@gmail.com
              </div>
              <div
                style={{
                  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                  fontWeight: 400,
                  fontSize: '16px',
                  color: '#e6e6e6',
                  textDecoration: 'underline',
                  cursor: 'pointer',
                }}
              >
                letterio.tomasini@gmail.com
              </div>
            </div>
          </div>

          {/* Column 4: PRIVACY */}
          <div>
            <div
              style={{
                fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                fontWeight: 900,
                fontSize: '24px',
                color: '#ff1654',
                marginBottom: '12px',
              }}
            >
              PRIVACY
            </div>
            <div
              style={{
                fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                fontWeight: 400,
                fontSize: '16px',
                color: '#e6e6e6',
                textDecoration: 'underline',
                cursor: 'pointer',
              }}
            >
              Terms & Privacy
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '4px',
            maxWidth: '1920px',
            margin: '0 auto',
            padding: '40px 44px 0',
          }}
        >
          <img
            src="/figma-assets/9-36.webp"
            alt="copyright"
            style={{ width: '23px', height: '23px' }}
          />
          <span
            style={{
              fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
              fontWeight: 400,
              fontSize: '24px',
              color: '#e6e6e6',
            }}
          >
            {' '}2026 OLEBOY. All Rights Reserved.
          </span>
        </div>
      </footer>

    </div>
  );
}
