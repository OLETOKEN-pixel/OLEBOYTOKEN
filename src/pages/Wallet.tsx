import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { Wallet as WalletIcon, Lock, Coins, Plus, Banknote, Clock, CheckCircle, XCircle, CreditCard, Info, ChevronDown, ArrowDownLeft, Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { TransactionHistory } from '@/components/wallet/TransactionHistory';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import type { Transaction, WithdrawalRequest } from '@/types';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/custom-badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const MIN_WITHDRAWAL = 10;
const WITHDRAWAL_FEE = 0.50;

const withdrawalStatusConfig: Record<string, { icon: React.ReactNode; variant: 'default' | 'destructive' | 'outline' | 'warning'; color: string }> = {
  pending: { icon: <Clock className="w-3 h-3" />, variant: 'warning', color: 'text-[#FFC805]' },
  approved: { icon: <CheckCircle className="w-3 h-3" />, variant: 'default', color: 'text-green-500' },
  completed: { icon: <CheckCircle className="w-3 h-3" />, variant: 'default', color: 'text-green-500' },
  rejected: { icon: <XCircle className="w-3 h-3" />, variant: 'destructive', color: 'text-red-500' },
};

interface StripeConnectedAccount {
  onboarding_complete: boolean;
  payouts_enabled: boolean;
  charges_enabled: boolean;
  stripe_account_id: string;
}

export default function Wallet() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user, wallet, loading: authLoading, refreshWallet } = useAuth();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  
  const [stripeAccount, setStripeAccount] = useState<StripeConnectedAccount | null>(null);
  const [connectingStripe, setConnectingStripe] = useState(false);
  
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stripeOnboarding = searchParams.get('stripe_onboarding');
    const stripeRefresh = searchParams.get('stripe_refresh');
    
    if (stripeOnboarding === 'complete') {
      toast({
        title: 'Verifica completata',
        description: 'Il tuo account Stripe è stato configurato. Puoi ora effettuare prelievi.',
      });
      navigate('/wallet', { replace: true });
    } else if (stripeRefresh === 'true') {
      toast({
        title: 'Verifica incompleta',
        description: 'Completa la verifica Stripe per abilitare i prelievi.',
        variant: 'destructive',
      });
      navigate('/wallet', { replace: true });
    }
  }, [searchParams, navigate, toast]);

  useEffect(() => {
    if (!user && !authLoading) {
      navigate(`/auth?next=${encodeURIComponent(location.pathname)}`);
    }
  }, [user, authLoading, navigate, location.pathname]);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (txData) {
        setTransactions(txData as Transaction[]);
      }

      const { data: wdData } = await supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (wdData) {
        setWithdrawals(wdData as WithdrawalRequest[]);
      }

      const { data: stripeData } = await supabase
        .from('stripe_connected_accounts')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (stripeData) {
        setStripeAccount(stripeData as StripeConnectedAccount);
      }

      setLoading(false);
    };

    fetchData();
    refreshWallet();
  }, [user, refreshWallet]);

  const handleConnectStripe = async () => {
    setConnectingStripe(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-connect-account');
      
      if (error) throw error;
      
      if (data?.url) {
        window.location.href = data.url;
      } else if (data?.payouts_enabled) {
        setStripeAccount(prev => prev ? { ...prev, payouts_enabled: true } : null);
        toast({
          title: 'Account già verificato',
          description: 'Puoi effettuare prelievi.',
        });
      }
    } catch (error: unknown) {
      console.error('Stripe connect error:', error);
      
      let errorMessage = 'Impossibile avviare la verifica Stripe. Riprova.';
      let requestId: string | null = null;
      
      if (error && typeof error === 'object') {
        const errObj = error as { 
          message?: string; 
          context?: { 
            body?: { 
              error?: string; 
              details?: string; 
              stripeRequestId?: string;
              code?: string;
            } 
          } 
        };
        const body = errObj.context?.body;
        errorMessage = body?.error || body?.details || errObj.message || errorMessage;
        requestId = body?.stripeRequestId || null;
        
        console.error('Stripe error details:', JSON.stringify(body, null, 2));
      }
      
      toast({
        title: 'Errore Stripe',
        description: requestId 
          ? `${errorMessage} (ID: ${requestId})` 
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    const totalDeduction = amount + WITHDRAWAL_FEE;

    if (isNaN(amount) || amount < MIN_WITHDRAWAL) {
      toast({
        title: 'Importo non valido',
        description: `Il prelievo minimo è di €${MIN_WITHDRAWAL}.`,
        variant: 'destructive',
      });
      return;
    }

    if (totalDeduction > (wallet?.balance ?? 0)) {
      toast({
        title: 'Saldo insufficiente',
        description: `Servono €${totalDeduction.toFixed(2)} (importo + commissione €${WITHDRAWAL_FEE}).`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-payout', {
        body: { amount },
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Prelievo completato',
          description: `€${amount} trasferiti al tuo account Stripe.`,
        });
        setWithdrawOpen(false);
        setWithdrawAmount('');
        refreshWallet();
        
        const { data: wdData } = await supabase
          .from('withdrawal_requests')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false });
        if (wdData) setWithdrawals(wdData as WithdrawalRequest[]);
      } else {
        throw new Error(data?.error || 'Errore sconosciuto');
      }
    } catch (error) {
      console.error('Withdrawal error:', error);
      toast({
        title: 'Errore',
        description: error instanceof Error ? error.message : 'Impossibile completare il prelievo.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const canWithdraw = (wallet?.balance ?? 0) >= (MIN_WITHDRAWAL + WITHDRAWAL_FEE);
  const isStripeVerified = stripeAccount?.payouts_enabled === true;

  if (authLoading) return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 py-8">
        <div className="h-10 w-48 skeleton-premium rounded-2xl mx-auto" />
        <div className="h-32 skeleton-premium rounded-2xl" />
        <div className="grid grid-cols-2 gap-4">
          {[1,2].map(i => <div key={i} className="h-12 skeleton-premium rounded-2xl" />)}
        </div>
        <div className="h-64 skeleton-premium rounded-2xl" />
      </div>
    </MainLayout>
  );

  return (
    <MainLayout>
      <div className="space-y-8 max-w-3xl mx-auto py-4 lg:py-8">

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
          className="text-center"
        >
          <h1 className="text-[36px] font-bold tracking-tight uppercase">
            WALLET
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.05, duration: 0.5 }}
          className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-8 lg:p-10 text-center"
        >
          <p className="text-sm text-gray-400 mb-2 tracking-wide">Available Balance</p>
          <div className="flex items-baseline justify-center gap-1">
            <span className="font-mono text-5xl lg:text-6xl font-bold text-[#FFC805]">
              €<AnimatedCounter value={wallet?.balance ?? 0} formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} />
            </span>
          </div>

          <div className="flex items-center justify-center gap-6 mt-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4" />
              <span>Locked: <span className="font-mono font-semibold text-white">€{(wallet?.locked_balance ?? 0).toFixed(2)}</span></span>
            </div>
            <div className="w-px h-4 bg-[#1f2937]" />
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4" />
              <span>Total: <span className="font-mono font-semibold text-white">€{((wallet?.balance ?? 0) + (wallet?.locked_balance ?? 0)).toFixed(2)}</span></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Button asChild className="btn-premium h-12 px-8 min-w-[160px]">
              <Link to="/buy">
                <Plus className="w-4 h-4 mr-2" />
                Buy Coins
              </Link>
            </Button>
            <Button className="btn-premium-secondary h-12 px-8 min-w-[160px]" onClick={() => navigate('/matches')}>
              <Send className="w-4 h-4 mr-2" />
              Play
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-0 overflow-hidden"
        >
          <div className="p-5 lg:p-6 flex items-center justify-between border-b border-[#1f2937]">
            <div className="flex items-center gap-3">
              <ArrowDownLeft className="w-5 h-5 text-[#FFC805]" />
              <div>
                <h3 className="font-semibold text-sm">Withdraw</h3>
                <p className="text-xs text-gray-400">
                  Min €{MIN_WITHDRAWAL} · Fee €{WITHDRAWAL_FEE}
                </p>
              </div>
            </div>
            
            {!isStripeVerified ? (
              <Button 
                onClick={handleConnectStripe}
                disabled={connectingStripe}
                className="btn-premium-secondary h-10 px-5 text-sm"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                {connectingStripe ? 'Loading...' : 'Setup Stripe'}
              </Button>
            ) : (
              <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!canWithdraw} className="btn-premium h-10 px-5 text-sm">
                    <Banknote className="w-4 h-4 mr-2" />
                    Withdraw
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-[#121212] border border-[#1f2937] rounded-[16px]">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Request Withdrawal</DialogTitle>
                    <DialogDescription>
                      Minimum €{MIN_WITHDRAWAL} · Fee €{WITHDRAWAL_FEE}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label className="text-xs tracking-wide uppercase text-gray-400">Amount (€)</Label>
                      <Input
                        type="number"
                        min={MIN_WITHDRAWAL}
                        max={(wallet?.balance ?? 0) - WITHDRAWAL_FEE}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder={`${MIN_WITHDRAWAL}.00`}
                        className="text-lg font-mono input-premium"
                      />
                      <p className="text-xs text-gray-400">
                        Available: <span className="font-mono text-[#FFC805] font-semibold">€{(wallet?.balance ?? 0).toFixed(2)}</span>
                      </p>
                    </div>

                    {withdrawAmount && parseFloat(withdrawAmount) >= MIN_WITHDRAWAL && (
                      <div className="p-4 rounded-xl bg-[#1a1a1a] space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-400">Amount</span>
                          <span className="font-mono font-medium">€{parseFloat(withdrawAmount).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-gray-400">
                          <span>Fee</span>
                          <span className="font-mono text-red-400">-€{WITHDRAWAL_FEE.toFixed(2)}</span>
                        </div>
                        <div className="h-px bg-[#1f2937] my-2" />
                        <div className="flex justify-between font-semibold">
                          <span>Total deducted</span>
                          <span className="font-mono text-[#FFC805]">€{(parseFloat(withdrawAmount) + WITHDRAWAL_FEE).toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setWithdrawOpen(false)} className="btn-premium-ghost">
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleWithdraw} 
                      disabled={submitting || parseFloat(withdrawAmount) < MIN_WITHDRAWAL}
                      className="btn-premium"
                    >
                      {submitting ? 'Processing...' : 'Confirm Withdrawal'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          
          {!isStripeVerified && (
            <div className="px-5 lg:px-6 py-4 flex items-start gap-3 border-b border-[#1f2937]">
              <Info className="w-4 h-4 text-[#FFC805] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-gray-400">
                Completa la verifica Stripe per ricevere i pagamenti sul tuo conto bancario.
              </span>
            </div>
          )}
          {isStripeVerified && (
            <div className="px-5 lg:px-6 py-3 flex items-center gap-2 text-sm text-green-500">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <CheckCircle className="w-4 h-4" />
              <span className="font-medium">Stripe account verified</span>
            </div>
          )}
        </motion.div>

        {withdrawals.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-0 overflow-hidden"
          >
            <div className="p-5 lg:p-6 border-b border-[#1f2937]">
              <h3 className="font-semibold text-sm flex items-center gap-3">
                <Banknote className="w-5 h-5 text-[#FFC805]" />
                Withdrawal Requests
              </h3>
            </div>
            <div className="p-4 space-y-2">
              {withdrawals.map((wd) => (
                <div
                  key={wd.id}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-xl",
                    "bg-[#1a1a1a] border border-[#1f2937]",
                    wd.status === 'pending' && 'border-[#FFC805]/30'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      wd.status === 'completed' || wd.status === 'approved' 
                        ? 'bg-green-500/10' 
                        : wd.status === 'pending' 
                          ? 'bg-[#FFC805]/10' 
                          : 'bg-red-500/10'
                    )}>
                      <Banknote className={cn(
                        "w-5 h-5",
                        withdrawalStatusConfig[wd.status]?.color || 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <p className="font-mono font-bold text-lg">€{wd.amount.toFixed(2)}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(wd.created_at).toLocaleDateString('it-IT', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <Badge variant={withdrawalStatusConfig[wd.status]?.variant || 'outline'} className="flex items-center gap-1.5 px-3">
                    {withdrawalStatusConfig[wd.status]?.icon}
                    {wd.status === 'pending' && 'Pending'}
                    {wd.status === 'approved' && 'Approved'}
                    {wd.status === 'completed' && 'Completed'}
                    {wd.status === 'rejected' && 'Rejected'}
                  </Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-0 overflow-hidden">
              <CollapsibleTrigger asChild>
                <div className="p-5 lg:p-6 cursor-pointer hover:bg-[#1a1a1a] transition-colors">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-3">
                      <Clock className="w-5 h-5 text-[#FFC805]" />
                      Transaction History
                      <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-[#1a1a1a] border border-[#1f2937] text-gray-400">
                        {transactions.length}
                      </span>
                    </h3>
                    <ChevronDown className={cn(
                      "w-5 h-5 text-gray-400 transition-transform duration-300",
                      historyOpen && "rotate-180"
                    )} />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="h-px bg-[#1f2937]" />
                <div className="px-5 lg:px-6 pb-5 lg:pb-6">
                  <TransactionHistory transactions={transactions} loading={loading} />
                </div>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </motion.div>
      </div>
    </MainLayout>
  );
}
