import {
  ArrowRight,
  CreditCard,
  Package,
  RefreshCw,
  ScrollText,
  Swords,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ADMIN_INSET_PANEL_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
  AdminEmptyState,
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

type AdminActionLog = {
  id: string;
  action_type: string;
  target_type: string;
  created_at: string;
  details: Record<string, unknown> | null;
};

const QUICK_LINKS = [
  { href: '/admin/users', label: 'Open users', copy: 'Roles, bans, balances, and account moderation.', icon: Users },
  { href: '/admin/matches', label: 'Open matches', copy: 'Disputes, proofs, and live state operations.', icon: Swords },
  { href: '/admin/withdrawals', label: 'Open withdrawals', copy: 'Approve or reject payout requests from one workspace.', icon: CreditCard },
  { href: '/admin/shop', label: 'Open shop rewards', copy: 'Manage live level rewards without repo edits.', icon: Package },
  { href: '/admin/challenges', label: 'Open challenges', copy: 'Create or reorder daily and weekly tasks.', icon: Trophy },
];

function describeContentLog(log: AdminActionLog) {
  const details = log.details || {};

  if (log.target_type === 'shop_reward') {
    return String(details.name || 'Shop reward');
  }

  if (log.target_type === 'challenge') {
    return String(details.title || 'Challenge');
  }

  return log.action_type;
}

export default function Admin() {
  const { isAdmin } = useAdminStatus();
  const {
    data,
    isLoading,
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
        logsRes,
        shopRewardsRes,
        challengesRes,
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
        supabase
          .from('admin_action_logs')
          .select('id, action_type, target_type, created_at, details')
          .in('target_type', ['challenge', 'shop_reward'])
          .order('created_at', { ascending: false })
          .limit(8),
        supabase.from('shop_level_rewards').select('*').eq('is_active', true),
        supabase.from('challenges').select('*').eq('is_active', true),
      ]);

      return {
        users: (usersRes.data || []) as Profile[],
        matches: (matchesRes.data || []) as unknown as Match[],
        transactions: (transactionsRes.data || []) as Transaction[],
        withdrawals: (withdrawalsRes.data || []) as unknown as WithdrawalWithProfile[],
        platformBalance: Number(walletRes.data?.balance ?? 0),
        contentLogs: (logsRes.data || []) as AdminActionLog[],
        activeRewards: shopRewardsRes.data || [],
        activeChallenges: challengesRes.data || [],
      };
    },
  });

  const users = data?.users ?? [];
  const matches = data?.matches ?? [];
  const transactions = data?.transactions ?? [];
  const withdrawals = data?.withdrawals ?? [];
  const platformBalance = data?.platformBalance ?? 0;
  const contentLogs = data?.contentLogs ?? [];
  const activeRewards = data?.activeRewards ?? [];
  const activeChallenges = data?.activeChallenges ?? [];

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
          <AdminStatCard label="Users" value={String(users.length)} icon={Users} />
          <AdminStatCard label="Matches" value={String(matches.length)} icon={Swords} accent="#72d2ff" />
          <AdminStatCard label="Transactions" value={String(transactions.length)} icon={ScrollText} accent="#72f1b8" />
          <AdminStatCard label="Pending payouts" value={String(pendingWithdrawals.length)} icon={CreditCard} accent="#ff8a65" />
          <AdminStatCard label="Disputes" value={String(disputedCount)} icon={Trophy} accent="#ffd166" />
          <AdminStatCard label="Platform balance" value={`${platformBalance.toFixed(2)} EUR`} icon={Wallet} accent="#ff8ead" />
        </div>

        <div className="grid min-h-0 gap-4 xl:grid-cols-[1.12fr_0.88fr]">
          <AdminPanel className="h-full" contentClassName="h-full overflow-y-auto pr-1">
            <IssueCenter matches={matches} onRefresh={() => void refetch()} />
          </AdminPanel>

          <div className="grid min-h-0 gap-4 xl:grid-rows-[0.82fr_1.18fr]">
            <AdminPanel
              title="Quick actions"
              description="Jump straight into the admin workspace that replaces the old tab stack."
              className="min-h-0"
              contentClassName="min-h-0 overflow-y-auto pr-1"
            >
              <div className="grid gap-3">
                {QUICK_LINKS.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="group flex items-center justify-between rounded-[22px] border border-[#302025] bg-[#1c1c1c] px-4 py-4 transition hover:border-[#ff1654]/28 hover:bg-[#26161b]"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-[16px] border border-[#302025] bg-[#151012]">
                        <link.icon className="h-5 w-5 text-[#ff8ead]" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{link.label}</p>
                        <p className="mt-1 max-w-[320px] text-xs leading-5 text-white/48">{link.copy}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/28 transition group-hover:text-[#ff8ead]" />
                  </Link>
                ))}
              </div>
            </AdminPanel>

            <div className="grid min-h-0 gap-4 xl:grid-cols-[0.92fr_1.08fr]">
              <AdminPanel
                title="Recent payout requests"
                description="Latest user withdrawals waiting for action."
                className="min-h-0"
                contentClassName="min-h-0 overflow-y-auto pr-1"
              >
                {withdrawals.length === 0 && !isLoading ? (
                  <AdminEmptyState
                    title="No withdrawals yet"
                    description="When users submit payout requests, they will appear here and in the dedicated withdrawals view."
                  />
                ) : (
                  <div className="space-y-3">
                    {withdrawals.slice(0, 6).map((withdrawal) => (
                      <div key={withdrawal.id} className={`${ADMIN_INSET_PANEL_CLASS} p-4`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-white">{withdrawal.profiles?.username || withdrawal.user_id}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/44">
                              {withdrawal.payment_method}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-white">
                              {withdrawal.amount.toFixed(2)} {withdrawal.currency}
                            </p>
                            <p className="mt-1 text-xs text-white/44">{withdrawal.status}</p>
                          </div>
                        </div>
                      </div>
                    ))}

                    <Button
                      asChild
                      variant="outline"
                      className={`w-full ${ADMIN_OUTLINE_BUTTON_CLASS}`}
                    >
                      <Link to="/admin/withdrawals">Open withdrawals</Link>
                    </Button>
                  </div>
                )}
              </AdminPanel>

              <AdminPanel
                title="Live content"
                description="Snapshot of what is currently live from the self-service admin tools."
                className="min-h-0"
                contentClassName="min-h-0 overflow-y-auto pr-1"
              >
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={`${ADMIN_INSET_PANEL_CLASS} p-4`}>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/44">Active shop rewards</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{activeRewards.length}</p>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Visible in the public shop and next-reward surfaces.
                    </p>
                  </div>

                  <div className={`${ADMIN_INSET_PANEL_CLASS} p-4`}>
                    <p className="text-xs uppercase tracking-[0.2em] text-white/44">Active challenges</p>
                    <p className="mt-3 text-3xl font-semibold text-white">{activeChallenges.length}</p>
                    <p className="mt-2 text-sm leading-6 text-white/50">
                      Daily and weekly tasks currently visible on the live site.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-white/42">Recent content changes</p>
                  {contentLogs.length === 0 && !isLoading ? (
                    <AdminEmptyState
                      title="No content edits logged yet"
                      description="Once rewards or challenges are edited through admin, the audit trail will appear here."
                    />
                  ) : (
                    contentLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between gap-4 rounded-[20px] border border-[#302025] bg-[#1c1c1c] px-4 py-3"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{describeContentLog(log)}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/44">
                            {log.action_type}
                          </p>
                        </div>
                        <p className="text-right text-xs text-white/42">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </AdminPanel>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
