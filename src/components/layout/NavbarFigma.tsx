/**
 * NavbarFigma — 1:1 replica Figma node 41:128
 * NavBar: x=194 y=55 w=1532 h=91
 *
 * Bar:      left: calc(8%+40.4px)  top: 55px  w: 1532px  h: 91px
 * Logo:     left: calc(12%+5.6px)  top: 73px  w: 65.207px  h: 55.245px  rotate: 89.78deg
 * MEET OBT: left: calc(28%+126.95px) translateX(-50%)  top: 82px  33.878px  Black Oblique  #ff1654
 * matches:  left: calc(40%+140.07px) translateX(-50%)  top: 82.82px  28.231px  white
 * ladder:   left: calc(52%+92.91px)  translateX(-50%)  top: 82px   28.231px  white
 * highlights:left: calc(60%+127.32px) translateX(-50%)  top: 82px  28.231px  white
 * Twitter:  left: calc(76%+48.8px)  top: 75px  50×50  rounded-54px
 * TikTok:   left: calc(80%+32.77px) top: 75px  50×50  rounded-157px
 * DC Ellipse:left: calc(84%+16.74px) top: 75px  50×50
 * DC Icon:  left: calc(84%+28.28px) top: 86.54px  27.692×27.692px
 */

import { Link } from 'react-router-dom';

const F = "'Base Neue Trial', 'Base Neue', sans-serif";

const A_BAR     = '/figma-assets/figma-bar.svg';
const A_LOGO    = '/figma-assets/figma-logo.svg';
const A_TWITTER = '/figma-assets/figma-twitter-x.png';
const A_TIKTOK  = '/figma-assets/figma-tiktok.png';
const A_ELLIPSE = '/figma-assets/figma-ellipse.svg';
const A_DS_NAV  = '/figma-assets/figma-ds-icon-nav.png';

export function NavbarFigma() {
  return (
    <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, pointerEvents: 'none' }}>
      {/* Bar — left: calc(8%+40.4px) top: 55px w: 1532px h: 91px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(8% + 40.4px)',
          top: '55px',
          width: 'calc(1532 / 1920 * 100%)',
          height: '91px',
          pointerEvents: 'all',
        }}
      >
        <img src={A_BAR} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>

      {/* Logo — left: calc(12%+5.6px) top: 73px w: 65.207px h: 55.245px  rotate: 89.78deg */}
      <Link
        to="/"
        style={{
          position: 'absolute',
          left: 'calc(12% + 5.6px)',
          top: '73px',
          width: '65.207px',
          height: '55.245px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'all',
        }}
      >
        <div style={{ transform: 'rotate(89.78deg)', flexShrink: 0 }}>
          <img src={A_LOGO} alt="OleBoy" style={{ display: 'block', width: '55px', height: '65px' }} />
        </div>
      </Link>

      {/* MEET OBT — left: calc(28%+126.95px) translateX(-50%) top: 82px  33.878px  Black Oblique  #ff1654 */}
      <Link
        to="/"
        style={{
          position: 'absolute',
          left: 'calc(28% + 126.95px)',
          transform: 'translateX(-50%)',
          top: '82px',
          fontFamily: F,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: '33.878px',
          lineHeight: 'normal',
          color: '#ff1654',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          pointerEvents: 'all',
          height: '35px',
          width: '219.105px',
          textAlign: 'center',
        }}
      >
        MEET OBT
      </Link>

      {/* matches — left: calc(40%+140.07px) translateX(-50%) top: 82.82px  28.231px  white */}
      <Link
        to="/matches"
        style={{
          position: 'absolute',
          left: 'calc(40% + 140.07px)',
          transform: 'translateX(-50%)',
          top: '82.82px',
          fontFamily: F,
          fontWeight: 400,
          fontSize: '28.231px',
          lineHeight: 'normal',
          color: '#ffffff',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          pointerEvents: 'all',
          width: '160.077px',
          textAlign: 'center',
        }}
      >
        matches
      </Link>

      {/* ladder — left: calc(52%+92.91px) translateX(-50%) top: 82px  28.231px  white */}
      <Link
        to="/leaderboard"
        style={{
          position: 'absolute',
          left: 'calc(52% + 92.91px)',
          transform: 'translateX(-50%)',
          top: '82px',
          fontFamily: F,
          fontWeight: 400,
          fontSize: '28.231px',
          lineHeight: 'normal',
          color: '#ffffff',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          pointerEvents: 'all',
          width: '116.056px',
          textAlign: 'center',
        }}
      >
        ladder
      </Link>

      {/* highlights — left: calc(60%+127.32px) translateX(-50%) top: 82px  28.231px  white */}
      <Link
        to="/highlights"
        style={{
          position: 'absolute',
          left: 'calc(60% + 127.32px)',
          transform: 'translateX(-50%)',
          top: '82px',
          fontFamily: F,
          fontWeight: 400,
          fontSize: '28.231px',
          lineHeight: 'normal',
          color: '#ffffff',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          pointerEvents: 'all',
          width: '170.082px',
          textAlign: 'center',
        }}
      >
        highlights
      </Link>

      {/* Twitter/X — left: calc(76%+48.8px) top: 75px  50×50  rounded-54px */}
      <a
        href="https://x.com/oleboytokens"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute',
          left: 'calc(76% + 48.8px)',
          top: '75px',
          width: '50px',
          height: '50px',
          borderRadius: '54px',
          overflow: 'hidden',
          pointerEvents: 'all',
          display: 'block',
        }}
      >
        <img
          src={A_TWITTER}
          alt="X/Twitter"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '54px',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '54px', boxShadow: 'inset 0px -3px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.25)' }} />
      </a>

      {/* TikTok — left: calc(80%+32.77px) top: 75px  50×50  rounded-157px */}
      <a
        href="https://www.tiktok.com/@oleboytokens"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute',
          left: 'calc(80% + 32.77px)',
          top: '75px',
          width: '50px',
          height: '50px',
          borderRadius: '157px',
          overflow: 'hidden',
          pointerEvents: 'all',
          display: 'block',
        }}
      >
        <img
          src={A_TIKTOK}
          alt="TikTok"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '157px',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, borderRadius: '157px', boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.25)' }} />
      </a>

      {/* Discord Ellipse bg — left: calc(84%+16.74px) top: 75px  50×50 */}
      <a
        href="https://discord.gg/2XVffNDPAE"
        target="_blank"
        rel="noopener noreferrer"
        style={{ position: 'absolute', left: 'calc(84% + 16.74px)', top: '75px', width: '50px', height: '50px', pointerEvents: 'all', display: 'block' }}
      >
        <img src={A_ELLIPSE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </a>

      {/* Discord Icon — left: calc(84%+28.28px) top: 86.54px  27.692×27.692px */}
      <div
        style={{
          position: 'absolute',
          left: 'calc(84% + 28.28px)',
          top: '86.54px',
          width: '27.692px',
          height: '27.692px',
          pointerEvents: 'none',
        }}
      >
        <img src={A_DS_NAV} alt="Discord" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </div>
    </nav>
  );
}
