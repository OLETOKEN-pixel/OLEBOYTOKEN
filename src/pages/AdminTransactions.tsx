import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Coins,
  Download,
  Gift,
  RefreshCw,
  Search,
  ShoppingBag,
  Trophy,
} from 'lucide-react';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_INSET_PANEL_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
  AdminEmptyState,
  AdminPanel,
  AdminShell,
  AdminStatCard,
} from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Profile, Transaction } from '@/types';

type PurchaseSource = 'stripe' | 'challenge' | 'admin';

type PurchaseRow = Transaction & {
  source: PurchaseSource;
  profile?: Profile | null;
};

const SOURCE_META: Record<
  PurchaseSource,
  { label: string; accent: string; surface: string; border: string; description: string }
> = {
  stripe: {
    label: 'Stripe',
    accent: '#72d2ff',
    surface: 'rgba(114,210,255,0.10)',
    border: 'rgba(114,210,255,0.32)',
    description: 'Coins purchased via Stripe checkout.',
  },
  challenge: {
    label: 'Challenge',
    accent: '#ffd166',
    surface: 'rgba(255,209,102,0.10)',
    border: 'rgba(255,209,102,0.30)',
    description: 'Coins paid out for completed challenges.',
  },
  admin: {
    label: 'Admin gift',
    accent: '#ff8ead',
    surface: 'rgba(255,142,173,0.10)',
    border: 'rgba(255,142,173,0.30)',
    description: 'Coins granted by an admin.',
  },
};

function classifyTransaction(tx: Transaction): PurchaseSource | null {
  const description = (tx.description || '').toLowerCase().trim();

  if (tx.stripe_session_id) return 'stripe';
  if (description.startsWith('challenge:')) return 'challenge';
  if (description.startsWith('admin:') || description.startsWith('manual reconciliation')) return 'admin';

  return null;
}

function formatCoins(amount: number) {
  const sign = amount < 0 ? '-' : '+';
  return `${sign}${Math.abs(amount).toFixed(2)} C`;
}

function shortId(id: string) {
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`;
}

function exportCsv(rows: PurchaseRow[]) {
  const headers = ['ID', 'Source', 'User', 'Amount', 'Description', 'Created'];
  const data = rows.map((row) => [
    row.id,
    SOURCE_META[row.source].label,
    row.profile?.username || row.user_id,
    row.amount.toFixed(2),
    row.description ?? '',
    new Date(row.created_at).toISOString(),
  ]);

  const csv = [headers, ...data]
    .map((line) =>
      line
        .map((cell) => {
          const value = String(cell ?? '');
          return value.includes(',') || value.includes('"')
            ? `"${value.replace(/"/g, '""')}"`
            : value;
        })
        .join(','),
    )
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `purchases-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminTransactions() {
  const { isAdmin } = useAdminStatus();
  const [sourceFilter, setSourceFilter] = useState<'all' | PurchaseSource>('all');
  const [search, setSearch] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-transactions-purchases'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .or(
          'stripe_session_id.not.is.null,description.ilike.Challenge:%,description.ilike.Admin:%,description.ilike.Manual reconciliation%',
        )
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) {
        console.error('Error fetching purchases:', error);
        return { rows: [] as PurchaseRow[] };
      }

      const transactions = (txs || []) as Transaction[];
      const userIds = Array.from(new Set(transactions.map((tx) => tx.user_id))).filter(Boolean);

      let profileMap = new Map<string, Profile>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('user_id', userIds);

        profileMap = new Map(((profiles || []) as Profile[]).map((p) => [p.user_id, p]));
      }

      const rows = transactions.reduce<PurchaseRow[]>((acc, tx) => {
        const source = classifyTransaction(tx);
        if (!source) return acc;
        acc.push({ ...tx, source, profile: profileMap.get(tx.user_id) ?? null });
        return acc;
      }, []);

      return { rows };
    },
  });

  const rows = data?.rows ?? [];

  const stripeCount = rows.filter((row) => row.source === 'stripe').length;
  const stripeVolume = rows
    .filter((row) => row.source === 'stripe')
    .reduce((total, row) => total + Math.abs(row.amount), 0);
  const adminCount = rows.filter((row) => row.source === 'admin').length;
  const adminVolume = rows
    .filter((row) => row.source === 'admin')
    .reduce((total, row) => total + Math.abs(row.amount), 0);
  const challengeCount = rows.filter((row) => row.source === 'challenge').length;
  const challengeVolume = rows
    .filter((row) => row.source === 'challenge')
    .reduce((total, row) => total + Math.abs(row.amount), 0);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return rows.filter((row) => {
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (!query) return true;

      const username = row.profile?.username?.toLowerCase() ?? '';
      const displayName = row.profile?.discord_display_name?.toLowerCase() ?? '';
      const description = row.description?.toLowerCase() ?? '';

      return (
        username.includes(query) ||
        displayName.includes(query) ||
        description.includes(query) ||
        row.id.toLowerCase().includes(query) ||
        row.user_id.toLowerCase().includes(query)
      );
    });
  }, [rows, search, sourceFilter]);

  const filterPills: Array<{ value: 'all' | PurchaseSource; label: string; count: number }> = [
    { value: 'all', label: 'All purchases', count: rows.length },
    { value: 'stripe', label: 'Stripe', count: stripeCount },
    { value: 'challenge', label: 'Challenges', count: challengeCount },
    { value: 'admin', label: 'Admin gifts', count: adminCount },
  ];

  return (
    <AdminShell
      title="Transactions"
      description="Coin purchases only — Stripe checkouts, challenge rewards, and admin gifts. Match locks, fees and refunds live in the matches workspace."
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => exportCsv(filteredRows)}
            disabled={filteredRows.length === 0}
            className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Total purchases"
            value={String(rows.length)}
            icon={ShoppingBag}
            hint="Stripe + challenges + admin"
          />
          <AdminStatCard
            label="Stripe revenue"
            value={`${stripeVolume.toFixed(2)} C`}
            icon={CreditCard}
            accent="#72d2ff"
            hint={`${stripeCount} purchases`}
          />
          <AdminStatCard
            label="Challenge payouts"
            value={`${challengeVolume.toFixed(2)} C`}
            icon={Trophy}
            accent="#ffd166"
            hint={`${challengeCount} rewards claimed`}
          />
          <AdminStatCard
            label="Admin gifted"
            value={`${adminVolume.toFixed(2)} C`}
            icon={Gift}
            accent="#ff8ead"
            hint={`${adminCount} manual grants`}
          />
        </div>

        <AdminPanel className="h-full" contentClassName="flex h-full min-h-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {filterPills.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setSourceFilter(pill.value)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                  sourceFilter === pill.value
                    ? 'border-[#ff1654] bg-[#221014] text-white'
                    : 'border-[#39242b] bg-[#1c1c1c] text-[#b6adb0] hover:border-[#ff1654]/40 hover:text-white',
                )}
              >
                <span>{pill.label}</span>
                <span className="rounded-full bg-black/40 px-2 py-0.5 text-[11px] text-white/72">
                  {pill.count}
                </span>
              </button>
            ))}

            <div className="ml-auto relative w-full max-w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#77686d]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by user, description, ID..."
                className={cn('h-11 pl-9', ADMIN_FIELD_CLASS)}
              />
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.22em] text-[#7a6b70]">
            {filteredRows.length} {filteredRows.length === 1 ? 'purchase' : 'purchases'} shown
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="grid h-full place-items-center text-sm text-white/50">
                <RefreshCw className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredRows.length === 0 ? (
              <AdminEmptyState
                title="No purchases match the current filter"
                description="Try a different source or clear the search to see every coin purchase."
              />
            ) : (
              <div className="grid gap-3">
                {filteredRows.map((row) => {
                  const meta = SOURCE_META[row.source];
                  const username = row.profile?.discord_display_name || row.profile?.username || row.user_id;

                  return (
                    <article
                      key={row.id}
                      className={`${ADMIN_INSET_PANEL_CLASS} flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between`}
                    >
                      <div className="flex min-w-0 items-start gap-3">
                        <div
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] border"
                          style={{
                            background: meta.surface,
                            borderColor: meta.border,
                            color: meta.accent,
                          }}
                        >
                          {row.source === 'stripe' ? (
                            <CreditCard className="h-5 w-5" />
                          ) : row.source === 'challenge' ? (
                            <Trophy className="h-5 w-5" />
                          ) : (
                            <Gift className="h-5 w-5" />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{username}</p>
                            <span
                              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                              style={{
                                background: meta.surface,
                                borderColor: meta.border,
                                color: meta.accent,
                              }}
                            >
                              {meta.label}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-white/56">
                            {row.description || meta.description}
                          </p>

                          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#7a6b70]">
                            ID {shortId(row.id)} · {new Date(row.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                        <div className="text-right">
                          <p className="font-['Base_Neue_Trial-Bold','Helvetica',_sans-serif] text-2xl font-semibold text-white">
                            <Coins className="mr-1 inline-block h-4 w-4 text-[#ff8ead]" />
                            {formatCoins(row.amount)}
                          </p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-[#7a6b70]">
                            {row.status || 'completed'}
                          </p>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
