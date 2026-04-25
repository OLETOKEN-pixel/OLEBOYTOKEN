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
      description="Monitor ledger activity, export records, and deep-link back into the underlying match history."
      actions={
        <Button variant="outline" onClick={() => refetch()} className="border-white/14 bg-white/5 text-white hover:bg-white/10">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatCard label="Transactions" value={String(transactions.length)} icon={ScrollText} />
        <AdminStatCard label="Completed" value={String(completedCount)} icon={Activity} accent="#72f1b8" />
        <AdminStatCard label="Ledger volume" value={`${volume.toFixed(2)} C`} icon={Coins} accent="#ffd166" />
      </div>

      <AdminPanel
        title="Transaction ledger"
        description="Read-only finance view with filters, export, and match jump links."
      >
        <TransactionsTable transactions={transactions} loading={isLoading} />
      </AdminPanel>
    </AdminShell>
  );
}
