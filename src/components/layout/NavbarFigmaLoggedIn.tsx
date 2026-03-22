/**
 * NavbarFigmaLoggedIn — Logged-in user navbar
 * Based on Figma node 84:282
 *
 * Different from NavbarFigma (public):
 *  - Nav links: matches, leaderboard, challenges, hls, teams, shop
 *  - Right section: coins, recharge, separator, LVL, PFP (Discord avatar)
 */

import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base Neue Expanded', 'Base Neue Trial', 'Base Neue', sans-serif";

const A_LOGO = '/figma-assets/figma-logo.svg';
// Figma assets for the right section
const A_COIN_CIRCLE = '/figma-assets/b263e5b69c85b19df9c41aec85aebe9fb9be1de4.svg';
const A_RECHARGE_CIRCLE = '/figma-assets/ed0e9082258c15c22aceda00bea77820256739f9.svg';
const A_SEP = '/figma-assets/c8d970b53fe56a074ba321c6a2ea0bc1e6b8d1d7.svg';

const linkStyle: React.CSSProperties = {
  fontFamily: F,
  fontWeight: 400,
  fontSize: '24px',
  lineHeight: 'normal',
  color: '#ffffff',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

export function NavbarFigmaLoggedIn() {
  const { profile, wallet } = useAuth();
  const avatarUrl = profile?.discord_avatar_url || profile?.avatar_url || null;
  const balance = wallet?.balance?.toFixed(2) ?? '0.00';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
        <Link to="/matches" style={linkStyle}>matches</Link>
        <Link to="/leaderboard" style={linkStyle}>leaderboard</Link>
        <Link to="/challenges" style={linkStyle}>challenges</Link>
        <Link to="/highlights" style={linkStyle}>hls</Link>
        <Link to="/teams" style={linkStyle}>teams</Link>
        <Link to="/shop" style={linkStyle}>shop</Link>
      </div>

      {/* Right section — coins, recharge, LVL, PFP */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'rgba(255, 22, 84, 0.2)',
          borderRadius: '23px',
          height: '50px',
          padding: '0 8px 0 16px',
          flexShrink: 0,
        }}
      >
        {/* Coins */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <img
            src={A_COIN_CIRCLE}
            alt=""
            aria-hidden
            style={{ width: '29px', height: '29px' }}
          />
          <span
            style={{
              fontFamily: FE,
              fontWeight: 700,
              fontSize: '24.76px',
              lineHeight: 'normal',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            {balance}
          </span>
        </div>

        {/* Recharge "+" — Figma ellipse asset with "+" overlay */}
        <button
          style={{
            marginLeft: '8px',
            width: '16px',
            height: '16px',
            position: 'relative',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <img
            src={A_RECHARGE_CIRCLE}
            alt=""
            aria-hidden
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
          <span
            style={{
              position: 'relative',
              fontFamily: F,
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: 1,
              color: '#ffffff',
            }}
          >
            +
          </span>
        </button>

        {/* Separator — Figma SVG asset */}
        <div style={{ width: '0.5px', height: '30px', margin: '0 12px', flexShrink: 0 }}>
          <img src={A_SEP} alt="" aria-hidden style={{ display: 'block', width: '100%', height: '100%' }} />
        </div>

        {/* LVL */}
        <span
          style={{
            fontFamily: FE,
            fontWeight: 700,
            fontSize: '24.76px',
            lineHeight: 'normal',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            marginRight: '12px',
          }}
        >
          <span style={{ fontFamily: F, fontWeight: 700, fontSize: '15px' }}>LVL</span>
          <span style={{ fontSize: '24.76px' }}>.</span>
          <span>1</span>
        </span>

        {/* PFP — Discord avatar */}
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Profile"
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b28cc, #6f5cff)',
              flexShrink: 0,
            }}
          />
        )}
      </div>
    </nav>
  );
}
