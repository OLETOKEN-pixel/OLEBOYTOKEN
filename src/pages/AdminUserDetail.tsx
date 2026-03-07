import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Wallet, Swords, DollarSign, AlertTriangle, Ban, CheckCircle, Plus, Minus, Loader2, Shield, ShieldCheck } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/custom-badge';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import type { Profile, Wallet as WalletType, Match, Transaction } from '@/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { AnimatedCounter } from '@/components/ui/animated-counter';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [banning, setBanning] = useState(false);

  const [userRole, setUserRole] = useState<'admin' | 'user'>('user');
  const [changingRole, setChangingRole] = useState(false);

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

  const fetchUserData = async () => {
    if (!id) return;
    setLoading(true);

    const [profileRes, walletRes, matchesRes, txRes, roleRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('user_id', id).maybeSingle(),
      supabase.from('wallets').select('*').eq('user_id', id).maybeSingle(),
      supabase
        .from('match_participants')
        .select(`
          match:matches(
            *,
            creator:profiles!matches_creator_id_fkey(*),
            participants:match_participants(*, profile:profiles(*))
          )
        `)
        .eq('user_id', id)
        .order('joined_at', { ascending: false })
        .limit(20),
      supabase
        .from('transactions')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', id)
        .eq('role', 'admin')
        .maybeSingle(),
    ]);

    if (profileRes.error || !profileRes.data) {
      setNotFound(true);
    } else {
      setProfile(profileRes.data as Profile);
      setNotFound(false);
    }

    if (walletRes.data) {
      setWallet(walletRes.data as WalletType);
    }

    if (matchesRes.data) {
      const uniqueMatches = matchesRes.data
        .map((mp: any) => mp.match)
        .filter((m: any, idx: number, arr: any[]) => m && arr.findIndex((x: any) => x?.id === m?.id) === idx);
      setMatches(uniqueMatches as Match[]);
    }

    if (txRes.data) {
      setTransactions(txRes.data as Transaction[]);
    }

    setUserRole(roleRes.data ? 'admin' : 'user');

    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin === true && id) {
      fetchUserData();
    }
  }, [isAdmin, id]);

  const handleBanToggle = async () => {
    if (!profile) return;
    setBanning(true);

    const { error } = await supabase
      .from('profiles')
      .update({ is_banned: !profile.is_banned })
      .eq('user_id', profile.user_id);

    if (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare lo stato utente.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: profile.is_banned ? 'Utente sbloccato' : 'Utente bannato',
        description: 'Stato utente aggiornato.',
      });
      fetchUserData();
    }

    setBanning(false);
  };

  const handleRoleChange = async () => {
    if (!profile) return;
    setChangingRole(true);

    const newRole = userRole === 'admin' ? 'user' : 'admin';
    const { data, error } = await supabase.rpc('admin_set_user_role', {
      p_user_id: profile.user_id,
      p_role: newRole,
    });

    const result = data as { success: boolean; error?: string; role?: string } | null;

    if (error || (result && !result.success)) {
      toast({
        title: 'Errore',
        description: result?.error || 'Impossibile cambiare il ruolo.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Ruolo aggiornato',
        description: `L'utente ora è ${newRole === 'admin' ? 'Admin' : 'User'}.`,
      });
      fetchUserData();
    }

    setChangingRole(false);
  };

  const handleAdjustBalance = async (positive: boolean) => {
    if (!profile || !adjustAmount || !adjustReason.trim()) {
      toast({
        title: 'Dati mancanti',
        description: 'Inserisci importo e motivazione.',
        variant: 'destructive',
      });
      return;
    }

    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'Importo non valido',
        description: 'Inserisci un importo positivo.',
        variant: 'destructive',
      });
      return;
    }

    setAdjusting(true);

    const finalAmount = positive ? amount : -amount;

    const { data, error } = await supabase.rpc('admin_adjust_balance', {
      p_user_id: profile.user_id,
      p_amount: finalAmount,
      p_reason: adjustReason,
    });

    const result = data as { success: boolean; error?: string } | null;

    if (error || (result && !result.success)) {
      toast({
        title: 'Errore',
        description: result?.error || 'Impossibile modificare il saldo.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Saldo aggiornato',
        description: `${positive ? '+' : '-'}${amount} coins applicati.`,
      });
      setAdjustAmount('');
      setAdjustReason('');
      fetchUserData();
    }

    setAdjusting(false);
  };

  const activeMatches = matches.filter(m => 
    ['open', 'ready_check', 'in_progress', 'result_pending', 'disputed'].includes(m.status)
  );
  const completedMatches = matches.filter(m => 
    ['finished', 'completed', 'admin_resolved', 'expired', 'canceled'].includes(m.status)
  );

  if (authLoading || isAdmin === null) return <MainLayout><LoadingPage /></MainLayout>;
  if (isAdmin !== true) return null;

  if (notFound) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-20 h-20 rounded-2xl glass-panel flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-display font-bold">Utente non trovato</h1>
          <p className="text-muted-foreground">L'ID specificato non corrisponde a nessun utente.</p>
          <Button onClick={() => navigate('/admin')} variant="outline" className="border-white/[0.1]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna all'Admin
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (loading || !profile) {
    return <MainLayout><LoadingPage /></MainLayout>;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <FadeIn>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')} className="self-start hover:bg-white/[0.05]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Admin
            </Button>
            <div className="flex items-center gap-4 flex-1">
              <Avatar className="w-16 h-16 ring-2 ring-primary/20">
                <AvatarImage src={profile.avatar_url ?? undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-[hsl(186,100%,50%)] via-[hsl(263,90%,66%)] to-[hsl(186,100%,50%)] bg-clip-text text-transparent">
                  {profile.username}
                </h1>
                <p className="text-sm text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {userRole === 'admin' && (
                <PremiumBadge variant="vip">Admin</PremiumBadge>
              )}
              {profile.is_banned ? (
                <PremiumBadge variant="completed">Banned</PremiumBadge>
              ) : (
                <PremiumBadge variant="live">Active</PremiumBadge>
              )}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <User className="w-5 h-5 text-primary" />
              <h3 className="font-display text-lg font-bold">Profilo</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Epic Username', value: profile.epic_username || '-' },
                { label: 'Region', value: profile.preferred_region || '-' },
                { label: 'Platform', value: profile.preferred_platform || '-' },
                { label: 'Registrato', value: format(new Date(profile.created_at), 'dd MMM yyyy', { locale: it }) },
              ].map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.04]">
                  <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
                  <p className="font-medium">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StaggerItem>
            <div className="glass-panel rounded-xl p-6 text-center glow-success">
              <Wallet className="w-8 h-8 mx-auto mb-2 text-[hsl(var(--success))]" />
              <p className="text-xs text-muted-foreground mb-2">Saldo Disponibile</p>
              <CoinDisplay amount={wallet?.balance || 0} size="lg" />
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="glass-panel rounded-xl p-6 text-center">
              <Wallet className="w-8 h-8 mx-auto mb-2 text-warning" />
              <p className="text-xs text-muted-foreground mb-2">Saldo Bloccato</p>
              <CoinDisplay amount={wallet?.locked_balance || 0} size="lg" />
            </div>
          </StaggerItem>
        </StaggerContainer>

        <FadeIn delay={0.2}>
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold">Azioni Admin</h3>
                <p className="text-xs text-muted-foreground">Gestisci saldo e stato utente</p>
              </div>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground/80">Modifica Saldo</p>
                <div className="flex flex-wrap gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Importo"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-32 bg-white/[0.03] border-white/[0.08] focus:border-primary/50"
                  />
                  <Textarea
                    placeholder="Motivazione (obbligatoria)..."
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="flex-1 min-h-[40px] h-10 bg-white/[0.03] border-white/[0.08] focus:border-primary/50"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleAdjustBalance(true)}
                    disabled={adjusting}
                    className="bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white"
                  >
                    {adjusting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                    Aggiungi
                  </Button>
                  <Button
                    onClick={() => handleAdjustBalance(false)}
                    disabled={adjusting}
                    variant="destructive"
                  >
                    {adjusting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
                    Sottrai
                  </Button>
                </div>
              </div>

              <div className="pt-4 border-t border-white/[0.06] space-y-3">
                <p className="text-sm font-semibold text-foreground/80">Gestione Ruolo</p>
                <div className="flex items-center gap-3">
                  <PremiumBadge variant={userRole === 'admin' ? 'vip' : 'open'}>
                    {userRole === 'admin' ? 'Admin' : 'User'}
                  </PremiumBadge>
                  <Button
                    onClick={handleRoleChange}
                    disabled={changingRole}
                    variant={userRole === 'admin' ? 'outline' : 'default'}
                    className={cn(
                      userRole !== 'admin' ? 'bg-red-600 hover:bg-red-700 text-white' : 'border-white/[0.1]'
                    )}
                  >
                    {changingRole ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : userRole === 'admin' ? (
                      <Shield className="w-4 h-4 mr-2" />
                    ) : (
                      <ShieldCheck className="w-4 h-4 mr-2" />
                    )}
                    {userRole === 'admin' ? 'Rimuovi Admin' : 'Promuovi Admin'}
                  </Button>
                </div>
              </div>

              {userRole !== 'admin' && (
                <div className="pt-4 border-t border-white/[0.06]">
                  <Button
                    onClick={handleBanToggle}
                    disabled={banning}
                    variant={profile.is_banned ? 'default' : 'destructive'}
                    className={profile.is_banned ? 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white' : ''}
                  >
                    {banning ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : profile.is_banned ? (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    ) : (
                      <Ban className="w-4 h-4 mr-2" />
                    )}
                    {profile.is_banned ? 'Sblocca Utente' : 'Banna Utente'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.3}>
          <Tabs defaultValue="active" className="space-y-4">
            <div className="glass-panel rounded-xl p-1.5">
              <TabsList className="bg-transparent w-full gap-1">
                <TabsTrigger value="active" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <Swords className="w-4 h-4 mr-2" />
                  Match Attivi ({activeMatches.length})
                </TabsTrigger>
                <TabsTrigger value="history" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  Storico ({completedMatches.length})
                </TabsTrigger>
                <TabsTrigger value="transactions" className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Transazioni ({transactions.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="active">
              <div className="glass-panel rounded-xl p-5">
                {activeMatches.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nessun match attivo</p>
                ) : (
                  <div className="space-y-2">
                    {activeMatches.map((m) => (
                      <MatchRow key={m.id} match={m} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history">
              <div className="glass-panel rounded-xl p-5">
                {completedMatches.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nessun match nello storico</p>
                ) : (
                  <div className="space-y-2">
                    {completedMatches.map((m) => (
                      <MatchRow key={m.id} match={m} navigate={navigate} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="transactions">
              <div className="glass-panel rounded-xl p-5">
                {transactions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">Nessuna transazione</p>
                ) : (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-3">
                          <PremiumBadge variant={
                            tx.type === 'payout' || tx.type === 'refund' || tx.type === 'deposit'
                              ? 'live'
                              : 'completed'
                          }>
                            {tx.type}
                          </PremiumBadge>
                          <span className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {tx.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <CoinDisplay 
                            amount={tx.amount} 
                            size="sm"
                          />
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), 'dd MMM HH:mm', { locale: it })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </FadeIn>
      </div>
    </MainLayout>
  );
}

function MatchRow({ match, navigate }: { match: Match; navigate: (path: string) => void }) {
  const STATUS_BADGE_VARIANT: Record<string, 'live' | 'open' | 'completed' | 'vip'> = {
    open: 'open',
    ready_check: 'vip',
    in_progress: 'live',
    finished: 'live',
    completed: 'live',
    expired: 'completed',
    disputed: 'completed',
    admin_resolved: 'completed',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.04] hover:bg-white/[0.06] hover:border-white/[0.08] cursor-pointer transition-all"
      onClick={() => navigate(`/admin/matches/${match.id}`)}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
          <Swords className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="font-medium text-sm">{match.mode} • {match.team_size}v{match.team_size}</p>
          <p className="text-xs text-muted-foreground">{match.region}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <CoinDisplay amount={match.entry_fee} size="sm" />
        <PremiumBadge variant={STATUS_BADGE_VARIANT[match.status] || 'completed'}>
          {match.status}
        </PremiumBadge>
      </div>
    </motion.div>
  );
}
