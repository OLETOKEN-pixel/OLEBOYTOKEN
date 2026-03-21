/**
 * NavbarFigma — pixel-perfect replica of the Figma navbar.
 *
 * Figma specs (NavBar group: x=194 y=55 w=1532 h=91):
 *   Bar:    semi-transparent pill with inner shadows
 *   Logo:   bolt SVG (65×55)
 *   Pages:  MEET OBT (#ff1654 black weight 36px), matches/ladder/highlights (white 28px)
 *   Icons:  X/Twitter (50px round), TikTok (50px round), Discord (50px purple circle)
 */

import { Link } from 'react-router-dom';

const BASE_FONT = "'Base Neue Trial', 'Base Neue', sans-serif";

export function NavbarFigma() {
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
        padding: '55px 10.1% 0',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          maxWidth: '1532px',
          height: '91px',
          pointerEvents: 'all',
          overflow: 'hidden',
          borderRadius: '45.5px',
        }}
      >
        {/* Bar background */}
        <img
          src="/figma-assets/figma-bar.svg"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            zIndex: 0,
          }}
        />

        {/* Content overlay */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            padding: '0 42px',
          }}
        >
          {/* Logo bolt */}
          <Link
            to="/"
            style={{
              flexShrink: 0,
              filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.25))',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <img
              src="/figma-assets/figma-logo.svg"
              alt="OleBoy Logo"
              style={{ width: '65px', height: '55px' }}
            />
          </Link>

          {/* Nav links */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '48px',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Link
              to="/"
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 900,
                fontStyle: 'italic',
                fontSize: '34px',
                lineHeight: 1,
                color: '#ff1654',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              MEET OBT
            </Link>
            <Link
              to="/matches"
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 400,
                fontSize: '28px',
                lineHeight: 1,
                color: '#ffffff',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              matches
            </Link>
            <Link
              to="/leaderboard"
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 400,
                fontSize: '28px',
                lineHeight: 1,
                color: '#ffffff',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              ladder
            </Link>
            <Link
              to="/highlights"
              style={{
                fontFamily: BASE_FONT,
                fontWeight: 400,
                fontSize: '28px',
                lineHeight: 1,
                color: '#ffffff',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
            >
              highlights
            </Link>
          </div>

          {/* Social icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* X / Twitter */}
            <a href="https://x.com/oleboytokens" target="_blank" rel="noopener noreferrer">
              <img
                src="/figma-assets/figma-twitter-x.png"
                alt="X/Twitter"
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '54px',
                  boxShadow:
                    'inset 0px 4px 4px 0px rgba(255,255,255,0.25), inset 0px -3px 4px 0px rgba(0,0,0,0.25)',
                  cursor: 'pointer',
                  display: 'block',
                  objectFit: 'cover',
                }}
              />
            </a>
            {/* TikTok */}
            <a href="https://www.tiktok.com/@oleboytokens" target="_blank" rel="noopener noreferrer">
              <img
                src="/figma-assets/figma-tiktok.png"
                alt="TikTok"
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '157px',
                  boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.25)',
                  cursor: 'pointer',
                  display: 'block',
                  objectFit: 'cover',
                }}
              />
            </a>
            {/* Discord — ellipse background + DS icon */}
            <a
              href="https://discord.gg/2XVffNDPAE"
              target="_blank"
              rel="noopener noreferrer"
              style={{ position: 'relative', display: 'block', width: '50px', height: '50px', flexShrink: 0 }}
            >
              <img
                src="/figma-assets/figma-ellipse.svg"
                alt=""
                aria-hidden="true"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              />
              <img
                src="/figma-assets/figma-ds-icon.png"
                alt="Discord"
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '27.7px',
                  height: '27.7px',
                }}
              />
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
