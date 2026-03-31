/**
 * MatchCard — Reusable match card component
 * Based on Figma node 205:274 (card "Tab" inside MATCHES frame)
 *
 * Card: 300x400px, bg #272727, border 1px #FF1654 inside, radius 12px
 */

interface MatchCardProps {
  title: string;
  firstTo: string;
  platform: string;
  entryFee: string;
  prize: string;
  expiresIn: string;
  onAccept?: () => void;
}

const F = "'Base Neue Trial', 'Base Neue', sans-serif";

/* Small pink decorative triangles next to "First to" */
function Triangles() {
  return (
    <svg width="19" height="28" viewBox="0 0 19 28" fill="none" style={{ flexShrink: 0 }}>
      <polygon points="5,14 13,25 3,22" fill="#FF1654" />
      <polygon points="12,9 17,12 14,11" fill="#FF1654" />
      <polygon points="11,8 12,9 11,9" fill="#FF1654" />
      <polygon points="4,13 8,14 5,12" fill="#FF1654" />
      <polygon points="3,3 11,12 1,9" fill="#FF1654" />
    </svg>
  );
}

export function MatchCard({ title, firstTo, platform, entryFee, prize, expiresIn, onAccept }: MatchCardProps) {
  return (
    <div
      style={{
        width: '300px',
        height: '400px',
        background: '#272727',
        border: '1px solid #FF1654',
        borderRadius: '12px',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Header: title + divider */}
      <div style={{ position: 'absolute', top: '25px', left: '20px', width: '261px' }}>
        <div
          style={{
            fontFamily: "'Base_Neue_Trial-WideBlack', " + F,
            fontWeight: 900,
            fontSize: '32px',
            lineHeight: '38px',
            color: '#ffffff',
            whiteSpace: 'nowrap',
            textAlign: 'center',
          }}
        >
          {title}
        </div>
        <div
          style={{
            marginTop: '14px',
            width: '259px',
            height: '1px',
            background: '#E6E6E6',
          }}
        />
      </div>

      {/* First to */}
      <div style={{ position: 'absolute', top: '107px', left: '38px', display: 'flex', gap: '0px' }}>
        <div>
          <div
            style={{
              fontFamily: "'Base_Neue_Trial-Regular', " + F,
              fontWeight: 400,
              fontSize: '20px',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            First to
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '4px' }}>
            <Triangles />
            <span
              style={{
                fontFamily: "'Base_Neue_Trial-Bold', " + F,
                fontWeight: 700,
                fontSize: '30px',
                lineHeight: '36px',
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
            >
              {firstTo}
            </span>
          </div>
        </div>
      </div>

      {/* Platform */}
      <div style={{ position: 'absolute', top: '107px', left: '170px', textAlign: 'center' }}>
        <div
          style={{
            fontFamily: "'Base_Neue_Trial-Regular', " + F,
            fontWeight: 400,
            fontSize: '20px',
            color: '#ffffff',
          }}
        >
          Platform
        </div>
        <div
          style={{
            fontFamily: "'Base_Neue_Trial-Bold', " + F,
            fontWeight: 700,
            fontSize: '24px',
            lineHeight: '29px',
            color: '#ffffff',
            marginTop: '3px',
          }}
        >
          {platform}
        </div>
      </div>

      {/* Money: Entry fee + Prize */}
      <div style={{ position: 'absolute', top: '187px', left: '38px', width: '232px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span
            style={{
              fontFamily: "'Base_Neue_Trial-Regular', " + F,
              fontWeight: 400,
              fontSize: '20px',
              color: '#ffffff',
            }}
          >
            Entry fee
          </span>
          <span
            style={{
              fontFamily: "'Base_Neue_Trial-Regular', " + F,
              fontWeight: 400,
              fontSize: '20px',
              color: '#ffffff',
              marginRight: '38px',
            }}
          >
            Prize
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
          {/* Pink circle */}
          <div
            style={{
              width: '19px',
              height: '19px',
              borderRadius: '50%',
              background: '#FF1654',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'Base_Neue_Trial-WideBlack', " + F,
              fontWeight: 900,
              fontSize: '24px',
              lineHeight: '29px',
              color: '#ffffff',
            }}
          >
            {entryFee}
          </span>

          {/* Arrow */}
          <svg width="16" height="11" viewBox="0 0 16 11" fill="none" style={{ flexShrink: 0, margin: '0 4px' }}>
            <path d="M10 0.5L15 5.5L10 10.5" stroke="white" strokeWidth="1.5" />
            <line x1="0" y1="5.5" x2="14" y2="5.5" stroke="white" strokeWidth="1.5" />
          </svg>

          {/* Prize icon (pink diamond/token) */}
          <svg width="23" height="19" viewBox="0 0 23 19" fill="#FF1654" style={{ flexShrink: 0 }}>
            <path d="M11.5 0L23 9.5L11.5 19L0 9.5L11.5 0Z" />
          </svg>
          <span
            style={{
              fontFamily: "'Base_Neue_Trial-WideBlack', " + F,
              fontWeight: 900,
              fontSize: '24px',
              lineHeight: '29px',
              color: '#ffffff',
            }}
          >
            {prize}
          </span>
        </div>
      </div>

      {/* Expires in */}
      <div style={{ position: 'absolute', top: '261px', left: '38px' }}>
        <div
          style={{
            fontFamily: "'Base_Neue_Trial-Regular', " + F,
            fontWeight: 400,
            fontSize: '20px',
            color: '#ffffff',
          }}
        >
          Expires in
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
          <div
            style={{
              width: '19px',
              height: '19px',
              borderRadius: '50%',
              background: '#FF1654',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "'Base_Neue_Trial-WideBlack', " + F,
              fontWeight: 900,
              fontSize: '24px',
              lineHeight: '29px',
              color: '#ffffff',
            }}
          >
            {expiresIn}
          </span>
        </div>
      </div>

      {/* Accept token button */}
      <button
        onClick={onAccept}
        style={{
          position: 'absolute',
          top: '335px',
          left: '26px',
          width: '247px',
          height: '44px',
          background: '#FF1654',
          borderRadius: '8px',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Base_Neue_Trial-WideBlack', " + F,
            fontWeight: 900,
            fontSize: '20px',
            lineHeight: '24px',
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          Accept token
        </span>
      </button>
    </div>
  );
}
