import {
  CreditCard,
  RefreshCw,
  ScrollText,
  Swords,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ADMIN_OUTLINE_BUTTON_CLASS,
  AdminPanel,
  AdminShell,
  AdminStatCard,
} from '@/components/admin/AdminShell';
import { GlobalSearchBar } from '@/components/admin/GlobalSearchBar';
import { IssueCenter } from '@/components/admin/IssueCenter';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Match, Profile, Transaction, WithdrawalRequest } from '@/types';

type WithdrawalWithProfile = WithdrawalRequest & {
  profiles: Profile | null;
};

export default function Admin() {
  const { isAdmin } = useAdminStatus();
  const {
    data,
    refetch,
  } = useQuery({
    queryKey: ['admin-dashboard'],
    enabled: isAdmin,
    queryFn: async () => {
      const [
        usersRes,
        matchesRes,
        transactionsRes,
        withdrawalsRes,
        walletRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
        supabase
          .from('matches')
          .select(`*, creator:profiles!matches_creator_id_fkey(*), participants:match_participants(*, profile:profiles(*)), result:match_results(*)`)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(400),
        supabase
          .from('withdrawal_requests')
          .select('*, profiles:user_id(*)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase.from('platform_wallet').select('balance').limit(1).maybeSingle(),
      ]);

      return {
        users: (usersRes.data || []) as Profile[],
        matches: (matchesRes.data || []) as unknown as Match[],
        transactions: (transactionsRes.data || []) as Transaction[],
        withdrawals: (withdrawalsRes.data || []) as unknown as WithdrawalWithProfile[],
        platformBalance: Number(walletRes.data?.balance ?? 0),
      };
    },
  });

  const users = data?.users ?? [];
  const matches = data?.matches ?? [];
  const transactions = data?.transactions ?? [];
  const withdrawals = data?.withdrawals ?? [];
  const platformBalance = data?.platformBalance ?? 0;

  const pendingWithdrawals = withdrawals.filter((withdrawal) => withdrawal.status === 'pending');
  const disputedCount = matches.filter((match) => match.status === 'disputed').length;

  return (
    <AdminShell
      title="Dashboard"
      description="Operational command center for moderation, payouts, diagnostics, and live content management."
      actions={
        <>
          <div className="w-full max-w-[360px]">
            <GlobalSearchBar />
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 grid-rows-[auto,minmax(0,1fr)] gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <AdminStatCard
            label="Users"
            value={String(users.length)}
            icon={Users}
            href="/admin/users"
            hint="Open users workspace"
          />
          <AdminStatCard
            label="Matches"
            value={String(matches.length)}
            icon={Swords}
            accent="#72d2ff"
            href="/admin/matches"
            hint="Open matches workspace"
          />
          <AdminStatCard
            label="Transactions"
            value={String(transactions.length)}
            icon={ScrollText}
            accent="#72f1b8"
            href="/admin/transactions"
            hint="View purchase ledger"
          />
          <AdminStatCard
            label="Pending payouts"
            value={String(pendingWithdrawals.length)}
            icon={CreditCard}
            accent="#ff8a65"
            href="/admin/withdrawals?status=pending"
            hint="Approve or reject"
          />
          <AdminStatCard
            label="Disputes"
            value={String(disputedCount)}
            icon={Trophy}
            accent="#ffd166"
            href="/admin/matches?status=disputed"
            hint="Jump to disputed matches"
          />
          <AdminStatCard
            label="Platform balance"
            value={`${platformBalance.toFixed(2)} EUR`}
            icon={Wallet}
            accent="#ff8ead"
            href="/admin/withdrawals"
            hint="Withdraw earnings"
          />
        </div>

        <AdminPanel className="h-full" contentClassName="h-full overflow-y-auto pr-1">
          <IssueCenter matches={matches} onRefresh={() => void refetch()} />
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
