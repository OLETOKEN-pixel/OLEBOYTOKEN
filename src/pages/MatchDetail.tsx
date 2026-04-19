import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NavbarFigmaLoggedIn } from '@/components/layout/NavbarFigmaLoggedIn';
import { MatchChat } from '@/components/matches/MatchChat';
import { PlayerStatsModal } from '@/components/player/PlayerStatsModal';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  useMatchDetail,
  useSetPlayerReady,
  useSubmitResult,
  useCancelMatch,
} from '@/hooks/useMatches';
import { formatEntryFee } from '@/lib/matchFormatters';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { copyTextToClipboard } from '@/lib/copyToClipboard';
import { PLATFORM_FEE } from '@/types';
import type { Match, MatchParticipant, ProfileSummary } from '@/types';

// ─── fonts shorthand ─────────────────────────────────────────────────────────
const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_BOLD_OBLIQUE =
  "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK_OBLIQUE =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";

const READY_ASSETS = {
  epicLogo: '/figma-assets/match-ready/epic-games-logo.png',
  playerActionRed: '/figma-assets/player-profile/see-more-red.svg',
  playerActionGreen: [
    '/figma-assets/player-profile/see-more-green.svg',
    '/figma-assets/player-profile/see-more-green.svg',
    '/figma-assets/player-profile/see-more-green.svg',
  ],
  statusCreatedEllipse: '/figma-assets/match-ready/status-created-ellipse.svg',
  statusStartedEllipse: '/figma-assets/match-ready/status-started-ellipse.svg',
  statusFinishedEllipse: '/figma-assets/match-ready/status-finished-ellipse.svg',
  statusCreatedCheck: '/figma-assets/match-ready/status-created-check.svg',
  statusLineCreatedStarted: '/figma-assets/match-ready/status-line-created-started.svg',
  statusLineStartedFinished: '/figma-assets/match-ready/status-line-started-finished.svg',
  chatDivider: '/figma-assets/match-ready/chat-divider.svg',
};

// ─── Epic Games logo SVG (inline) ────────────────────────────────────────────
function EpicIcon() {
  return (
    <svg
      width="13"
      height="15"
      viewBox="0 0 512 512"
      fill="currentColor"
      style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 4, opacity: 0.75, flexShrink: 0 }}
    >
      <path d="M256 0C114.6 0 0 114.6 0 256s114.6 256 256 256 256-114.6 256-256S397.4 0 256 0zm117.4 319.2h-47.7v47.7h-47.4v-47.7h-47.7v-47.4h47.7v-47.7h47.4v47.7h47.7v47.4zm-187.5 47.7h-47.4V192.8h47.4v174.1zm0-221.5h-47.4v-47.4h47.4v47.4zm234.9 0h-47.4v-47.4h47.4v47.4z" />
    </svg>
  );
}

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
    subtitle = (
      <span style={{ color: '#9c9c9c', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>
        <EpicIcon />
        {epicName}
      </span>
    );
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
function ReadyStatusProgress({ status }: { status: string }) {
  const isStarted = ['in_progress', 'result_pending', 'started', 'completed', 'finished', 'disputed', 'admin_resolved'].includes(status);
  const isFinished = ['completed', 'finished', 'admin_resolved'].includes(status);
  const lineColor = '#ff1654';
  const lineInactiveColor = '#4b4447';
  const StatusNode = ({
    active,
    baseAsset,
    label,
    style,
  }: {
    active: boolean;
    baseAsset: string;
    label: string;
    style: CSSProperties;
  }) => (
    <div aria-label={`${label} status ${active ? 'active' : 'inactive'}`} style={{ position: 'absolute', width: 66, height: 66, ...style }}>
      <img src={active ? READY_ASSETS.statusCreatedEllipse : baseAsset} alt="" aria-hidden style={{ display: 'block', width: 66, height: 66 }} />
      {active && (
        <img
          src={READY_ASSETS.statusCreatedCheck}
          alt=""
          aria-hidden
          style={{ position: 'absolute', left: 13, top: 17, width: 40, height: 31 }}
        />
      )}
    </div>
  );

  return (
    <div aria-label="Match status progress" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <StatusNode
        active
        baseAsset={READY_ASSETS.statusCreatedEllipse}
        label="Created"
        style={{ left: 'calc(13.333% + 7px)', top: 297 }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 'calc(16.667% + 9px)',
          top: 329,
          width: 388,
          height: 3,
          background: isStarted ? lineColor : lineInactiveColor,
        }}
      />
      <StatusNode
        active={isStarted}
        baseAsset={READY_ASSETS.statusStartedEllipse}
        label="Started"
        style={{ left: 'calc(36.667% + 9px)', top: 297 }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 'calc(40% + 11px)',
          top: 329,
          width: 385,
          height: 3,
          background: isFinished ? lineColor : lineInactiveColor,
        }}
      />
      <StatusNode
        active={isFinished}
        baseAsset={READY_ASSETS.statusFinishedEllipse}
        label="Finished"
        style={{ left: 'calc(60% + 11px)', top: 297 }}
      />
      {[
        { label: 'CREATED', left: 'calc(13.333% - 11px)', top: 376 },
        { label: 'STARTED', left: 'calc(36.667% - 9px)', top: 376 },
        { label: 'FINISHED', left: 'calc(60% - 7px)', top: 376 },
      ].map((step) => (
        <span
          key={step.label}
          style={{
            position: 'absolute',
            left: step.left,
            top: step.top,
            fontFamily: FONT_BOLD,
            fontSize: 24,
            lineHeight: 1,
            color: '#ffffff',
            whiteSpace: 'nowrap',
          }}
        >
          {step.label}
        </span>
      ))}
    </div>
  );
}

function ReadyPlayerSlot({
  participant,
  side,
  actionAsset,
  maskIdentity,
  emptyLabel = 'Unknown',
  emptySubtitle = 'Unknown',
  onOpenProfile,
  onCopyEpicName,
}: {
  participant?: MatchParticipant;
  side: 'A' | 'B';
  actionAsset: string;
  maskIdentity?: boolean;
  emptyLabel?: string;
  emptySubtitle?: string;
  onOpenProfile?: (participant: MatchParticipant) => void;
  onCopyEpicName?: (epicName: string) => void;
}) {
  const [isEpicHovered, setIsEpicHovered] = useState(false);
  const profile = !maskIdentity ? participant?.profile as {
    username?: string;
    avatar_url?: string | null;
    discord_avatar_url?: string | null;
    epic_username?: string | null;
    fortnite_username?: string | null;
  } | undefined : undefined;
  const avatarUrl = participant && !maskIdentity ? getDiscordAvatarUrl(profile) : null;
  const username = profile?.username || emptyLabel;
  const epicName = profile?.fortnite_username || profile?.epic_username || emptySubtitle;
  const accent = side === 'A' ? '#ff1654' : '#d8ff16';
  const showEpicLogo = !!participant || emptySubtitle !== '............';
  const canOpenProfile = !!participant && !maskIdentity && !!participant.user_id;
  const canCopyEpicName = !!participant && !maskIdentity && !!epicName && !['Unknown', '............'].includes(epicName);
  const profileButtonLabel = canOpenProfile ? `Open ${username} profile` : 'Player profile unavailable';

  return (
    <div
      style={{
        position: 'relative',
        width: 368,
        height: 87,
        borderRadius: 18,
        border: `1px solid ${accent}`,
        background: '#282828',
        overflow: 'hidden',
      }}
    >
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          style={{
            position: 'absolute',
            left: 26,
            top: 15,
            width: 58,
            height: 58,
            borderRadius: '50%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          aria-label="Player avatar missing"
          style={{
            position: 'absolute',
            left: 26,
            top: 15,
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: '#565656',
          }}
        />
      )}

      <span
        style={{
          position: 'absolute',
          left: 87,
          top: 22,
          maxWidth: 202,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontFamily: FONT_BOLD,
          fontSize: 20,
          lineHeight: '24px',
          color: accent,
        }}
      >
        {username}
      </span>

      <div
        style={{
          position: 'absolute',
          left: 87,
          top: 51,
          width: 210,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          overflow: 'hidden',
        }}
      >
        {canCopyEpicName ? (
          <button
            type="button"
            aria-label={`Copy Epic username ${epicName}`}
            title="Copy Epic username"
            onClick={() => onCopyEpicName?.(epicName)}
            onMouseEnter={() => setIsEpicHovered(true)}
            onMouseLeave={() => setIsEpicHovered(false)}
            style={{
              minWidth: 0,
              maxWidth: 170,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: 0,
              border: 0,
              outline: 'none',
              background: 'transparent',
              fontFamily: FONT_BOLD_OBLIQUE,
              fontSize: 15,
              lineHeight: '18px',
              color: '#9c9c9c',
              cursor: 'copy',
              textDecorationLine: isEpicHovered ? 'underline' : 'none',
              textDecorationColor: accent,
              textDecorationThickness: 2,
              textUnderlineOffset: 3,
            }}
          >
            {epicName}
          </button>
        ) : (
          <span
            style={{
              minWidth: 0,
              maxWidth: 170,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontFamily: FONT_BOLD_OBLIQUE,
              fontSize: 15,
              lineHeight: '18px',
              color: '#9c9c9c',
            }}
          >
            {epicName}
          </span>
        )}
        {showEpicLogo && (
          <img src={READY_ASSETS.epicLogo} alt="" aria-hidden style={{ width: 16, height: 19, flexShrink: 0, opacity: 0.75 }} />
        )}
      </div>

      <button
        type="button"
        aria-label={profileButtonLabel}
        disabled={!canOpenProfile}
        onClick={() => {
          if (participant && canOpenProfile) onOpenProfile?.(participant);
        }}
        style={{
          position: 'absolute',
          right: 11,
          top: 20,
          width: 47,
          height: 47,
          padding: 0,
          border: 0,
          borderRadius: '50%',
          background: 'transparent',
          cursor: canOpenProfile ? 'pointer' : 'default',
          opacity: canOpenProfile ? 1 : 0.62,
        }}
      >
        <img
          src={actionAsset}
          alt=""
          aria-hidden
          style={{ display: 'block', width: 47, height: 47 }}
        />
      </button>
    </div>
  );
}

function ReadyVsMark() {
  return (
    <div data-testid="match-ready-vs" aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <p
        style={{
          position: 'absolute',
          left: 'calc(26.667% + 36px)',
          top: 600,
          width: 364,
          height: 229,
          margin: 0,
          fontFamily: FONT_EXPANDED_BLACK_OBLIQUE,
          fontSize: 205.331,
          fontStyle: 'normal',
          fontWeight: 'normal',
          lineHeight: 'normal',
          opacity: 0.48,
          color: 'transparent',
          backgroundImage: 'linear-gradient(180.20163242201932deg, rgb(15, 4, 4) 10.117%, rgb(255, 255, 255) 99.722%)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          WebkitMaskImage: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, #000 19%, #000 78%, rgba(0,0,0,0) 100%)',
          maskImage: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, #000 19%, #000 78%, rgba(0,0,0,0) 100%)',
          userSelect: 'none',
        }}
      >
        VS
      </p>
    </div>
  );
}

function ReadyChatPanel({
  matchId,
  status,
  currentUserId,
  isParticipant,
  teamMap,
  profileMap,
}: {
  matchId: string;
  status: string;
  currentUserId?: string;
  isParticipant: boolean;
  teamMap: Record<string, 'A' | 'B'>;
  profileMap: Record<string, ProfileSummary>;
}) {
  if (!currentUserId || !isParticipant) return null;

  return (
    <section
      aria-label="Match chat"
      style={{
        position: 'absolute',
        right: 44,
        top: 202,
        width: 462,
        height: 680,
        borderRadius: 18,
        background: '#282828',
        boxShadow: '0px 0px 28.2px 7px rgba(255,22,84,0.12)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 30,
      }}
    >
      <h2
        style={{
          margin: 0,
          paddingTop: 18,
          height: 79,
          fontFamily: FONT_EXPANDED_BOLD,
          fontSize: 40,
          lineHeight: '48px',
          color: '#ffffff',
          textAlign: 'center',
        }}
      >
        MATCH CHAT
      </h2>
      <img
        src={READY_ASSETS.chatDivider}
        alt=""
        aria-hidden
        style={{ width: 350, height: 2, margin: '0 auto', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <MatchChat
          matchId={matchId}
          matchStatus={status}
          currentUserId={currentUserId}
          isAdmin={false}
          isParticipant={isParticipant}
          hideHeader
          teamMap={teamMap}
          profileMap={profileMap}
          variant="figmaReady"
          className="flex-1 bg-transparent border-0 rounded-none overflow-hidden"
        />
      </div>
    </section>
  );
}

function ReadyLobbyScreen({
  match,
  status,
  viewState,
  currentUserId,
  currentTeamSide,
  isParticipant,
  isCreator,
  amReady,
  hasSubmittedResult,
  teamSize,
  teamA,
  teamB,
  teamMap,
  profileMap,
  readyCount,
  readyTotal,
  readyPending,
  cancelPending,
  submitPending,
  onReady,
  onCancel,
  onSubmitResult,
  onRules,
  isWinner,
  prize = 0,
  entryFee = 0,
}: {
  match: Match;
  status: string;
  viewState: ViewState;
  currentUserId?: string;
  currentTeamSide?: 'A' | 'B';
  isParticipant: boolean;
  isCreator: boolean;
  amReady: boolean;
  hasSubmittedResult: boolean;
  teamSize: number;
  teamA: MatchParticipant[];
  teamB: MatchParticipant[];
  teamMap: Record<string, 'A' | 'B'>;
  profileMap: Record<string, ProfileSummary>;
  readyCount: number;
  readyTotal: number;
  readyPending: boolean;
  cancelPending: boolean;
  submitPending: boolean;
  onReady: () => void;
  onCancel: () => void;
  onSubmitResult: (result: 'WIN' | 'LOSS') => void;
  onRules: () => void;
  isWinner?: boolean;
  prize?: number;
  entryFee?: number;
}) {
  const [selectedProfileUserId, setSelectedProfileUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const slots = Array.from({ length: teamSize });
  const teamTop = 666 - Math.max(teamSize - 1, 0) * 48;
  const isWaitingForAcceptance = viewState === 'WAIT';
  const isReadyCheck = viewState === 'READY_UP';
  const isPlaying = viewState === 'WIN_LOSS';
  const isTerminal = viewState === 'TERMINAL';
  const shouldMaskParticipants = isWaitingForAcceptance || isReadyCheck;
  const actionLabel = isWaitingForAcceptance ? 'CANCEL' : `READY (${readyCount}/${readyTotal})`;
  const actionDisabled = isWaitingForAcceptance
    ? !isCreator || cancelPending
    : !isParticipant || amReady || readyPending;
  const handlePrimaryAction = isWaitingForAcceptance ? onCancel : onReady;
  const shouldMaskSlot = (participant?: MatchParticipant) =>
    !!participant &&
    shouldMaskParticipants &&
    (!currentTeamSide || participant.team_side !== currentTeamSide);
  const creatorProfile = match.creator as ProfileSummary | undefined;
  const getVisibleParticipant = (participant?: MatchParticipant): MatchParticipant | undefined => {
    if (!participant || !isPlaying || participant.user_id !== match.creator_id || !creatorProfile) {
      return participant;
    }

    const profile = participant.profile as ProfileSummary | undefined;

    return {
      ...participant,
      profile: {
        ...creatorProfile,
        ...profile,
        username: profile?.username || creatorProfile.username,
        avatar_url: profile?.avatar_url || creatorProfile.avatar_url,
        discord_avatar_url: profile?.discord_avatar_url || creatorProfile.discord_avatar_url,
        epic_username: profile?.epic_username || creatorProfile.epic_username,
      },
    };
  };

  const handleOpenProfile = (participant: MatchParticipant) => {
    if (!participant.user_id) return;
    setSelectedProfileUserId(participant.user_id);
  };

  const handleCopyEpicName = async (epicName: string) => {
    try {
      const copied = await copyTextToClipboard(epicName);
      toast({
        title: copied ? 'Epic username copied' : 'Copy unavailable',
        description: copied ? epicName : 'Copy it manually from the card.',
        variant: copied ? undefined : 'destructive',
      });
    } catch (err: any) {
      toast({
        title: 'Copy failed',
        description: err?.message || 'Unable to copy Epic username.',
        variant: 'destructive',
      });
    }
  };

  const actionButtonBase = {
    position: 'absolute' as const,
    top: 426,
    width: 218,
    height: 52,
    borderRadius: 16,
    fontFamily: FONT_BOLD,
    fontSize: 24,
    lineHeight: 1,
    color: '#ffffff',
  };

  return (
    <div data-testid="match-ready-lobby" style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0f0404' }}>
      <img
        src="/figma-assets/figma-neon.png"
        alt=""
        aria-hidden
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 146, objectFit: 'cover', zIndex: 5, pointerEvents: 'none' }}
      />
      <NavbarFigmaLoggedIn />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          minWidth: 1280,
          zIndex: 10,
        }}
      >
        <ReadyStatusProgress status={status} />

        {!isTerminal && (
          <button
            type="button"
            onClick={onRules}
            style={{
              position: 'absolute',
              left: 'calc(26.667% + 7px)',
              top: 426,
              width: 218,
              height: 52,
              borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.5)',
              background: '#282828',
              fontFamily: FONT_BOLD,
              fontSize: 24,
              lineHeight: 1,
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            SEE RULES
          </button>
        )}

        {(isWaitingForAcceptance || isReadyCheck) && (
          <button
            type="button"
            onClick={handlePrimaryAction}
            disabled={actionDisabled}
            style={{
              ...actionButtonBase,
              left: 'calc(36.667% + 50px)',
              border: '1px solid #ff1654',
              background: 'rgba(255,22,84,0.34)',
              cursor: actionDisabled ? 'default' : 'pointer',
              opacity: readyPending || cancelPending ? 0.72 : 1,
            }}
          >
            {actionLabel}
          </button>
        )}

        {isPlaying && !hasSubmittedResult && (
          <>
            <button
              type="button"
              onClick={() => onSubmitResult('WIN')}
              disabled={!isParticipant || submitPending}
              style={{
                ...actionButtonBase,
                left: 'calc(36.667% + 50px)',
                border: '1px solid #1aff16',
                background: 'rgba(26,255,22,0.28)',
                cursor: !isParticipant || submitPending ? 'default' : 'pointer',
                opacity: submitPending ? 0.72 : 1,
              }}
            >
              WIN
            </button>
            <button
              type="button"
              onClick={() => onSubmitResult('LOSS')}
              disabled={!isParticipant || submitPending}
              style={{
                ...actionButtonBase,
                left: 'calc(36.667% + 282px)',
                border: '1px solid #ff1654',
                background: 'rgba(255,22,84,0.34)',
                cursor: !isParticipant || submitPending ? 'default' : 'pointer',
                opacity: submitPending ? 0.72 : 1,
              }}
            >
              LOSS
            </button>
          </>
        )}

        {isPlaying && hasSubmittedResult && (
          <div
            style={{
              ...actionButtonBase,
              left: 'calc(36.667% + 50px)',
              width: 450,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#9c9c9c',
              fontFamily: FONT_BOLD_OBLIQUE,
              fontSize: 18,
            }}
          >
            Waiting for opponent result...
          </div>
        )}

        {isTerminal && (
          <div
            style={{
              position: 'absolute',
              left: 'calc(36.667% + 50px)',
              top: 400,
              width: 450,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
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

        <ReadyVsMark />

        <div
          style={{
            position: 'absolute',
            left: 'calc(13.333% + 7px)',
            top: teamTop,
            width: 368,
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            zIndex: 3,
          }}
        >
          {slots.map((_, index) => (
            <ReadyPlayerSlot
              key={teamA[index]?.id ?? `ready-a-empty-${index}`}
              participant={getVisibleParticipant(teamA[index])}
              side="A"
              actionAsset={READY_ASSETS.playerActionRed}
              maskIdentity={shouldMaskSlot(teamA[index])}
              emptyLabel={isWaitingForAcceptance ? 'Wait for a player' : 'Unknown'}
              emptySubtitle={isWaitingForAcceptance ? '............' : 'Unknown'}
              onOpenProfile={handleOpenProfile}
              onCopyEpicName={handleCopyEpicName}
            />
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 'calc(43.333% + 29px)',
            top: teamTop,
            width: 368,
            display: 'flex',
            flexDirection: 'column',
            gap: 9,
            zIndex: 3,
          }}
        >
          {slots.map((_, index) => (
            <ReadyPlayerSlot
              key={teamB[index]?.id ?? `ready-b-empty-${index}`}
              participant={getVisibleParticipant(teamB[index])}
              side="B"
              actionAsset={READY_ASSETS.playerActionGreen[index % READY_ASSETS.playerActionGreen.length]}
              maskIdentity={shouldMaskSlot(teamB[index])}
              emptyLabel={isWaitingForAcceptance ? 'Wait for a player' : 'Unknown'}
              emptySubtitle={isWaitingForAcceptance ? '............' : 'Unknown'}
              onOpenProfile={handleOpenProfile}
              onCopyEpicName={handleCopyEpicName}
            />
          ))}
        </div>

        <ReadyChatPanel
          matchId={match.id}
          status={status}
          currentUserId={currentUserId}
          isParticipant={isParticipant}
          teamMap={teamMap}
          profileMap={profileMap}
        />
      </div>

      <PlayerStatsModal
        open={!!selectedProfileUserId}
        onOpenChange={(open) => {
          if (!open) setSelectedProfileUserId(null);
        }}
        userId={selectedProfileUserId || ''}
      />

      <img
        src="/figma-assets/figma-neon.png"
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          top: 809,
          left: 0,
          width: 1920,
          height: 146,
          objectFit: 'cover',
          zIndex: 5,
          pointerEvents: 'none',
          transform: 'scaleY(-1)',
        }}
      />
    </div>
  );
}

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
  const currentTeamSide = myParticipant?.team_side === 'A' || myParticipant?.team_side === 'B'
    ? myParticipant.team_side
    : undefined;
  const isTeamMatch = (match.team_size ?? 1) > 1;
  const hasSubmittedResult = !!myParticipant?.result_choice;
  const amReady = !!myParticipant?.ready;

  const teamSize = Math.max(Number(match.team_size ?? 1), 1);
  const teamA = participants.filter((p) => p.team_side === 'A');
  const teamB = participants.filter((p) => p.team_side === 'B');
  const readyTotal = teamSize * 2;
  const readyCount = participants.filter((p) => p.ready).length;

  const matchResult = Array.isArray(match.result) ? match.result[0] : match.result;
  const isWinner = matchResult
    ? matchResult.winner_user_id === user?.id ||
      (matchResult.winner_team_id && teamA.some((p) => p.user_id === user?.id) && matchResult.winner_team_id === match.team_a_id) ||
      (matchResult.winner_team_id && teamB.some((p) => p.user_id === user?.id) && matchResult.winner_team_id === match.team_b_id)
    : undefined;

  const entryFee = Number(match.entry_fee ?? 0);
  const totalPot = entryFee * teamSize * 2;
  const prize = totalPot * (1 - PLATFORM_FEE);

  // teamMap: userId → 'A' | 'B' — passed to chat for team-colored usernames
  const teamMap: Record<string, 'A' | 'B'> = {};
  const profileMap: Record<string, ProfileSummary> = {};
  participants.forEach((p) => {
    if (p.team_side === 'A' || p.team_side === 'B') {
      teamMap[p.user_id] = p.team_side;
    }
    if (p.profile) {
      profileMap[p.user_id] = p.profile as ProfileSummary;
    }
  });
  if (match.creator) {
    profileMap[match.creator_id] = match.creator as ProfileSummary;
  }

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

  const handleRules = () => {
    navigate('/rules');
  };

  if (viewState === 'WAIT' || viewState === 'READY_UP' || viewState === 'WIN_LOSS' || viewState === 'TERMINAL') {
    return (
      <ReadyLobbyScreen
        match={match}
        status={status}
        viewState={viewState}
        currentUserId={user?.id}
        currentTeamSide={currentTeamSide}
        isParticipant={isParticipant}
        isCreator={isCreator}
        amReady={amReady}
        hasSubmittedResult={hasSubmittedResult}
        teamSize={teamSize}
        teamA={teamA}
        teamB={teamB}
        teamMap={teamMap}
        profileMap={profileMap}
        readyCount={readyCount}
        readyTotal={readyTotal}
        readyPending={setPlayerReady.isPending}
        cancelPending={cancelMatch.isPending}
        submitPending={submitResult.isPending}
        onReady={handleReady}
        onCancel={handleCancel}
        onSubmitResult={handleSubmitResult}
        onRules={handleRules}
        isWinner={isWinner as boolean | undefined}
        prize={prize}
        entryFee={entryFee}
      />
    );
  }

  // Fallback — should never be reached since all viewStates are handled above
  return null;
}
