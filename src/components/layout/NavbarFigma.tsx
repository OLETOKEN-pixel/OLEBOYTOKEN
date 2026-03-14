import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

/**
 * NavbarFigma — pixel-perfect replica of the Figma navbar.
 *
 * Figma specs (NavBar group: x=194 y=55 w=1532 h=91):
 *   Bar:    fill #f7fff7, shadow 0px 4px 4px rgba(12,12,13,0.05) + 0px 16px 16px rgba(12,12,13,0.10)
 *   Logo:   "O" + bolt SVG (33×65 white) + "B" — 48px/900
 *   Pages:  MEET OBT (lime italic), play / community / leader (white 30px/700)
 *   Icons:  X, TikTok, Discord — 50×50px circles
 */

const FONT: React.CSSProperties = {
  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
};

/** Logo bolt — Vector 17 (id=1:191): x=282 y=68 w=33 h=65, fill #ffffff */
function LogoBolt() {
  return (
    <svg
      width="33"
      height="65"
      viewBox="0 0 33 65"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 27.4918L10.3654 0L31.0299 0L23.8881 15.8779L16.0769 17.2623L33 17.2623L0 65L10.3654 28.9836L16.0769 27.4918L0 27.4918Z"
        fill="white"
      />
    </svg>
  );
}

/** X / Twitter icon */
function XIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

/** TikTok icon */
function TikTokIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  );
}

/** Discord icon */
function DiscordIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.133 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

export function NavbarFigma() {
  const { user } = useAuth();

  return (
    <nav
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: 'flex',
        justifyContent: 'center',
        padding: '55px 194px 0',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: '1532px',
          height: '91px',
          background: '#f7fff7',
          borderRadius: '12px',
          boxShadow: '0px 4px 4px rgba(12,12,13,0.05), 0px 16px 16px rgba(12,12,13,0.10)',
          padding: '0 37px',
          pointerEvents: 'all',
        }}
      >
        {/* ── Logo: O + bolt + B ── */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            textDecoration: 'none',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              ...FONT,
              fontWeight: 900,
              fontSize: '48px',
              lineHeight: 1,
              color: '#04080f',
            }}
          >
            O
          </span>
          <LogoBolt />
          <span
            style={{
              ...FONT,
              fontWeight: 900,
              fontSize: '48px',
              lineHeight: 1,
              color: '#04080f',
            }}
          >
            B
          </span>
        </Link>

        {/* ── Nav links ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
          {/* MEET OBT — lime italic */}
          <Link
            to="/"
            style={{
              ...FONT,
              fontWeight: 700,
              fontSize: '30px',
              lineHeight: 1.2,
              color: '#d8ff16',
              fontStyle: 'italic',
              textDecoration: 'none',
            }}
          >
            MEET OBT
          </Link>

          <Link
            to="/matches"
            style={{
              ...FONT,
              fontWeight: 700,
              fontSize: '30px',
              lineHeight: 1.2,
              color: '#04080f',
              textDecoration: 'none',
            }}
          >
            play
          </Link>

          <Link
            to="/leaderboard"
            style={{
              ...FONT,
              fontWeight: 700,
              fontSize: '30px',
              lineHeight: 1.2,
              color: '#04080f',
              textDecoration: 'none',
            }}
          >
            community
          </Link>

          <Link
            to="/leaderboard"
            style={{
              ...FONT,
              fontWeight: 700,
              fontSize: '30px',
              lineHeight: 1.2,
              color: '#04080f',
              textDecoration: 'none',
            }}
          >
            leader
          </Link>
        </div>

        {/* ── Social icons ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* X */}
          <a
            href="https://x.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: '#04080f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            <XIcon />
          </a>

          {/* TikTok */}
          <a
            href="https://tiktok.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: '#04080f',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            <TikTokIcon />
          </a>

          {/* Discord */}
          <a
            href="https://discord.gg"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              background: '#3b28cc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              textDecoration: 'none',
            }}
          >
            <DiscordIcon />
          </a>

          {/* LOGIN — shown only when not logged in */}
          {!user && (
            <Link
              to="/auth"
              style={{
                ...FONT,
                fontWeight: 700,
                fontSize: '16px',
                color: '#ffffff',
                background: '#3b28cc',
                borderRadius: '999px',
                padding: '10px 24px',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              LOGIN
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
