/**
 * NavbarFigma — pixel-perfect replica of the Figma navbar.
 *
 * Figma specs (NavBar group: x=194 y=55 w=1532 h=91):
 *   Bar:    semi-transparent dark (#04080f at 58%), rounded pill (45.5px),
 *           inner shadows: inset 0px -9px 9.2px rgba(0,0,0,0.25), inset 0px 4px 4px rgba(255,255,255,0.21)
 *   Logo:   bolt SVG (66×55) — white double bolt
 *   Pages:  MEET OBT (#ff1654 black weight 36px), matches/ladder/highlights (white 30px normal)
 *   Icons:  X (50px round), TikTok (50px round), Discord (50px purple circle)
 */

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
        {/* Bar background SVG */}
        <img
          src="/figma-assets/9-139.svg"
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
          <div
            style={{
              flexShrink: 0,
              filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.25))',
              cursor: 'pointer',
            }}
          >
            <img
              src="/figma-assets/9-143.svg"
              alt="OleBoy Logo"
              style={{ width: '65px', height: '55px' }}
            />
          </div>

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
            <span
              style={{
                fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                fontWeight: 900,
                fontSize: '36px',
                lineHeight: 1,
                color: '#ff1654',
                cursor: 'pointer',
              }}
            >
              MEET OBT
            </span>
            <span
              style={{
                fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                fontWeight: 400,
                fontSize: '30px',
                lineHeight: 1,
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              matches
            </span>
            <span
              style={{
                fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                fontWeight: 400,
                fontSize: '30px',
                lineHeight: 1,
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              ladder
            </span>
            <span
              style={{
                fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
                fontWeight: 400,
                fontSize: '30px',
                lineHeight: 1,
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              highlights
            </span>
          </div>

          {/* Social icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* X / Twitter */}
            <img
              src="/figma-assets/9-151.webp"
              alt="X/Twitter"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '54px',
                boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.25), inset 0px -3px 4px 0px rgba(0,0,0,0.25)',
                cursor: 'pointer',
              }}
            />
            {/* TikTok */}
            <img
              src="/figma-assets/9-150.webp"
              alt="TikTok"
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '157px',
                boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.25)',
                cursor: 'pointer',
              }}
            />
            {/* Discord */}
            <div
              style={{
                position: 'relative',
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: '#3B28CC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.25), inset 0px -3px 4px 0px rgba(0,0,0,0.25)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.133 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
