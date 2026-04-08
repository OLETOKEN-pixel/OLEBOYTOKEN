import { Users, User, Coins, AlertCircle } from 'lucide-react';
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
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <button
        type="button"
        aria-pressed={paymentMode === 'cover'}
        onClick={() => onChangePaymentMode('cover')}
        className={cn(
          'w-full rounded-[18px] border px-4 py-4 text-left transition-all duration-200',
          paymentMode === 'cover'
            ? 'border-[#ff1654] bg-[rgba(255,22,84,0.18)]'
            : 'border-transparent bg-[rgba(0,0,0,0.5)] hover:border-white/10 hover:bg-black/60',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#ff1654]/20 text-[#ff6a8f]">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-white md:text-lg">Cover All</h4>
              <p className="text-sm text-white/60">You lock the full team amount.</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-2 text-white">
              <Coins className="h-4 w-4 text-[#ff6a8f]" />
              <span className="text-lg font-bold md:text-xl">{totalCost.toFixed(2)}</span>
            </div>
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">total</p>
          </div>
        </div>

        {!canCover && (
          <div className="mt-4 rounded-[14px] border border-red-500/30 bg-red-500/10 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-red-200">
              <AlertCircle className="h-4 w-4" />
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
          'w-full rounded-[18px] border px-4 py-4 text-left transition-all duration-200',
          paymentMode === 'split'
            ? 'border-[#ff1654] bg-[rgba(255,22,84,0.18)]'
            : 'border-transparent bg-[rgba(0,0,0,0.5)] hover:border-white/10 hover:bg-black/60',
          !canSplit && paymentMode !== 'split' && 'opacity-60',
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white/10 text-white/75">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-base font-semibold text-white md:text-lg">Split Pay</h4>
              <p className="text-sm text-white/60">Each member locks their own share.</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="flex items-center justify-end gap-2 text-white">
              <Coins className="h-4 w-4 text-[#ff6a8f]" />
              <span className="text-lg font-bold md:text-xl">{entryFee.toFixed(2)}</span>
            </div>
            <p className="text-xs uppercase tracking-[0.14em] text-white/45">each</p>
          </div>
        </div>

        {!canSplit && insufficientMembers.length > 0 && (
          <div className="mt-4 rounded-[14px] border border-red-500/30 bg-red-500/10 px-3 py-2">
            <div className="flex items-center gap-2 text-sm text-red-200">
              <AlertCircle className="h-4 w-4" />
              <span>Insufficient balance: {insufficientMembers.map((member) => member.username).join(', ')}</span>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
