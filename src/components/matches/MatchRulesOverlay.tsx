import type { CSSProperties } from 'react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GENERAL_MATCH_RULES, getModeRules } from '@/lib/matchRules';
import type { GameMode } from '@/types';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK = "'Base_Neue_Trial:Expanded_Black', 'Base Neue Trial-ExpandedBlack', 'Base Neue Trial', sans-serif";

interface MatchRulesOverlayProps {
  open: boolean;
  mode: GameMode;
  onClose: () => void;
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 90,
  background: 'rgba(15, 4, 4, 0.72)',
};

const frameWrapStyle: CSSProperties = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  width: 903,
  maxWidth: 'calc(100vw - 32px)',
  height: 800,
  maxHeight: 'calc(100vh - 32px)',
  transform: 'translate(-50%, -50%)',
};

const panelStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  borderRadius: 18,
  border: '1.5px solid #ff1654',
  background: '#282828',
  color: '#ffffff',
  boxSizing: 'border-box',
  overflow: 'hidden',
  boxShadow: '0 30px 100px rgba(0,0,0,0.45)',
};

function RuleList({ rules, bulletColor = '#ff1654' }: { rules: string[]; bulletColor?: string }) {
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        display: 'grid',
        gap: 13,
        listStyle: 'none',
      }}
    >
      {rules.map((rule) => (
        <li
          key={rule}
          style={{
            display: 'grid',
            gridTemplateColumns: '12px 1fr',
            columnGap: 13,
            alignItems: 'start',
            fontFamily: FONT_REGULAR,
            fontSize: 20,
            lineHeight: '24px',
            color: 'rgba(255,255,255,0.88)',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 6,
              height: 6,
              marginTop: 9,
              borderRadius: '50%',
              background: bulletColor,
              boxShadow: `0 0 12px ${bulletColor}`,
            }}
          />
          <span>{rule}</span>
        </li>
      ))}
    </ul>
  );
}

export function MatchRulesOverlay({ open, mode, onClose }: MatchRulesOverlayProps) {
  const modeRules = getModeRules(mode);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  const overlay = (
    <div
      data-testid="match-rules-overlay"
      style={overlayStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div style={frameWrapStyle}>
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-rules-title"
          style={panelStyle}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            style={{
              height: '100%',
              overflowY: 'auto',
              padding: '37px 74px 54px',
              boxSizing: 'border-box',
            }}
          >
            <h2
              id="match-rules-title"
              style={{
                margin: 0,
                fontFamily: FONT_EXPANDED_BLACK,
                fontSize: 64,
                lineHeight: '77px',
                textAlign: 'center',
                color: '#ffffff',
              }}
            >
              MATCH RULES
            </h2>

            <div style={{ width: 615, maxWidth: '100%', height: 2, margin: '17px auto 34px', background: '#d9d9d9' }} />

            <section
              aria-label={`${modeRules.rulesTitle} map code`}
              style={{
                borderRadius: 14,
                border: '1px solid rgba(255,22,84,0.72)',
                background: 'rgba(15,4,4,0.43)',
                padding: '22px 28px',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 24,
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontFamily: FONT_EXPANDED_BOLD,
                    fontSize: 38,
                    lineHeight: '46px',
                    color: '#ffffff',
                  }}
                >
                  {modeRules.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontFamily: FONT_BOLD,
                    fontSize: 24,
                    lineHeight: '29px',
                    color: '#ffffff',
                  }}
                >
                  Map Code: <span style={{ color: '#ff1654' }}>{modeRules.mapCode}</span>
                </p>
              </div>
              <p
                style={{
                  margin: '8px 0 0',
                  fontFamily: FONT_REGULAR,
                  fontSize: 20,
                  lineHeight: '24px',
                  color: 'rgba(255,255,255,0.72)',
                }}
              >
                {modeRules.mapName}
              </p>
            </section>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
              <section
                aria-label={modeRules.rulesTitle}
                style={{
                  minHeight: 330,
                  borderRadius: 14,
                  background: 'rgba(15,4,4,0.43)',
                  padding: '24px 25px 28px',
                  boxSizing: 'border-box',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 22px',
                    fontFamily: FONT_EXPANDED_BOLD,
                    fontSize: 32,
                    lineHeight: '38px',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                  }}
                >
                  {modeRules.rulesTitle}
                </h3>
                <RuleList rules={modeRules.rules} />
              </section>

              <section
                aria-label={GENERAL_MATCH_RULES.title}
                style={{
                  minHeight: 330,
                  borderRadius: 14,
                  background: 'rgba(15,4,4,0.43)',
                  padding: '24px 25px 28px',
                  boxSizing: 'border-box',
                }}
              >
                <h3
                  style={{
                    margin: '0 0 22px',
                    fontFamily: FONT_EXPANDED_BOLD,
                    fontSize: 32,
                    lineHeight: '38px',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                  }}
                >
                  {GENERAL_MATCH_RULES.title}
                </h3>
                <RuleList rules={GENERAL_MATCH_RULES.rules} bulletColor="#d8ff16" />
              </section>
            </div>
          </div>
        </section>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
