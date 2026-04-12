/**
 * NavbarFigma — Pill-shaped navbar with glassmorphism
 * Based on Figma node 41:128
 */

import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { getCurrentPathWithQueryAndHash, startDiscordAuth } from '@/lib/oauth';

const F = "'Base Neue Trial', 'Base Neue', sans-serif";

const A_LOGO    = '/figma-assets/figma-logo.svg';
const A_TWITTER = '/figma-assets/figma-twitter-x.png';
const A_TIKTOK  = '/figma-assets/figma-tiktok.png';
const A_ELLIPSE = '/figma-assets/figma-ellipse.svg';
const A_DS_NAV  = '/figma-assets/figma-ds-icon-nav.png';

export function NavbarFigma() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <NavbarFigmaMobile />;
  }

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
      </div>
    </nav>
  );
}

function NavbarFigmaMobile() {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignUp = useCallback(async () => {
    try {
      await startDiscordAuth(getCurrentPathWithQueryAndHash());
    } catch (error) {
      console.error('Discord sign-up error:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to start Discord login. Please try again.');
    }
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <nav
      data-mobile-navbar="guest"
      aria-label="Guest mobile navigation"
      style={{
        position: 'fixed',
        top: '14px',
        left: '12px',
        right: '12px',
        width: 'auto',
        minHeight: '64px',
        zIndex: 80,
        borderRadius: '8px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(10, 10, 15, 0.86)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxShadow: '0 12px 38px rgba(0, 0, 0, 0.34)',
        fontFamily: F,
      }}
    >
      <div
        style={{
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '0 10px',
        }}
      >
        <Link
          to="/"
          aria-label="OleBoy home"
          onClick={closeMenu}
          style={{
            width: '45px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ transform: 'rotate(89.78deg)', flexShrink: 0 }}>
            <img src={A_LOGO} alt="OleBoy" style={{ display: 'block', width: '42px', height: '50px' }} />
          </div>
        </Link>

        <button
          onClick={handleSignUp}
          style={{
            height: '42px',
            minWidth: '118px',
            marginLeft: 'auto',
            border: 'none',
            borderRadius: '8px',
            background: '#3b28cc',
            boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.15), inset 0px -3px 4px 0px rgba(0,0,0,0.25)',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '7px',
            padding: '0 10px',
            fontFamily: F,
            fontWeight: 900,
            fontSize: '20px',
            lineHeight: '22px',
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}
        >
          SIGN UP!
          <img src={A_DS_NAV} alt="" aria-hidden style={{ width: '23px', height: '23px' }} />
        </button>

        <button
          type="button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          style={{
            width: '42px',
            height: '42px',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.04)',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <span aria-hidden="true" style={{ display: 'grid', gap: '5px', width: '18px' }}>
            <span style={{ display: 'block', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
            <span style={{ display: 'block', height: '2px', background: '#ff1654', borderRadius: '2px' }} />
            <span style={{ display: 'block', height: '2px', background: '#ffffff', borderRadius: '2px' }} />
          </span>
        </button>
      </div>

      {menuOpen ? (
        <div
          data-mobile-navbar-menu="guest"
          style={{
            display: 'grid',
            gap: '18px',
            padding: '8px 14px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <div style={{ display: 'grid', gap: '12px' }}>
            <Link
              to="/"
              onClick={closeMenu}
              style={{
                fontFamily: F,
                fontWeight: 900,
                fontStyle: 'italic',
                fontSize: '26px',
                lineHeight: '30px',
                color: '#ff1654',
                textDecoration: 'none',
                letterSpacing: 0,
              }}
            >
              MEET OBT
            </Link>
            <Link to="/matches" onClick={closeMenu} style={mobileMenuLinkStyle}>
              matches
            </Link>
            <Link to="/leaderboard" onClick={closeMenu} style={mobileMenuLinkStyle}>
              ladder
            </Link>
            <Link to="/highlights" onClick={closeMenu} style={mobileMenuLinkStyle}>
              highlights
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MobileSocialLink href="https://x.com/oleboytokens" label="X/Twitter" image={A_TWITTER} />
            <MobileSocialLink href="https://www.tiktok.com/@oleboytokens" label="TikTok" image={A_TIKTOK} />
            <a
              href="https://discord.gg/2XVffNDPAE"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Discord"
              style={{ width: '42px', height: '42px', display: 'block', position: 'relative' }}
            >
              <img src={A_ELLIPSE} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
              <img
                src={A_DS_NAV}
                alt=""
                aria-hidden
                style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', width: '23px', height: '23px' }}
              />
            </a>
          </div>
        </div>
      ) : null}
    </nav>
  );
}

const mobileMenuLinkStyle = {
  fontFamily: F,
  fontWeight: 400,
  fontSize: '24px',
  lineHeight: '28px',
  color: '#ffffff',
  textDecoration: 'none',
  letterSpacing: 0,
} as const;

function MobileSocialLink({ href, label, image }: { href: string; label: string; image: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={{
        width: '42px',
        height: '42px',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'block',
        position: 'relative',
      }}
    >
      <img src={image} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.22)' }} />
    </a>
  );
}
