import { useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Download,
  RefreshCw,
  Search,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  ADMIN_DIALOG_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_INSET_PANEL_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
  AdminEmptyState,
  AdminPanel,
  AdminShell,
  AdminStatCard,
} from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { Profile, WithdrawalRequest } from '@/types';

type WithdrawalWithProfile = WithdrawalRequest & {
  profiles: Profile | null;
};

type StatusFilter = 'all' | 'pending' | 'completed' | 'rejected';
type ProcessAction = 'approve' | 'reject';

const STATUS_META: Record<
  string,
  { label: string; color: string; surface: string; border: string }
> = {
  pending: {
    label: 'Pending',
    color: '#ffd166',
    surface: 'rgba(255,209,102,0.10)',
    border: 'rgba(255,209,102,0.34)',
  },
  completed: {
    label: 'Completed',
    color: '#72f1b8',
    surface: 'rgba(114,241,184,0.10)',
    border: 'rgba(114,241,184,0.32)',
  },
  rejected: {
    label: 'Rejected',
    color: '#ff8a65',
    surface: 'rgba(255,138,101,0.10)',
    border: 'rgba(255,138,101,0.34)',
  },
};

function statusMeta(status: string) {
  return STATUS_META[status] || STATUS_META.pending;
}

function shortId(id: string) {
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`;
}

function exportCsv(rows: WithdrawalWithProfile[]) {
  const headers = ['ID', 'User', 'Method', 'Amount', 'Currency', 'Status', 'Created', 'Processed', 'Destination', 'Notes'];
  const data = rows.map((row) => [
    row.id,
    row.profiles?.username || row.user_id,
    row.payment_method,
    row.amount.toFixed(2),
    row.currency,
    row.status,
    new Date(row.created_at).toISOString(),
    row.processed_at ? new Date(row.processed_at).toISOString() : '',
    row.payment_details ?? '',
    row.admin_notes ?? '',
  ]);

  const csv = [headers, ...data]
    .map((line) =>
      line
        .map((cell) => {
          const value = String(cell ?? '');
          return value.includes(',') || value.includes('"') || value.includes('\n')
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
  link.download = `withdrawals-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminWithdrawals() {
  const { isAdmin } = useAdminStatus();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const initial = searchParams.get('status');
    if (initial === 'pending' || initial === 'completed' || initial === 'rejected') return initial;
    return 'all';
  });
  const [search, setSearch] = useState('');

  const [processModal, setProcessModal] = useState<{
    withdrawal: WithdrawalWithProfile | null;
    action: ProcessAction | null;
  }>({ withdrawal: null, action: null });
  const [adminNotes, setAdminNotes] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const [platformDialogOpen, setPlatformDialogOpen] = useState(false);
  const [platformWithdrawAmount, setPlatformWithdrawAmount] = useState('');
  const [platformPaymentNotes, setPlatformPaymentNotes] = useState('');
  const [withdrawingPlatform, setWithdrawingPlatform] = useState(false);

  useEffect(() => {
    const initial = searchParams.get('status');
    if (initial === 'pending' || initial === 'completed' || initial === 'rejected') {
      setStatusFilter(initial);
    }
  }, [searchParams]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-withdrawals'],
    enabled: isAdmin,
    queryFn: async () => {
      const [withdrawalsRes, walletRes] = await Promise.all([
        supabase
          .from('withdrawal_requests')
          .select('*, profiles:user_id(*)')
          .order('created_at', { ascending: false }),
        supabase.from('platform_wallet').select('balance').limit(1).maybeSingle(),
      ]);

      return {
        withdrawals: ((withdrawalsRes.data || []) as unknown as WithdrawalWithProfile[]),
        platformBalance: Number(walletRes.data?.balance ?? 0),
      };
    },
  });

  const withdrawals = data?.withdrawals ?? [];
  const platformBalance = data?.platformBalance ?? 0;

  const counts = useMemo(() => {
    const totals = { all: withdrawals.length, pending: 0, completed: 0, rejected: 0 };
    let pendingAmount = 0;
    let paidAmount = 0;

    for (const item of withdrawals) {
      if (item.status === 'pending') {
        totals.pending += 1;
        pendingAmount += Number(item.amount || 0);
      } else if (item.status === 'completed') {
        totals.completed += 1;
        paidAmount += Number(item.amount || 0);
      } else if (item.status === 'rejected') {
        totals.rejected += 1;
      }
    }

    return { totals, pendingAmount, paidAmount };
  }, [withdrawals]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return withdrawals.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!query) return true;

      const username = row.profiles?.username?.toLowerCase() ?? '';
      const displayName = row.profiles?.discord_display_name?.toLowerCase() ?? '';

      return (
        username.includes(query) ||
        displayName.includes(query) ||
        (row.payment_method || '').toLowerCase().includes(query) ||
        (row.payment_details || '').toLowerCase().includes(query) ||
        row.id.toLowerCase().includes(query) ||
        row.user_id.toLowerCase().includes(query)
      );
    });
  }, [withdrawals, statusFilter, search]);

  const filterPills: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: 'all', label: 'All withdrawals', count: counts.totals.all },
    { value: 'pending', label: 'Pending', count: counts.totals.pending },
    { value: 'completed', label: 'Completed', count: counts.totals.completed },
    { value: 'rejected', label: 'Rejected', count: counts.totals.rejected },
  ];

  const handleProcessWithdrawal = async () => {
    if (!processModal.withdrawal || !processModal.action) return;

    setProcessingId(processModal.withdrawal.id);

    const status = processModal.action === 'approve' ? 'completed' : 'rejected';
    const { data: result, error } = await supabase.rpc('process_withdrawal', {
      p_withdrawal_id: processModal.withdrawal.id,
      p_status: status,
      p_admin_notes: adminNotes.trim() || null,
    });

    setProcessingId(null);

    if (error || (result && !(result as { success?: boolean }).success)) {
      toast({
        title: 'Error',
        description: (result as { error?: string } | null)?.error || error?.message || 'Unable to process withdrawal.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: processModal.action === 'approve' ? 'Withdrawal approved' : 'Withdrawal rejected',
      description: processModal.withdrawal.profiles?.username || processModal.withdrawal.user_id,
    });
    setProcessModal({ withdrawal: null, action: null });
    setAdminNotes('');
    await refetch();
  };

  const handleWithdrawPlatformEarnings = async () => {
    const amount = Number(platformWithdrawAmount);

    if (!Number.isFinite(amount) || amount <= 0 || amount > platformBalance) {
      toast({
        title: 'Invalid amount',
        description: 'Choose an amount lower than the current platform balance.',
        variant: 'destructive',
      });
      return;
    }

    setWithdrawingPlatform(true);

    const { data: result, error } = await supabase.rpc('withdraw_platform_earnings', {
      p_amount: amount,
      p_payment_method: 'stripe',
      p_payment_details: platformPaymentNotes.trim() || 'Admin withdrawal',
    });

    setWithdrawingPlatform(false);

    if (error || (result && !(result as { success?: boolean }).success)) {
      toast({
        title: 'Error',
        description: (result as { error?: string } | null)?.error || error?.message || 'Unable to withdraw platform earnings.',
        variant: 'destructive',
      });
      return;
    }

    toast({ title: 'Platform withdrawal created', description: `${amount.toFixed(2)} EUR` });
    setPlatformDialogOpen(false);
    setPlatformWithdrawAmount('');
    setPlatformPaymentNotes('');
    await refetch();
  };

  return (
    <AdminShell
      title="Withdrawals"
      description="Full payout log. Review pending requests, audit completed payouts, and withdraw the platform balance."
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
          <Button onClick={() => setPlatformDialogOpen(true)} className="h-11 bg-[#ff1654] text-white hover:bg-[#ff1654]/90">
            <Wallet className="mr-2 h-4 w-4" />
            Withdraw platform
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 grid-rows-[auto,minmax(0,1fr)] gap-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Pending requests"
            value={String(counts.totals.pending)}
            icon={CreditCard}
            accent="#ffd166"
            hint={`${counts.pendingAmount.toFixed(2)} EUR awaiting review`}
          />
          <AdminStatCard
            label="Paid out"
            value={`${counts.paidAmount.toFixed(2)} EUR`}
            icon={Banknote}
            accent="#72f1b8"
            hint={`${counts.totals.completed} approved payouts`}
          />
          <AdminStatCard
            label="Rejected"
            value={String(counts.totals.rejected)}
            icon={XCircle}
            accent="#ff8a65"
            hint="Total declined requests"
          />
          <AdminStatCard
            label="Platform balance"
            value={`${platformBalance.toFixed(2)} EUR`}
            icon={Wallet}
            accent="#ff8ead"
            hint="Available to withdraw"
          />
        </div>

        <AdminPanel className="h-full" contentClassName="flex h-full min-h-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {filterPills.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => setStatusFilter(pill.value)}
                className={cn(
                  'flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition',
                  statusFilter === pill.value
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
                placeholder="Search by user, method, ID..."
                className={cn('h-11 pl-9', ADMIN_FIELD_CLASS)}
              />
            </div>
          </div>

          <p className="text-xs uppercase tracking-[0.22em] text-[#7a6b70]">
            {filteredRows.length} {filteredRows.length === 1 ? 'request' : 'requests'} shown
          </p>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {isLoading ? (
              <div className="grid h-full place-items-center text-sm text-white/50">
                <RefreshCw className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredRows.length === 0 ? (
              <AdminEmptyState
                title="No withdrawals match the current filter"
                description="Switch filter or wait for new payout requests to come in."
              />
            ) : (
              <div className="grid gap-3">
                {filteredRows.map((row) => {
                  const status = statusMeta(row.status);
                  const username = row.profiles?.discord_display_name || row.profiles?.username || row.user_id;
                  const isPending = row.status === 'pending';

                  return (
                    <article
                      key={row.id}
                      className={`${ADMIN_INSET_PANEL_CLASS} flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-[16px] border"
                          style={{
                            background: status.surface,
                            borderColor: status.border,
                            color: status.color,
                          }}
                        >
                          <CreditCard className="h-5 w-5" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-white">{username}</p>
                            <span
                              className="rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]"
                              style={{
                                background: status.surface,
                                borderColor: status.border,
                                color: status.color,
                              }}
                            >
                              {status.label}
                            </span>
                            <span className="rounded-full border border-[#39242b] bg-[#1c1c1c] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/64">
                              {row.payment_method}
                            </span>
                          </div>

                          <p className="mt-1 truncate text-xs text-white/56">{row.payment_details || '—'}</p>

                          <p className="mt-2 text-[11px] uppercase tracking-[0.18em] text-[#7a6b70]">
                            ID {shortId(row.id)} · created {new Date(row.created_at).toLocaleString()}
                            {row.processed_at ? ` · processed ${new Date(row.processed_at).toLocaleString()}` : ''}
                          </p>

                          {row.admin_notes ? (
                            <p className="mt-2 rounded-[12px] border border-[#39242b] bg-[#1c1c1c] px-3 py-2 text-xs text-white/64">
                              <span className="font-semibold text-white/76">Admin note:</span> {row.admin_notes}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-3">
                        <div className="text-right">
                          <p className="font-['Base_Neue_Trial-Bold','Helvetica',_sans-serif] text-2xl font-semibold text-white">
                            {row.amount.toFixed(2)} {row.currency}
                          </p>
                          {row.fee_amount > 0 ? (
                            <p className="mt-1 text-[11px] text-white/56">Fee {row.fee_amount.toFixed(2)} {row.currency}</p>
                          ) : null}
                        </div>

                        {isPending ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAdminNotes('');
                                setProcessModal({ withdrawal: row, action: 'reject' });
                              }}
                              className={ADMIN_OUTLINE_BUTTON_CLASS}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setAdminNotes('');
                                setProcessModal({ withdrawal: row, action: 'approve' });
                              }}
                              className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
                            >
                              Approve
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </AdminPanel>
      </div>

      <Dialog
        open={Boolean(processModal.withdrawal && processModal.action)}
        onOpenChange={(open) => {
          if (!open) {
            setProcessModal({ withdrawal: null, action: null });
          }
        }}
      >
        <DialogContent className={ADMIN_DIALOG_CLASS}>
          <DialogHeader>
            <DialogTitle>
              {processModal.action === 'approve' ? 'Approve withdrawal' : 'Reject withdrawal'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#302025] bg-[#1c1c1c] p-4 text-sm text-white/72">
              <p className="font-semibold text-white">
                {processModal.withdrawal?.profiles?.username || processModal.withdrawal?.user_id}
              </p>
              <p className="mt-1">
                {processModal.withdrawal?.amount?.toFixed(2)} {processModal.withdrawal?.currency} via {processModal.withdrawal?.payment_method}
              </p>
            </div>

            <Textarea
              value={adminNotes}
              onChange={(event) => setAdminNotes(event.target.value)}
              placeholder="Optional admin notes"
              className={`min-h-[120px] ${ADMIN_FIELD_CLASS}`}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setProcessModal({ withdrawal: null, action: null })}
              className={ADMIN_OUTLINE_BUTTON_CLASS}
            >
              Cancel
            </Button>
            <Button
              onClick={handleProcessWithdrawal}
              disabled={processingId === processModal.withdrawal?.id}
              className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
            >
              {processingId === processModal.withdrawal?.id ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : processModal.action === 'approve' ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve
                </>
              ) : (
                'Reject request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={platformDialogOpen} onOpenChange={setPlatformDialogOpen}>
        <DialogContent className={ADMIN_DIALOG_CLASS}>
          <DialogHeader>
            <DialogTitle>Withdraw platform earnings</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-[#302025] bg-[#1c1c1c] p-4 text-sm text-white/68">
              Available balance: <span className="font-semibold text-white">{platformBalance.toFixed(2)} EUR</span>
            </div>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={platformWithdrawAmount}
              onChange={(event) => setPlatformWithdrawAmount(event.target.value)}
              placeholder="Amount"
              className={ADMIN_FIELD_CLASS}
            />

            <Textarea
              value={platformPaymentNotes}
              onChange={(event) => setPlatformPaymentNotes(event.target.value)}
              placeholder="Payment notes"
              className={`min-h-[110px] ${ADMIN_FIELD_CLASS}`}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPlatformDialogOpen(false)}
              className={ADMIN_OUTLINE_BUTTON_CLASS}
            >
              Cancel
            </Button>
            <Button
              onClick={handleWithdrawPlatformEarnings}
              disabled={withdrawingPlatform}
              className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
            >
              {withdrawingPlatform ? 'Submitting...' : 'Submit withdrawal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
