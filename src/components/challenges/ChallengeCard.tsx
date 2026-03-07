import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Challenge } from '@/hooks/useChallenges';
import { ClaimButton } from './ClaimButton';
import { CoinIcon } from '@/components/common/CoinIcon';
import { Zap, Gamepad2, Clock, Camera, Sparkles, Check, Lock } from 'lucide-react';

interface ChallengeCardProps {
  challenge: Challenge;
  onClaim: (challengeId: string, periodKey: string) => Promise<unknown>;
  isClaiming: boolean;
}

const metricIcons: Record<string, React.ReactNode> = {
  match_completed: <Gamepad2 className="w-5 h-5" />,
  ready_up_fast: <Clock className="w-5 h-5" />,
  proof_uploaded: <Camera className="w-5 h-5" />,
  match_created_started: <Sparkles className="w-5 h-5" />,
};

export const ChallengeCard = memo(function ChallengeCard({
  challenge,
  onClaim,
  isClaiming,
}: ChallengeCardProps) {
  const progressPercent = Math.min(
    (challenge.progress_value / challenge.target_value) * 100,
    100
  );

  const isCompleted = challenge.is_completed;
  const isClaimed = challenge.is_claimed;
  const canClaim = isCompleted && !isClaimed;

  const handleClaim = async () => {
    await onClaim(challenge.id, challenge.period_key);
  };

  return (
    <div
      className={cn(
        'premium-card p-5 relative overflow-hidden',
        canClaim && 'border-[hsl(var(--gold)/0.4)] glow-gold-soft',
        isClaimed && 'opacity-60'
      )}
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'p-2.5 rounded-xl',
                canClaim
                  ? 'bg-[hsl(var(--gold)/0.1)] text-gold'
                  : isClaimed
                  ? 'bg-[hsl(var(--bg-2))] text-[hsl(var(--text-tertiary))]'
                  : 'bg-[hsl(var(--teal)/0.1)] text-[hsl(var(--teal))]'
              )}
            >
              {metricIcons[challenge.metric_type] || <Zap className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-tight">
                {challenge.title}
              </h3>
              <p className="text-xs text-[hsl(var(--text-secondary))] mt-0.5">
                {challenge.description}
              </p>
            </div>
          </div>

          {isClaimed && (
            <span className="flex items-center gap-1 text-xs text-green-500 font-medium shrink-0">
              <Check className="w-3 h-3" />
              Done
            </span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[hsl(var(--text-secondary))]">Progress</span>
            <span className={cn('font-mono font-medium', isCompleted && 'text-green-500')}>
              {challenge.progress_value}/{challenge.target_value}
            </span>
          </div>
          <div className="w-full h-1 rounded-full bg-[hsl(var(--bg-2))]">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isCompleted ? "bg-green-500" : "bg-[hsl(var(--gold))]"
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            {challenge.reward_xp > 0 && (
              <span className="inline-flex items-center text-xs font-medium text-[hsl(var(--text-secondary))] bg-[hsl(var(--bg-2))] px-2.5 py-1 rounded-full">
                <Zap className="w-3 h-3 mr-1 text-gold" />
                +{challenge.reward_xp} XP
              </span>
            )}
            {challenge.reward_coin > 0 && (
              <span className="inline-flex items-center text-xs font-medium text-gold bg-[hsl(var(--gold)/0.08)] px-2.5 py-1 rounded-full border border-[hsl(var(--gold)/0.15)]">
                <CoinIcon size="xs" className="mr-1" />
                +{challenge.reward_coin}
              </span>
            )}
          </div>

          {canClaim ? (
            <ClaimButton onClick={handleClaim} isLoading={isClaiming} />
          ) : !isClaimed ? (
            <span className="badge-status text-xs">
              Active
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});
