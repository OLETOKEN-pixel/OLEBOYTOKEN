import { Users, AlertCircle, Check, Coins } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useEligibleTeams } from '@/hooks/useEligibleTeams';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import type { Team, TeamMember, Profile } from '@/types';

interface TeamWithMembersAndBalance extends Team {
  members: (TeamMember & { profile: Profile })[];
  acceptedMemberCount: number;
  memberBalances?: Array<{
    user_id: string;
    username: string;
    balance: number;
    has_sufficient_balance: boolean;
  }>;
}

interface TeamSelectorProps {
  teamSize: number;
  entryFee: number;
  selectedTeamId: string | null;
  onSelectTeam: (team: TeamWithMembersAndBalance | null) => void;
  paymentMode: 'cover' | 'split';
}

export function TeamSelector({
  teamSize,
  entryFee,
  selectedTeamId,
  onSelectTeam,
  paymentMode,
}: TeamSelectorProps) {
  const { eligibleTeams, loading } = useEligibleTeams(teamSize, entryFee);

  if (loading) {
    return (
      <div className="rounded-[18px] border border-white/10 bg-black/25 px-4 py-6 text-center text-sm text-white/65">
        Loading teams...
      </div>
    );
  }

  if (eligibleTeams.length === 0) {
    return (
      <div className="flex h-full flex-col justify-center rounded-[18px] border border-[#ff1654]/25 bg-[rgba(0,0,0,0.35)] px-5 py-4">
        <AlertCircle className="mx-auto mb-2 h-8 w-8 text-[#ff6a8f]" />
        <h4 className="text-center text-[18px] font-semibold text-white">
          No Eligible Teams
        </h4>
        <p className="mx-auto mt-1 max-w-[420px] text-center text-[14px] leading-[1.2] text-white/65">
          You need a team with exactly {teamSize} accepted members for {teamSize}v{teamSize} matches.
        </p>
        <div className="mt-4 flex justify-center">
          <Link
            to="/teams"
            className="inline-flex h-10 items-center justify-center rounded-[14px] border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:border-[#ff1654]/40 hover:bg-[#ff1654]/10"
          >
            Manage Teams
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {eligibleTeams.map((team) => {
        const isSelected = selectedTeamId === team.id;
        const insufficientMembers = paymentMode === 'split'
          ? team.memberBalances?.filter((member) => !member.has_sufficient_balance) ?? []
          : [];
        const canSelect = paymentMode === 'cover' || insufficientMembers.length === 0;

        return (
          <button
            key={team.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => canSelect && onSelectTeam(isSelected ? null : (team as TeamWithMembersAndBalance))}
            className={cn(
              'w-full rounded-[18px] border px-4 py-4 text-left transition-all duration-200',
              isSelected
                ? 'border-[#ff1654] bg-[rgba(255,22,84,0.18)]'
                : 'border-transparent bg-[rgba(0,0,0,0.5)] hover:border-white/10 hover:bg-black/60',
              !canSelect && 'cursor-not-allowed opacity-60',
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-sm font-bold',
                    isSelected ? 'bg-[#ff1654] text-white' : 'bg-white/10 text-white/80',
                  )}
                >
                  {team.tag}
                </div>

                <div className="min-w-0">
                  <h4 className="truncate text-base font-semibold text-white md:text-lg">{team.name}</h4>
                  <p className="text-xs text-white/55 md:text-sm">
                    {team.acceptedMemberCount} accepted members
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="flex -space-x-2">
                  {team.members?.slice(0, 4).map((member) => (
                    <Avatar key={member.id} className="h-8 w-8 border-2 border-[#282828]">
                      <AvatarImage src={getDiscordAvatarUrl(member.profile) ?? undefined} />
                      <AvatarFallback className="bg-black/60 text-xs text-white">
                        {member.profile?.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>

                {isSelected && (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff1654]">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/60 md:text-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Users className="h-3.5 w-3.5 text-[#ff6a8f]" />
                <span>{teamSize}v{teamSize} ready</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                <Coins className="h-3.5 w-3.5 text-[#ff6a8f]" />
                <span>{entryFee.toFixed(2)} OBT each</span>
              </div>
            </div>

            {paymentMode === 'split' && insufficientMembers.length > 0 && (
              <div className="mt-4 rounded-[14px] border border-red-500/30 bg-red-500/10 px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-red-200">
                  <Coins className="h-4 w-4" />
                  <span>
                    Insufficient balance: {insufficientMembers.map((member) => member.username).join(', ')}
                  </span>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
