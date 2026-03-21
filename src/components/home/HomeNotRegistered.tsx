/**
 * HomeNotRegistered — 1:1 replica del frame Figma "NO LOGGED USER" (node 41:2)
 * Frame originale: 1920×4457px
 * Tutte le posizioni sono quelle esatte del Figma (absolute su canvas 1920px).
 * I valori calc() percentuali scalano con la viewport; i px rimangono fissi.
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ─── Asset URLs (scaricati dal Figma MCP) ────────────────────────────────────
const A_NEON          = '/figma-assets/figma-neon.png';
const A_ZAPS          = '/figma-assets/figma-zaps.svg';
const A_BAR           = '/figma-assets/figma-bar.svg';
const A_LOGO          = '/figma-assets/figma-logo.svg';
const A_ELLIPSE       = '/figma-assets/figma-ellipse.svg';
const A_DS_NAV        = '/figma-assets/figma-ds-icon-nav.png';
const A_TIKTOK        = '/figma-assets/figma-tiktok.png';
const A_TWITTER       = '/figma-assets/figma-twitter-x.png';
const A_DS_BTN        = '/figma-assets/figma-ds-icon-btn.png';
const A_ARROW_L       = '/figma-assets/figma-arrow-stroke-l.svg';
const A_ARROW_R       = '/figma-assets/figma-arrow-stroke-r.svg';
// Sezione 2
const A_GUIDE         = '/figma-assets/figma-guide.svg';
const A_SPAC_BOTTOM_A = '/figma-assets/figma-spaccato-bottom-a.svg';
const A_ANIMATION     = '/figma-assets/figma-animation.svg';
const A_STAR_SHAPE    = '/figma-assets/figma-star-shape.svg';
const A_SPAC_TITLE_2  = '/figma-assets/figma-spaccato-title-2.svg';
const A_BW2           = '/figma-assets/figma-bw2.svg';
const A_FW2           = '/figma-assets/figma-fw2.svg';
// Sezione 3
const A_RECTANGLE11   = '/figma-assets/figma-rectangle11.svg';
const A_SPAC_BOTTOM_B = '/figma-assets/figma-spaccato-bottom-b.svg';
const A_STAR1         = '/figma-assets/figma-star1.svg';
const A_OUTLINE       = '/figma-assets/figma-outline.svg';
const A_BW3           = '/figma-assets/figma-bw3.svg';
const A_FW3           = '/figma-assets/figma-fw3.svg';
// Sezione 4
const A_VECTOR19      = '/figma-assets/figma-vector19.svg';
const A_SPAC_TITLE_4  = '/figma-assets/figma-spaccato-title-4.svg';
const A_BW4           = '/figma-assets/figma-bw4.svg';
const A_FW4           = '/figma-assets/figma-fw4.svg';
// Footer
const A_COPYRIGHT     = '/figma-assets/figma-copyright.png';

// ─── Font helpers ─────────────────────────────────────────────────────────────
const F = "'Base Neue Trial', 'Base Neue', sans-serif";

// ─── Section scroll IDs ───────────────────────────────────────────────────────
const IDS = ['s-hero', 's-rank', 's-arena', 's-rewards', 's-footer'];

export function HomeNotRegistered() {
  const handleSignUp = useCallback(async () => {
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${origin}/auth/discord/callback`,
        scopes: 'identify email guilds.join',
      },
    });
  }, []);

  const scrollTo = useCallback((i: number) => {
    const el = document.getElementById(IDS[Math.max(0, Math.min(i, IDS.length - 1))]);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    /**
     * Root: position relative, 1920px canvas equivalente.
     * min-height = altezza totale del frame Figma (4457px).
     * Tutti gli elementi child sono absolute con top/left esatti dal Figma.
     */
    <div
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '4457px',
        background: '#0f0404',
        overflowX: 'hidden',
      }}
    >
      {/* ══════════════════════════════════════════════════════════════════════
          FOOTER  (41:3) — disegnato PRIMA così è sotto il testo OLEBOY gigante
          top: 3820px | h: 636.66px | bg: #0f0404 | border-top: 0.5px white
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="s-footer" style={{ position: 'absolute', left: 0, top: '3820px', width: '100%', height: '636.66px', background: '#0f0404', borderTop: '0.5px solid #ffffff' }} />

      {/* BTS MARV — left: calc(12%-6.4px) top: 4215px */}
      <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '4215px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0 }}>BTS - Marv</p>
      <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '4257px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', margin: 0 }}>X/Twitter</p>

      {/* BTS TOM — left: calc(12%-6.4px) top: 4315px */}
      <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '4315px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0 }}>BTS - Tom</p>
      <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '4357px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', margin: 0 }}>X/Twitter</p>
      <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '4389px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', margin: 0 }}>Instagram</p>

      {/* SOCIALS — left: calc(32%+58.6px) top: 4215px */}
      <p style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '4215px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0 }}>SOCIALS</p>
      <a href="https://x.com/oleboytokens" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '4256.92px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline' }}>X/Twitter</a>
      <a href="https://www.tiktok.com/@oleboytokens" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '4288.75px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline' }}>TikTok</a>
      <a href="https://discord.gg/2XVffNDPAE" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '4319.79px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline' }}>Discord</a>

      {/* CONTACT — left: calc(56%+3.8px) top: 4217px */}
      <p style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '4217px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0 }}>CONTACT US</p>
      <a href="mailto:coolowner.2025@gmail.com" style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '4259px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline' }}>coolowner.2025@gmail.com</a>
      <a href="mailto:letterio.tomasini@gmail.com" style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '4291px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline' }}>letterio.tomasini@gmail.com</a>

      {/* PRIVACY — left: calc(80%+26px) top: 4217px */}
      <p style={{ position: 'absolute', left: 'calc(80% + 26px)', top: '4217px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0 }}>PRIVACY</p>
      <a href="/terms" style={{ position: 'absolute', left: 'calc(80% + 29px)', top: '4259px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', width: '124px', display: 'block' }}>Terms &amp; Privacy</a>

      {/* COPYRIGHT — left: calc(76%+25.8px) top: 4405px */}
      <div style={{ position: 'absolute', left: 'calc(76% + 25.8px)', top: '4408px', width: '23px', height: '23px' }}>
        <img src={A_COPYRIGHT} alt="©" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'invert(1)' }} />
      </div>
      <p style={{ position: 'absolute', left: 'calc(76% + 48.8px)', top: '4405px', fontFamily: F, fontWeight: 400, fontSize: '24px', color: '#e6e6e6', whiteSpace: 'nowrap', margin: 0 }}>
        {' '}2026 OLEBOY. All Rights Reserved.
      </p>

      {/* ══════════════════════════════════════════════════════════════════════
          FOURTH PAGE — "GET REWARDS!"  top: 2865px  h: 955px
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="s-rewards" style={{ position: 'absolute', top: '2865px', left: 0, width: '100%', height: '955px' }}>
        <img src={A_GUIDE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* spaccato title — left: calc(12%-4.4px) top: 3022px w: 1321.928px h: 207.861px */}
      <div style={{ position: 'absolute', left: 'calc(12% - 4.4px)', top: '3022px', width: 'calc(1321.928 / 1920 * 100%)', height: '207.861px' }}>
        <img src={A_SPAC_TITLE_4} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* GET REWARDS! — left: calc(16%+461.3px) translateX(-50%) top: 3093px */}
      <p
        style={{
          position: 'absolute',
          left: 'calc(16% + 461.3px)',
          transform: 'translateX(-50%)',
          top: '3093px',
          fontFamily: F,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: 0,
          lineHeight: 0,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          margin: 0,
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '96px', lineHeight: 'normal' }}>GET REWARDS</span>
        <span style={{ fontSize: '110px', lineHeight: 'normal' }}>!</span>
      </p>

      {/* Vector 19 — container: left: calc(12%-6.4px) top: 3196px w: 660.187px h: 650.974px
           inner: rotate(46.25deg) w: 313.81px h: 613.539px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(12% - 6.4px)',
          top: '3196px',
          width: 'calc(660.187 / 1920 * 100%)',
          height: '650.974px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ transform: 'rotate(46.25deg)', flexShrink: 0 }}>
          <div style={{ height: '613.539px', width: 'calc(313.81 / 660.187 * 100vw * (660.187 / 1920))', position: 'relative' }}>
            <img src={A_VECTOR19} alt="" aria-hidden style={{ position: 'absolute', inset: '-0% -0.31% 0% -0.23%', display: 'block', width: '100%', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* Body text — left: calc(16%+2.8px) top: 3374px */}
      <p
        style={{
          position: 'absolute',
          left: 'calc(16% + 2.8px)',
          top: '3374px',
          fontFamily: F,
          fontWeight: 700,
          fontSize: '48px',
          lineHeight: 'normal',
          color: '#ffffff',
          whiteSpace: 'nowrap',
          margin: 0,
        }}
      >
        Complete tasks
        <br />
        &amp; win matches to
        <br />
        get OBCoins.
      </p>

      {/* Animation — left: calc(64%-1.27px) top: 3345.21px w: 408.932px h: 230.024px */}
      <div style={{ position: 'absolute', left: 'calc(64% - 1.27px)', top: '3345.21px', width: 'calc(408.932 / 1920 * 100%)', height: '230.024px' }}>
        <img src={A_ANIMATION} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* spaccato bottom — left: calc(80%+44px) top: 3467px w: 137.847px h: 206.33px */}
      <div style={{ position: 'absolute', left: 'calc(80% + 44px)', top: '3467px', width: 'calc(137.847 / 1920 * 100%)', height: '206.33px' }}>
        <img src={A_SPAC_BOTTOM_A} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* BW Arrow 4 — left: calc(44%+42.2px) top: 3707px size: 63.107px */}
      <button onClick={() => scrollTo(2)} style={{ position: 'absolute', left: 'calc(44% + 42.2px)', top: '3707px', width: '63.107px', height: '63.107px', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
        <img src={A_BW4} alt="Sezione precedente" style={{ display: 'block', width: '100%', height: '100%' }} />
      </button>
      {/* FW Arrow 4 — left: calc(48%+48.4px) top: 3707px size: 63.107px */}
      <button onClick={() => scrollTo(4)} style={{ position: 'absolute', left: 'calc(48% + 48.4px)', top: '3707px', width: '63.107px', height: '63.107px', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
        <img src={A_FW4} alt="Sezione successiva" style={{ display: 'block', width: '100%', height: '100%' }} />
      </button>

      {/* ══════════════════════════════════════════════════════════════════════
          THIRD PAGE — "JOIN THE ARENA!"  top: 1910px  h: 955px
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="s-arena" style={{ position: 'absolute', top: '1910px', left: 0, width: '100%', height: '955px' }}>
        <img src={A_GUIDE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* JOIN THE ARENA! — left: calc(28%+1088.4px) translateX(-100%) top: 2113px */}
      <p
        style={{
          position: 'absolute',
          left: 'calc(28% + 1088.4px)',
          transform: 'translateX(-100%)',
          top: '2113px',
          fontFamily: F,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: 0,
          lineHeight: 0,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          margin: 0,
          textAlign: 'right',
        }}
      >
        <span style={{ fontSize: '96px', lineHeight: 'normal' }}>JOIN THE ARENA</span>
        <span style={{ fontSize: '110px', lineHeight: 'normal' }}>!</span>
      </p>

      {/* Outline — container: left: calc(28%+20.4px) top: 2229.71px w: 1436.682px h: 25.522px
           inner: -scaleY rotate(89.8deg) div h: 1436.62px w: 20.499px
           content: absolute bottom-1/4 left-6.7% right-6.7% top-0 */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(28% + 20.4px)',
          top: '2229.71px',
          width: 'calc(1436.682 / 1920 * 100%)',
          height: '25.522px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'visible',
        }}
      >
        <div style={{ transform: 'scaleY(-1) rotate(89.8deg)', flexShrink: 0, height: '1436.62px', width: '20.499px', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: '6.7%', right: '6.7%', bottom: '25%' }}>
            <img src={A_OUTLINE} alt="" aria-hidden style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* Star 1 — container: left: calc(44%+43.2px) top: 2226px w: 813.516px h: 506.117px
           inner: rotate(-8.84deg) w: 762.061px h: 393.648px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(44% + 43.2px)',
          top: '2226px',
          width: 'calc(813.516 / 1920 * 100%)',
          height: '506.117px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ transform: 'rotate(-8.84deg)', flexShrink: 0 }}>
          <div style={{ height: '393.648px', width: 'calc(762.061 / 813.516 * 100vw * (813.516 / 1920))', position: 'relative' }}>
            <img src={A_STAR1} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          </div>
        </div>
      </div>

      {/* Rectangle 11 — container: left: calc(16%+3.8px) top: 2364px w: 408.932px h: 230.024px
           inner: scaleY(-1) rotate(180deg) */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(16% + 3.8px)',
          top: '2364px',
          width: 'calc(408.932 / 1920 * 100%)',
          height: '230.024px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ transform: 'scaleY(-1) rotate(180deg)', flexShrink: 0, width: '100%', height: '100%' }}>
          <img src={A_RECTANGLE11} alt="" aria-hidden style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
      </div>

      {/* spaccato bottom 3 — container: left: calc(12%-5.4px) top: 2491px w: 137.847px h: 206.33px
           inner: scaleY(-1) rotate(180deg) */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(12% - 5.4px)',
          top: '2491px',
          width: 'calc(137.847 / 1920 * 100%)',
          height: '206.33px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ transform: 'scaleY(-1) rotate(180deg)', flexShrink: 0, width: '100%', height: '100%' }}>
          <img src={A_SPAC_BOTTOM_B} alt="" aria-hidden style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>
      </div>

      {/* Body text right — left: calc(48%+708.4px) translateX(-100%) top: 2393px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(48% + 708.4px)',
          transform: 'translateX(-100%)',
          top: '2393px',
          fontFamily: F,
          fontWeight: 700,
          fontSize: '48px',
          lineHeight: 'normal',
          color: '#ffffff',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        <p style={{ margin: '0 0 0' }}>Build your team,</p>
        <p style={{ margin: 0 }}>
          complete challenges
          <br />
          and get rewarded.
        </p>
      </div>

      {/* BW Arrow 3 — left: calc(44%+42.2px) top: 2752px */}
      <button onClick={() => scrollTo(1)} style={{ position: 'absolute', left: 'calc(44% + 42.2px)', top: '2752px', width: '63.107px', height: '63.107px', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
        <img src={A_BW3} alt="Sezione precedente" style={{ display: 'block', width: '100%', height: '100%' }} />
      </button>
      {/* FW Arrow 3 — left: calc(48%+48.4px) top: 2752px */}
      <button onClick={() => scrollTo(3)} style={{ position: 'absolute', left: 'calc(48% + 48.4px)', top: '2752px', width: '63.107px', height: '63.107px', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
        <img src={A_FW3} alt="Sezione successiva" style={{ display: 'block', width: '100%', height: '100%' }} />
      </button>

      {/* ══════════════════════════════════════════════════════════════════════
          SECOND PAGE — "RANK UP!"  top: 955px  h: 955px
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="s-rank" style={{ position: 'absolute', top: '955px', left: 0, width: '100%', height: '955px' }}>
        <img src={A_GUIDE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* spaccato title 2 — left: calc(12%-4.4px) top: 1112px w: 846.854px h: 207.862px */}
      <div style={{ position: 'absolute', left: 'calc(12% - 4.4px)', top: '1112px', width: 'calc(846.854 / 1920 * 100%)', height: '207.862px' }}>
        <img src={A_SPAC_TITLE_2} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* RANK UP! — left: calc(16%+289.3px) translateX(-50%) top: 1183.89px */}
      <p
        style={{
          position: 'absolute',
          left: 'calc(16% + 289.3px)',
          transform: 'translateX(-50%)',
          top: '1183.89px',
          fontFamily: F,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: 0,
          lineHeight: 0,
          color: '#ffffff',
          whiteSpace: 'nowrap',
          margin: 0,
          textAlign: 'center',
        }}
      >
        <span style={{ fontSize: '96px', lineHeight: 'normal' }}>RANK UP</span>
        <span style={{ fontSize: '110px', lineHeight: 'normal' }}>!</span>
      </p>

      {/* Star shape — container: left: calc(8%-17.6px) top: 1252px w: 866.424px h: 596.408px
           inner: rotate(-15.44deg) w: 788.09px h: 401.031px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(8% - 17.6px)',
          top: '1252px',
          width: 'calc(866.424 / 1920 * 100%)',
          height: '596.408px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ transform: 'rotate(-15.44deg)', flexShrink: 0 }}>
          <div style={{ height: '401.031px', width: 'calc(788.09 / 866.424 * 100vw * (866.424 / 1920))', position: 'relative' }}>
            <div style={{ position: 'absolute', top: '-0.26%', bottom: '-0.22%', left: 0, right: 0 }}>
              <img src={A_STAR_SHAPE} alt="" aria-hidden style={{ display: 'block', width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Body text — left: calc(16%-7.2px) top: 1464px w: 593px h: 171px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(16% - 7.2px)',
          top: '1464px',
          width: 'calc(593 / 1920 * 100%)',
          fontFamily: F,
          fontWeight: 700,
          fontSize: '48px',
          lineHeight: 'normal',
          color: '#ffffff',
        }}
      >
        <p style={{ margin: '0 0 0' }}>Dominate the</p>
        <p style={{ margin: 0 }}>
          leaderboard and
          <br />
          claim your legacy.
        </p>
      </div>

      {/* Animation 2 — left: calc(64%-1.27px) top: 1435.21px w: 408.932px h: 230.024px */}
      <div style={{ position: 'absolute', left: 'calc(64% - 1.27px)', top: '1435.21px', width: 'calc(408.932 / 1920 * 100%)', height: '230.024px' }}>
        <img src={A_ANIMATION} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* spaccato bottom 2 — left: calc(80%+44px) top: 1557px w: 137.847px h: 206.33px */}
      <div style={{ position: 'absolute', left: 'calc(80% + 44px)', top: '1557px', width: 'calc(137.847 / 1920 * 100%)', height: '206.33px' }}>
        <img src={A_SPAC_BOTTOM_A} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* BW Arrow 2 — left: calc(44%+42.2px) top: 1797px */}
      <button onClick={() => scrollTo(0)} style={{ position: 'absolute', left: 'calc(44% + 42.2px)', top: '1797px', width: '63.107px', height: '63.107px', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
        <img src={A_BW2} alt="Sezione precedente" style={{ display: 'block', width: '100%', height: '100%' }} />
      </button>
      {/* FW Arrow 2 — left: calc(48%+48.4px) top: 1797px */}
      <button onClick={() => scrollTo(2)} style={{ position: 'absolute', left: 'calc(48% + 48.4px)', top: '1797px', width: '63.107px', height: '63.107px', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer' }}>
        <img src={A_FW2} alt="Sezione successiva" style={{ display: 'block', width: '100%', height: '100%' }} />
      </button>

      {/* ══════════════════════════════════════════════════════════════════════
          FIRST PAGE — HERO  top: 0  h: 955px
          ══════════════════════════════════════════════════════════════════════ */}
      <div id="s-hero" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '955px', background: '#0f0404' }} />

      {/* OLEBOY title — left: calc(32%+345.6px) translateX(-50%) top: 356px */}
      <p
        style={{
          position: 'absolute',
          left: 'calc(32% + 345.6px)',
          transform: 'translateX(-50%)',
          top: '356px',
          fontFamily: F,
          fontWeight: 900,
          fontSize: '128px',
          lineHeight: 'normal',
          color: '#ffffff',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          margin: 0,
          width: '647.999px',
        }}
      >
        OLEBOY
      </p>

      {/* Subtitle — left: calc(32%+345.6px) translateX(-50%) top: 501.6px
           font: Expanded 30px, tracking 4.8px, lineHeight 35px */}
      <p
        style={{
          position: 'absolute',
          left: 'calc(32% + 345.6px)',
          transform: 'translateX(-50%)',
          top: '501.6px',
          fontFamily: F,
          fontWeight: 400,
          fontSize: '30px',
          lineHeight: '35px',
          letterSpacing: '4.8px',
          color: '#ffffff',
          textAlign: 'center',
          width: '685.999px',
          margin: 0,
        }}
      >
        Stake tokens. Win Matches.
        <br />
        Claim your victory.
      </p>

      {/* SIGN UP BUTTON — left: calc(40%+49px) top: 602px w: 285px h: 69px bg: #3b28cc rounded: 29px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(40% + 49px)',
          top: '602px',
          width: '285px',
          height: '69px',
          background: '#3b28cc',
          borderRadius: '29px',
          boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.15), inset 0px -3px 4px 0px rgba(0,0,0,0.25)',
          cursor: 'pointer',
        }}
        onClick={handleSignUp}
      />
      {/* SIGN UP text — left: calc(44%+78.83px) translateX(-50%) top: 613px */}
      <p
        onClick={handleSignUp}
        style={{
          position: 'absolute',
          left: 'calc(44% + 78.83px)',
          transform: 'translateX(-50%)',
          top: '613px',
          fontFamily: F,
          fontWeight: 900,
          fontSize: 0,
          lineHeight: 0,
          color: '#ffffff',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          margin: 0,
          width: '159.441px',
          cursor: 'pointer',
          zIndex: 1,
        }}
      >
        <span style={{ fontSize: '36px', lineHeight: 'normal' }}>SIGN UP</span>
        <span style={{ fontSize: '40px', lineHeight: 'normal' }}>!</span>
      </p>
      {/* DS Icon in SIGN UP button — left: calc(52%+24.31px) top: 617.57px w: 52.907px h: 38.932px */}
      <div
        style={{ position: 'absolute', left: 'calc(52% + 24.31px)', top: '617.57px', width: '52.907px', height: '38.932px', cursor: 'pointer', zIndex: 1 }}
        onClick={handleSignUp}
      >
        <img src={A_DS_BTN} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* KNOW MORE BUTTON bg — left: calc(40%+55px) top: 840px w: 274px h: 65px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(40% + 55px)',
          top: '840px',
          width: '274px',
          height: '65px',
          background: 'rgba(255,22,84,0.23)',
          border: '1px solid #ff1654',
          borderRadius: '50px',
          boxShadow: 'inset 0px -4px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.14)',
          cursor: 'pointer',
        }}
        onClick={() => scrollTo(1)}
      />
      {/* Know More text — left: calc(44%+114.7px) translateX(-50%) top: 858px */}
      <p
        onClick={() => scrollTo(1)}
        style={{
          position: 'absolute',
          left: 'calc(44% + 114.7px)',
          transform: 'translateX(-50%)',
          top: '858px',
          fontFamily: F,
          fontWeight: 400,
          fontSize: '24px',
          lineHeight: 'normal',
          color: '#ffffff',
          textAlign: 'center',
          whiteSpace: 'nowrap',
          margin: 0,
          cursor: 'pointer',
          zIndex: 1,
        }}
      >
        Know More
      </p>
      {/* Arrow stroke left — left: calc(44%-2.29px) top: 862.87px w: 16.312px h: 21.071px */}
      <div style={{ position: 'absolute', left: 'calc(44% - 2.29px)', top: '862.87px', width: '16.312px', height: '21.071px', cursor: 'pointer', zIndex: 1 }} onClick={() => scrollTo(1)}>
        <img src={A_ARROW_L} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
      {/* Arrow stroke right — left: calc(52%+61.89px) top: 862.87px w: 15.653px h: 21.071px */}
      <div style={{ position: 'absolute', left: 'calc(52% + 61.89px)', top: '862.87px', width: '15.653px', height: '21.071px', cursor: 'pointer', zIndex: 1 }} onClick={() => scrollTo(1)}>
        <img src={A_ARROW_R} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ZAPS (41:120) — lightning bolts overlay hero
          left: -183.62px top: -290px w: 2288.421px h: 1373.5px
          Convertito in %: left=-9.56% top=-290px (px rimangono, percentuale per width)
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'calc(-183.62 / 1920 * 100%)',
          top: '-290px',
          width: 'calc(2288.421 / 1920 * 100%)',
          height: '1373.5px',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <img src={A_ZAPS} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          OLEBOY GIANT TEXT (41:125)
          left: calc(4%+4.2px) top: 3802px  font: 347.059px  Expanded Black Oblique
          gradient: 180.075deg #0f0404 10% → #ffffff 100%
          ══════════════════════════════════════════════════════════════════════ */}
      <p
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'calc(4% + 4.2px)',
          top: '3802px',
          fontFamily: F,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: '347.059px',
          lineHeight: 'normal',
          whiteSpace: 'nowrap',
          margin: 0,
          background: 'linear-gradient(180.075deg, rgb(15,4,4) 10.117%, rgb(255,255,255) 99.722%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          color: 'transparent',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        OLEBOY
      </p>

      {/* ══════════════════════════════════════════════════════════════════════
          BOTTOM NEON (41:126) — wrapper top: 827px (scaleY-1 inside)
          L'immagine è flippata verticalmente per effetto "neon" in basso
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: '827px',
          width: '100%',
          height: '146px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        <div style={{ transform: 'scaleY(-1)', flexShrink: 0, width: '100%', height: '100%' }}>
          <img src={A_NEON} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          TOP NEON (41:127) — top: 0 left: 0 w: 1920px h: 146px
          ══════════════════════════════════════════════════════════════════════ */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '146px',
          pointerEvents: 'none',
          zIndex: 2,
          overflow: 'hidden',
        }}
      >
        <img src={A_NEON} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

    </div>
  );
}
