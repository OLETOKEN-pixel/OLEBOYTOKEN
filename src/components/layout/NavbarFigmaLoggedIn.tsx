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
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

/* Routes that map nav items to standalone pages instead of home sections */
const NAV_ROUTES: Record<string, string> = {
  matches: '/matches',
};

export function NavbarFigmaLoggedIn() {
  const { profile, wallet, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const avatarUrl = profile?.discord_avatar_url || profile?.avatar_url || null;
  const balance = wallet?.balance?.toFixed(2) ?? '0.00';
  const level = (profile as any)?.level ?? 1;

  const isOnHome = location.pathname === '/';

  const [activeSection, setActiveSection] = useState<string | null>(null);
  // Determine active nav item from current route (when not on home page)
  const activeRouteItem = !isOnHome
    ? Object.entries(NAV_ROUTES).find(([, path]) => location.pathname === path)?.[0] ?? null
    : null;

  useEffect(() => {
    if (!isOnHome) return; // Only observe sections on home page
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
  }, [isOnHome]);

  // Clear active section when user scrolls back to top of page
  useEffect(() => {
    if (!isOnHome) return;
    const clearOnTop = () => {
      if (window.scrollY < 100) setActiveSection(null);
    };
    window.addEventListener('scroll', clearOnTop, { passive: true });
    clearOnTop();
    return () => window.removeEventListener('scroll', clearOnTop);
  }, [isOnHome]);

  const openProfilePage = (path: string) => {
    navigate(path);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
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
            const isActive = activeRouteItem === item || activeSection === NAV_SECTIONS[item];
            const hasRoute = item in NAV_ROUTES;

            const handleClick = () => {
              if (hasRoute) {
                // Navigate to standalone page
                navigate(NAV_ROUTES[item]);
              } else if (isOnHome) {
                // Scroll to section on home page
                scrollToSection(NAV_SECTIONS[item]);
              } else {
                // Navigate to home page then scroll
                navigate('/', { state: { scrollTo: NAV_SECTIONS[item] } });
              }
            };

            return (
              <button
                key={item}
                onClick={handleClick}
                style={{
                  fontFamily: isActive
                    ? "'Base_Neue_Trial-ExpandedBlack_Oblique', sans-serif"
                    : "'Base_Neue_Trial-Expanded', sans-serif",
                  fontWeight: 'normal',
                  fontSize: isActive ? '26px' : '24px',
                  lineHeight: isActive ? '31px' : 'normal',
                  color: isActive ? '#ff1654' : '#ffffff',
                  WebkitTextStroke: isActive ? '1px #000000' : '0px transparent',
                  textShadow: 'none',
                  filter: 'none',
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
            type="button"
            onClick={() => navigate('/wallet')}
            aria-label="Open wallet page"
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

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open profile menu"
                aria-haspopup="menu"
                style={{
                  position: 'absolute',
                  left: '347px',
                  top: 0,
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  padding: 0,
                  border: '1px solid rgba(255,255,255,0.18)',
                  background: avatarUrl ? 'transparent' : 'linear-gradient(135deg, #3b28cc, #6f5cff)',
                  cursor: 'pointer',
                  boxShadow: '0 0 18px rgba(0,0,0,0.28)',
                }}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    style={{
                      display: 'block',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b28cc, #6f5cff)',
                    }}
                  />
                )}
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={18}
              className="w-[336px] rounded-[28px] border border-white/[0.14] bg-[linear-gradient(180deg,rgba(18,11,15,0.97)_0%,rgba(8,6,10,0.94)_100%)] p-2 text-white shadow-[0_4px_4px_-4px_rgba(12,12,13,0.05),0_16px_16px_-8px_rgba(12,12,13,0.1),0_26px_60px_rgba(0,0,0,0.55)] backdrop-blur-[22px]"
            >
              <DropdownMenuLabel className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-4 py-4">
                <div className="pointer-events-none absolute inset-x-5 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)]" />
                <div className="pointer-events-none absolute -left-8 top-1 h-20 w-20 rounded-full bg-[#ff1654]/18 blur-3xl" />

                <div className="relative flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-full border border-white/[0.14] bg-white/[0.05]">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile" className="block h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full bg-[linear-gradient(135deg,#3b28cc,#6f5cff)]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#ff8ead]">My Profile</p>
                    <p className="mt-1 truncate text-[15px] font-semibold uppercase tracking-[0.08em] text-white">
                      {profile?.discord_display_name || profile?.username || 'Player'}
                    </p>
                    <p className="truncate text-[11px] uppercase tracking-[0.12em] text-white/42">{profile?.email}</p>
                  </div>
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="my-2 bg-white/[0.08]" />

              <DropdownMenuItem
                className="group rounded-[18px] border border-transparent bg-white/[0.03] px-3 py-0 text-white outline-none transition hover:border-[#ff1654]/30 hover:bg-[#ff1654]/10 focus:border-[#ff1654]/30 focus:bg-[#ff1654]/10"
                onSelect={() => openProfilePage('/profile')}
              >
                <div className="flex w-full items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white">My Profile</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/42">Account details and identity</p>
                  </div>
                  <span className="text-xl leading-none text-white/22 transition group-hover:text-[#ff8ead] group-focus:text-[#ff8ead]">&rsaquo;</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="group rounded-[18px] border border-transparent bg-white/[0.03] px-3 py-0 text-white outline-none transition hover:border-[#ff1654]/30 hover:bg-[#ff1654]/10 focus:border-[#ff1654]/30 focus:bg-[#ff1654]/10"
                onSelect={() => openProfilePage('/profile?tab=game')}
              >
                <div className="flex w-full items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white">Game Settings</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/42">Epic username and match setup</p>
                  </div>
                  <span className="text-xl leading-none text-white/22 transition group-hover:text-[#ff8ead] group-focus:text-[#ff8ead]">&rsaquo;</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="group rounded-[18px] border border-transparent bg-white/[0.03] px-3 py-0 text-white outline-none transition hover:border-[#ff1654]/30 hover:bg-[#ff1654]/10 focus:border-[#ff1654]/30 focus:bg-[#ff1654]/10"
                onSelect={() => openProfilePage('/wallet')}
              >
                <div className="flex w-full items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white">Payments &amp; Bank</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/42">Wallet, Stripe and withdrawals</p>
                  </div>
                  <span className="text-xl leading-none text-white/22 transition group-hover:text-[#ff8ead] group-focus:text-[#ff8ead]">&rsaquo;</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="group rounded-[18px] border border-transparent bg-white/[0.03] px-3 py-0 text-white outline-none transition hover:border-[#ff1654]/30 hover:bg-[#ff1654]/10 focus:border-[#ff1654]/30 focus:bg-[#ff1654]/10"
                onSelect={() => openProfilePage('/profile?tab=connections')}
              >
                <div className="flex w-full items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white">Connections</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-white/42">Discord and linked services</p>
                  </div>
                  <span className="text-xl leading-none text-white/22 transition group-hover:text-[#ff8ead] group-focus:text-[#ff8ead]">&rsaquo;</span>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator className="my-2 bg-white/[0.08]" />

              <DropdownMenuItem
                className="rounded-[18px] border border-[#ff1654]/20 bg-[#ff1654]/8 px-3 py-0 text-[#ffc1d1] outline-none transition hover:bg-[#ff1654]/14 focus:bg-[#ff1654]/14"
                onSelect={() => void handleSignOut()}
              >
                <div className="flex w-full items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[#ffd0dc]">Sign Out</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[#ffc1d1]/60">Close your current session</p>
                  </div>
                  <span className="text-xl leading-none text-[#ffc1d1]/45">&rsaquo;</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      </nav>
    </>
  );
}
