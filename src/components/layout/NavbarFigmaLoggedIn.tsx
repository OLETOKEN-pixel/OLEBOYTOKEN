/**
 * NavbarFigmaLoggedIn — Logged-in user navbar
 * Based on Figma node 84:282
 *
 * Navbar: 1532x91px, centered, top:55px (from page top, Figma y=168 relative to frame y=113)
 * TAB pill: 394x50px at left:1088px inside navbar, top:20px
 * PFP: 50x50px at left:347.54px inside TAB (extends 3.54px beyond TAB right edge)
 * RECHARGE "+": Ellipse 16x16px at left:190px, top:18px inside TAB
 * SEP: at left:228px inside TAB
 * LVL: at left:245px inside TAB
 * COINS: at left:23px inside TAB
 */

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const NAV_SECTIONS: Record<string, string> = {
  matches: 's-matches',
  leaderboard: 's-leaderboard',
  challenges: 's-challenges',
  hls: 's-highlights',
  teams: 's-teams',
  shop: 's-shop',
};

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
}

const F = "'Base Neue Trial', 'Base Neue', sans-serif";

export function NavbarFigmaLoggedIn() {
  const { profile, wallet } = useAuth();
  const avatarUrl = profile?.discord_avatar_url || profile?.avatar_url || null;
  const balance = wallet?.balance?.toFixed(2) ?? '0.00';
  const level = (profile as any)?.level ?? 1;

  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    const sectionIds = Object.values(NAV_SECTIONS);
    const observers: IntersectionObserver[] = [];

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { threshold: 0.3 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

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
      }}
    >
      {/* SVG Bar background */}
      <img
        src="/figma-assets/84-283.svg"
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
        }}
      />

      {/* Content layer */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          padding: '0 42px',
          boxSizing: 'border-box',
        }}
      >
        {/* Logo — 65x55px */}
        <Link
          to="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '65px',
            height: '55px',
            flexShrink: 0,
            filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.25))',
          }}
        >
          <img
            src="/figma-assets/84-287.svg"
            alt="OleBoy"
            style={{ display: 'block', width: '65px', height: '55px' }}
          />
        </Link>

        {/* Nav Links — centered between logo and TAB */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '26px',
            marginLeft: '72px',
            flex: 1,
          }}
        >
          {(Object.keys(NAV_SECTIONS) as Array<keyof typeof NAV_SECTIONS>).map((item) => {
            const isActive = activeSection === NAV_SECTIONS[item];
            return (
              <button
                key={item}
                onClick={() => scrollToSection(NAV_SECTIONS[item])}
                style={{
                  fontFamily: isActive
                    ? "'Base_Neue_Trial:Expanded_Black_Oblique', sans-serif"
                    : "'Base_Neue_Trial:Expanded', sans-serif",
                  fontWeight: 'normal',
                  fontSize: isActive ? '26px' : '24px',
                  lineHeight: 'normal',
                  color: isActive ? '#ff1654' : '#ffffff',
                  WebkitTextStroke: isActive ? '1px #000000' : 'none',
                  textShadow: isActive
                    ? '0px 2px 4px rgba(0,0,0,0.55), 0px -1px 3px rgba(180,0,20,0.45)'
                    : 'none',
                  filter: isActive ? 'drop-shadow(0px 0px 10px rgba(255, 22, 84, 0.9))' : 'none',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  whiteSpace: 'nowrap',
                  transition: 'color 0.2s, font-size 0.2s',
                }}
              >
                {isActive ? item.toUpperCase() : item}
              </button>
            );
          })}
        </div>

        {/* TAB section — 394x50px pill + PFP extending beyond right edge */}
        <div
          style={{
            position: 'relative',
            width: '398px', /* 394 + 4px for PFP overflow */
            height: '50px',
            flexShrink: 0,
          }}
        >
          {/* TAB background pill — 394x50px */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '394px',
              height: '50px',
              background: 'rgba(255, 22, 84, 0.2)',
              borderRadius: '23px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          />

          {/* COINS — red circle 29x29 at left:23, top:11 + balance text */}
          <div
            style={{
              position: 'absolute',
              left: '23px',
              top: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '29px',
                height: '29px',
                borderRadius: '50%',
                background: '#ff1654',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: "'Base_Neue_Trial-ExpandedBold', 'Base Neue Trial', sans-serif",
                fontWeight: 'normal',
                fontSize: '24px',
                lineHeight: 'normal',
                color: '#ffffff',
                whiteSpace: 'nowrap',
              }}
            >
              {balance}
            </span>
          </div>

          {/* RECHARGE "+" — Ellipse 16x16 at left:190, top:18 inside TAB */}
          <button
            style={{
              position: 'absolute',
              left: '190px',
              top: '18px',
              width: '16px',
              height: '16px',
              background: 'rgba(255, 22, 84, 0.5)',
              border: '1px solid #ff1654',
              borderRadius: '50%',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span
              style={{
                fontFamily: F,
                fontWeight: 400,
                fontSize: '16px',
                lineHeight: 1,
                color: '#ffffff',
                textAlign: 'center',
                marginTop: '-2px',
              }}
            >
              +
            </span>
          </button>

          {/* SEP — separator line at left:228, top:10, height:30 */}
          <div
            style={{
              position: 'absolute',
              left: '228px',
              top: '10px',
              width: '1px',
              height: '30px',
            }}
          >
            <img
              src="/figma-assets/84-294.svg"
              alt=""
              aria-hidden
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
          </div>

          {/* LVL — at left:245, top:11 */}
          <span
            style={{
              position: 'absolute',
              left: '245px',
              top: '11px',
              fontFamily: "'Base_Neue_Trial-WideBlack', 'Base Neue Trial', sans-serif",
              fontWeight: 'normal',
              fontSize: '15px',
              lineHeight: 'normal',
              color: '#ffffff',
              whiteSpace: 'nowrap',
            }}
          >
            LVL<span style={{ fontFamily: "'Base_Neue_Trial-ExpandedBold', 'Base Neue Trial', sans-serif", fontSize: '24px' }}>.{level}</span>
          </span>

          {/* PFP — 50x50 circle at left:347.54 (extends 3.54px beyond TAB right edge) */}
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Profile"
              style={{
                position: 'absolute',
                left: '347px',
                top: 0,
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                left: '347px',
                top: 0,
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b28cc, #6f5cff)',
              }}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
