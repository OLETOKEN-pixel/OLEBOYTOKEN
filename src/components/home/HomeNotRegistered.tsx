import { Link } from 'react-router-dom';

/**
 * HomeNotRegistered — pixel-perfect replica of the Figma "not registered home" frame.
 * Frame: 1920×2949px — 3 sections stacked vertically
 *
 * Section 1 (First page):  y=0,    h=955  — hero
 * Section 2 (Second page): y=955,  h=955  — RANK UP!
 * Section 3 (Third page):  y=1910, h=1039 — players
 */

const FONT: React.CSSProperties = {
  fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
};

function DiscordSVG() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.114 18.1.133 18.113a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function ArrowDown() {
  return (
    <svg width="15" height="19" viewBox="0 0 15 19" fill="none">
      <path d="M7.5 0V15M7.5 15L1 9M7.5 15L14 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HomeNotRegistered() {
  return (
    <div style={{ background: '#04080f', width: '100%', overflowX: 'hidden' }}>

      {/* ══════════════════════════════════════════════════════
          SECTION 1 — HERO (First page: 1920×955)
          ══════════════════════════════════════════════════════ */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          minHeight: '955px',
          background: '#04080f',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Left bolt — Vector 17 (id=1:184): x=-103 y=430 w=546 h=567 in 1920px frame */}
        <svg
          viewBox="0 0 538 386"
          fill="none"
          style={{
            position: 'absolute',
            left: '-5.4vw',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '28.4vw',
            height: 'auto',
            pointerEvents: 'none',
          }}
        >
          <path d="M308.703 247.49L93.6588 385.363L1.10685e-06 298.589L129.435 223.812L173.301 247.477L96.5994 176.414L538 4.64722e-06L270.843 194.12L235.836 179.98L308.703 247.49Z" fill="#FF1654" />
        </svg>

        {/* Right bolt — Vector 18 (id=1:185): x=1478 y=430 w=546 h=567 in 1920px frame */}
        <svg
          viewBox="0 0 538 386"
          fill="none"
          style={{
            position: 'absolute',
            right: '-5.4vw',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '28.4vw',
            height: 'auto',
            pointerEvents: 'none',
          }}
        >
          <path d="M229.297 247.49L444.341 385.363L538 298.589L408.565 223.812L364.699 247.477L441.401 176.414L5.38553e-05 4.64722e-06L267.157 194.12L302.164 179.98L229.297 247.49Z" fill="#FF1654" />
        </svg>

        {/* Center content */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          {/* OLEBOY — 128px/900, x=615 y=388 w=690 h=143 in 1920px frame */}
          <h1
            style={{
              ...FONT,
              fontWeight: 900,
              fontSize: 'clamp(72px, 6.7vw, 128px)',
              lineHeight: 1,
              color: '#ffffff',
              margin: '0 0 24px 0',
              letterSpacing: '-0.01em',
            }}
          >
            OLEBOY
          </h1>

          {/* Subtitle — 32px/400, x=611 y=531 w=686 h=70 */}
          <p
            style={{
              ...FONT,
              fontWeight: 400,
              fontSize: 'clamp(18px, 1.67vw, 32px)',
              lineHeight: 1.35,
              color: '#ffffff',
              margin: '0 0 48px 0',
            }}
          >
            Stake tokens. Win Matches.<br />
            Claim your victory.
          </p>

          {/* DS Button — 277×71, fill #3b28cc, rounded-full */}
          <Link
            to="/auth"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              width: '277px',
              height: '71px',
              background: '#3b28cc',
              borderRadius: '999px',
              textDecoration: 'none',
              marginBottom: '28px',
            }}
          >
            <span
              style={{
                ...FONT,
                fontWeight: 900,
                fontSize: '26px',
                color: '#f7fff7',
                letterSpacing: '0.02em',
              }}
            >
              SIGN UP!
            </span>
            <DiscordSVG />
          </Link>

          {/* Know More Message — arrow + text + arrow */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <ArrowDown />
            <span
              style={{
                ...FONT,
                fontWeight: 400,
                fontSize: '16px',
                color: '#ffffff',
                letterSpacing: '0.05em',
              }}
            >
              Know More
            </span>
            <ArrowDown />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 2 — RANK UP (Second page: 1920×955)
          Red thingy: left=3 top=138(relative) w=calc(100%-3px) h=796, fill #ff1654
          RANK UP!: x=176 y=129(relative) 96px/900 white
          Subtitle: x=195 y=315(relative)
          Animation: x=1164 y=467(relative) 562×269 #d9d9d9
          ══════════════════════════════════════════════════════ */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          minHeight: '955px',
          background: '#04080f',
          overflow: 'hidden',
        }}
      >
        {/* Red thingy */}
        <div
          style={{
            position: 'absolute',
            left: '3px',
            top: '138px',
            width: 'calc(100% - 3px)',
            height: '796px',
            background: '#ff1654',
          }}
        />

        {/* RANK UP! */}
        <h2
          style={{
            ...FONT,
            fontWeight: 900,
            fontSize: 'clamp(48px, 5vw, 96px)',
            lineHeight: 1,
            color: '#ffffff',
            margin: 0,
            position: 'absolute',
            left: '176px',
            top: '129px',
          }}
        >
          RANK UP!
        </h2>

        {/* Row: subtitle + placeholder */}
        <div
          style={{
            position: 'absolute',
            left: '195px',
            top: '315px',
            right: '195px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '40px',
          }}
        >
          {/* Left text */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '591px' }}>
            <p
              style={{
                ...FONT,
                fontWeight: 400,
                fontSize: 'clamp(14px, 1.1vw, 20px)',
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              Dominate the leaderboard and claim your legacy.
            </p>
            <Link
              to="/auth"
              style={{
                ...FONT,
                fontWeight: 700,
                fontSize: '18px',
                color: '#ffffff',
                background: '#04080f',
                borderRadius: '999px',
                padding: '14px 32px',
                textDecoration: 'none',
                display: 'inline-block',
                width: 'fit-content',
              }}
            >
              JOIN NOW
            </Link>
          </div>

          {/* Animation placeholder — 562×269, fill #d9d9d9 */}
          <div
            style={{
              width: '562px',
              height: '269px',
              background: '#d9d9d9',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <p
              style={{
                ...FONT,
                fontWeight: 400,
                fontSize: '14px',
                color: '#04080f',
                textAlign: 'center',
                opacity: 0.6,
                margin: 0,
              }}
            >
              immagine leaderboard<br />o<br />piccola animazione (da pagare extra)
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SECTION 3 — THIRD PAGE (1920×1039)
          Purple thingy: top=159(relative) h=796, fill #3b28cc
          "From the players...": x=195 y=355(relative)
          MARV PFP: x=722 y=448(relative) 217×217
          TOM PFP:  x=981 y=448(relative) 217×217
          "...for the players": x=1170 y=721(relative)
          ══════════════════════════════════════════════════════ */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '1039px',
          background: '#04080f',
          overflow: 'hidden',
        }}
      >
        {/* Purple shape */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '159px',
            width: '100%',
            height: '796px',
            background: '#3b28cc',
          }}
        />

        {/* "From the players..." */}
        <p
          style={{
            ...FONT,
            fontWeight: 700,
            fontSize: 'clamp(20px, 1.9vw, 36px)',
            color: '#ffffff',
            margin: 0,
            position: 'absolute',
            left: '195px',
            top: '355px',
          }}
        >
          From the players...
        </p>

        {/* MARV PFP */}
        <img
          src="/figma-assets/marv-pfp.png"
          alt="MARV"
          style={{
            position: 'absolute',
            left: '722px',
            top: '448px',
            width: '217px',
            height: '217px',
            objectFit: 'cover',
          }}
        />

        {/* TOM PFP */}
        <img
          src="/figma-assets/tom-pfp.png"
          alt="TOM"
          style={{
            position: 'absolute',
            left: '981px',
            top: '448px',
            width: '217px',
            height: '217px',
            objectFit: 'cover',
          }}
        />

        {/* "...for the players" */}
        <p
          style={{
            ...FONT,
            fontWeight: 700,
            fontSize: 'clamp(20px, 1.9vw, 36px)',
            color: '#ffffff',
            margin: 0,
            position: 'absolute',
            left: '1170px',
            top: '721px',
          }}
        >
          ...for the players
        </p>
      </section>

    </div>
  );
}
