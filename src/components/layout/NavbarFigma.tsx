/**
 * NavbarFigma — Pill-shaped navbar with glassmorphism
 * Based on Figma node 41:128
 */

import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const F = "'Base Neue Trial', 'Base Neue', sans-serif";

const A_LOGO    = '/figma-assets/figma-logo.svg';
const A_TWITTER = '/figma-assets/figma-twitter-x.png';
const A_TIKTOK  = '/figma-assets/figma-tiktok.png';
const A_ELLIPSE = '/figma-assets/figma-ellipse.svg';
const A_DS_NAV  = '/figma-assets/figma-ds-icon-nav.png';

export function NavbarFigma() {
  const { profile } = useAuth();
  const avatarUrl = profile?.discord_avatar_url || profile?.avatar_url || null;

  return (
    <nav
      style={{
        position: 'fixed',
        top: '55px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(1532px, calc(100% - 100px))',
        height: '91px',
        zIndex: 50,
        borderRadius: '50px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(10, 10, 15, 0.8)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 40px',
      }}
    >
      {/* Logo */}
      <Link
        to="/"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '65px',
          height: '55px',
          flexShrink: 0,
        }}
      >
        <div style={{ transform: 'rotate(89.78deg)', flexShrink: 0 }}>
          <img src={A_LOGO} alt="OleBoy" style={{ display: 'block', width: '55px', height: '65px' }} />
        </div>
      </Link>

      {/* Nav Links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
        <Link
          to="/"
          style={{
            fontFamily: F,
            fontWeight: 900,
            fontStyle: 'italic',
            fontSize: '33.878px',
            lineHeight: 'normal',
            color: '#ff1654',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          MEET OBT
        </Link>
        <Link
          to="/matches"
          style={{
            fontFamily: F,
            fontWeight: 400,
            fontSize: '28.231px',
            lineHeight: 'normal',
            color: '#ffffff',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          matches
        </Link>
        <Link
          to="/leaderboard"
          style={{
            fontFamily: F,
            fontWeight: 400,
            fontSize: '28.231px',
            lineHeight: 'normal',
            color: '#ffffff',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          ladder
        </Link>
        <Link
          to="/highlights"
          style={{
            fontFamily: F,
            fontWeight: 400,
            fontSize: '28.231px',
            lineHeight: 'normal',
            color: '#ffffff',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          highlights
        </Link>
      </div>

      {/* Social Icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Twitter/X */}
        <a
          href="https://x.com/oleboytokens"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '54px',
            overflow: 'hidden',
            display: 'block',
            position: 'relative',
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

        {/* TikTok */}
        <a
          href="https://www.tiktok.com/@oleboytokens"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: '50px',
            height: '50px',
            borderRadius: '157px',
            overflow: 'hidden',
            display: 'block',
            position: 'relative',
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

        {/* Discord */}
        <a
          href="https://discord.gg/2XVffNDPAE"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: '50px',
            height: '50px',
            display: 'block',
            position: 'relative',
          }}
        >
          <img src={A_ELLIPSE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          <img
            src={A_DS_NAV}
            alt="Discord"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '27.692px',
              height: '27.692px',
            }}
          />
        </a>

        {/* Discord PFP — shown when logged in */}
        {avatarUrl && (
          <img
            src={avatarUrl}
            alt="Profile"
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid rgba(255,22,84,0.6)',
              flexShrink: 0,
            }}
          />
        )}
      </div>
    </nav>
  );
}
