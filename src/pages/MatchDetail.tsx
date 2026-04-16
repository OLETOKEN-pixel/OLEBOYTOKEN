import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavbarFigmaLoggedIn } from '@/components/layout/NavbarFigmaLoggedIn';
import { MatchChat } from '@/components/matches/MatchChat';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  useMatchDetail,
  useSetPlayerReady,
  useSubmitResult,
  useCancelMatch,
} from '@/hooks/useMatches';
import {
  formatMatchTitle,
  formatEntryFee,
} from '@/lib/matchFormatters';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { PLATFORM_FEE } from '@/types';
import type { Match, MatchParticipant } from '@/types';

// ─── fonts shorthand ─────────────────────────────────────────────────────────
const F = "'Base Neue Trial', 'Base Neue', sans-serif";

// ─── View state ──────────────────────────────────────────────────────────────
type ViewState = 'WAIT' | 'READY_UP' | 'WIN_LOSS' | 'TERMINAL';

function getViewState(status: string): ViewState {
  if (['open', 'joined'].includes(status)) return 'WAIT';
  if (['ready_check', 'full'].includes(status)) return 'READY_UP';
  if (['in_progress', 'result_pending', 'started'].includes(status)) return 'WIN_LOSS';
  return 'TERMINAL';
}

// ─── Status progress ─────────────────────────────────────────────────────────
function StepCircle({ done }: { done: boolean }) {
  return (
    <div
      style={{
        width: 66,
        height: 66,
        borderRadius: '50%',
        border: `3px solid ${done ? '#ff1654' : 'rgba(255,255,255,0.25)'}`,
        background: done ? '#ff1654' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {done && (
        <svg width="30" height="22" viewBox="0 0 30 22" fill="none">
          <path d="M2 11L11 20L28 2" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <div
      style={{
        flex: 1,
        height: 3,
        background: done ? '#ff1654' : 'rgba(255,255,255,0.15)',
        margin: '0 4px',
        alignSelf: 'center',
        marginBottom: 28,
      }}
    />
  );
}

function MatchStatusProgress({ status }: { status: string }) {
  const started = ['in_progress', 'result_pending', 'started', 'completed', 'finished', 'disputed', 'admin_resolved'].includes(status);
  const finished = ['completed', 'finished', 'admin_resolved'].includes(status);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '0 clamp(40px, 8vw, 200px)',
        marginBottom: 8,
      }}
    >
      {/* CREATED */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <StepCircle done />
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(14px, 1.25vw, 24px)', color: 'white', whiteSpace: 'nowrap' }}>
          CREATED
        </span>
      </div>

      <StepConnector done />

      {/* STARTED */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <StepCircle done={started} />
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(14px, 1.25vw, 24px)', color: 'white', whiteSpace: 'nowrap' }}>
          STARTED
        </span>
      </div>

      <StepConnector done={finished} />

      {/* FINISHED */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <StepCircle done={finished} />
        <span style={{ fontFamily: F, fontWeight: 700, fontSize: 'clamp(14px, 1.25vw, 24px)', color: 'white', whiteSpace: 'nowrap' }}>
          FINISHED
        </span>
      </div>
    </div>
  );
}

// ─── Player slot ─────────────────────────────────────────────────────────────
function EmptyPlayerSlot({ side }: { side: 'A' | 'B' }) {
  const borderColor = side === 'A' ? '#ff1654' : '#d8ff16';
  const textColor = side === 'A' ? '#ff1654' : '#d8ff16';

  return (
    <div
      style={{
        background: '#282828',
        border: `1px solid ${borderColor}`,
        borderRadius: 18,
        height: 87,
        width: '100%',
        maxWidth: 368,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Question mark placeholder */}
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: F, fontWeight: 800, fontSize: 36, color: 'white' }}>?</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F, fontWeight: 700, fontSize: 20, color: textColor, whiteSpace: 'nowrap' }}>
          Wait for a player
        </div>
        <div style={{ fontFamily: F, fontStyle: 'italic', fontSize: 15, color: '#9c9c9c', whiteSpace: 'nowrap' }}>
          ............
        </div>
      </div>
      {/* Arrow icon */}
      <div
        style={{
          width: 47,
          height: 47,
          borderRadius: '50%',
          border: `2px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <span style={{ color: textColor, fontSize: 20, fontWeight: 700 }}>→</span>
      </div>
    </div>
  );
}

function FilledPlayerSlot({
  participant,
  side,
  viewState,
}: {
  participant: MatchParticipant;
  side: 'A' | 'B';
  viewState: ViewState;
}) {
  const profile = participant.profile as {
    username?: string;
    avatar_url?: string | null;
    discord_avatar_url?: string | null;
    epic_username?: string | null;
    fortnite_username?: string | null;
  } | undefined;

  const avatarUrl = getDiscordAvatarUrl(profile);
  const username = profile?.username || 'Unknown';
  const epicName = profile?.fortnite_username || profile?.epic_username || null;

  const borderColor = side === 'A' ? '#ff1654' : '#d8ff16';
  const nameColor = side === 'A' ? '#ff1654' : '#d8ff16';

  let subtitle: ReactNode = null;
  if (viewState === 'READY_UP') {
    if (participant.ready) {
      subtitle = <span style={{ color: '#46f32f', fontStyle: 'italic' }}>ready to play</span>;
    } else {
      subtitle = <span style={{ color: '#9c9c9c', fontStyle: 'italic' }}>not ready</span>;
    }
  } else if (epicName) {
    subtitle = <span style={{ color: '#9c9c9c', fontStyle: 'italic' }}>{epicName}</span>;
  }

  return (
    <div
      style={{
        background: '#282828',
        border: `1px solid ${borderColor}`,
        borderRadius: 18,
        height: 87,
        width: '100%',
        maxWidth: 368,
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Avatar */}
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{ width: 58, height: 58, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontFamily: F,
            fontWeight: 700,
            fontSize: 24,
            color: nameColor,
          }}
        >
          {username.charAt(0).toUpperCase()}
        </div>
      )}

      {/* Name + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: F, fontWeight: 700, fontSize: 20, color: nameColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {username}
        </div>
        {subtitle && (
          <div style={{ fontFamily: F, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Arrow button */}
      <div
        style={{
          width: 47,
          height: 47,
          borderRadius: '50%',
          border: `2px solid ${borderColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        <span style={{ color: nameColor, fontSize: 20, fontWeight: 700 }}>→</span>
      </div>
    </div>
  );
}

// ─── Terminal banner ──────────────────────────────────────────────────────────
function TerminalBanner({
  status,
  isWinner,
  isParticipant,
  prize,
  entryFee,
  teamSize,
}: {
  status: string;
  isWinner: boolean | undefined;
  isParticipant: boolean;
  prize: number;
  entryFee: number;
  teamSize: number;
}) {
  if (status === 'canceled' || status === 'expired') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(24px, 3vw, 48px)', color: 'rgba(255,255,255,0.4)' }}>CANCELED</div>
        <div style={{ fontFamily: F, fontSize: 15, color: '#9c9c9c', marginTop: 4 }}>All entry fees have been refunded.</div>
      </div>
    );
  }
  if (status === 'disputed') {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(24px, 3vw, 48px)', color: '#ef4444' }}>DISPUTED</div>
        <div style={{ fontFamily: F, fontSize: 15, color: '#9c9c9c', marginTop: 4 }}>An admin will review this match.</div>
      </div>
    );
  }
  if (isParticipant && isWinner !== undefined) {
    return (
      <div style={{ textAlign: 'center', padding: '8px 0' }}>
        <div style={{ fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(24px, 3vw, 48px)', color: isWinner ? '#1aff16' : '#ff1654' }}>
          {isWinner ? 'VICTORY' : 'DEFEAT'}
        </div>
        <div style={{ fontFamily: F, fontSize: 15, color: '#9c9c9c', marginTop: 4 }}>
          {isWinner ? `+${(prize / teamSize).toFixed(2)} coins` : `-${entryFee.toFixed(2)} coins`}
        </div>
      </div>
    );
  }
  return null;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function MatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: matchRaw, isPending, error } = useMatchDetail(id);
  const setPlayerReady = useSetPlayerReady();
  const submitResult = useSubmitResult();
  const cancelMatch = useCancelMatch();

  const match = matchRaw as Match | null;

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isPending) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0f0404', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ position: 'relative', zIndex: 20 }}>
          <NavbarFigmaLoggedIn />
        </div>
        <div style={{ fontFamily: F, fontWeight: 700, fontSize: 24, color: 'rgba(255,255,255,0.5)' }}>
          Loading match...
        </div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────
  if (error || !match) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#0f0404', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <img src="/figma-assets/figma-neon.png" alt="" aria-hidden style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 146, objectFit: 'cover', zIndex: 5, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 20 }}>
          <NavbarFigmaLoggedIn />
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <h1 style={{ fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: 'clamp(32px, 4vw, 60px)', color: 'white' }}>MATCH NOT FOUND</h1>
          <p style={{ fontFamily: F, fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>This match does not exist or has been removed.</p>
          <button
            onClick={() => navigate('/matches')}
            style={{ marginTop: 16, background: '#ff1654', border: 'none', borderRadius: 23, padding: '14px 32px', fontFamily: F, fontWeight: 900, fontSize: 18, color: 'white', cursor: 'pointer' }}
          >
            BACK TO MATCHES
          </button>
        </div>
      </div>
    );
  }

  // ── Derived state ────────────────────────────────────────────────────────
  const participants = (match.participants ?? []) as MatchParticipant[];
  const myParticipant = user ? participants.find((p) => p.user_id === user.id) : undefined;
  const isParticipant = !!myParticipant;
  const isCreator = match.creator_id === user?.id;
  const isTeamMatch = (match.team_size ?? 1) > 1;
  const hasSubmittedResult = !!myParticipant?.result_choice;
  const amReady = !!myParticipant?.ready;

  const teamSize = Math.max(Number(match.team_size ?? 1), 1);
  const teamA = participants.filter((p) => p.team_side === 'A');
  const teamB = participants.filter((p) => p.team_side === 'B');

  const matchResult = Array.isArray(match.result) ? match.result[0] : match.result;
  const isWinner = matchResult
    ? matchResult.winner_user_id === user?.id ||
      (matchResult.winner_team_id && teamA.some((p) => p.user_id === user?.id) && matchResult.winner_team_id === match.team_a_id) ||
      (matchResult.winner_team_id && teamB.some((p) => p.user_id === user?.id) && matchResult.winner_team_id === match.team_b_id)
    : undefined;

  const entryFee = Number(match.entry_fee ?? 0);
  const totalPot = entryFee * teamSize * 2;
  const prize = totalPot * (1 - PLATFORM_FEE);

  const status = match.status ?? 'open';
  const viewState = getViewState(status);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleReady = async () => {
    try {
      await setPlayerReady.mutateAsync(match.id);
      toast({ title: 'Ready!', description: 'You are ready to play.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmitResult = async (result: 'WIN' | 'LOSS') => {
    try {
      await submitResult.mutateAsync({ matchId: match.id, result, isTeam: isTeamMatch });
      toast({ title: 'Result submitted', description: `You declared ${result}.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMatch.mutateAsync(match.id);
      toast({ title: 'Match canceled', description: 'All funds have been refunded.' });
      navigate('/matches');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0f0404', display: 'flex', flexDirection: 'column' }}>

      {/* Top neon decoration */}
      <img
        src="/figma-assets/figma-neon.png"
        alt=""
        aria-hidden
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 146, objectFit: 'cover', zIndex: 5, pointerEvents: 'none' }}
      />

      {/* Navbar */}
      <div style={{ position: 'relative', zIndex: 20, flexShrink: 0 }}>
        <NavbarFigmaLoggedIn />
      </div>

      {/* ── Content area (below navbar) ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 10 }}>

        {/* Match title */}
        <div style={{ textAlign: 'center', padding: 'clamp(4px, 1.2vh, 16px) 0 0' }}>
          <h1
            style={{
              fontFamily: F,
              fontWeight: 900,
              fontStyle: 'italic',
              fontSize: 'clamp(28px, 4.2vw, 80px)',
              color: 'white',
              margin: 0,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {formatMatchTitle(match).toUpperCase()} {formatEntryFee(match)}
            {/* Dot indicator like Figma */}
            <span style={{ color: '#ff1654', fontSize: '0.5em', verticalAlign: 'middle', marginLeft: 8 }}>●</span>
          </h1>
        </div>

        {/* Status progress bar */}
        <div style={{ padding: 'clamp(6px, 1.5vh, 20px) 0 0' }}>
          <MatchStatusProgress status={status} />
        </div>

        {/* Action area (center, above players) */}
        {isParticipant && viewState !== 'TERMINAL' && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'clamp(4px, 1vh, 12px) 0', gap: 24, flexShrink: 0 }}>

            {/* READY UP */}
            {viewState === 'READY_UP' && !amReady && (
              <button
                onClick={handleReady}
                disabled={setPlayerReady.isPending}
                style={{
                  background: '#1aff16',
                  border: 'none',
                  borderRadius: 23,
                  width: 246,
                  height: 69,
                  fontFamily: F,
                  fontWeight: 900,
                  fontSize: 'clamp(20px, 1.875vw, 36px)',
                  color: 'white',
                  cursor: setPlayerReady.isPending ? 'not-allowed' : 'pointer',
                  opacity: setPlayerReady.isPending ? 0.7 : 1,
                  letterSpacing: '0.02em',
                }}
              >
                {setPlayerReady.isPending ? 'READYING...' : 'READY UP'}
              </button>
            )}

            {viewState === 'READY_UP' && amReady && (
              <div style={{ fontFamily: F, fontStyle: 'italic', fontSize: 18, color: '#46f32f', height: 69, display: 'flex', alignItems: 'center' }}>
                You are ready. Waiting for all players...
              </div>
            )}

            {/* WIN / LOSS */}
            {viewState === 'WIN_LOSS' && !hasSubmittedResult && (
              <>
                <button
                  onClick={() => handleSubmitResult('WIN')}
                  disabled={submitResult.isPending}
                  style={{
                    background: '#1aff16',
                    border: 'none',
                    borderRadius: 23,
                    width: 246,
                    height: 69,
                    fontFamily: F,
                    fontWeight: 900,
                    fontSize: 'clamp(20px, 1.875vw, 36px)',
                    color: 'white',
                    cursor: submitResult.isPending ? 'not-allowed' : 'pointer',
                    opacity: submitResult.isPending ? 0.7 : 1,
                  }}
                >
                  WIN
                </button>
                <button
                  onClick={() => handleSubmitResult('LOSS')}
                  disabled={submitResult.isPending}
                  style={{
                    background: '#ff1654',
                    border: 'none',
                    borderRadius: 23,
                    width: 246,
                    height: 69,
                    fontFamily: F,
                    fontWeight: 900,
                    fontSize: 'clamp(20px, 1.875vw, 36px)',
                    color: 'white',
                    cursor: submitResult.isPending ? 'not-allowed' : 'pointer',
                    opacity: submitResult.isPending ? 0.7 : 1,
                  }}
                >
                  LOSS
                </button>
              </>
            )}

            {viewState === 'WIN_LOSS' && hasSubmittedResult && (
              <div style={{ fontFamily: F, fontStyle: 'italic', fontSize: 18, color: '#9c9c9c', height: 69, display: 'flex', alignItems: 'center' }}>
                You declared {myParticipant?.result_choice}. Waiting for opponent...
              </div>
            )}

            {/* DELETE MATCH */}
            {viewState === 'WAIT' && isCreator && (
              <button
                onClick={handleCancel}
                disabled={cancelMatch.isPending}
                style={{
                  background: '#ff0000',
                  border: 'none',
                  borderRadius: 23,
                  width: 237,
                  height: 51,
                  fontFamily: F,
                  fontWeight: 900,
                  fontSize: 'clamp(16px, 1.25vw, 24px)',
                  color: 'white',
                  cursor: cancelMatch.isPending ? 'not-allowed' : 'pointer',
                  opacity: cancelMatch.isPending ? 0.7 : 1,
                  letterSpacing: '0.02em',
                }}
              >
                {cancelMatch.isPending ? 'DELETING...' : 'DELETE MATCH'}
              </button>
            )}
          </div>
        )}

        {/* Terminal banner */}
        {viewState === 'TERMINAL' && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'clamp(4px, 1vh, 12px) 0', flexShrink: 0 }}>
            <TerminalBanner
              status={status}
              isWinner={isWinner}
              isParticipant={isParticipant}
              prize={prize}
              entryFee={entryFee}
              teamSize={teamSize}
            />
          </div>
        )}

        {/* ── Main row: Teams + Chat ── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '0 clamp(12px, 1.5vw, 28px) clamp(8px, 1.5vh, 20px)', gap: 'clamp(8px, 1vw, 16px)', minHeight: 0 }}>

          {/* Left content: VS + teams */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, minWidth: 0, overflow: 'hidden' }}>

            {/* Team A */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 1vh, 14px)', flex: '0 0 auto', width: 'clamp(220px, 22vw, 368px)' }}>
              {Array.from({ length: teamSize }).map((_, i) => {
                const p = teamA[i];
                return p ? (
                  <FilledPlayerSlot key={p.id} participant={p} side="A" viewState={viewState} />
                ) : (
                  <EmptyPlayerSlot key={`a-empty-${i}`} side="A" />
                );
              })}
            </div>

            {/* VS center */}
            <div
              style={{
                position: 'relative',
                width: 'clamp(120px, 12vw, 220px)',
                alignSelf: 'stretch',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {/* Fade left */}
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', background: 'linear-gradient(to right, #0f0404, transparent)', zIndex: 2 }} />
              {/* Fade right */}
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40%', background: 'linear-gradient(to left, #0f0404, transparent)', zIndex: 2 }} />
              <p
                style={{
                  fontFamily: F,
                  fontWeight: 900,
                  fontStyle: 'italic',
                  fontSize: 'clamp(80px, 10.7vw, 205px)',
                  lineHeight: 1,
                  opacity: 0.48,
                  background: 'linear-gradient(180deg, #0f0404 10%, #fff 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  margin: 0,
                  userSelect: 'none',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                VS
              </p>
            </div>

            {/* Team B */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(6px, 1vh, 14px)', flex: '0 0 auto', width: 'clamp(220px, 22vw, 368px)' }}>
              {Array.from({ length: teamSize }).map((_, i) => {
                const p = teamB[i];
                return p ? (
                  <FilledPlayerSlot key={p.id} participant={p} side="B" viewState={viewState} />
                ) : (
                  <EmptyPlayerSlot key={`b-empty-${i}`} side="B" />
                );
              })}
            </div>
          </div>

          {/* Chat panel — only for participants */}
          {user && isParticipant && (
            <div
              style={{
                width: 'clamp(280px, 24vw, 462px)',
                background: '#282828',
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {/* Chat header */}
              <div
                style={{
                  padding: '20px 0 0',
                  textAlign: 'center',
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 'clamp(22px, 2.1vw, 40px)',
                  color: 'white',
                  flexShrink: 0,
                }}
              >
                MATCH CHAT
              </div>
              <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', margin: '12px 24px', flexShrink: 0 }} />

              {/* Chat messages + input */}
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <MatchChat
                  matchId={match.id}
                  matchStatus={status}
                  currentUserId={user.id}
                  isAdmin={false}
                  isParticipant={isParticipant}
                  className="flex-1 bg-transparent border-0 rounded-none overflow-hidden"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom neon decoration */}
      <img
        src="/figma-assets/figma-neon.png"
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: 96,
          objectFit: 'cover',
          zIndex: 5,
          pointerEvents: 'none',
          transform: 'scaleY(-1)',
        }}
      />
    </div>
  );
}
