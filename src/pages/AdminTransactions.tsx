import { Activity, Coins, RefreshCw, ScrollText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminPanel, AdminShell, AdminStatCard } from '@/components/admin/AdminShell';
import { TransactionsTable } from '@/components/admin/TransactionsTable';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Transaction } from '@/types';

export default function AdminTransactions() {
  const { isAdmin } = useAdminStatus();
  const {
    data: transactions = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-transactions'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(800);

      if (error) {
        console.error('Error fetching admin transactions:', error);
        return [];
      }

      return (data || []) as Transaction[];
    },
  });

  const volume = transactions.reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const completedCount = transactions.filter((tx) => tx.status === 'completed' || !tx.status).length;

  return (
    <AdminShell
      title="Transactions"
      description="Read-only ledger view for exports, finance checks, and jumps back to the linked match flow."
      actions={
        <Button
          variant="outline"
          onClick={() => refetch()}
          className="h-11 border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="grid min-h-0 gap-4 xl:grid-rows-[repeat(3,minmax(0,1fr))]">
          <AdminStatCard label="Transactions" value={String(transactions.length)} icon={ScrollText} />
          <AdminStatCard label="Completed" value={String(completedCount)} icon={Activity} accent="#72f1b8" />
          <AdminStatCard label="Ledger volume" value={`${volume.toFixed(2)} C`} icon={Coins} accent="#ffd166" />
        </div>

        <AdminPanel
          title="Transaction ledger"
          description="Filters, export, and match jump links stay visible while the ledger scrolls internally."
          className="h-full"
          contentClassName="h-full"
        >
          <TransactionsTable transactions={transactions} loading={isLoading} fullHeight />
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
