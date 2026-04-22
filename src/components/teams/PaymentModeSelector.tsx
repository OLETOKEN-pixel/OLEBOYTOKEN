import { AlertCircle, User, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { PaymentMode, TeamMemberWithBalance } from '@/types';

interface PaymentModeSelectorProps {
  paymentMode: PaymentMode;
  onChangePaymentMode: (mode: PaymentMode) => void;
  entryFee: number;
  teamSize: number;
  memberBalances?: TeamMemberWithBalance[];
  userBalance?: number;
}

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED = "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial-ExpandedBold', 'Base Neue Trial', sans-serif";

function InsufficientMemberList({ members }: { members: TeamMemberWithBalance[] }) {
  if (members.length === 0) {
    return null;
  }

  return (
    <div className="mt-[9px] flex flex-wrap gap-[7px]">
      {members.slice(0, 4).map((member) => (
        <span
          key={member.user_id}
          className="inline-flex h-[26px] max-w-[150px] items-center gap-[7px] rounded-full border border-red-400/30 bg-red-500/10 px-[7px] text-[12px] text-red-100"
          style={{ fontFamily: FONT_REGULAR }}
        >
          <Avatar className="h-[18px] w-[18px] bg-[#3b3b3b]" data-avatar-url={member.avatar_url ?? ''}>
            <AvatarImage src={member.avatar_url ?? undefined} alt={`${member.username} avatar`} className="object-cover" />
            <AvatarFallback className="bg-[#3b3b3b] text-[10px] text-white">
              {member.username?.charAt(0).toUpperCase() || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="truncate">{member.username}</span>
        </span>
      ))}
    </div>
  );
}

export function PaymentModeSelector({
  paymentMode,
  onChangePaymentMode,
  entryFee,
  teamSize,
  memberBalances,
  userBalance = 0,
}: PaymentModeSelectorProps) {
  const totalCost = entryFee * teamSize;
  const canCover = userBalance >= totalCost;
  const insufficientMembers = memberBalances?.filter((member) => member.balance < entryFee) ?? [];
  const canSplit = insufficientMembers.length === 0;

  return (
    <div className="grid grid-cols-2 gap-[13px]">
      <button
        type="button"
        aria-pressed={paymentMode === 'cover'}
        onClick={() => onChangePaymentMode('cover')}
        className={cn(
          'min-h-[104px] w-full rounded-[18px] border px-[17px] py-[14px] text-left transition-all duration-200 focus:outline-none focus:ring-0',
          paymentMode === 'cover'
            ? 'border-[#ff1654] bg-[linear-gradient(90deg,rgba(255,22,84,0.32),rgba(15,4,4,0.56))]'
            : 'border-transparent bg-[rgba(0,0,0,0.54)] hover:border-[#ff1654]/40 hover:bg-black/65',
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-[13px]">
            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] bg-[#ff1654]/20 text-[#ff6a8f]">
              <User className="h-[19px] w-[19px]" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[20px] uppercase leading-none text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                COVER ALL
              </h4>
              <p className="mt-[7px] text-[13px] leading-[1.15] text-white/62" style={{ fontFamily: FONT_REGULAR }}>
                You lock the full team amount.
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-[8px] text-white">
              <span className="h-[12px] w-[12px] shrink-0 rounded-full bg-[#ff1654]" aria-hidden="true" />
              <span className="text-[25px] leading-none" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                {totalCost.toFixed(2)}
              </span>
            </div>
            <p className="mt-[4px] text-[11px] uppercase tracking-[0.14em] text-white/45" style={{ fontFamily: FONT_EXPANDED }}>
              TOTAL
            </p>
          </div>
        </div>

        {!canCover && (
          <div className="mt-[10px] rounded-[13px] border border-red-500/35 bg-red-500/10 px-3 py-2">
            <div className="flex items-center gap-2 text-[12px] leading-[1.15] text-red-100" style={{ fontFamily: FONT_REGULAR }}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>You need {totalCost.toFixed(2)} OBT and currently have {userBalance.toFixed(2)}.</span>
            </div>
          </div>
        )}
      </button>

      <button
        type="button"
        aria-pressed={paymentMode === 'split'}
        onClick={() => canSplit && onChangePaymentMode('split')}
        className={cn(
          'min-h-[104px] w-full rounded-[18px] border px-[17px] py-[14px] text-left transition-all duration-200 focus:outline-none focus:ring-0',
          paymentMode === 'split'
            ? 'border-[#ff1654] bg-[linear-gradient(90deg,rgba(255,22,84,0.32),rgba(15,4,4,0.56))]'
            : 'border-transparent bg-[rgba(0,0,0,0.54)] hover:border-[#ff1654]/40 hover:bg-black/65',
          !canSplit && paymentMode !== 'split' && 'opacity-60',
        )}
      >
        <div className="flex min-w-0 items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-[13px]">
            <div className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[13px] bg-white/10 text-white/75">
              <Users className="h-[19px] w-[19px]" />
            </div>
            <div className="min-w-0">
              <h4 className="text-[20px] uppercase leading-none text-white" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                SPLIT PAY
              </h4>
              <p className="mt-[7px] text-[13px] leading-[1.15] text-white/62" style={{ fontFamily: FONT_REGULAR }}>
                Each member locks their own share.
              </p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-[8px] text-white">
              <span className="h-[12px] w-[12px] shrink-0 rounded-full bg-[#ff1654]" aria-hidden="true" />
              <span className="text-[25px] leading-none" style={{ fontFamily: FONT_EXPANDED_BOLD }}>
                {entryFee.toFixed(2)}
              </span>
            </div>
            <p className="mt-[4px] text-[11px] uppercase tracking-[0.14em] text-white/45" style={{ fontFamily: FONT_EXPANDED }}>
              EACH
            </p>
          </div>
        </div>

        {!canSplit && insufficientMembers.length > 0 && (
          <div className="mt-[10px] rounded-[13px] border border-red-500/35 bg-red-500/10 px-3 py-2">
            <div className="flex items-center gap-2 text-[12px] leading-[1.15] text-red-100" style={{ fontFamily: FONT_REGULAR }}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Not enough balance</span>
            </div>
            <InsufficientMemberList members={insufficientMembers} />
          </div>
        )}
      </button>
    </div>
  );
}
