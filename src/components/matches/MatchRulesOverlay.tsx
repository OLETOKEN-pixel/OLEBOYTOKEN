import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { GENERAL_MATCH_RULES, getModeRules } from '@/lib/matchRules';
import type { GameMode } from '@/types';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_BOLD_OBLIQUE = "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK = "'Base_Neue_Trial:Expanded_Black', 'Base Neue Trial-ExpandedBlack', 'Base Neue Trial', sans-serif";
const TITLE_TRIANGLES = '/figma-assets/match-ready/lobby-title-triangles.svg';

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
  width: 536,
  height: 476,
  transformOrigin: 'center center',
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

function RuleList({
  rules,
  bulletColor = '#ff1654',
  compact = false,
}: {
  rules: string[];
  bulletColor?: string;
  compact?: boolean;
}) {
  return (
    <ul
      style={{
        margin: 0,
        padding: 0,
        display: 'grid',
        gap: compact ? 7 : 10,
        listStyle: 'none',
      }}
    >
      {rules.map((rule) => (
        <li
          key={rule}
          style={{
            display: 'grid',
            gridTemplateColumns: '12px 1fr',
            columnGap: 11,
            alignItems: 'start',
            fontFamily: FONT_REGULAR,
            fontSize: compact ? 14 : 15,
            lineHeight: compact ? '16px' : '18px',
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
  const [frameScale, setFrameScale] = useState(1);
  const [activeTab, setActiveTab] = useState<'mode' | 'general'>('mode');

  useEffect(() => {
    if (!open || typeof window === 'undefined') return;

    setActiveTab('mode');

    const updateScale = () => {
      setFrameScale(Math.max(Math.min((window.innerWidth - 32) / 536, (window.innerHeight - 32) / 476, 1), 0.6));
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') return null;

  const activeRules = activeTab === 'mode' ? modeRules.rules : GENERAL_MATCH_RULES.rules;
  const activeTitle = activeTab === 'mode' ? modeRules.rulesTitle : GENERAL_MATCH_RULES.title;
  const isGeneralTab = activeTab === 'general';

  const overlay = (
    <div
      data-testid="match-rules-overlay"
      style={overlayStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div style={{ ...frameWrapStyle, transform: `translate(-50%, -50%) scale(${frameScale})` }}>
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="match-rules-title"
          style={panelStyle}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div
            data-testid="match-rules-content"
            style={{
              height: '100%',
              overflow: 'hidden',
              padding: '18px 56px 42px',
              boxSizing: 'border-box',
            }}
          >
            <h2
              id="match-rules-title"
              style={{
                margin: 0,
                fontFamily: FONT_EXPANDED_BLACK,
                fontSize: 42,
                lineHeight: '50px',
                textAlign: 'center',
                color: '#ffffff',
              }}
            >
              MATCH RULES
            </h2>

            <div style={{ width: 363, maxWidth: '100%', height: 2, margin: '8px auto 0', background: '#d9d9d9' }} />

            <div
              role="tablist"
              aria-label="Match rule sections"
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 106,
                marginTop: 60,
              }}
            >
              {[
                { key: 'mode' as const, label: modeRules.title },
                { key: 'general' as const, label: 'GENERAL' },
              ].map((tab) => {
                const selected = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActiveTab(tab.key)}
                    style={{
                      position: 'relative',
                      padding: 0,
                      border: 0,
                      background: 'transparent',
                      color: '#ffffff',
                      fontFamily: selected ? FONT_BOLD : FONT_REGULAR,
                      fontSize: 18,
                      lineHeight: '22px',
                      cursor: 'pointer',
                    }}
                  >
                    {tab.label}
                    {selected && (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          top: 27,
                          height: 3,
                          background: '#ff1654',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            <section
              aria-label={activeTitle}
              style={{
                position: 'relative',
                marginTop: 43,
                minHeight: 220,
                paddingLeft: 0,
                boxSizing: 'border-box',
              }}
            >
              <img
                src={TITLE_TRIANGLES}
                alt=""
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 1,
                  top: -25,
                  width: 26,
                  height: 39,
                  objectFit: 'contain',
                }}
              />
              <h3
                style={{
                  margin: '0 0 6px',
                  paddingLeft: 29,
                  fontFamily: FONT_EXPANDED_BOLD,
                  fontSize: 31,
                  lineHeight: '37px',
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                {activeTitle}
              </h3>

              {activeTab === 'mode' && (
                <p
                  style={{
                    margin: '0 0 13px',
                    fontFamily: FONT_BOLD_OBLIQUE,
                    fontSize: 16,
                    lineHeight: '19px',
                    color: 'rgba(255,255,255,0.86)',
                  }}
                >
                  Map Code: <span style={{ color: '#ff1654' }}>{modeRules.mapCode}</span> ({modeRules.mapName})
                </p>
              )}

              <RuleList rules={activeRules} bulletColor={isGeneralTab ? '#d8ff16' : '#ff1654'} compact={isGeneralTab} />
            </section>
          </div>
        </section>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
