import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ProofSection } from '@/components/matches/ProofSection';
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
  formatFirstTo,
  formatPlatform,
  formatEntryFee,
} from '@/lib/matchFormatters';
import { PLATFORM_FEE } from '@/types';
import type { Match, MatchParticipant } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  ready_check: 'Ready Check',
  full: 'Ready Check',
  in_progress: 'In Progress',
  result_pending: 'Result Pending',
  completed: 'Completed',
  finished: 'Completed',
  disputed: 'Disputed',
  canceled: 'Canceled',
  admin_resolved: 'Admin Resolved',
  expired: 'Expired',
};

function getStatusClass(status: string): string {
  if (status === 'full') return 'ready_check';
  if (status === 'finished') return 'completed';
  return status;
}

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

  if (isPending) {
    return (
      <PublicLayout>
        <section className="match-detail">
          <div className="match-detail__loading">
            <div className="match-detail__spinner" />
          </div>
        </section>
      </PublicLayout>
    );
  }

  if (error || !match) {
    return (
      <PublicLayout>
        <section className="match-detail">
          <img
            className="match-detail__top-neon"
            src="/figma-assets/figma-neon.png"
            alt=""
            aria-hidden="true"
          />
          <div className="match-detail__content">
            <Link to="/matches" className="match-detail__back">
              <ArrowLeft size={18} />
              Back to Matches
            </Link>
            <div style={{ textAlign: 'center', paddingTop: '80px' }}>
              <h1 className="match-detail__title" style={{ fontSize: '36px' }}>
                MATCH NOT FOUND
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: '12px', fontFamily: "'Base Neue Trial', sans-serif" }}>
                This match does not exist or has been removed.
              </p>
            </div>
          </div>
        </section>
      </PublicLayout>
    );
  }

  const participants = (match.participants ?? []) as MatchParticipant[];
  const myParticipant = user ? participants.find((p) => p.user_id === user.id) : undefined;
  const isParticipant = !!myParticipant;
  const isCreator = match.creator_id === user?.id;
  const isTeamMatch = (match.team_size ?? 1) > 1;
  const hasSubmittedResult = !!myParticipant?.result_choice;
  const amReady = !!myParticipant?.ready;

  const teamA = participants.filter((p) => p.team_side === 'A');
  const teamB = participants.filter((p) => p.team_side === 'B');

  const matchResult = Array.isArray(match.result) ? match.result[0] : match.result;
  const isWinner = matchResult
    ? matchResult.winner_user_id === user?.id ||
      (matchResult.winner_team_id && teamA.some((p) => p.user_id === user?.id) && matchResult.winner_team_id === match.team_a_id) ||
      (matchResult.winner_team_id && teamB.some((p) => p.user_id === user?.id) && matchResult.winner_team_id === match.team_b_id)
    : undefined;

  const entryFee = Number(match.entry_fee ?? 0);
  const teamSize = Math.max(Number(match.team_size ?? 1), 1);
  const totalPot = entryFee * teamSize * 2;
  const prize = totalPot * (1 - PLATFORM_FEE);

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

  const status = match.status ?? 'open';
  const showActions =
    isParticipant &&
    ['open', 'ready_check', 'full', 'in_progress', 'result_pending'].includes(status);
  const isTerminal = ['completed', 'finished', 'canceled', 'admin_resolved', 'expired'].includes(status);

  return (
    <PublicLayout>
      <section className="match-detail">
        <img
          className="match-detail__top-neon"
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
        />

        <div className="match-detail__content">
          <Link to="/matches" className="match-detail__back">
            <ArrowLeft size={18} />
            Back to Matches
          </Link>

          {/* Header */}
          <div className="match-detail__header">
            <h1 className="match-detail__title">
              {formatMatchTitle(match)}
            </h1>
            <span className={`match-detail__status match-detail__status--${getStatusClass(status)}`}>
              <span className="match-detail__status-dot" />
              {STATUS_LABELS[status] || status.toUpperCase()}
            </span>
          </div>

          {/* Info Grid */}
          <div className="match-detail__info-grid">
            <div className="match-detail__info-item">
              <span className="match-detail__info-label">First To</span>
              <span className="match-detail__info-value">{formatFirstTo(match)}</span>
            </div>
            <div className="match-detail__info-item">
              <span className="match-detail__info-label">Platform</span>
              <span className="match-detail__info-value">{formatPlatform(match.platform)}</span>
            </div>
            <div className="match-detail__info-item">
              <span className="match-detail__info-label">Region</span>
              <span className="match-detail__info-value">{String(match.region ?? '').toUpperCase()}</span>
            </div>
            <div className="match-detail__info-item">
              <span className="match-detail__info-label">Entry Fee</span>
              <span className="match-detail__info-value">{formatEntryFee(match)}</span>
            </div>
            <div className="match-detail__info-item">
              <span className="match-detail__info-label">Prize Pool</span>
              <span className="match-detail__info-value match-detail__info-value--gold">
                {prize.toFixed(2)}
              </span>
            </div>
            <div className="match-detail__info-item">
              <span className="match-detail__info-label">Mode</span>
              <span className="match-detail__info-value">
                {isTeamMatch ? `${teamSize}v${teamSize}` : '1v1'}
              </span>
            </div>
          </div>

          {/* Result Banner (for terminal states) */}
          {isTerminal && matchResult && isParticipant && (
            <div
              className={`match-detail__result-banner ${
                isWinner
                  ? 'match-detail__result-banner--winner'
                  : 'match-detail__result-banner--loser'
              }`}
            >
              <div
                className={`match-detail__result-label ${
                  isWinner
                    ? 'match-detail__result-label--winner'
                    : 'match-detail__result-label--loser'
                }`}
              >
                {isWinner ? 'VICTORY' : 'DEFEAT'}
              </div>
              <div className="match-detail__result-sub">
                {isWinner
                  ? `You earned ${(prize / teamSize).toFixed(2)} coins`
                  : `You lost ${entryFee.toFixed(2)} coins`}
              </div>
            </div>
          )}

          {isTerminal && status === 'canceled' && (
            <div className="match-detail__result-banner match-detail__result-banner--neutral">
              <div className="match-detail__result-label" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '36px' }}>
                CANCELED
              </div>
              <div className="match-detail__result-sub">All entry fees have been refunded.</div>
            </div>
          )}

          {status === 'disputed' && (
            <div className="match-detail__result-banner match-detail__result-banner--neutral">
              <div className="match-detail__result-label" style={{ color: '#EF4444', fontSize: '36px' }}>
                DISPUTED
              </div>
              <div className="match-detail__result-sub">
                Both sides declared conflicting results. An admin will review this match.
              </div>
            </div>
          )}

          {/* Teams */}
          <div className="match-detail__teams">
            <div className="match-detail__team match-detail__team--a">
              <div className="match-detail__team-label">
                {isTeamMatch ? 'Team A' : 'Player 1'} {isCreator && '(Host)'}
              </div>
              {teamA.length > 0 ? (
                teamA.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    showReady={status === 'ready_check' || status === 'full'}
                  />
                ))
              ) : (
                <div className="match-detail__participant-empty">Waiting for player...</div>
              )}
            </div>

            <div className="match-detail__vs">VS</div>

            <div className="match-detail__team match-detail__team--b">
              <div className="match-detail__team-label">
                {isTeamMatch ? 'Team B' : 'Player 2'}
              </div>
              {teamB.length > 0 ? (
                teamB.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    participant={p}
                    showReady={status === 'ready_check' || status === 'full'}
                  />
                ))
              ) : (
                <div className="match-detail__participant-empty">Waiting for opponent...</div>
              )}
            </div>
          </div>

          {/* Actions */}
          {showActions && (
            <div className="match-detail__actions">
              {/* Open: creator can cancel, others just see waiting */}
              {status === 'open' && isCreator && (
                <>
                  <div className="match-detail__actions-title">Waiting for opponent</div>
                  <div className="match-detail__action-row">
                    <span className="match-detail__waiting">
                      Your match is live on the board...
                    </span>
                    <button
                      className="match-detail__btn match-detail__btn--cancel"
                      onClick={handleCancel}
                      disabled={cancelMatch.isPending}
                    >
                      {cancelMatch.isPending ? 'Canceling...' : 'Cancel Match'}
                    </button>
                  </div>
                </>
              )}

              {status === 'open' && !isCreator && (
                <div className="match-detail__actions-title">Waiting for the match to fill...</div>
              )}

              {/* Ready Check */}
              {(status === 'ready_check' || status === 'full') && (
                <>
                  <div className="match-detail__actions-title">Ready Check</div>
                  <div className="match-detail__action-row">
                    {amReady ? (
                      <span className="match-detail__waiting">
                        You are ready. Waiting for all players...
                      </span>
                    ) : (
                      <button
                        className="match-detail__btn match-detail__btn--ready"
                        onClick={handleReady}
                        disabled={setPlayerReady.isPending}
                      >
                        {setPlayerReady.isPending ? 'Readying...' : 'READY UP'}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* In Progress */}
              {status === 'in_progress' && (
                <div className="match-detail__actions-title">
                  Match in progress — good luck!
                </div>
              )}

              {/* Result Pending */}
              {status === 'result_pending' && !hasSubmittedResult && (
                <>
                  <div className="match-detail__actions-title">Declare your result</div>
                  <div className="match-detail__action-row">
                    <button
                      className="match-detail__btn match-detail__btn--win"
                      onClick={() => handleSubmitResult('WIN')}
                      disabled={submitResult.isPending}
                    >
                      I WON
                    </button>
                    <button
                      className="match-detail__btn match-detail__btn--loss"
                      onClick={() => handleSubmitResult('LOSS')}
                      disabled={submitResult.isPending}
                    >
                      I LOST
                    </button>
                  </div>
                </>
              )}

              {status === 'result_pending' && hasSubmittedResult && (
                <>
                  <div className="match-detail__actions-title">Result submitted</div>
                  <span className="match-detail__waiting">
                    You declared {myParticipant?.result_choice}. Waiting for opponent...
                  </span>
                </>
              )}

              {/* In progress — also show result buttons since backend accepts in_progress too */}
              {status === 'in_progress' && !hasSubmittedResult && (
                <>
                  <div className="match-detail__actions-title" style={{ marginTop: '16px' }}>
                    Ready to declare?
                  </div>
                  <div className="match-detail__action-row">
                    <button
                      className="match-detail__btn match-detail__btn--win"
                      onClick={() => handleSubmitResult('WIN')}
                      disabled={submitResult.isPending}
                    >
                      I WON
                    </button>
                    <button
                      className="match-detail__btn match-detail__btn--loss"
                      onClick={() => handleSubmitResult('LOSS')}
                      disabled={submitResult.isPending}
                    >
                      I LOST
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Proof Section */}
          {user && ['in_progress', 'result_pending', 'disputed', 'completed', 'finished'].includes(status) && (
            <div className="match-detail__section">
              <h3 className="match-detail__section-title">Proof & Screenshots</h3>
              <ProofSection
                matchId={match.id}
                currentUserId={user.id}
                isAdmin={false}
                isParticipant={isParticipant}
              />
            </div>
          )}

          {/* Chat */}
          {user && (
            <div className="match-detail__section">
              <h3 className="match-detail__section-title">Match Chat</h3>
              <MatchChat
                matchId={match.id}
                matchStatus={status}
                currentUserId={user.id}
                isAdmin={false}
                isParticipant={isParticipant}
              />
            </div>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}

function ParticipantRow({
  participant,
  showReady,
}: {
  participant: MatchParticipant;
  showReady: boolean;
}) {
  const profile = participant.profile as { username?: string; discord_avatar_url?: string | null } | undefined;
  return (
    <div className="match-detail__participant">
      {profile?.discord_avatar_url ? (
        <img
          className="match-detail__participant-avatar"
          src={profile.discord_avatar_url}
          alt=""
        />
      ) : (
        <div className="match-detail__participant-avatar" />
      )}
      <span className="match-detail__participant-name">
        {profile?.username || 'Unknown Player'}
      </span>
      {showReady && (
        <span
          className={`match-detail__participant-ready ${
            participant.ready
              ? 'match-detail__participant-ready--yes'
              : 'match-detail__participant-ready--no'
          }`}
        >
          {participant.ready ? 'READY' : 'NOT READY'}
        </span>
      )}
    </div>
  );
}
