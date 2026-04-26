import { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, RefreshCw, Wallet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import {
  ADMIN_DIALOG_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
  AdminEmptyState,
  AdminPanel,
  AdminShell,
  AdminStatCard,
} from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, WithdrawalRequest } from '@/types';

type WithdrawalWithProfile = WithdrawalRequest & {
  profiles: Profile | null;
};

type ProcessAction = 'approve' | 'reject';

export default function AdminWithdrawals() {
  const { isAdmin } = useAdminStatus();
  const { toast } = useToast();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [processModal, setProcessModal] = useState<{
    withdrawal: WithdrawalWithProfile | null;
    action: ProcessAction | null;
  }>({
    withdrawal: null,
    action: null,
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [platformDialogOpen, setPlatformDialogOpen] = useState(false);
  const [platformWithdrawAmount, setPlatformWithdrawAmount] = useState('');
  const [platformPaymentNotes, setPlatformPaymentNotes] = useState('');
  const [withdrawingPlatform, setWithdrawingPlatform] = useState(false);

  const {
    data,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-withdrawals'],
    enabled: isAdmin,
    queryFn: async () => {
      const [withdrawalsRes, walletRes, earningsRes] = await Promise.all([
        supabase
          .from('withdrawal_requests')
          .select('*, profiles:user_id(*)')
          .order('created_at', { ascending: false }),
        supabase.from('platform_wallet').select('balance').limit(1).maybeSingle(),
        supabase.from('platform_earnings').select('*').order('created_at', { ascending: false }).limit(20),
      ]);

      return {
        withdrawals: ((withdrawalsRes.data || []) as unknown as WithdrawalWithProfile[]),
        platformBalance: Number(walletRes.data?.balance ?? 0),
        earnings: earningsRes.data || [],
      };
    },
  });

  const withdrawals = data?.withdrawals ?? [];
  const platformBalance = data?.platformBalance ?? 0;
  const earnings = data?.earnings ?? [];

  const pendingWithdrawals = useMemo(
    () => withdrawals.filter((withdrawal) => withdrawal.status === 'pending'),
    [withdrawals],
  );

  const completedWithdrawals = useMemo(
    () => withdrawals.filter((withdrawal) => withdrawal.status !== 'pending').slice(0, 12),
    [withdrawals],
  );

  const openProcessModal = (withdrawal: WithdrawalWithProfile, action: ProcessAction) => {
    setProcessModal({ withdrawal, action });
    setAdminNotes('');
  };

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

    toast({
      title: 'Platform withdrawal created',
      description: `${amount.toFixed(2)} EUR`,
    });
    setPlatformDialogOpen(false);
    setPlatformWithdrawAmount('');
    setPlatformPaymentNotes('');
    await refetch();
  };

  return (
    <AdminShell
      title="Withdrawals"
      description="Approve, reject, and audit payout requests while keeping the platform wallet visible in the same workspace."
      actions={
        <>
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
        <div className="grid gap-4 md:grid-cols-3">
          <AdminStatCard label="Pending requests" value={String(pendingWithdrawals.length)} icon={CreditCard} />
          <AdminStatCard label="Platform balance" value={`${platformBalance.toFixed(2)} EUR`} icon={Wallet} accent="#ffd166" />
          <AdminStatCard label="Recent platform fees" value={String(earnings.length)} icon={Banknote} accent="#72f1b8" />
        </div>

        <div className="grid min-h-0 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <AdminPanel
            title="Pending withdrawals"
            description="Primary action queue. Review destination details and process requests without leaving this screen."
            className="min-h-0"
            contentClassName="min-h-0 h-full"
          >
            {pendingWithdrawals.length === 0 ? (
              <AdminEmptyState
                title="No pending withdrawals"
                description="As soon as a new request is submitted, it will appear here for manual review."
              />
            ) : (
              <div className="min-h-0 h-full overflow-auto rounded-[20px] border border-white/8 bg-black/12">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-[#17090d]">
                    <TableRow className="border-white/8 bg-[#17090d] hover:bg-[#17090d]">
                      <TableHead>User</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Destination</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingWithdrawals.map((withdrawal) => (
                      <TableRow key={withdrawal.id} className="border-white/6">
                        <TableCell>
                          <div className="font-medium text-white">{withdrawal.profiles?.username || 'Unknown user'}</div>
                          <div className="text-xs text-white/48">{withdrawal.user_id}</div>
                        </TableCell>
                        <TableCell className="uppercase text-white/64">{withdrawal.payment_method}</TableCell>
                        <TableCell className="font-semibold text-white">
                          {withdrawal.amount.toFixed(2)} {withdrawal.currency}
                        </TableCell>
                        <TableCell className="max-w-[280px] text-sm text-white/58">{withdrawal.payment_details}</TableCell>
                        <TableCell className="text-sm text-white/48">
                          {new Date(withdrawal.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openProcessModal(withdrawal, 'reject')}
                              className={ADMIN_OUTLINE_BUTTON_CLASS}
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => openProcessModal(withdrawal, 'approve')}
                              className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90"
                            >
                              Approve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </AdminPanel>

          <div className="grid min-h-0 gap-4 xl:grid-rows-[1fr_1fr]">
            <AdminPanel
              title="Processed history"
              description="Latest completed or rejected requests for quick auditing."
              className="min-h-0"
              contentClassName="min-h-0 h-full"
            >
              <div className="min-h-0 h-full overflow-auto rounded-[20px] border border-white/8 bg-black/12">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-[#17090d]">
                    <TableRow className="border-white/8 bg-[#17090d] hover:bg-[#17090d]">
                      <TableHead>User</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Processed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedWithdrawals.length === 0 ? (
                      <TableRow className="border-white/6">
                        <TableCell colSpan={4} className="py-10 text-center text-white/52">
                          No processed withdrawals yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      completedWithdrawals.map((withdrawal) => (
                        <TableRow key={withdrawal.id} className="border-white/6">
                          <TableCell className="text-white">{withdrawal.profiles?.username || withdrawal.user_id}</TableCell>
                          <TableCell className="uppercase text-white/58">{withdrawal.status}</TableCell>
                          <TableCell className="text-white">
                            {withdrawal.amount.toFixed(2)} {withdrawal.currency}
                          </TableCell>
                          <TableCell className="text-sm text-white/48">
                            {withdrawal.processed_at ? new Date(withdrawal.processed_at).toLocaleString() : 'Not processed'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </AdminPanel>

            <AdminPanel
              title="Recent platform earnings"
              description="Latest fee entries credited to the platform wallet."
              className="min-h-0"
              contentClassName="min-h-0 overflow-y-auto pr-1"
            >
              <div className="space-y-3">
                {earnings.length === 0 ? (
                  <AdminEmptyState
                    title="No platform earnings yet"
                    description="When the platform books a fee, it will show up here."
                  />
                ) : (
                  earnings.map((earning: any) => (
                    <div key={earning.id} className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{Number(earning.amount || 0).toFixed(2)} EUR</p>
                          <p className="mt-1 text-xs text-white/50">{earning.match_id || 'Platform entry'}</p>
                        </div>
                        <div className="text-right text-xs text-white/46">
                          {new Date(earning.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </AdminPanel>
          </div>
        </div>
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
