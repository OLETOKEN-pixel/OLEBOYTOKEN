import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, MapPin, Monitor, Swords, Users, DollarSign, AlertTriangle, CheckCircle, RefreshCw, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/custom-badge';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MatchChat } from '@/components/matches/MatchChat';
import { ProofSection } from '@/components/matches/ProofSection';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import type { Match, Transaction } from '@/types';
import { PLATFORM_FEE } from '@/types';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/motion';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { Shield } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-400',
  ready_check: 'bg-yellow-500/20 text-yellow-400',
  in_progress: 'bg-orange-500/20 text-orange-400',
  finished: 'bg-green-500/20 text-green-400',
  completed: 'bg-green-500/20 text-green-400',
  expired: 'bg-gray-500/20 text-gray-400',
  disputed: 'bg-red-500/20 text-red-400',
  admin_resolved: 'bg-purple-500/20 text-purple-400',
  canceled: 'bg-gray-500/20 text-gray-400',
};

const STATUS_BADGE_VARIANT: Record<string, 'live' | 'open' | 'completed' | 'vip'> = {
  open: 'open',
  ready_check: 'vip',
  in_progress: 'live',
  finished: 'live',
  completed: 'live',
  expired: 'completed',
  disputed: 'completed',
  admin_resolved: 'completed',
  canceled: 'completed',
};

export default function AdminMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [match, setMatch] = useState<Match | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [resolving, setResolving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [forceExpireOpen, setForceExpireOpen] = useState(false);
  const [forceExpireReason, setForceExpireReason] = useState('');
  const [forceExpiring, setForceExpiring] = useState(false);

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

  const fetchMatch = async () => {
    if (!id) return;
    setLoading(true);

    const [matchRes, txRes] = await Promise.all([
      supabase
        .from('matches')
        .select(`
          *,
          creator:profiles!matches_creator_id_fkey(*),
          participants:match_participants(*, profile:profiles(*)),
          result:match_results(*),
          team_a:teams!matches_team_a_id_fkey(*),
          team_b:teams!matches_team_b_id_fkey(*)
        `)
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('transactions')
        .select('*')
        .eq('match_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (matchRes.error || !matchRes.data) {
      setNotFound(true);
    } else {
      setMatch(matchRes.data as unknown as Match);
      setNotFound(false);
    }

    if (txRes.data) {
      setTransactions(txRes.data as Transaction[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin === true && id) {
      fetchMatch();
    }
  }, [isAdmin, id]);

  const handleResolve = async (action: 'TEAM_A_WIN' | 'TEAM_B_WIN' | 'REFUND_BOTH') => {
    if (!match) return;
    
    if (action !== 'REFUND_BOTH' && !adminNotes.trim()) {
      toast({
        title: 'Note richieste',
        description: 'Inserisci una motivazione per la risoluzione.',
        variant: 'destructive',
      });
      return;
    }

    setResolving(true);

    const { data, error } = await supabase.rpc('admin_resolve_match_v3', {
      p_match_id: match.id,
      p_action: action,
      p_notes: adminNotes || null,
    });

    const result = data as { success: boolean; error?: string; message?: string } | null;

    if (error || (result && !result.success)) {
      toast({
        title: 'Errore',
        description: result?.error || 'Impossibile risolvere il match.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Match risolto',
        description: result?.message || 'Il match è stato risolto con successo.',
      });
      fetchMatch();
      setAdminNotes('');
    }

    setResolving(false);
  };

  const handleForceExpire = async () => {
    if (!match) return;
    setForceExpiring(true);
    try {
      const { data, error } = await supabase.rpc('admin_force_expire_match', {
        p_match_id: match.id,
        p_reason: forceExpireReason.trim() || null,
      });

      if (error) throw error;
      const result = data as { success: boolean; error?: string; refund_count?: number; refunded_total?: number } | null;
      if (!result?.success) {
        const msg = result?.error === 'already_settled'
          ? 'Match già settled (payout eseguito).'
          : result?.error === 'in_progress_blocked'
            ? 'Force Expire bloccato su match in_progress.'
            : result?.error || 'Impossibile forzare expire.';
        toast({ title: 'Errore', description: msg, variant: 'destructive' });
        return;
      }

      toast({
        title: 'Force Expire OK',
        description: `Refunds: ${result.refund_count ?? 0} • Totale: ${(result.refunded_total ?? 0).toFixed?.(2) ?? result.refunded_total ?? 0}`,
      });
      setForceExpireOpen(false);
      setForceExpireReason('');
      fetchMatch();
    } catch (e: any) {
      toast({ title: 'Errore', description: e?.message || 'Impossibile forzare expire.', variant: 'destructive' });
    } finally {
      setForceExpiring(false);
    }
  };

  const prizePool = match ? match.entry_fee * 2 * (1 - PLATFORM_FEE) : 0;
  const platformFee = match ? match.entry_fee * 2 * PLATFORM_FEE : 0;

  const teamAParticipants = match?.participants?.filter(p => p.team_side === 'A') || [];
  const teamBParticipants = match?.participants?.filter(p => p.team_side === 'B') || [];

  if (authLoading || isAdmin === null) return <MainLayout><LoadingPage /></MainLayout>;
  if (isAdmin !== true) return null;

  if (notFound) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="w-20 h-20 rounded-2xl glass-panel flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-display font-bold">Match non trovato</h1>
          <p className="text-muted-foreground">L'ID specificato non corrisponde a nessun match.</p>
          <Button onClick={() => navigate('/admin')} variant="outline" className="border-white/[0.1]">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Torna all'Admin
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (loading || !match) {
    return <MainLayout><LoadingPage /></MainLayout>;
  }

  const canForceExpire =
    !['expired', 'completed', 'admin_resolved', 'finished', 'canceled'].includes(match.status) &&
    match.status !== 'in_progress';

  return (
    <MainLayout>
      <div className="space-y-6">
        <FadeIn>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin')} className="self-start hover:bg-white/[0.05]">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Admin
            </Button>
            <div className="flex-1">
              <h1 className="font-display text-2xl font-bold bg-gradient-to-r from-[hsl(186,100%,50%)] via-[hsl(263,90%,66%)] to-[hsl(186,100%,50%)] bg-clip-text text-transparent">
                Match Detail
              </h1>
              <p className="text-sm text-muted-foreground font-mono">{match.id}</p>
            </div>
            <PremiumBadge variant={STATUS_BADGE_VARIANT[match.status] || 'completed'}>
              {match.status.toUpperCase()}
            </PremiumBadge>
          </div>
        </FadeIn>

        <StaggerContainer className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { icon: Swords, label: 'Mode', value: match.mode, color: 'text-primary' },
            { icon: MapPin, label: 'Region', value: match.region, color: 'text-accent' },
            { icon: Monitor, label: 'Platform', value: match.platform, color: 'text-blue-400' },
            { icon: Users, label: 'Size', value: `${match.team_size}v${match.team_size}`, color: 'text-[hsl(var(--success))]' },
            { icon: DollarSign, label: 'Entry Fee', value: null, color: 'text-accent', coinAmount: match.entry_fee },
          ].map((item, i) => (
            <StaggerItem key={i}>
              <div className="glass-card rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <item.icon className={cn("w-5 h-5", item.color)} />
                  <div>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    {item.coinAmount !== undefined ? (
                      <CoinDisplay amount={item.coinAmount} size="sm" />
                    ) : (
                      <p className="font-medium">{item.value}</p>
                    )}
                  </div>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <FadeIn delay={0.15}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="glass-panel rounded-xl p-5 text-center glow-success">
              <p className="text-xs text-muted-foreground mb-2">Prize Pool</p>
              <CoinDisplay amount={prizePool} size="lg" />
            </div>
            <div className="glass-card rounded-xl p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">Total Entry</p>
              <CoinDisplay amount={match.entry_fee * 2} size="lg" />
            </div>
            <div className="glass-card rounded-xl p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">Platform Fee (5%)</p>
              <CoinDisplay amount={platformFee} size="lg" />
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.2}>
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="font-display text-lg font-bold">Timeline</h3>
            </div>
            <div className="space-y-3">
              <TimelineItem label="Creato" date={match.created_at} active />
              {teamAParticipants.length > 0 && (
                <TimelineItem
                  label={`Team A (${teamAParticipants.map(p => p.profile?.username).join(', ')})`}
                  date={teamAParticipants[0]?.joined_at}
                  active
                />
              )}
              {teamBParticipants.length > 0 && (
                <TimelineItem
                  label={`Team B (${teamBParticipants.map(p => p.profile?.username).join(', ')})`}
                  date={teamBParticipants[0]?.joined_at}
                  active
                />
              )}
              {match.started_at && <TimelineItem label="Partita iniziata" date={match.started_at} active />}
              {match.finished_at && <TimelineItem label="Match concluso" date={match.finished_at} active />}
            </div>
          </div>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FadeIn delay={0.25}>
            <div className="glass-panel rounded-xl p-5 border-l-2 border-l-blue-500/50">
              <h3 className="font-display text-lg font-bold text-blue-400 mb-1">Team A (Host)</h3>
              {match.team_a && <p className="text-xs text-muted-foreground mb-3">{match.team_a.name}</p>}
              <div className="space-y-3">
                {teamAParticipants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <Avatar className="w-10 h-10 ring-2 ring-blue-500/20">
                      <AvatarImage src={p.profile?.discord_avatar_url ?? undefined} />
                      <AvatarFallback className="bg-blue-500/10 text-blue-400">{p.profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{p.profile?.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Ready: {p.ready ? '✓' : '✗'} • Result: {p.result_choice || '-'}
                      </p>
                    </div>
                    {p.result_choice && (
                      <PremiumBadge variant={p.result_choice === 'WIN' ? 'live' : 'completed'}>
                        {p.result_choice}
                      </PremiumBadge>
                    )}
                  </div>
                ))}
                {teamAParticipants.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nessun partecipante</p>
                )}
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={0.3}>
            <div className="glass-panel rounded-xl p-5 border-l-2 border-l-orange-500/50">
              <h3 className="font-display text-lg font-bold text-orange-400 mb-1">Team B (Joiner)</h3>
              {match.team_b && <p className="text-xs text-muted-foreground mb-3">{match.team_b.name}</p>}
              <div className="space-y-3">
                {teamBParticipants.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                    <Avatar className="w-10 h-10 ring-2 ring-orange-500/20">
                      <AvatarImage src={p.profile?.discord_avatar_url ?? undefined} />
                      <AvatarFallback className="bg-orange-500/10 text-orange-400">{p.profile?.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{p.profile?.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Ready: {p.ready ? '✓' : '✗'} • Result: {p.result_choice || '-'}
                      </p>
                    </div>
                    {p.result_choice && (
                      <PremiumBadge variant={p.result_choice === 'WIN' ? 'live' : 'completed'}>
                        {p.result_choice}
                      </PremiumBadge>
                    )}
                  </div>
                ))}
                {teamBParticipants.length === 0 && (
                  <p className="text-muted-foreground text-sm">Nessun partecipante</p>
                )}
              </div>
            </div>
          </FadeIn>
        </div>

        {match.result?.dispute_reason && (
          <FadeIn>
            <div className="glass-panel rounded-xl p-5 border-l-2 border-l-destructive/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                </div>
                <h3 className="font-display text-lg font-bold text-destructive">Disputa</h3>
              </div>
              <p className="text-sm text-foreground/80">{match.result.dispute_reason}</p>
            </div>
          </FadeIn>
        )}

        {user && (
          <ProofSection
            matchId={match.id}
            currentUserId={user.id}
            isAdmin={true}
            isParticipant={false}
          />
        )}

        {(match.status === 'disputed' || match.status === 'in_progress' || match.status === 'result_pending') && (
          <FadeIn>
            <div className="glass-panel rounded-xl p-6 glow-cyan border-l-2 border-l-primary/50">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Swords className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">Risolvi Match</h3>
                  <p className="text-xs text-muted-foreground">Scegli il vincitore o rimborsa entrambi i giocatori</p>
                </div>
              </div>
              <div className="space-y-4 mt-4">
                <Textarea
                  placeholder="Note admin (obbligatorie per assegnare vittoria)..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="min-h-[80px] bg-white/[0.03] border-white/[0.08] focus:border-primary/50"
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handleResolve('TEAM_A_WIN')}
                    disabled={resolving}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {resolving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Team A Vince
                  </Button>
                  <Button
                    onClick={() => handleResolve('TEAM_B_WIN')}
                    disabled={resolving}
                    className="bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {resolving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                    Team B Vince
                  </Button>
                  <Button
                    onClick={() => handleResolve('REFUND_BOTH')}
                    disabled={resolving}
                    variant="outline"
                    className="border-white/[0.1] hover:bg-white/[0.05]"
                  >
                    {resolving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Rimborsa Entrambi
                  </Button>
                </div>
              </div>
            </div>
          </FadeIn>
        )}

        <FadeIn>
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-destructive" />
                <h3 className="font-display text-lg font-bold">Force Expire</h3>
              </div>
              <Button
                variant="destructive"
                size="sm"
                disabled={!canForceExpire}
                onClick={() => setForceExpireOpen(true)}
              >
                Force Expire
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Chiude il match come <span className="font-mono text-foreground/70">expired</span> e rimborsa in modo idempotente (no payout). Bloccato su <span className="font-mono text-foreground/70">in_progress</span>.
            </p>
            {!canForceExpire && (
              <p className="text-sm text-muted-foreground mt-2">
                Non disponibile per lo stato attuale.
              </p>
            )}
          </div>
        </FadeIn>

        <Dialog open={forceExpireOpen} onOpenChange={setForceExpireOpen}>
          <DialogContent className="glass-overlay rounded-xl border-white/[0.08]">
            <DialogHeader>
              <DialogTitle className="font-display">Confermi Force Expire?</DialogTitle>
              <DialogDescription>
                Questa azione è idempotente (cliccabile 2 volte senza doppi rimborsi). Se il match è già settled, verrà rifiutata.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Textarea
                placeholder="Motivo (opzionale)"
                value={forceExpireReason}
                onChange={(e) => setForceExpireReason(e.target.value)}
                className="min-h-[90px] bg-white/[0.03] border-white/[0.08] focus:border-primary/50"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setForceExpireOpen(false)} disabled={forceExpiring} className="border-white/[0.1]">
                Annulla
              </Button>
              <Button variant="destructive" onClick={handleForceExpire} disabled={forceExpiring}>
                {forceExpiring ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Force Expire
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FadeIn>
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-3 mb-1">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="font-display text-lg font-bold">Chat (Admin)</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Messaggi mostrati con mittente "ADMIN" quando scrive un admin.</p>
            {user && (
              <div className="h-[420px] rounded-lg overflow-hidden">
                <MatchChat
                  matchId={match.id}
                  matchStatus={match.status}
                  currentUserId={user.id}
                  isAdmin={true}
                  isParticipant={false}
                />
              </div>
            )}
          </div>
        </FadeIn>

        {match.result?.admin_notes && match.status === 'admin_resolved' && (
          <FadeIn>
            <div className="glass-panel rounded-xl p-5 border-l-2 border-l-purple-500/50 glow-violet">
              <h3 className="font-display text-lg font-bold text-purple-400 mb-2">Note Risoluzione</h3>
              <p className="text-sm text-foreground/80">{match.result.admin_notes}</p>
            </div>
          </FadeIn>
        )}

        <FadeIn>
          <div className="glass-panel rounded-xl p-5">
            <div className="flex items-center gap-3 mb-4">
              <DollarSign className="w-5 h-5 text-accent" />
              <h3 className="font-display text-lg font-bold">Transazioni Match</h3>
            </div>
            {transactions.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nessuna transazione registrata</p>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.03] border border-white/[0.04] text-sm hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-2">
                      <PremiumBadge variant={tx.type === 'payout' || tx.type === 'refund' ? 'live' : 'completed'}>
                        {tx.type}
                      </PremiumBadge>
                      <span className="text-muted-foreground">{tx.description}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <CoinDisplay amount={tx.amount} size="sm" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(tx.created_at), 'dd MMM HH:mm', { locale: it })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </MainLayout>
  );
}

function TimelineItem({ label, date, active }: { label: string; date?: string | null; active?: boolean }) {
  if (!date) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className={cn("w-3 h-3 rounded-full", active ? 'bg-primary' : 'bg-muted')} />
        {active && (
          <div className="absolute inset-0 w-3 h-3 rounded-full bg-primary/30 animate-ping" />
        )}
      </div>
      <span className="font-medium">{label}</span>
      <span className="text-sm text-muted-foreground ml-auto">
        {format(new Date(date), 'dd MMM HH:mm', { locale: it })}
      </span>
    </div>
  );
}
