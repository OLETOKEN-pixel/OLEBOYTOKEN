import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Swords, DollarSign, AlertTriangle, Banknote, CheckCircle, XCircle, TrendingUp, Wallet, CreditCard } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/custom-badge';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, Match, Transaction, WithdrawalRequest } from '@/types';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { GlobalSearchBar } from '@/components/admin/GlobalSearchBar';
import { IssueCenter } from '@/components/admin/IssueCenter';
import { MatchesTable } from '@/components/admin/MatchesTable';
import { UsersTable } from '@/components/admin/UsersTable';
import { TransactionsTable } from '@/components/admin/TransactionsTable';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface WithdrawalWithProfile extends WithdrawalRequest {
  profiles: Profile;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.2, 0.8, 0.2, 1] } },
};

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();

  const [users, setUsers] = useState<Profile[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [platformBalance, setPlatformBalance] = useState<number>(0);
  const [platformEarnings, setPlatformEarnings] = useState<{ id: string; match_id: string; amount: number; created_at: string }[]>([]);
  const [withdrawPlatformDialog, setWithdrawPlatformDialog] = useState(false);
  const [platformWithdrawAmount, setPlatformWithdrawAmount] = useState('');
  const [platformPaymentNotes, setPlatformPaymentNotes] = useState('');
  const [withdrawingPlatform, setWithdrawingPlatform] = useState(false);

  const [processDialog, setProcessDialog] = useState<{ open: boolean; withdrawal: WithdrawalWithProfile | null; action: 'approve' | 'reject' | null }>({
    open: false,
    withdrawal: null,
    action: null,
  });
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        return;
      }
      
      const { data, error } = await supabase.rpc('is_admin');
      if (error || !data) {
        setIsAdmin(false);
        navigate('/');
      } else {
        setIsAdmin(true);
      }
    };
    
    if (!authLoading) {
      checkAdmin();
    }
  }, [user, authLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    
    const [usersRes, matchesRes, transactionsRes, withdrawalsRes, walletRes, earningsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('matches').select(`*, creator:profiles!matches_creator_id_fkey(*), participants:match_participants(*, profile:profiles(*)), result:match_results(*)`).order('created_at', { ascending: false }).limit(200),
      supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(500),
      supabase.from('withdrawal_requests').select('*, profiles:user_id(*)').order('created_at', { ascending: false }),
      supabase.from('platform_wallet').select('balance').limit(1).maybeSingle(),
      supabase.from('platform_earnings').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    if (usersRes.data) setUsers(usersRes.data as Profile[]);
    if (matchesRes.data) setMatches(matchesRes.data as unknown as Match[]);
    if (transactionsRes.data) setTransactions(transactionsRes.data as Transaction[]);
    if (withdrawalsRes.data) setWithdrawals(withdrawalsRes.data as unknown as WithdrawalWithProfile[]);
    if (walletRes.data) setPlatformBalance(Number(walletRes.data.balance));
    if (earningsRes.data) setPlatformEarnings(earningsRes.data);

    setLoading(false);
  };

  useEffect(() => {
    if (!user || isAdmin !== true) return;
    fetchData();
  }, [user, isAdmin]);

  const openProcessDialog = (withdrawal: WithdrawalWithProfile, action: 'approve' | 'reject') => {
    setProcessDialog({ open: true, withdrawal, action });
    setAdminNotes('');
  };

  const handleProcessWithdrawal = async () => {
    if (!processDialog.withdrawal || !processDialog.action) return;
    setProcessing(true);

    const status = processDialog.action === 'approve' ? 'completed' : 'rejected';
    const { data, error } = await supabase.rpc('process_withdrawal', {
      p_withdrawal_id: processDialog.withdrawal.id,
      p_status: status,
      p_admin_notes: adminNotes || null,
    });

    const result = data as { success: boolean; error?: string } | null;
    if (error || (result && !result.success)) {
      toast({ title: 'Errore', description: result?.error || 'Impossibile processare.', variant: 'destructive' });
    } else {
      toast({ title: processDialog.action === 'approve' ? 'Approvato' : 'Rifiutato' });
      fetchData();
    }

    setProcessing(false);
    setProcessDialog({ open: false, withdrawal: null, action: null });
  };

  const handleWithdrawPlatformEarnings = async () => {
    const amount = parseFloat(platformWithdrawAmount);
    if (isNaN(amount) || amount <= 0 || amount > platformBalance) {
      toast({ title: 'Errore', description: 'Verifica importo inserito.', variant: 'destructive' });
      return;
    }

    setWithdrawingPlatform(true);
    const { data, error } = await supabase.rpc('withdraw_platform_earnings', {
      p_amount: amount,
      p_payment_method: 'stripe',
      p_payment_details: platformPaymentNotes || 'Admin withdrawal',
    });

    const result = data as { success: boolean; error?: string } | null;
    if (error || (result && !result.success)) {
      toast({ title: 'Errore', description: result?.error || 'Errore.', variant: 'destructive' });
    } else {
      toast({ title: 'Richiesta inviata' });
      setPlatformBalance(platformBalance - amount);
      setWithdrawPlatformDialog(false);
    }
    setWithdrawingPlatform(false);
  };

  const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending' && w.payment_method !== 'paypal');
  const disputedCount = matches.filter(m => m.status === 'disputed').length;

  const paymentLogs = transactions.filter(t => {
    const tx = t as Transaction & { provider?: string };
    return t.type === 'deposit' && (tx.provider === 'stripe' || t.stripe_session_id);
  });

  if (authLoading || isAdmin === null) return <MainLayout><LoadingPage /></MainLayout>;
  if (isAdmin !== true) return null;

  const statCards = [
    { icon: Users, value: users.length, label: 'Users', color: 'text-foreground' },
    { icon: Swords, value: matches.length, label: 'Matches', color: 'text-foreground' },
    { icon: DollarSign, value: transactions.length, label: 'Transactions', color: 'text-foreground' },
    { icon: Banknote, value: pendingWithdrawals.length, label: 'Pending', color: pendingWithdrawals.length > 0 ? 'text-[#FFC805]' : 'text-foreground' },
    { icon: AlertTriangle, value: disputedCount, label: 'Disputes', color: disputedCount > 0 ? 'text-[hsl(var(--error))]' : 'text-foreground' },
    { icon: TrendingUp, value: platformBalance, label: 'Earnings', color: 'text-[#FFC805]', isCurrency: true },
  ];

  return (
    <MainLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: 'hsl(0 65% 50% / 0.08)' }}>
                <Shield className="w-6 h-6" style={{ color: 'hsl(0 65% 50%)' }} />
              </div>
              <div>
                <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
                  Admin
                </h1>
                <p className="text-sm text-muted-foreground">
                  Manage platform operations
                </p>
              </div>
            </div>
            <div className="lg:ml-auto">
              <GlobalSearchBar />
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
        >
          {statCards.map((stat, i) => (
            <motion.div key={i} variants={itemVariants}>
              <div className="stat-card">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'hsl(var(--bg-2))' }}>
                    <stat.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  {stat.isCurrency ? (
                    <p className={cn("text-xl font-mono font-bold", stat.color)}>
                      <AnimatedCounter value={stat.value} suffix="€" />
                    </p>
                  ) : (
                    <p className={cn("text-xl font-mono font-bold", stat.color)}>
                      <AnimatedCounter value={stat.value as number} />
                    </p>
                  )}
                  <p className="text-[11px] font-semibold text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Tabs defaultValue="issues" className="space-y-4">
            <div className="premium-card p-1.5">
              <TabsList className="flex-wrap bg-transparent w-full gap-1">
                <TabsTrigger value="issues" className="relative text-xs font-semibold rounded-lg data-[state=active]:bg-[hsl(var(--bg-2))] data-[state=active]:text-[hsl(var(--error))]">
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  Issues
                  {disputedCount > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-mono font-bold" style={{ background: 'hsl(0 65% 50% / 0.15)', color: 'hsl(0 65% 50%)' }}>{disputedCount}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="matches" className="text-xs font-semibold rounded-lg data-[state=active]:bg-[hsl(var(--bg-2))] data-[state=active]:text-foreground">
                  Matches
                </TabsTrigger>
                <TabsTrigger value="users" className="text-xs font-semibold rounded-lg data-[state=active]:bg-[hsl(var(--bg-2))] data-[state=active]:text-foreground">
                  Users
                </TabsTrigger>
                <TabsTrigger value="transactions" className="text-xs font-semibold rounded-lg data-[state=active]:bg-[hsl(var(--bg-2))] data-[state=active]:text-foreground">
                  Transactions
                </TabsTrigger>
                <TabsTrigger value="payments" className="relative text-xs font-semibold rounded-lg data-[state=active]:bg-[hsl(var(--bg-2))] data-[state=active]:text-foreground">
                  <CreditCard className="w-4 h-4 mr-1.5" />
                  Payments
                </TabsTrigger>
                <TabsTrigger value="withdrawals" className="relative text-xs font-semibold rounded-lg data-[state=active]:bg-[hsl(var(--bg-2))] data-[state=active]:text-foreground">
                  Withdrawals
                  {pendingWithdrawals.length > 0 && (
                    <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full font-mono font-bold" style={{ background: 'hsl(0 65% 50% / 0.15)', color: 'hsl(0 65% 50%)' }}>{pendingWithdrawals.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="earnings" className="text-xs font-semibold rounded-lg data-[state=active]:bg-[hsl(var(--bg-2))] data-[state=active]:text-[#FFC805]">
                  Earnings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="issues">
              <IssueCenter matches={matches} onRefresh={fetchData} />
            </TabsContent>

            <TabsContent value="matches">
              <div className="premium-card p-5">
                <MatchesTable matches={matches} loading={loading} />
              </div>
            </TabsContent>

            <TabsContent value="users">
              <div className="premium-card p-5">
                <UsersTable users={users} loading={loading} onUserUpdated={fetchData} />
              </div>
            </TabsContent>

            <TabsContent value="transactions">
              <div className="premium-card p-5">
                <TransactionsTable transactions={transactions} loading={loading} />
              </div>
            </TabsContent>

            <TabsContent value="payments">
              <div className="premium-card p-5 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'hsl(var(--bg-2))' }}>
                    <CreditCard className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Payment Logs (Stripe)</h3>
                </div>
                <div className="neon-line" />
                {loading ? <Skeleton className="h-48" /> : paymentLogs.length === 0 ? (
                  <div className="premium-surface p-8 rounded-xl text-center">
                    <p className="text-muted-foreground">No payments recorded</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border-soft))]">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b border-[hsl(var(--border-soft))]">
                          <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Provider</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Coins</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">External ID</TableHead>
                          <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">User ID</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paymentLogs.slice(0, 50).map((tx) => {
                          const extTx = tx as Transaction & { provider?: string };
                          const externalId = tx.stripe_session_id || '-';
                          const provider = extTx.provider || 'stripe';
                          
                          return (
                            <TableRow key={tx.id} className="border-b border-[hsl(var(--border-soft))] hover:bg-[hsl(var(--bg-2))]/50 transition-colors">
                              <TableCell className="text-sm font-mono">
                                {format(new Date(tx.created_at || ''), 'dd/MM/yy HH:mm')}
                              </TableCell>
                              <TableCell>
                                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border border-[hsl(var(--border-soft))] text-muted-foreground">
                                  {provider.toUpperCase()}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono font-bold text-[#FFC805]">
                                +{tx.amount}
                              </TableCell>
                              <TableCell>
                                <span className={cn(
                                  "inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full border",
                                  tx.status === 'completed'
                                    ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20"
                                    : tx.status === 'pending'
                                    ? "bg-[#FFC805]/10 text-[#FFC805] border-[#FFC805]/20"
                                    : "bg-[hsl(var(--error))]/10 text-[hsl(var(--error))] border-[hsl(var(--error))]/20"
                                )}>
                                  {tx.status?.toUpperCase()}
                                </span>
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[200px] truncate text-muted-foreground" title={externalId}>
                                {externalId.length > 25 ? `${externalId.substring(0, 25)}...` : externalId}
                              </TableCell>
                              <TableCell className="font-mono text-xs max-w-[100px] truncate text-muted-foreground" title={tx.user_id}>
                                {tx.user_id.substring(0, 8)}...
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                
                <motion.div
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="grid grid-cols-2 md:grid-cols-4 gap-3"
                >
                  {[
                    { label: 'Total Payments', value: paymentLogs.length, color: 'text-foreground' },
                    { label: 'Completed', value: paymentLogs.filter(t => t.status === 'completed').length, color: 'text-[hsl(var(--success))]' },
                    { label: 'Pending', value: paymentLogs.filter(t => t.status === 'pending').length, color: 'text-[#FFC805]' },
                    { label: 'Coins Credited', value: paymentLogs.filter(t => t.status === 'completed').reduce((sum, t) => sum + t.amount, 0), color: 'text-[#FFC805]' },
                  ].map((item, idx) => (
                    <motion.div key={idx} variants={itemVariants}>
                      <div className="stat-card">
                        <p className="text-[11px] font-semibold text-muted-foreground mb-1">{item.label}</p>
                        <p className={cn("text-2xl font-mono font-bold", item.color)}>
                          <AnimatedCounter value={item.value} />
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            </TabsContent>

            <TabsContent value="withdrawals">
              <div className="premium-card p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center rounded-xl" style={{ background: 'hsl(var(--bg-2))' }}>
                    <Banknote className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Withdrawal Requests</h3>
                </div>
                <div className="neon-line" />
                {loading ? <Skeleton className="h-48" /> : withdrawals.length === 0 ? (
                  <div className="premium-surface p-8 rounded-xl text-center">
                    <p className="text-muted-foreground">No requests</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {withdrawals.map((wd) => (
                      <motion.div
                        key={wd.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all",
                          wd.status === 'pending'
                            ? "premium-surface border-[#FFC805]/15 hover:border-[#FFC805]/30"
                            : "premium-surface"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 ring-1 ring-[hsl(var(--border-soft))]">
                            <AvatarImage src={wd.profiles?.discord_avatar_url ?? undefined} />
                            <AvatarFallback className="bg-[hsl(var(--bg-2))] text-sm">{wd.profiles?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-sm">{wd.profiles?.username}</p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {wd.amount.toFixed(2)}€ via {wd.payment_method}
                              {wd.payment_method === 'paypal' ? ` • ${wd.payment_details}` : ''}
                            </p>
                            {wd.status === 'failed' && (wd.paypal_error_message || wd.stripe_error_message) && (
                              <p className="mt-1 max-w-[420px] text-xs text-[hsl(var(--error))]">
                                {wd.paypal_error_message || wd.stripe_error_message}
                              </p>
                            )}
                          </div>
                        </div>
                        {wd.status === 'pending' && wd.payment_method !== 'paypal' ? (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => openProcessDialog(wd, 'reject')} className="btn-premium-danger text-xs px-3 rounded-lg">
                              <XCircle className="w-4 h-4 mr-1" /> Reject
                            </Button>
                            <Button size="sm" onClick={() => openProcessDialog(wd, 'approve')} className="btn-premium text-xs px-3">
                              <CheckCircle className="w-4 h-4 mr-1" /> Approve
                            </Button>
                          </div>
                        ) : (
                          <span className={cn(
                            "inline-flex items-center px-2.5 py-1 text-[10px] font-semibold rounded-full border",
                            wd.status === 'completed'
                              ? "bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] border-[hsl(var(--success))]/20"
                              : wd.status === 'processing'
                              ? "bg-[#FFC805]/10 text-[#FFC805] border-[#FFC805]/20"
                              : "bg-[hsl(var(--error))]/10 text-[hsl(var(--error))] border-[hsl(var(--error))]/20"
                          )}>
                            {wd.status?.toUpperCase()}
                          </span>
                        )}
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="earnings">
              <div className="grid gap-4 md:grid-cols-2">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="premium-card p-6" style={{ borderColor: 'rgba(255, 200, 5, 0.2)' }}>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(255, 200, 5, 0.08)' }}>
                        <Wallet className="w-6 h-6 text-[#FFC805]" />
                      </div>
                      <h3 className="text-lg font-bold text-foreground">Platform Wallet</h3>
                    </div>
                    <p className="text-4xl font-mono font-bold text-[#FFC805] mb-4">
                      <AnimatedCounter value={platformBalance} suffix="€" />
                    </p>
                    <Button onClick={() => setWithdrawPlatformDialog(true)} disabled={platformBalance <= 0} className="w-full btn-premium py-3">
                      Withdraw
                    </Button>
                  </div>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="premium-card p-6">
                    <h3 className="text-lg font-bold text-foreground mb-4">Recent Fees</h3>
                    <div className="neon-line mb-4" />
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {platformEarnings.map((e) => (
                        <div key={e.id} className="flex justify-between p-3 rounded-lg text-sm" style={{ background: 'hsl(var(--bg-2))' }}>
                          <span className="font-mono font-bold text-[#FFC805]">+{e.amount.toFixed(2)}€</span>
                          <span className="text-xs text-muted-foreground font-mono">{new Date(e.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <Dialog open={processDialog.open} onOpenChange={(open) => !open && setProcessDialog({ open: false, withdrawal: null, action: null })}>
        <DialogContent className="premium-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {processDialog.action === 'approve' ? 'Approve' : 'Reject'} Withdrawal
            </DialogTitle>
            <DialogDescription>
              {processDialog.withdrawal && <><strong className="font-mono">{processDialog.withdrawal.amount.toFixed(2)}€</strong> for <strong>{processDialog.withdrawal.profiles?.username}</strong></>}
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="Admin notes..." value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} className="input-premium" />
          <DialogFooter>
            <Button onClick={() => setProcessDialog({ open: false, withdrawal: null, action: null })} className="btn-premium-ghost">Cancel</Button>
            <Button
              onClick={handleProcessWithdrawal}
              disabled={processing}
              className={processDialog.action === 'approve' ? 'btn-premium' : 'btn-premium-danger'}
            >
              {processing ? '...' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawPlatformDialog} onOpenChange={setWithdrawPlatformDialog}>
        <DialogContent className="premium-card">
          <DialogHeader>
            <DialogTitle className="text-foreground">Withdraw Platform Earnings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount (€)</Label>
              <input type="number" step="0.01" max={platformBalance} value={platformWithdrawAmount} onChange={(e) => setPlatformWithdrawAmount(e.target.value)} className="w-full px-4 py-3 input-premium rounded-xl mt-1" placeholder="Amount €" />
              <p className="text-xs text-muted-foreground mt-1 font-mono">Available: €{platformBalance.toFixed(2)}</p>
            </div>
            <div>
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes / Reference</Label>
              <input type="text" value={platformPaymentNotes} onChange={(e) => setPlatformPaymentNotes(e.target.value)} className="w-full px-4 py-3 input-premium rounded-xl mt-1" placeholder="Notes for this operation" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setWithdrawPlatformDialog(false)} className="btn-premium-ghost">Cancel</Button>
            <Button onClick={handleWithdrawPlatformEarnings} disabled={withdrawingPlatform} className="btn-premium">{withdrawingPlatform ? '...' : 'Register Withdrawal'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
