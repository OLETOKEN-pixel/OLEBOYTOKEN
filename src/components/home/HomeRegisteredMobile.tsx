import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { getLevel, getLevelXpRequired, getXpInLevel, getXpToNext } from '@/lib/xp';
import type { Match } from '@/types';
import { PlayerStatsModal } from '@/components/player/PlayerStatsModal';
import { ACTIVE_HOME_ASSETS } from './sections/activeHomeAssets';
import { useWalletPurchase } from '@/contexts/WalletPurchaseContext';
import { useShopLevelRewards } from '@/hooks/useShopLevelRewards';

interface HomeRegisteredMobileProps {
  displayName: string;
}

interface MatchDisplay {
  id: string;
  title: string;
  firstTo: string;
  platform: string;
  entryFee: string;
  prize: string;
  expiresIn: string;
}

interface PlayerDisplay {
  userId: string | null;
  rank: number;
  username: string;
  avatarUrl: string | null;
  winRate: string;
  roundsWon: string;
  earnings: string;
}

interface ChallengeDisplay {
  id: string;
  title: string;
  reward: string;
  progress: number;
  completed: boolean;
}

interface HomeChallengeRpcRow {
  id: string;
  title: string;
  reward_xp: number;
  reward_coin: number;
  target_value: number;
  progress_value: number;
  is_completed: boolean;
  is_claimed: boolean;
}

type ChallengeRow = Database['public']['Tables']['challenges']['Row'];
type ChallengeProgressRow = Database['public']['Tables']['user_challenge_progress']['Row'];

interface TeamDisplay {
  rank: number;
  name: string;
  avatarUrl: string | null;
  score: string;
}

interface ShopItem {
  type: 'cosmetic' | 'vip';
  image: string;
  price: string;
  label?: string;
  sublabel?: string;
}

const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base Neue Expanded', 'Base Neue Trial', 'Base Neue', sans-serif";
const SECTION_BG = 'radial-gradient(ellipse at 50% 35%, #1a0a0a 0%, #0f0404 54%, #080202 100%)';
const A_NEON = '/figma-assets/figma-neon.png';

const PLACEHOLDER_MATCHES: MatchDisplay[] = [
  { id: '1', title: 'BUILD FIGHT', firstTo: '5+2', platform: 'PS5', entryFee: '0.75', prize: '1.40', expiresIn: '23:00' },
  { id: '2', title: 'REALISTIC 1V1', firstTo: '5+2', platform: 'PC', entryFee: '2.20', prize: '4.00', expiresIn: '00:13' },
];

const PLACEHOLDER_PLAYERS: PlayerDisplay[] = [
  { userId: null, rank: 1, username: '-', avatarUrl: null, winRate: '0%', roundsWon: '0', earnings: '0' },
  { userId: null, rank: 2, username: '-', avatarUrl: null, winRate: '0%', roundsWon: '0', earnings: '0' },
  { userId: null, rank: 3, username: '-', avatarUrl: null, winRate: '0%', roundsWon: '0', earnings: '0' },
];

const PLACEHOLDER_TEAMS: TeamDisplay[] = [
  { rank: 1, name: '-', avatarUrl: null, score: '0/30' },
  { rank: 2, name: '-', avatarUrl: null, score: '0/30' },
  { rank: 3, name: '-', avatarUrl: null, score: '0/30' },
];

const videoItems = [
  { href: 'https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5', src: '/showreel/highlight-video-1.png', alt: 'Piz montage 1' },
  { href: 'https://youtu.be/SDIys2MtwnA?si=Tba7ZE_Uda0qphNI', src: '/showreel/highlight-video-2.png', alt: 'Maxresdefault' },
  { href: 'https://youtu.be/YcUuHL9i_7c?si=rHCyzj47PmRRa_ph', src: '/showreel/highlight-video-3.png', alt: 'Piz montage 2' },
];

const shopItems: ShopItem[] = [
  { type: 'vip', image: '/showreel/vip-icon.svg', price: 'EUR 9.99', label: 'VIP', sublabel: '1 MONTH' },
];

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
    title: m.mode === 'Box Fight' ? 'BUILD FIGHT' : m.mode === 'Realistic' ? 'REALISTIC 1V1' : 'ZONE WARS',
    firstTo: `${m.first_to}+2`,
    platform: m.platform === 'Console' ? 'PS5' : m.platform,
    entryFee: fee.toFixed(2),
    prize: prize.toFixed(2),
    expiresIn: formatTimeLeft(m.expires_at),
  };
}

function scrollToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
}

function AvatarBlock({ src, alt, size = 48 }: { src: string | null; alt: string; size?: number }) {
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '8px',
          objectFit: 'cover',
          flexShrink: 0,
          border: '1px solid rgba(255,255,255,0.14)',
        }}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '8px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}
    />
  );
}

function MobileSection({
  id,
  title,
  copy,
  prevId,
  nextId,
  children,
  align = 'left',
}: {
  id: string;
  title: string;
  copy: ReactNode;
  prevId: string;
  nextId: string;
  children: ReactNode;
  align?: 'left' | 'right';
}) {
  const isRight = align === 'right';

  return (
    <section
      id={id}
      data-mobile-section={id}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100vw',
        minHeight: '100svh',
        overflow: 'hidden',
        padding: '118px 16px 58px',
        background: `radial-gradient(circle at 50% 100%, rgba(255, 22, 84, 0.18) 0%, rgba(255, 22, 84, 0.07) 32%, rgba(255, 22, 84, 0) 70%), ${SECTION_BG}`,
      }}
    >
      <div style={{ position: 'relative', zIndex: 2, maxWidth: '430px', margin: '0 auto', textAlign: align }}>
        <h2
          style={{
            margin: 0,
            fontFamily: FE,
            fontWeight: 900,
            fontStyle: 'oblique',
            fontSize: '34px',
            lineHeight: '38px',
            letterSpacing: 0,
            color: '#ffffff',
            textTransform: 'uppercase',
            overflowWrap: 'anywhere',
          }}
        >
          {title}
        </h2>

        <div
          aria-hidden="true"
          style={{
            width: '100%',
            height: '4px',
            marginTop: '13px',
            background: 'linear-gradient(90deg, #ff1654 0%, rgba(255, 22, 84, 0) 94%)',
            transform: isRight ? 'scaleX(-1)' : undefined,
          }}
        />

        <div
          style={{
            marginTop: '31px',
            fontFamily: FE,
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: '27px',
            letterSpacing: 0,
            color: '#ffffff',
            overflowWrap: 'anywhere',
          }}
        >
          {copy}
        </div>

        <div style={{ marginTop: '24px' }}>{children}</div>

        <MobileNavArrows prevId={prevId} nextId={nextId} />
      </div>
    </section>
  );
}

function MobileNavArrows({ prevId, nextId }: { prevId: string; nextId: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '26px', position: 'relative', zIndex: 4 }}>
      <button
        aria-label="Previous section"
        onClick={() => scrollToSection(prevId)}
        style={{
          width: '44px',
          height: '44px',
          border: 'none',
          borderRadius: '8px',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <img src={ACTIVE_HOME_ASSETS.shared.navPrev} alt="" aria-hidden style={{ width: '100%', height: '100%', display: 'block' }} />
      </button>
      <button
        aria-label="Next section"
        onClick={() => scrollToSection(nextId)}
        style={{
          width: '44px',
          height: '44px',
          border: 'none',
          borderRadius: '8px',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <img src={ACTIVE_HOME_ASSETS.shared.navNext} alt="" aria-hidden style={{ width: '100%', height: '100%', display: 'block' }} />
      </button>
    </div>
  );
}

function MobileCta({
  children,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: '100%',
        maxWidth: '218px',
        height: '52px',
        margin: '24px auto 0',
        border: '1px solid #ff1654',
        borderRadius: '8px',
        background: 'rgba(255,22,84,0.23)',
        boxShadow: 'inset 0px 4px 4px rgba(255,255,255,0.14), inset 0px -4px 4px rgba(0,0,0,0.25)',
        color: '#ffffff',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '0 16px',
        fontFamily: "'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif",
        fontWeight: 900,
        fontSize: '22px',
        lineHeight: '26px',
        letterSpacing: 0,
        whiteSpace: 'nowrap',
      }}
    >
      <span>{children}</span>
      <img src={ACTIVE_HOME_ASSETS.shared.ctaArrow} alt="" aria-hidden style={{ width: '22px', height: '16px', flexShrink: 0, transform: 'rotate(-90deg)' }} />
    </button>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        border: '1px solid rgba(255, 22, 84, 0.66)',
        borderRadius: '8px',
        background: 'rgba(39,39,39,0.92)',
        boxShadow: '0 18px 46px rgba(0,0,0,0.36)',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function LaunchMobile({ displayName }: { displayName: string }) {
  return (
    <section
      id="s-launch"
      data-mobile-section="s-launch"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100vw',
        minHeight: '100svh',
        overflow: 'hidden',
        padding: '132px 16px 70px',
        background: `radial-gradient(circle at 50% 100%, rgba(255, 22, 84, 0.16) 0%, rgba(255, 22, 84, 0.03) 56%, rgba(255, 22, 84, 0) 72%), ${SECTION_BG}`,
      }}
    >
      <img src={A_NEON} alt="" aria-hidden style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '112px', objectFit: 'cover', zIndex: 1 }} />
      <img
        src={A_NEON}
        alt=""
        aria-hidden
        style={{ position: 'absolute', left: 0, bottom: '-20px', width: '100%', height: '112px', objectFit: 'cover', transform: 'scaleY(-1)', zIndex: 1 }}
      />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: '430px', margin: '0 auto', textAlign: 'center' }}>
        <h1
          style={{
            margin: 0,
            fontFamily: FE,
            fontWeight: 900,
            color: '#ffffff',
            fontSize: '34px',
            lineHeight: '40px',
            letterSpacing: 0,
            overflowWrap: 'anywhere',
          }}
        >
          <span style={{ fontFamily: "'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif", fontWeight: 700 }}>Welcome, </span>
          <span style={{ fontFamily: "'Base Neue Trial-Black', 'Base Neue Trial', sans-serif", fontWeight: 900 }}>{displayName}</span>
        </h1>

        <div
          aria-hidden="true"
          style={{
            width: '100%',
            height: '4px',
            maxWidth: '330px',
            margin: '14px auto 0',
            background: 'linear-gradient(90deg, rgba(255,22,84,0), #ff1654 12%, #ff1654 88%, rgba(255,22,84,0))',
          }}
        />

        <a
          href="https://x.com/lightvsls/status/1928798617550360876?s=20"
          rel="noopener noreferrer"
          target="_blank"
          style={{
            display: 'block',
            marginTop: '34px',
            color: '#ffffff',
            textDecoration: 'none',
          }}
        >
          <Panel>
            <div
              style={{
                minHeight: '182px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '16px',
                padding: '18px',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.2))',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontFamily: "'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif",
                  fontWeight: 700,
                  fontSize: '24px',
                  lineHeight: '29px',
                  letterSpacing: 0,
                  color: '#ffffff',
                  textAlign: 'center',
                }}
              >
                Watch the launch video!
              </p>
              <div style={{ display: 'flex', gap: '7px' }}>
                {[true, false, false, false].map((active, index) => (
                  <span
                    key={index}
                    aria-hidden="true"
                    style={{
                      width: '9px',
                      height: '9px',
                      borderRadius: '8px',
                      background: active ? '#ffffff' : '#454545',
                    }}
                  />
                ))}
              </div>
            </div>
          </Panel>
        </a>

        <button
          type="button"
          onClick={() => scrollToSection('s-matches')}
          style={{
            width: '190px',
            height: '52px',
            marginTop: '48px',
            border: '1px solid #ff1654',
            borderRadius: '8px',
            background: 'rgba(255,22,84,0.23)',
            boxShadow: 'inset 0px 4px 4px rgba(255,255,255,0.14), inset 0px -4px 4px rgba(0,0,0,0.25)',
            color: '#ffffff',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: 0,
            fontFamily: F,
            fontWeight: 400,
            fontSize: '21px',
            lineHeight: '24px',
            letterSpacing: 0,
            whiteSpace: 'nowrap',
          }}
        >
          <img src={ACTIVE_HOME_ASSETS.launch.buttonArrowLeft} alt="" aria-hidden style={{ width: '13px', height: '17px' }} />
          See sections
          <img src={ACTIVE_HOME_ASSETS.launch.buttonArrowRight} alt="" aria-hidden style={{ width: '13px', height: '17px' }} />
        </button>
      </div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontFamily: F, fontWeight: 400, fontSize: '13px', lineHeight: '16px', color: 'rgba(255,255,255,0.72)' }}>{label}</p>
      <p
        style={{
          margin: '4px 0 0',
          fontFamily: "'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif",
          fontWeight: 900,
          fontSize: '16px',
          lineHeight: '19px',
          color: '#ffffff',
          overflowWrap: 'anywhere',
        }}
      >
        {value}
      </p>
    </div>
  );
}

function LiveMatchesMobile() {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<MatchDisplay[]>(PLACEHOLDER_MATCHES);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(2);

      if (!error && data && data.length > 0) {
        setMatches(data.map(matchToDisplay));
      }
    };

    fetchMatches();
  }, []);

  return (
    <MobileSection
      id="s-matches"
      title="LIVE MATCHES"
      prevId="s-launch"
      nextId="s-leaderboard"
      copy={
        <>
          <p style={{ margin: 0 }}>Find an opponent.</p>
          <p style={{ margin: 0 }}>Let's see who's built different!</p>
        </>
      }
    >
      <div style={{ display: 'grid', gap: '14px' }}>
        {matches.slice(0, 2).map((match) => (
          <Panel key={match.id}>
            <div style={{ padding: '18px 16px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '10px' }}>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif",
                    fontWeight: 900,
                    fontSize: '24px',
                    lineHeight: '28px',
                    letterSpacing: 0,
                    color: '#ffffff',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {match.title}
                </h3>
                <span style={{ fontFamily: F, fontWeight: 400, fontSize: '15px', lineHeight: '18px', color: '#ff8ead', whiteSpace: 'nowrap' }}>
                  {match.expiresIn}
                </span>
              </div>

              <div style={{ height: '1px', margin: '13px 0 14px', background: 'linear-gradient(90deg, #ff1654, rgba(255,22,84,0))' }} />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px' }}>
                <MiniStat label="First to" value={match.firstTo} />
                <MiniStat label="Platform" value={match.platform} />
                <MiniStat label="Entry" value={match.entryFee} />
                <MiniStat label="Prize" value={match.prize} />
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <MobileCta onClick={() => navigate('/matches')} ariaLabel="Open matches page">PLAY</MobileCta>
    </MobileSection>
  );
}

function SmallValue({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '7px', alignItems: 'baseline' }}>
      <span style={{ fontFamily: F, fontWeight: 400, fontSize: '11px', lineHeight: '13px', color: 'rgba(255,255,255,0.58)' }}>{label}</span>
      <span style={{ fontFamily: "'Base Neue Trial-RegularOblique', 'Base Neue Trial', sans-serif", fontSize: '13px', lineHeight: '15px', color: '#ff1654' }}>{value}</span>
    </div>
  );
}

function LeaderboardMobile() {
  const [players, setPlayers] = useState<PlayerDisplay[]>(PLACEHOLDER_PLAYERS);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRank, setSelectedRank] = useState<number | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const { data: lbData, error: lbErr } = await supabase
          .from('leaderboard_weekly')
          .select('*')
          .order('wins', { ascending: false })
          .limit(3);

        if (!lbErr && lbData && lbData.length > 0) {
          const userIds = lbData.map((p: any) => p.user_id).filter(Boolean);
          let avatarMap: Record<string, string | null> = {};

          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, discord_avatar_url, discord_display_name, username')
              .in('user_id', userIds);

            if (profiles) {
              for (const p of profiles) {
                avatarMap[p.user_id] = getDiscordAvatarUrl(p);
              }
            }
          }

          setPlayers(lbData.map((p: any, i: number) => ({
            userId: p.user_id || null,
            rank: i + 1,
            username: p.username || `Player${i + 1}`,
            avatarUrl: avatarMap[p.user_id] || null,
            winRate: p.total_matches > 0 ? `${Math.round((p.wins / p.total_matches) * 100)}%` : '0%',
            roundsWon: String(p.wins ?? 0),
            earnings: p.total_earnings != null ? String(Number(p.total_earnings).toFixed(0)) : '0',
          })));
        } else {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, discord_display_name, discord_avatar_url')
            .order('created_at', { ascending: true })
            .limit(3);

          if (profiles && profiles.length > 0) {
            setPlayers(profiles.map((p: any, i: number) => ({
              userId: p.user_id || null,
              rank: i + 1,
              username: p.discord_display_name || p.username || `Player${i + 1}`,
              avatarUrl: getDiscordAvatarUrl(p),
              winRate: '0%',
              roundsWon: '0',
              earnings: '0',
            })));
          }
        }
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
      }
    };

    fetchLeaderboard();
  }, []);

  const rows = useMemo(() => {
    const padded = [...players];
    PLACEHOLDER_PLAYERS.forEach((placeholder, index) => {
      if (!padded[index]) padded[index] = placeholder;
    });
    return padded.slice(0, 3);
  }, [players]);

  return (
    <MobileSection
      id="s-leaderboard"
      title="LEADERBOARD"
      prevId="s-matches"
      nextId="s-challenges"
      align="right"
      copy={
        <>
          <p style={{ margin: 0 }}>Get on top of the leaderboard.</p>
          <p style={{ margin: 0 }}>Weekly rewards!</p>
        </>
      }
    >
      <div style={{ display: 'grid', gap: '12px' }}>
        {rows.map((player) => (
          <Panel key={player.rank}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '13px', padding: '14px' }}>
              {player.userId ? (
                <button
                  type="button"
                  aria-label={`Open ${player.username} profile`}
                  onClick={() => {
                    setSelectedUserId(player.userId);
                    setSelectedRank(player.rank);
                  }}
                  style={{
                    padding: 0,
                    border: 0,
                    background: 'transparent',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <AvatarBlock src={player.avatarUrl} alt={player.username} size={54} />
                </button>
              ) : (
                <AvatarBlock src={player.avatarUrl} alt={player.username} size={54} />
              )}
              <div style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
                <p style={{ margin: 0, fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '20px', lineHeight: '23px', color: '#ff1654' }}>
                  #{player.rank}
                </p>
                <p style={{ margin: '2px 0 0', fontFamily: "'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif", fontWeight: 700, fontSize: '19px', lineHeight: '23px', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {player.username}
                </p>
              </div>
              <div style={{ display: 'grid', gap: '4px', textAlign: 'right', flexShrink: 0 }}>
                <SmallValue label="WR" value={player.winRate} />
                <SmallValue label="W" value={player.roundsWon} />
                <SmallValue label="OBC" value={player.earnings} />
              </div>
            </div>
          </Panel>
        ))}
      </div>
      <MobileCta ariaLabel="Rank up">RANK UP</MobileCta>
      <PlayerStatsModal
        open={!!selectedUserId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedUserId(null);
            setSelectedRank(null);
          }
        }}
        userId={selectedUserId || ''}
        rankOverride={selectedRank}
      />
    </MobileSection>
  );
}

function ChallengeRow({ challenge }: { challenge: ChallengeDisplay }) {
  return (
    <div
      style={{
        borderRadius: '8px',
        background: challenge.completed
          ? 'rgba(255,22,84,0.48)'
          : 'linear-gradient(90deg, rgba(255,22,84,0.34), rgba(15,4,4,0.34))',
        padding: '10px 11px',
        display: 'grid',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span
          aria-hidden="true"
          style={{
            width: '22px',
            height: '22px',
            borderRadius: '4px',
            background: challenge.completed ? '#ff1654' : 'rgba(0,0,0,0.42)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          {challenge.completed ? <img src={ACTIVE_HOME_ASSETS.challenges.checkmark} alt="" aria-hidden style={{ width: '15px', height: '15px' }} /> : null}
        </span>
        <p style={{ margin: 0, flex: 1, minWidth: 0, fontFamily: "'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif", fontWeight: 700, fontSize: '15px', lineHeight: '18px', color: '#ffffff', textAlign: 'left', overflowWrap: 'anywhere' }}>
          {challenge.title}
        </p>
        {challenge.reward ? (
          <span style={{ fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '12px', lineHeight: '14px', color: '#ff8ead', whiteSpace: 'nowrap' }}>
            {challenge.reward}
          </span>
        ) : null}
      </div>
      <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <div style={{ width: `${challenge.progress}%`, height: '100%', background: '#ff1654' }} />
      </div>
    </div>
  );
}

function ChallengesMobile() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [challengeRows, setChallengeRows] = useState<ChallengeDisplay[]>([]);
  const [userXp, setUserXp] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: rpcChallenges, error: rpcChallengesError } = await supabase.rpc('get_user_challenges');
      const { data: rpcXp, error: rpcXpError } = await supabase.rpc('get_user_xp');
      const rpcChallengeRows: HomeChallengeRpcRow[] = Array.isArray(rpcChallenges)
        ? (rpcChallenges as HomeChallengeRpcRow[])
        : [];

      if (!rpcChallengesError && rpcChallengeRows.length > 0) {
        setChallengeRows(
          rpcChallengeRows.slice(0, 5).map((challenge) => ({
            id: challenge.id,
            title: challenge.title,
            reward:
              challenge.reward_xp > 0
                ? `+${challenge.reward_xp}XP`
                : Number(challenge.reward_coin) > 0
                  ? `+${Number(challenge.reward_coin)}OBC`
                  : '',
            progress:
              challenge.target_value > 0
                ? Math.min(
                    100,
                    Math.round((challenge.progress_value / challenge.target_value) * 100),
                  )
                : 0,
            completed: Boolean(challenge.is_completed || challenge.is_claimed),
          })),
        );
      } else {
        const { data: challengeRowsData } = await supabase
          .from('challenges')
          .select('*')
          .eq('is_active', true)
          .order('created_at')
          .limit(5);

        if (challengeRowsData && challengeRowsData.length > 0) {
          const now = new Date();
          const dailyKey = now.toISOString().split('T')[0];
          const monday = new Date(now);
          monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
          const weeklyKey = monday.toISOString().split('T')[0];

          const { data: progressRows } = await supabase
            .from('user_challenge_progress')
            .select('*')
            .eq('user_id', user.id)
            .in('challenge_id', challengeRowsData.map((challenge) => challenge.id))
            .in('period_key', [dailyKey, weeklyKey]);

          const progressMap = new Map<string, ChallengeProgressRow>();
          (progressRows || []).forEach((progress) =>
            progressMap.set(progress.challenge_id, progress),
          );

          setChallengeRows(
            challengeRowsData.map((challenge: ChallengeRow) => {
              const progress = progressMap.get(challenge.id);
              return {
                id: challenge.id,
                title: challenge.title,
                reward:
                  challenge.reward_xp > 0
                    ? `+${challenge.reward_xp}XP`
                    : Number(challenge.reward_coin) > 0
                      ? `+${Number(challenge.reward_coin)}OBC`
                      : '',
                progress:
                  challenge.target_value > 0 && progress
                    ? Math.min(
                        100,
                        Math.round((progress.progress_value / challenge.target_value) * 100),
                      )
                    : 0,
                completed: Boolean(progress?.is_completed),
              };
            }),
          );
        }
      }

      if (!rpcXpError && typeof rpcXp === 'number' && rpcXp > 0) {
        setUserXp(rpcXp);
        return;
      }

      const { data: xpRow } = await supabase
        .from('user_xp')
        .select('total_xp')
        .eq('user_id', user.id)
        .single();

      if (xpRow) setUserXp(xpRow.total_xp);
    };

    fetchData();
  }, [user]);

  const level = getLevel(userXp);
  const xpInLevel = getXpInLevel(userXp);
  const xpToNext = getXpToNext(userXp);
  const ringProgress = `${Math.round((xpInLevel / getLevelXpRequired(level)) * 100)}%`;

  return (
    <MobileSection
      id="s-challenges"
      title="CHALLENGES"
      prevId="s-leaderboard"
      nextId="s-highlights"
      copy={
        <>
          <p style={{ margin: 0 }}>Complete the tasks.</p>
          <p style={{ margin: 0 }}>Get rewarded with XP and OBC!</p>
        </>
      }
    >
      <Panel>
        <div style={{ padding: '18px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
            <div
              aria-label={`${xpInLevel} percent XP progress`}
              style={{
                width: '92px',
                height: '92px',
                borderRadius: '50%',
                background: `conic-gradient(#ff1654 0% ${ringProgress}, rgba(255,255,255,0.12) ${ringProgress} 100%)`,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <div style={{ width: '66px', height: '66px', borderRadius: '50%', background: '#272727', display: 'grid', placeItems: 'center' }}>
                <span style={{ fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '22px', lineHeight: '24px', color: '#ffffff' }}>{userXp}</span>
              </div>
            </div>
            <div style={{ minWidth: 0, textAlign: 'left' }}>
              <p style={{ margin: 0, fontFamily: "'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif", fontWeight: 700, fontSize: '16px', lineHeight: '20px', color: '#ffffff' }}>
                LVL.{level}
              </p>
              <p style={{ margin: '5px 0 0', fontFamily: F, fontWeight: 400, fontSize: '15px', lineHeight: '18px', color: 'rgba(255,255,255,0.72)' }}>
                {xpToNext}XP left
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gap: '9px' }}>
            {challengeRows.length > 0 ? (
              challengeRows.map((challenge) => <ChallengeRow key={challenge.id} challenge={challenge} />)
            ) : (
              <p style={{ margin: 0, fontFamily: F, fontWeight: 400, fontSize: '16px', lineHeight: '20px', color: 'rgba(255,255,255,0.72)', textAlign: 'left' }}>
                No active challenges yet.
              </p>
            )}
          </div>
        </div>
      </Panel>
      <MobileCta onClick={() => navigate('/challenges')} ariaLabel="Open challenges page">LEVEL UP</MobileCta>
    </MobileSection>
  );
}

function HighlightsMobile() {
  return (
    <MobileSection
      id="s-highlights"
      title="HIGHLIGHTS"
      prevId="s-challenges"
      nextId="s-teams"
      align="right"
      copy={
        <>
          <p style={{ margin: 0 }}>Publish and vote.</p>
          <p style={{ margin: 0 }}>The most liked will get extra OBC!</p>
        </>
      }
    >
      <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
        {videoItems.map((item) => (
          <a
            key={item.href}
            href={item.href}
            rel="noopener noreferrer"
            target="_blank"
            style={{
              display: 'block',
              width: '268px',
              aspectRatio: '408 / 229',
              flexShrink: 0,
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid rgba(255,22,84,0.58)',
            }}
          >
            <img src={item.src} alt={item.alt} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </a>
        ))}
      </div>
      <MobileCta onClick={() => window.open(videoItems[0].href, '_blank', 'noopener,noreferrer')} ariaLabel="Watch highlights">WATCH</MobileCta>
    </MobileSection>
  );
}

function TeamsMobile() {
  const navigate = useNavigate();
  const [teams, setTeams] = useState<TeamDisplay[]>(PLACEHOLDER_TEAMS);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const { data, error } = await supabase
          .from('teams')
          .select('id, name, avatar_url, member_count, max_members')
          .order('member_count', { ascending: false })
          .limit(3);

        if (!error && data && data.length > 0) {
          setTeams(
            data.map((t: any, i: number) => ({
              rank: i + 1,
              name: t.name || `Team ${i + 1}`,
              avatarUrl: t.avatar_url || null,
              score: `${t.member_count ?? 0}/${t.max_members ?? 30}`,
            })),
          );
        }
      } catch {
        // Keep placeholders.
      }
    };

    fetchTeams();
  }, []);

  return (
    <MobileSection
      id="s-teams"
      title="TEAMS"
      prevId="s-highlights"
      nextId="s-shop"
      copy={
        <>
          <p style={{ margin: 0 }}>Build or join a team.</p>
          <p style={{ margin: 0 }}>Discover why...</p>
        </>
      }
    >
      <div style={{ display: 'grid', gap: '11px' }}>
        {teams.map((team) => (
          <Panel key={team.rank}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px' }}>
              <AvatarBlock src={team.avatarUrl} alt={team.name} size={44} />
              <p style={{ margin: 0, flex: 1, minWidth: 0, fontFamily: "'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif", fontWeight: 700, fontSize: '18px', lineHeight: '22px', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                {team.name}
              </p>
              <span style={{ fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '18px', lineHeight: '21px', color: '#ff1654', width: '34px', textAlign: 'right' }}>
                #{team.rank}
              </span>
              <span style={{ fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '15px', lineHeight: '18px', color: '#ff8ead', whiteSpace: 'nowrap' }}>
                {team.score}
              </span>
            </div>
          </Panel>
        ))}
      </div>
      <MobileCta onClick={() => navigate('/teams')} ariaLabel="Open teams page">TEAM UP</MobileCta>
    </MobileSection>
  );
}

function ShopPrice({ price }: { price: string }) {
  const showCoinIcon = /^\d/.test(price);
  return (
    <div style={{ position: 'absolute', left: '10px', right: '10px', bottom: '10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
      {showCoinIcon ? <img src="/showreel/coin-icon.svg" alt="" aria-hidden style={{ width: '19px', height: '19px', flexShrink: 0 }} /> : null}
      <span style={{ fontFamily: "'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif", fontWeight: 700, fontSize: price.startsWith('EUR') ? '20px' : price.startsWith('LVL') ? '18px' : '25px', lineHeight: '29px', color: '#ffffff', whiteSpace: 'nowrap' }}>
        {price}
      </span>
    </div>
  );
}

function ShopMobile() {
  const navigate = useNavigate();
  const { openWalletPurchase } = useWalletPurchase();
  const { rewards } = useShopLevelRewards();
  const mobileShopItems: ShopItem[] = [
    ...rewards.map((reward) => ({
      type: 'cosmetic' as const,
      image: reward.image,
      price: `LVL ${reward.levelRequired}`,
    })),
    ...shopItems,
  ];

  return (
    <MobileSection
      id="s-shop"
      title="SHOP"
      prevId="s-teams"
      nextId="s-footer"
      align="right"
      copy={
        <>
          <p style={{ margin: 0 }}>Cosmetics, coins, VIP.</p>
          <p style={{ margin: 0 }}>Everything you need to set you up!</p>
        </>
      }
    >
      <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px', WebkitOverflowScrolling: 'touch' }}>
        {mobileShopItems.map((item) => (
          <Panel key={`${item.image}-${item.price}`}>
            <div style={{ position: 'relative', width: '158px', height: '194px', background: '#3a0000' }}>
              {item.type === 'cosmetic' ? (
                <>
                  <img src={item.image} alt="Cosmetic" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', inset: 'auto 0 0', height: '86px', background: 'linear-gradient(0deg, #3a0000, rgba(58,0,0,0))' }} />
                  <ShopPrice price={item.price} />
                </>
              ) : (
                <>
                  <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', paddingBottom: '38px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <img src={item.image} alt="VIP" style={{ width: '62px', height: '52px', margin: '0 auto 8px', display: 'block' }} />
                      <p style={{ margin: 0, fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '27px', lineHeight: '31px', color: '#ff1654' }}>
                        {item.label}
                      </p>
                      <p style={{ margin: '1px 0 0', fontFamily: FE, fontWeight: 900, fontStyle: 'oblique', fontSize: '12px', lineHeight: '15px', color: '#ffffff' }}>
                        {item.sublabel}
                      </p>
                    </div>
                  </div>
                  <ShopPrice price={item.price} />
                </>
              )}
            </div>
          </Panel>
        ))}
      </div>
      <MobileCta onClick={openWalletPurchase} ariaLabel="Open shop page">SHOP</MobileCta>
    </MobileSection>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '20px', lineHeight: '24px', color: '#ff1654', letterSpacing: 0 }}>
        {title}
      </p>
      <div style={{ display: 'grid', gap: '9px', marginTop: '13px' }}>{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      style={{
        fontFamily: F,
        fontWeight: 400,
        fontSize: '16px',
        lineHeight: '20px',
        color: '#e6e6e6',
        textDecoration: 'underline',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </a>
  );
}

function MobileFooter() {
  return (
    <section
      id="s-footer"
      data-mobile-section="s-footer"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100vw',
        overflow: 'hidden',
        padding: '58px 18px 42px',
        background: '#0f0404',
        borderTop: '0.5px solid #ffffff',
      }}
    >
      <p
        aria-hidden="true"
        style={{
          margin: '0 auto 36px',
          width: '100%',
          maxWidth: '430px',
          fontFamily: FE,
          fontWeight: 900,
          fontStyle: 'oblique',
          fontSize: '56px',
          lineHeight: '60px',
          letterSpacing: 0,
          textAlign: 'center',
          backgroundImage: 'linear-gradient(180.075deg, rgb(15, 4, 4) 10.117%, rgb(255, 255, 255) 99.722%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
        }}
      >
        OLEBOY
      </p>

      <div style={{ display: 'grid', gap: '28px', maxWidth: '430px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        <FooterColumn title="BTS - Marv">
          <FooterLink href="https://x.com">X/Twitter</FooterLink>
        </FooterColumn>
        <FooterColumn title="BTS - Tom">
          <FooterLink href="https://x.com">X/Twitter</FooterLink>
          <FooterLink href="https://instagram.com">Instagram</FooterLink>
        </FooterColumn>
        <FooterColumn title="SOCIALS">
          <FooterLink href="https://x.com/oleboytokens">X/Twitter</FooterLink>
          <FooterLink href="https://www.tiktok.com/@oleboytokens">TikTok</FooterLink>
          <FooterLink href="https://discord.gg/2XVffNDPAE">Discord</FooterLink>
        </FooterColumn>
        <FooterColumn title="CONTACT US">
          <FooterLink href="mailto:coolowner.2025@gmail.com">coolowner.2025@gmail.com</FooterLink>
          <FooterLink href="mailto:letterio.tomasini@gmail.com">letterio.tomasini@gmail.com</FooterLink>
        </FooterColumn>
        <FooterColumn title="PRIVACY">
          <FooterLink href="/terms">Terms &amp; Privacy</FooterLink>
        </FooterColumn>
        <div
          data-footer-copyright="true"
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '7px',
            fontFamily: F,
            fontWeight: 400,
            fontSize: '18px',
            lineHeight: '24px',
            color: '#e6e6e6',
            marginTop: '6px',
            overflowWrap: 'anywhere',
          }}
        >
          <span aria-hidden="true" style={{ position: 'relative', top: '1px', fontSize: '18px', lineHeight: 1 }}>
            {'\u00A9'}
          </span>
          <span>2026 OLEBOY. All Rights Reserved.</span>
        </div>
      </div>
    </section>
  );
}

export function HomeRegisteredMobile({ displayName }: HomeRegisteredMobileProps) {
  return (
    <div
      data-mobile-home="logged-in"
      style={{
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        background: '#0f0404',
        color: '#ffffff',
      }}
    >
      <LaunchMobile displayName={displayName} />
      <LiveMatchesMobile />
      <LeaderboardMobile />
      <ChallengesMobile />
      <HighlightsMobile />
      <TeamsMobile />
      <ShopMobile />
      <MobileFooter />
    </div>
  );
}
