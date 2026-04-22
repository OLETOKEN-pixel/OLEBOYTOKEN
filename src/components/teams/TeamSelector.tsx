import { AlertCircle, Check, Coins, Users } from 'lucide-react';
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

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED = "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";

function TeamLogo({ logoUrl, name, tag, selected }: { logoUrl: string | null; name: string; tag: string; selected: boolean }) {
  return (
    <div
      className={cn(
        'relative flex h-[62px] w-[62px] shrink-0 items-center justify-center overflow-hidden rounded-[16px] border',
        selected ? 'border-[#ff1654] bg-[#ff1654]/20' : 'border-white/10 bg-white/10',
      )}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={`${name} logo`} className="h-full w-full object-cover" />
      ) : (
        <span className="px-1 text-center text-[15px] leading-none text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
          {tag || name.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function MemberAvatars({ members }: { members: TeamWithMembersAndBalance['members'] }) {
  return (
    <div className="flex min-w-[124px] justify-end -space-x-2" aria-label="Accepted members">
      {members.slice(0, 4).map((member) => {
        const avatarUrl = getDiscordAvatarUrl(member.profile);
        const fallback = member.profile?.username?.charAt(0).toUpperCase() || '?';

        return (
          <Avatar
            key={member.id}
            className="h-[34px] w-[34px] border-2 border-[#151515] bg-[#333]"
            data-avatar-url={avatarUrl ?? ''}
          >
            <AvatarImage
              src={avatarUrl ?? undefined}
              alt={`${member.profile?.username ?? 'Player'} avatar`}
              className="object-cover"
            />
            <AvatarFallback className="bg-[#3b3b3b] text-[13px] text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
              {fallback}
            </AvatarFallback>
          </Avatar>
        );
      })}
    </div>
  );
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
      <div
        className="flex h-full items-center justify-center rounded-[18px] border border-white/10 bg-[rgba(0,0,0,0.42)] text-[18px] text-white/65"
        style={{ fontFamily: FONT_EXPANDED }}
      >
        LOADING TEAMS...
      </div>
    );
  }

  if (eligibleTeams.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-[18px] border border-[#ff1654]/35 bg-[rgba(0,0,0,0.42)] px-8 text-center">
        <AlertCircle className="mb-3 h-8 w-8 text-[#ff1654]" />
        <h4 className="text-[25px] leading-none text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
          NO READY TEAM
        </h4>
        <p className="mt-3 max-w-[500px] text-[15px] leading-[1.25] text-white/65" style={{ fontFamily: FONT_REGULAR }}>
          You need a team with {teamSize}/{teamSize} accepted members before creating a {teamSize}v{teamSize} match.
        </p>
        <div className="mt-5 flex justify-center">
          <Link
            to="/teams"
            className="inline-flex h-[42px] items-center justify-center rounded-[14px] border border-[#ff1654] bg-[#ff1654]/20 px-7 text-[18px] text-white no-underline transition-colors hover:bg-[#ff1654]/30 focus:outline-none focus:ring-0"
            style={{ fontFamily: FONT_EXPANDED_BOLD }}
          >
            MANAGE TEAMS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-[10px] pr-1">
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
              'w-full rounded-[18px] border px-[17px] py-[14px] text-left transition-all duration-200 focus:outline-none focus:ring-0',
              isSelected
                ? 'border-[#ff1654] bg-[linear-gradient(90deg,rgba(255,22,84,0.30),rgba(15,4,4,0.55))]'
                : 'border-transparent bg-[rgba(0,0,0,0.54)] hover:border-[#ff1654]/45 hover:bg-black/65',
              !canSelect && 'cursor-not-allowed opacity-60',
            )}
          >
            <div className="flex min-w-0 items-center justify-between gap-[16px]">
              <div className="flex min-w-0 items-center gap-[14px]">
                <TeamLogo logoUrl={team.logo_url} name={team.name} tag={team.tag} selected={isSelected} />

                <div className="min-w-0">
                  <h4 className="max-w-[310px] truncate text-[22px] leading-none text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                    {team.name}
                  </h4>
                  <div className="mt-[9px] flex flex-wrap items-center gap-[8px]">
                    <span
                      className="inline-flex h-[28px] items-center gap-[8px] rounded-[10px] border border-white/10 bg-white/[0.06] px-[10px] text-[13px] uppercase text-white/75"
                      style={{ fontFamily: FONT_EXPANDED }}
                    >
                      <Users className="h-[13px] w-[13px] text-[#ff1654]" />
                      {team.acceptedMemberCount}/{teamSize} READY
                    </span>
                    <span
                      className="inline-flex h-[28px] items-center gap-[8px] rounded-[10px] border border-white/10 bg-white/[0.06] px-[10px] text-[13px] uppercase text-white/75"
                      style={{ fontFamily: FONT_EXPANDED }}
                    >
                      <Coins className="h-[13px] w-[13px] text-[#ff1654]" />
                      {entryFee.toFixed(2)} EACH
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-[14px]">
                <MemberAvatars members={team.members ?? []} />
                {isSelected && (
                  <div className="flex h-[36px] w-[36px] items-center justify-center rounded-full bg-[#ff1654]">
                    <Check className="h-[20px] w-[20px] text-white" />
                  </div>
                )}
              </div>
            </div>

            {paymentMode === 'split' && insufficientMembers.length > 0 && (
              <div className="mt-[12px] rounded-[13px] border border-red-500/35 bg-red-500/10 px-3 py-2">
                <div className="flex items-center gap-2 text-[13px] leading-[1.15] text-red-100" style={{ fontFamily: FONT_REGULAR }}>
                  <Coins className="h-4 w-4 shrink-0" />
                  <span>
                    Not enough balance: {insufficientMembers.map((member) => member.username).join(', ')}
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
