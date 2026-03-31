/**
 * Matches page — standalone route /matches
 * Based on Figma node 205:271 (MATCHES frame)
 *
 * Frame: 1920x955 (but rendered as scrollable page, not fixed height)
 * Background: #0F0404
 * Title "LIVE MATCHES": Base Neue Trial 900, 80px
 * Filter bar: 4 pill buttons at y~369
 * Cards grid: 300x400 cards starting y~463
 */

import { useEffect, useState } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { MatchCard } from '@/components/matches/MatchCard';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/types';

interface MatchDisplay {
  id: string;
  title: string;
  firstTo: string;
  platform: string;
  entryFee: string;
  prize: string;
  expiresIn: string;
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '00:00';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function matchToDisplay(m: Match): MatchDisplay {
  const fee = m.entry_fee ?? 0;
  const prize = fee * 2 * 0.95;
  return {
    id: m.id,
    title: m.mode === 'Box Fight' ? 'BOX FIGHT' : m.mode === 'Build Fight' ? 'BUILD FIGHT' : m.mode === 'Realistic' ? 'REALISTIC 1V1' : m.mode?.toUpperCase() ?? 'MATCH',
    firstTo: `${m.first_to}+2`,
    platform: m.platform === 'Console' ? 'PS5' : m.platform,
    entryFee: fee.toFixed(2),
    prize: prize.toFixed(2),
    expiresIn: formatTimeLeft(m.expires_at),
  };
}

const F = "'Base Neue Trial', 'Base Neue', sans-serif";

/* Decorative pink triangles cluster (left of title) */
function TitleTriangles() {
  return (
    <svg width="40" height="60" viewBox="0 0 40 60" fill="none" style={{ flexShrink: 0 }}>
      <polygon points="8,28 20,50 2,44" fill="#FF1654" />
      <polygon points="22,16 30,24 26,20" fill="#FF1654" />
      <polygon points="20,14 22,16 20,16" fill="#FF1654" />
      <polygon points="6,26 14,28 8,24" fill="#FF1654" />
      <polygon points="4,6 20,24 0,18" fill="#FF1654" />
    </svg>
  );
}

/* Chevron down arrow for filter dropdowns */
function ChevronDown() {
  return (
    <svg width="12" height="7" viewBox="0 0 12 7" fill="none" style={{ flexShrink: 0 }}>
      <path d="M1 1L6 6L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* Plus icon for CREATE button */
function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
      <line x1="9" y1="0" x2="9" y2="18" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <line x1="0" y1="9" x2="18" y2="9" stroke="white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Matches() {
  const [matches, setMatches] = useState<MatchDisplay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setMatches(data.map(matchToDisplay));
      }
      setLoading(false);
    };
    fetchMatches();
  }, []);

  // Update timers every second
  useEffect(() => {
    if (matches.length === 0) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      if (data) setMatches(data.map(matchToDisplay));
    }, 30000);
    return () => clearInterval(interval);
  }, [matches.length]);

  return (
    <PublicLayout>
      <div
        style={{
          width: '100%',
          minHeight: '100vh',
          background: '#0F0404',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        {/* Top neon gradient */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '146px',
            background: 'linear-gradient(to bottom, rgba(255,22,84,0.17), transparent)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />

        {/* Content container — centered 1532px like navbar */}
        <div
          style={{
            maxWidth: '1532px',
            margin: '0 auto',
            padding: '0 50px',
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* LIVE MATCHES title area — top ~156px from page top */}
          <div style={{ paddingTop: '180px', marginBottom: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <TitleTriangles />
              <h1
                style={{
                  fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', " + F,
                  fontWeight: 900,
                  fontSize: '80px',
                  lineHeight: '95px',
                  color: '#ffffff',
                  margin: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                LIVE MATCHES
              </h1>
            </div>
            {/* Pink underline polygon */}
            <div
              style={{
                marginTop: '8px',
                width: '100%',
                maxWidth: '1000px',
                height: '4px',
                background: '#FF1654',
                clipPath: 'polygon(0 0, 100% 0, 99% 100%, 1% 100%)',
              }}
            />
          </div>

          {/* Filter bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              marginBottom: '48px',
              alignItems: 'center',
            }}
          >
            {/* TEAM SIZE */}
            <button
              style={{
                width: '222px',
                height: '47px',
                background: '#3C3C3C',
                border: '1px solid #ffffff',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Base_Neue_Trial-Regular', " + F,
                  fontWeight: 400,
                  fontSize: '24px',
                  lineHeight: '29px',
                  color: '#ffffff',
                }}
              >
                TEAM SIZE
              </span>
              <ChevronDown />
            </button>

            {/* PLATFORM */}
            <button
              style={{
                width: '222px',
                height: '47px',
                background: '#3C3C3C',
                border: '1px solid #ffffff',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Base_Neue_Trial-Regular', " + F,
                  fontWeight: 400,
                  fontSize: '24px',
                  lineHeight: '29px',
                  color: '#ffffff',
                }}
              >
                PLATFORM
              </span>
              <ChevronDown />
            </button>

            {/* MODE */}
            <button
              style={{
                width: '147px',
                height: '47px',
                background: '#3C3C3C',
                border: '1px solid #ffffff',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Base_Neue_Trial-Regular', " + F,
                  fontWeight: 400,
                  fontSize: '24px',
                  lineHeight: '29px',
                  color: '#ffffff',
                }}
              >
                MODE
              </span>
              <ChevronDown />
            </button>

            {/* Spacer to push CREATE to the right */}
            <div style={{ flex: 1 }} />

            {/* CREATE */}
            <button
              style={{
                width: '222px',
                height: '47px',
                background: '#FF1654',
                border: '1px solid #ffffff',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                style={{
                  fontFamily: "'Base_Neue_Trial-Regular', " + F,
                  fontWeight: 400,
                  fontSize: '24px',
                  lineHeight: '29px',
                  color: '#ffffff',
                }}
              >
                CREATE
              </span>
              <PlusIcon />
            </button>
          </div>

          {/* Match cards grid */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '40px',
              paddingBottom: '200px',
            }}
          >
            {loading && (
              <div
                style={{
                  width: '100%',
                  textAlign: 'center',
                  padding: '80px 0',
                  fontFamily: "'Base_Neue_Trial-Regular', " + F,
                  fontSize: '24px',
                  color: 'rgba(255,255,255,0.4)',
                }}
              >
                Loading...
              </div>
            )}

            {!loading && matches.length === 0 && (
              <div
                style={{
                  width: '100%',
                  textAlign: 'center',
                  padding: '80px 0',
                }}
              >
                <div
                  style={{
                    fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', " + F,
                    fontWeight: 900,
                    fontSize: '32px',
                    color: 'rgba(255,255,255,0.25)',
                    marginBottom: '12px',
                  }}
                >
                  NO LIVE MATCHES
                </div>
                <div
                  style={{
                    fontFamily: "'Base_Neue_Trial-Regular', " + F,
                    fontSize: '20px',
                    color: 'rgba(255,255,255,0.3)',
                  }}
                >
                  Create a match or check back later
                </div>
              </div>
            )}

            {matches.map((m) => (
              <MatchCard
                key={m.id}
                title={m.title}
                firstTo={m.firstTo}
                platform={m.platform}
                entryFee={m.entryFee}
                prize={m.prize}
                expiresIn={m.expiresIn}
              />
            ))}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
