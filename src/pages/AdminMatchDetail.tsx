import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Clock,
  DollarSign,
  Loader2,
  MapPin,
  Monitor,
  RefreshCw,
  Shield,
  Swords,
  Users,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AdminEmptyState, AdminPanel, AdminShell } from '@/components/admin/AdminShell';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { MatchChat } from '@/components/matches/MatchChat';
import { ProofSection } from '@/components/matches/ProofSection';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import type { Match, Transaction } from '@/types';
import { PLATFORM_FEE } from '@/types';

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

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function TimelineItem({ label, date }: { label: string; date?: string | null }) {
  if (!date) return null;

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="h-3 w-3 rounded-full bg-[#ff1654]" />
        <div className="absolute inset-0 h-3 w-3 rounded-full bg-[#ff1654]/30 animate-ping" />
      </div>
      <span className="text-sm font-medium text-white">{label}</span>
      <span className="ml-auto text-xs text-white/42">{formatDate(date)}</span>
    </div>
  );
}

function TeamPanel({
  title,
  subtitle,
  accentClassName,
  participants,
}: {
  title: string;
  subtitle?: string | null;
  accentClassName: string;
  participants: Array<any>;
}) {
  return (
    <div className={cn('rounded-[24px] border border-white/10 bg-black/18 p-4', accentClassName)}>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs uppercase tracking-[0.18em] text-white/42">{subtitle}</p> : null}

      <div className="mt-4 space-y-3">
        {participants.length === 0 ? (
          <p className="text-sm text-white/46">No participants</p>
        ) : (
          participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#13070a] p-3">
              <Avatar className="h-10 w-10 ring-1 ring-white/10">
                <AvatarImage src={getDiscordAvatarUrl(participant.profile) ?? undefined} />
                <AvatarFallback className="bg-white/10 text-white">
                  {participant.profile?.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white">{participant.profile?.username || 'Unknown'}</p>
                <p className="mt-1 text-xs text-white/46">
                  Ready: {participant.ready ? 'Yes' : 'No'} • Result: {participant.result_choice || '-'}
                </p>
              </div>

              {participant.result_choice ? (
                <PremiumBadge variant={participant.result_choice === 'WIN' ? 'live' : 'completed'}>
                  {participant.result_choice}
                </PremiumBadge>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function AdminMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminStatus();
  const { toast } = useToast();

  const [match, setMatch] = useState<Match | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [notFound, setNotFound] = useState(false);

  const [forceExpireOpen, setForceExpireOpen] = useState(false);
  const [forceExpireReason, setForceExpireReason] = useState('');
  const [forceExpiring, setForceExpiring] = useState(false);

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
      supabase.from('transactions').select('*').eq('match_id', id).order('created_at', { ascending: true }),
    ]);

    if (matchRes.error || !matchRes.data) {
      setNotFound(true);
    } else {
      setMatch(matchRes.data as unknown as Match);
      setNotFound(false);
    }

    setTransactions((txRes.data as Transaction[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin && id) {
      void fetchMatch();
    }
  }, [id, isAdmin]);

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
      setAdminNotes('');
      await fetchMatch();
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
        const message = result?.error === 'already_settled'
          ? 'Match già settled (payout eseguito).'
          : result?.error === 'in_progress_blocked'
            ? 'Force Expire bloccato su match in_progress.'
            : result?.error || 'Impossibile forzare expire.';
        toast({ title: 'Errore', description: message, variant: 'destructive' });
      } else {
        toast({
          title: 'Force Expire OK',
          description: `Refunds: ${result.refund_count ?? 0} • Totale: ${Number(result.refunded_total ?? 0).toFixed(2)}`,
        });
        setForceExpireOpen(false);
        setForceExpireReason('');
        await fetchMatch();
      }
    } catch (error: any) {
      toast({
        title: 'Errore',
        description: error?.message || 'Impossibile forzare expire.',
        variant: 'destructive',
      });
    } finally {
      setForceExpiring(false);
    }
  };

  if (notFound) {
    return (
      <AdminShell title="Match Detail" description="The requested match is no longer available or the URL is invalid.">
        <AdminEmptyState
          title="Match not found"
          description="The requested match ID does not exist in the current match dataset."
        />
      </AdminShell>
    );
  }

  if (loading || !match) {
    return (
      <AdminShell title="Match Detail" description="Loading proofs, participants, chat, and finance data for this match.">
        <LoadingPage />
      </AdminShell>
    );
  }

  const prizePool = match.entry_fee * 2 * (1 - PLATFORM_FEE);
  const platformFee = match.entry_fee * 2 * PLATFORM_FEE;
  const teamAParticipants = match.participants?.filter((participant) => participant.team_side === 'A') || [];
  const teamBParticipants = match.participants?.filter((participant) => participant.team_side === 'B') || [];
  const canForceExpire =
    !['expired', 'completed', 'admin_resolved', 'finished', 'canceled'].includes(match.status) &&
    match.status !== 'in_progress';

  return (
    <AdminShell
      title="Match Detail"
      description="Inspect the full lifecycle, proofs, finance flow, and admin-only resolution controls for this match."
    >
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <AdminPanel
          title="Overview"
          description="Core match facts, status, and lifecycle timeline."
          className="min-h-0"
          contentClassName="min-h-0 overflow-y-auto pr-1"
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/matches')}
            className="mb-4 self-start border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Matches
          </Button>

          <div className="rounded-[24px] border border-white/10 bg-black/18 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Match #{match.id.slice(0, 8)}</p>
                <p className="mt-1 break-all text-xs text-white/42">{match.id}</p>
              </div>
              <PremiumBadge variant={STATUS_BADGE_VARIANT[match.status] || 'completed'}>
                {match.status.toUpperCase()}
              </PremiumBadge>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {[
              { icon: Swords, label: 'Mode', value: match.mode, accent: '#ff8ead' },
              { icon: MapPin, label: 'Region', value: match.region, accent: '#72d2ff' },
              { icon: Monitor, label: 'Platform', value: match.platform, accent: '#7db7ff' },
              { icon: Users, label: 'Size', value: `${match.team_size}v${match.team_size}`, accent: '#72f1b8' },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-white/10 bg-black/18 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[16px] border border-white/10 bg-white/[0.04]">
                    <item.icon className="h-4 w-4" style={{ color: item.accent }} />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/42">{item.label}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3">
            {[
              { label: 'Entry fee', amount: match.entry_fee },
              { label: 'Total entry', amount: match.entry_fee * 2 },
              { label: 'Prize pool', amount: prizePool },
              { label: 'Platform fee', amount: platformFee },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-white/10 bg-black/18 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/42">{item.label}</p>
                <div className="mt-3">
                  <CoinDisplay amount={item.amount} size="sm" />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-[24px] border border-white/10 bg-black/18 p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-[#ffd166]" />
              <h3 className="text-sm font-semibold text-white">Timeline</h3>
            </div>

            <div className="mt-4 space-y-4">
              <TimelineItem label="Created" date={match.created_at} />
              {teamAParticipants.length > 0 ? (
                <TimelineItem
                  label={`Team A joined (${teamAParticipants.map((participant) => participant.profile?.username).join(', ')})`}
                  date={teamAParticipants[0]?.joined_at}
                />
              ) : null}
              {teamBParticipants.length > 0 ? (
                <TimelineItem
                  label={`Team B joined (${teamBParticipants.map((participant) => participant.profile?.username).join(', ')})`}
                  date={teamBParticipants[0]?.joined_at}
                />
              ) : null}
              <TimelineItem label="Started" date={match.started_at} />
              <TimelineItem label="Finished" date={match.finished_at} />
            </div>
          </div>
        </AdminPanel>

        <div className="grid min-h-0 gap-4 xl:grid-rows-[minmax(0,0.48fr)_minmax(0,0.52fr)]">
          <AdminPanel
            title="Teams"
            description="Participants, readiness, and submitted choices."
            className="min-h-0"
            contentClassName="min-h-0 overflow-y-auto pr-1"
          >
            <div className="grid gap-4 xl:grid-cols-2">
              <TeamPanel
                title="Team A"
                subtitle={match.team_a?.name || 'Host side'}
                accentClassName="border-l-2 border-l-[#72d2ff]"
                participants={teamAParticipants}
              />
              <TeamPanel
                title="Team B"
                subtitle={match.team_b?.name || 'Joiner side'}
                accentClassName="border-l-2 border-l-[#ff8a65]"
                participants={teamBParticipants}
              />
            </div>
          </AdminPanel>

          <AdminPanel
            title="Proofs and dispute"
            description="Admin-only proof review stays inside this panel."
            className="min-h-0"
            contentClassName="min-h-0 overflow-y-auto pr-1"
          >
            {match.result?.dispute_reason ? (
              <div className="mb-4 rounded-[22px] border border-[#ff1654]/24 bg-[#ff1654]/8 p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-[#ff8ead]" />
                  <p className="text-sm font-semibold text-white">Dispute reason</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/68">{match.result.dispute_reason}</p>
              </div>
            ) : null}

            {user ? (
              <ProofSection matchId={match.id} currentUserId={user.id} isAdmin isParticipant={false} />
            ) : (
              <AdminEmptyState
                title="Admin session required"
                description="Sign in again to load proof moderation tools."
              />
            )}
          </AdminPanel>
        </div>

        <div className="grid min-h-0 gap-4 xl:grid-rows-[auto,minmax(0,1fr)]">
          <div className="grid gap-4">
            {(match.status === 'disputed' || match.status === 'in_progress' || match.status === 'result_pending') ? (
              <AdminPanel
                title="Resolve match"
                description="Winner assignment and refund controls stay visible while reviewing proofs."
                contentClassName="space-y-4"
              >
                <Textarea
                  placeholder="Admin notes (required when assigning a winner)"
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  className="min-h-[100px] border-white/12 bg-white/5 text-white"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => handleResolve('TEAM_A_WIN')}
                    disabled={resolving}
                    className="bg-[#72d2ff] text-black hover:bg-[#72d2ff]/90"
                  >
                    {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Team A wins
                  </Button>
                  <Button
                    onClick={() => handleResolve('TEAM_B_WIN')}
                    disabled={resolving}
                    className="bg-[#ff8a65] text-white hover:bg-[#ff8a65]/90"
                  >
                    {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                    Team B wins
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleResolve('REFUND_BOTH')}
                    disabled={resolving}
                    className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                  >
                    {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refund both
                  </Button>
                </div>
              </AdminPanel>
            ) : null}

            <AdminPanel
              title="Force expire"
              description="Idempotent refund-only close. Disabled when the match is already settled or in progress."
              actions={
                <Button
                  variant="outline"
                  disabled={!canForceExpire}
                  onClick={() => setForceExpireOpen(true)}
                  className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                >
                  Force expire
                </Button>
              }
            >
              <p className="text-sm leading-6 text-white/56">
                Status: <span className="font-semibold text-white">{match.status}</span>
              </p>
              {!canForceExpire ? (
                <p className="mt-2 text-sm text-white/44">Not available for the current state.</p>
              ) : null}
            </AdminPanel>

            {match.result?.admin_notes && match.status === 'admin_resolved' ? (
              <AdminPanel
                title="Resolution notes"
                description="Stored admin notes from the final resolution flow."
              >
                <p className="text-sm leading-6 text-white/64">{match.result.admin_notes}</p>
              </AdminPanel>
            ) : null}
          </div>

          <AdminPanel
            title="Live workspace"
            description="Switch between admin chat and transaction history without leaving the match."
            className="h-full"
            contentClassName="h-full"
          >
            <Tabs defaultValue="chat" className="flex h-full min-h-0 flex-col">
              <TabsList className="grid w-full shrink-0 grid-cols-2 rounded-[18px] bg-white/[0.04] p-1">
                <TabsTrigger value="chat">
                  <Shield className="mr-2 h-4 w-4" />
                  Chat
                </TabsTrigger>
                <TabsTrigger value="transactions">
                  <DollarSign className="mr-2 h-4 w-4" />
                  Transactions
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-4 min-h-0 flex-1 data-[state=inactive]:hidden">
                <div className="h-full overflow-hidden rounded-[20px] border border-white/10 bg-black/18">
                  {user ? (
                    <MatchChat
                      matchId={match.id}
                      matchStatus={match.status}
                      currentUserId={user.id}
                      isAdmin
                      isParticipant={false}
                    />
                  ) : (
                    <div className="grid h-full place-items-center">
                      <p className="text-sm text-white/48">Admin session required to load chat.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="transactions" className="mt-4 min-h-0 flex-1 data-[state=inactive]:hidden">
                <div className="h-full overflow-y-auto pr-1">
                  {transactions.length === 0 ? (
                    <AdminEmptyState
                      title="No match transactions"
                      description="Ledger entries tied to this match will appear here."
                    />
                  ) : (
                    <div className="space-y-3">
                      {transactions.map((transaction) => (
                        <div
                          key={transaction.id}
                          className="flex items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-black/18 px-4 py-4"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <PremiumBadge
                                variant={transaction.type === 'payout' || transaction.type === 'refund' ? 'live' : 'completed'}
                              >
                                {transaction.type}
                              </PremiumBadge>
                              <span className="truncate text-sm text-white/62">
                                {transaction.description || 'No description'}
                              </span>
                            </div>
                            <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">
                              {formatDate(transaction.created_at)}
                            </p>
                          </div>

                          <CoinDisplay amount={transaction.amount} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </AdminPanel>
        </div>
      </div>

      <Dialog open={forceExpireOpen} onOpenChange={setForceExpireOpen}>
        <DialogContent className="border-white/14 bg-[#120b0f] text-white">
          <DialogHeader>
            <DialogTitle>Confirm force expire</DialogTitle>
            <DialogDescription>
              This action is idempotent and refuses already-settled matches.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Optional reason"
            value={forceExpireReason}
            onChange={(event) => setForceExpireReason(event.target.value)}
            className="min-h-[110px] border-white/12 bg-white/5 text-white"
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setForceExpireOpen(false)}
              disabled={forceExpiring}
              className="border-white/12 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleForceExpire} disabled={forceExpiring}>
              {forceExpiring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Force expire
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
