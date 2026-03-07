import { Link } from 'react-router-dom';
import { Users, Trophy, Clock, CheckCircle2, AlertTriangle, XCircle, EyeOff, Zap, Crown, Skull, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { CoinIcon } from '@/components/common/CoinIcon';
import { cn } from '@/lib/utils';
import type { Match, MatchStatus } from '@/types';

interface MyMatchCardProps {
  match: Match;
  currentUserId: string;
}

const statusConfig: Record<MatchStatus, { 
  label: string; 
  variant: 'live' | 'open' | 'completed' | 'gold' | 'hot' | 'status';
  icon: React.ReactNode;
}> = {
  open: { label: 'Open', variant: 'open', icon: <Clock className="w-3 h-3" /> },
  ready_check: { label: 'Ready Check', variant: 'live', icon: <Zap className="w-3 h-3" /> },
  in_progress: { label: 'Live', variant: 'live', icon: <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse" /> },
  result_pending: { label: 'Submit Result', variant: 'gold', icon: <Trophy className="w-3 h-3" /> },
  completed: { label: 'Completed', variant: 'completed', icon: <CheckCircle2 className="w-3 h-3" /> },
  disputed: { label: 'Disputed', variant: 'hot', icon: <AlertTriangle className="w-3 h-3" /> },
  canceled: { label: 'Canceled', variant: 'status', icon: <XCircle className="w-3 h-3" /> },
  admin_resolved: { label: 'Resolved', variant: 'completed', icon: <CheckCircle2 className="w-3 h-3" /> },
  joined: { label: 'Joined', variant: 'open', icon: <Users className="w-3 h-3" /> },
  full: { label: 'Ready Check', variant: 'live', icon: <Zap className="w-3 h-3" /> },
  started: { label: 'Live', variant: 'live', icon: <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--success))] animate-pulse" /> },
  finished: { label: 'Finished', variant: 'completed', icon: <CheckCircle2 className="w-3 h-3" /> },
  expired: { label: 'Expired', variant: 'status', icon: <XCircle className="w-3 h-3" /> },
};

export function MyMatchCard({ match, currentUserId }: MyMatchCardProps) {
  const participant = match.participants?.find(p => p.user_id === currentUserId);
  
  const teamAPlayers = match.participants?.filter(p => p.team_side === 'A') || [];
  const teamBPlayers = match.participants?.filter(p => p.team_side === 'B') || [];
  
  const opponent = match.team_size === 1
    ? match.participants?.find(p => p.user_id !== currentUserId)
    : null;

  const teamACaptain = teamAPlayers.find(p => p.user_id === match.captain_a_user_id) || teamAPlayers[0];
  const teamBCaptain = teamBPlayers.find(p => p.user_id === match.captain_b_user_id) || teamBPlayers[0];

  const isTeamMode = match.team_size > 1;
  const myTeamCaptain = isTeamMode
    ? (teamAPlayers.some(p => p.user_id === currentUserId) ? teamACaptain : teamBCaptain)
    : null;
  const opponentTeamCaptain = isTeamMode
    ? (teamAPlayers.some(p => p.user_id === currentUserId) ? teamBCaptain : teamACaptain)
    : null;

  const displayOpponent = isTeamMode ? opponentTeamCaptain : opponent;
  const displayMe = isTeamMode ? myTeamCaptain : participant;
  
  const config = statusConfig[match.status] || statusConfig.open;
  
  const readyCount = match.participants?.filter(p => p.ready).length ?? 0;
  const totalParticipants = match.participants?.length ?? 0;
  
  const maxParticipants = match.team_size * 2;
  const prizePool = match.entry_fee * maxParticipants * 0.95;
  
  const needsReadyUp = (match.status === 'ready_check' || match.status === 'full') && participant && !participant.ready;
  const needsResult = (match.status === 'in_progress' || match.status === 'result_pending') && participant && !participant.result_choice;
  const actionRequired = needsReadyUp || needsResult;
  
  const isWinner = match.result?.winner_user_id === currentUserId;
  const isCompleted = match.status === 'completed' || match.status === 'admin_resolved' || match.status === 'finished';
  const isLost = isCompleted && !isWinner && match.result?.winner_user_id;

  const allReady = match.participants?.every(p => p.ready) ?? false;
  const showOpponentIdentity = isCompleted || (match.status !== 'ready_check' && match.status !== 'full') || allReady;

  const accentColor = actionRequired
    ? 'hsl(var(--gold))'
    : isCompleted && isWinner
      ? 'hsl(var(--gold))'
      : isCompleted && isLost
        ? 'hsl(var(--error))'
        : match.status === 'disputed'
          ? 'hsl(var(--error))'
          : 'hsl(var(--teal))';

  return (
    <div className={cn(
      'premium-card overflow-hidden flex',
      actionRequired && 'ring-1 ring-[hsl(var(--gold)/0.3)]',
      match.status === 'disputed' && 'ring-1 ring-[hsl(var(--error)/0.3)]',
    )}>
      <div
        className="w-1 flex-shrink-0 rounded-l-2xl"
        style={{ background: accentColor }}
      />

      <Link to={`/my-matches/${match.id}`} className="flex-1 p-5 space-y-4 block">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <PremiumBadge variant={config.variant} dot>
              {config.label}
            </PremiumBadge>
            {actionRequired && (
              <span className="text-xs font-semibold text-[hsl(var(--gold))] bg-[hsl(var(--gold)/0.08)] px-2 py-0.5 rounded-md">
                Action Required
              </span>
            )}
          </div>
          {isCompleted && match.result?.winner_user_id && (
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold",
              isWinner
                ? 'bg-[hsl(var(--gold)/0.1)] text-[hsl(var(--gold))]'
                : 'bg-[hsl(var(--error)/0.08)] text-[hsl(var(--error))]'
            )}>
              {isWinner ? <Crown className="w-3 h-3" /> : <Skull className="w-3 h-3" />}
              {isWinner ? 'Won' : 'Lost'}
            </div>
          )}
        </div>

        <div className={cn(
          "flex items-center gap-4 p-3 rounded-xl border border-[hsl(var(--border-soft))]",
          isLost ? 'bg-[hsl(var(--error)/0.03)]' : 'bg-[hsl(var(--bg-2)/0.5)]'
        )}>
          <div className="flex-1 flex items-center gap-2.5">
            <Avatar className="w-9 h-9 ring-1 ring-[hsl(var(--border-soft))]">
              <AvatarImage src={(displayMe?.profile?.avatar_url) ?? undefined} />
              <AvatarFallback className="bg-[hsl(var(--bg-2))] text-sm font-semibold">
                {(displayMe?.profile?.username)?.charAt(0).toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{(displayMe?.profile?.username) ?? 'You'}</p>
              {isTeamMode && <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Team {teamAPlayers.some(p => p.user_id === currentUserId) ? 'A' : 'B'}</p>}
            </div>
          </div>

          <div className="flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-[hsl(var(--bg-2))] flex items-center justify-center border border-[hsl(var(--border-soft))]">
              <span className="font-bold text-xs text-[hsl(var(--text-secondary))]">VS</span>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-2.5 justify-end text-right">
            {displayOpponent ? (
              showOpponentIdentity ? (
                <>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{displayOpponent.profile?.username || 'Unknown'}</p>
                    {isTeamMode && <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Team {teamAPlayers.some(p => p.user_id === currentUserId) ? 'B' : 'A'}</p>}
                  </div>
                  <Avatar className="w-9 h-9 ring-1 ring-[hsl(var(--border-soft))]">
                    <AvatarImage src={displayOpponent.profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[hsl(var(--bg-2))] text-sm font-semibold">
                      {displayOpponent.profile?.username?.charAt(0).toUpperCase() || <User className="w-3.5 h-3.5" />}
                    </AvatarFallback>
                  </Avatar>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-medium text-sm text-[hsl(var(--text-tertiary))] italic">Hidden</p>
                    <p className="text-[11px] text-[hsl(var(--text-tertiary))]">Ready up to reveal</p>
                  </div>
                  <Avatar className="w-9 h-9 ring-1 ring-[hsl(var(--border-soft))]">
                    <AvatarFallback className="bg-[hsl(var(--bg-2))]">
                      <EyeOff className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                    </AvatarFallback>
                  </Avatar>
                </>
              )
            ) : (
              <>
                <div>
                  <p className="text-sm text-[hsl(var(--text-tertiary))]">Waiting...</p>
                </div>
                <Avatar className="w-9 h-9 ring-1 ring-dashed ring-[hsl(var(--border-soft))]">
                  <AvatarFallback className="bg-transparent">
                    <User className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" />
                  </AvatarFallback>
                </Avatar>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-[hsl(var(--bg-2)/0.5)] text-center border border-[hsl(var(--border-soft)/0.5)]">
            <p className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-wider mb-0.5">Entry</p>
            <div className="flex items-center justify-center gap-1">
              <CoinIcon size="xs" />
              <span className="font-mono font-bold text-sm">{match.entry_fee}</span>
            </div>
          </div>
          <div className={cn(
            "p-2.5 rounded-xl text-center border",
            isWinner 
              ? 'bg-[hsl(var(--gold)/0.05)] border-[hsl(var(--gold)/0.15)]'
              : isLost 
                ? 'bg-[hsl(var(--error)/0.03)] border-[hsl(var(--error)/0.1)]'
                : 'bg-[hsl(var(--gold)/0.03)] border-[hsl(var(--gold)/0.1)]'
          )}>
            <p className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-wider mb-0.5">Prize</p>
            <div className="flex items-center justify-center gap-1">
              <CoinIcon size="xs" />
              <span className={cn(
                "font-mono font-bold text-sm",
                isWinner ? 'text-[hsl(var(--gold))]' : isLost ? 'text-[hsl(var(--error))]' : 'text-[hsl(var(--gold))]'
              )}>
                {prizePool.toFixed(0)}
              </span>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[hsl(var(--bg-2)/0.5)] text-center border border-[hsl(var(--border-soft)/0.5)]">
            <p className="text-[10px] text-[hsl(var(--text-tertiary))] uppercase tracking-wider mb-0.5">First to</p>
            <p className="font-mono font-bold text-sm">{match.first_to}</p>
          </div>
        </div>

        {(match.status === 'ready_check' || match.status === 'full') && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[hsl(var(--bg-2)/0.5)] border border-[hsl(var(--border-soft)/0.5)]">
            <span className="text-sm text-[hsl(var(--text-secondary))] flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[hsl(var(--teal))]" />
              Ready Status
            </span>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                {[...Array(totalParticipants)].map((_, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      i < readyCount ? "bg-[hsl(var(--success))]" : "bg-[hsl(var(--bg-3))]"
                    )}
                  />
                ))}
              </div>
              <span className="font-mono font-bold text-sm">{readyCount}/{totalParticipants}</span>
              {participant?.ready ? (
                <CheckCircle2 className="w-4 h-4 text-[hsl(var(--success))]" />
              ) : (
                <Clock className="w-4 h-4 text-[hsl(var(--gold))] animate-pulse" />
              )}
            </div>
          </div>
        )}

        <div className={cn(
          "w-full py-2.5 rounded-xl text-center text-sm font-semibold transition-colors",
          actionRequired 
            ? 'btn-premium' 
            : 'bg-[hsl(var(--bg-2))] text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))]'
        )}>
          {needsReadyUp ? 'Ready Up Now' : needsResult ? 'Submit Result' : 'View Details'}
        </div>
      </Link>
    </div>
  );
}
