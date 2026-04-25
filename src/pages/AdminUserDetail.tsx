import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  CheckCircle,
  DollarSign,
  Loader2,
  Minus,
  Plus,
  Shield,
  ShieldCheck,
  Swords,
  User,
  Wallet,
} from 'lucide-react';
import { AdminEmptyState, AdminPanel, AdminShell } from '@/components/admin/AdminShell';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { cn } from '@/lib/utils';
import type { Match, Profile, Transaction, Wallet as WalletType } from '@/types';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function MatchRow({ match, onOpen }: { match: Match; onOpen: (id: string) => void }) {
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
    <button
      type="button"
      onClick={() => onOpen(match.id)}
      className="flex w-full items-center justify-between gap-4 rounded-[20px] border border-white/10 bg-black/18 px-4 py-4 text-left transition hover:border-[#ff1654]/22 hover:bg-white/[0.04]"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-[16px] border border-white/10 bg-white/[0.04]">
          <Swords className="h-4 w-4 text-[#ff8ead]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">
            {match.mode} • {match.team_size}v{match.team_size}
          </p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/44">{match.region}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CoinDisplay amount={match.entry_fee} size="sm" />
        <PremiumBadge variant={STATUS_BADGE_VARIANT[match.status] || 'completed'}>
          {match.status}
        </PremiumBadge>
      </div>
    </button>
  );
}

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useAdminStatus();
  const { toast } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [banning, setBanning] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'user'>('user');
  const [changingRole, setChangingRole] = useState(false);

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
      supabase.from('transactions').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
      supabase.from('user_roles').select('role').eq('user_id', id).eq('role', 'admin').maybeSingle(),
    ]);

    if (profileRes.error || !profileRes.data) {
      setNotFound(true);
    } else {
      setProfile(profileRes.data as Profile);
      setNotFound(false);
    }

    setWallet((walletRes.data as WalletType | null) || null);

    if (matchesRes.data) {
      const uniqueMatches = matchesRes.data
        .map((matchParticipant: any) => matchParticipant.match)
        .filter(
          (match: any, index: number, array: any[]) =>
            match && array.findIndex((candidate: any) => candidate?.id === match?.id) === index,
        );
      setMatches(uniqueMatches as Match[]);
    } else {
      setMatches([]);
    }

    setTransactions((txRes.data as Transaction[]) || []);
    setUserRole(roleRes.data ? 'admin' : 'user');
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin && id) {
      void fetchUserData();
    }
  }, [id, isAdmin]);

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
      await fetchUserData();
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

    const result = data as { success: boolean; error?: string } | null;

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
      await fetchUserData();
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
    if (Number.isNaN(amount) || amount <= 0) {
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
      await fetchUserData();
    }

    setAdjusting(false);
  };

  const activeMatches = matches.filter((match) =>
    ['open', 'ready_check', 'in_progress', 'result_pending', 'disputed'].includes(match.status),
  );
  const completedMatches = matches.filter((match) =>
    ['finished', 'completed', 'admin_resolved', 'expired', 'canceled'].includes(match.status),
  );

  if (notFound) {
    return (
      <AdminShell title="User Detail" description="The requested profile is not available anymore or the URL is invalid.">
        <AdminEmptyState
          title="User not found"
          description="The requested user ID does not match any profile in the current platform data."
        />
      </AdminShell>
    );
  }

  if (loading || !profile) {
    return (
      <AdminShell title="User Detail" description="Loading the full user profile, balances, and match history.">
        <LoadingPage />
      </AdminShell>
    );
  }

  return (
    <AdminShell
      title="User Detail"
      description="Moderate the account, inspect balances, and review the player's full match and transaction history."
    >
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[320px_360px_minmax(0,1fr)]">
        <AdminPanel
          title="Identity"
          description="Who this user is and how the account is configured."
          className="min-h-0"
          contentClassName="min-h-0 overflow-y-auto pr-1"
        >
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/users')}
            className="mb-4 self-start border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Users
          </Button>

          <div className="rounded-[24px] border border-white/10 bg-black/18 p-5">
            <div className="flex items-start gap-4">
              <Avatar className="h-16 w-16 ring-1 ring-white/10">
                <AvatarImage src={getDiscordAvatarUrl(profile) ?? undefined} />
                <AvatarFallback className="bg-[#ff1654]/12 text-lg text-[#ff8ead]">
                  {profile.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-white">{profile.username}</p>
                <p className="mt-1 break-all text-sm text-white/54">{profile.email}</p>

                <div className="mt-3 flex flex-wrap gap-2">
                  {userRole === 'admin' ? <PremiumBadge variant="vip">Admin</PremiumBadge> : <PremiumBadge variant="open">User</PremiumBadge>}
                  {profile.is_banned ? <PremiumBadge variant="completed">Banned</PremiumBadge> : <PremiumBadge variant="live">Active</PremiumBadge>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {[
              { label: 'Epic Username', value: profile.epic_username || '-' },
              { label: 'Region', value: profile.preferred_region || '-' },
              { label: 'Platform', value: profile.preferred_platform || '-' },
              { label: 'Registered', value: formatDate(profile.created_at) },
              { label: 'User ID', value: profile.user_id },
            ].map((item) => (
              <div key={item.label} className="rounded-[20px] border border-white/10 bg-black/18 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">{item.label}</p>
                <p className="mt-2 break-all text-sm font-medium text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </AdminPanel>

        <div className="grid min-h-0 gap-4 xl:grid-rows-[176px_minmax(0,1fr)]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[28px] border border-white/10 bg-[#16080c]/94 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">Available balance</p>
                  <div className="mt-4">
                    <CoinDisplay amount={wallet?.balance || 0} size="lg" />
                  </div>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/10 bg-[#72f1b8]/12">
                  <Wallet className="h-5 w-5 text-[#72f1b8]" />
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-[#16080c]/94 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">Locked balance</p>
                  <div className="mt-4">
                    <CoinDisplay amount={wallet?.locked_balance || 0} size="lg" />
                  </div>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/10 bg-[#ffd166]/12">
                  <Wallet className="h-5 w-5 text-[#ffd166]" />
                </div>
              </div>
            </div>
          </div>

          <AdminPanel
            title="Admin actions"
            description="Critical balance, role, and ban controls stay visible in this column."
            className="min-h-0"
            contentClassName="min-h-0 overflow-y-auto pr-1"
          >
            <div className="space-y-5">
              <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[16px] border border-white/10 bg-white/[0.04]">
                    <DollarSign className="h-4 w-4 text-[#ff8ead]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Balance adjustment</p>
                    <p className="text-xs text-white/46">Amount and reason are required.</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Amount"
                    value={adjustAmount}
                    onChange={(event) => setAdjustAmount(event.target.value)}
                    className="border-white/12 bg-white/5 text-white"
                  />
                  <Textarea
                    placeholder="Reason"
                    value={adjustReason}
                    onChange={(event) => setAdjustReason(event.target.value)}
                    className="min-h-[110px] border-white/12 bg-white/5 text-white"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleAdjustBalance(true)}
                      disabled={adjusting}
                      className="bg-[#72f1b8] text-black hover:bg-[#72f1b8]/90"
                    >
                      {adjusting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                      Add coins
                    </Button>
                    <Button
                      onClick={() => handleAdjustBalance(false)}
                      disabled={adjusting}
                      variant="outline"
                      className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                    >
                      {adjusting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Minus className="mr-2 h-4 w-4" />}
                      Remove coins
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[16px] border border-white/10 bg-white/[0.04]">
                    <Shield className="h-4 w-4 text-[#72d2ff]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Role management</p>
                    <p className="text-xs text-white/46">Promote or demote the account.</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <PremiumBadge variant={userRole === 'admin' ? 'vip' : 'open'}>
                    {userRole === 'admin' ? 'Admin' : 'User'}
                  </PremiumBadge>
                  <Button
                    onClick={handleRoleChange}
                    disabled={changingRole}
                    variant="outline"
                    className={cn(
                      'border-white/12 bg-white/5 text-white hover:bg-white/10',
                      userRole !== 'admin' && 'border-[#ff1654]/40 bg-[#ff1654]/12',
                    )}
                  >
                    {changingRole ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : userRole === 'admin' ? (
                      <Shield className="mr-2 h-4 w-4" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    {userRole === 'admin' ? 'Remove admin' : 'Promote admin'}
                  </Button>
                </div>
              </div>

              {userRole !== 'admin' ? (
                <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-[16px] border border-white/10 bg-white/[0.04]">
                      <User className="h-4 w-4 text-[#ff8a65]" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Account status</p>
                      <p className="text-xs text-white/46">Ban or unban the user account.</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <Button
                      onClick={handleBanToggle}
                      disabled={banning}
                      className={profile.is_banned ? 'bg-[#72f1b8] text-black hover:bg-[#72f1b8]/90' : 'bg-[#ff1654] text-white hover:bg-[#ff1654]/90'}
                    >
                      {banning ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : profile.is_banned ? (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      ) : (
                        <Ban className="mr-2 h-4 w-4" />
                      )}
                      {profile.is_banned ? 'Unban user' : 'Ban user'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </AdminPanel>
        </div>

        <AdminPanel
          title="Related activity"
          description="Matches and transactions stay in tabs while the list itself scrolls internally."
          className="h-full"
          contentClassName="h-full"
        >
          <Tabs defaultValue="active" className="flex h-full min-h-0 flex-col">
            <TabsList className="grid w-full shrink-0 grid-cols-3 rounded-[18px] bg-white/[0.04] p-1">
              <TabsTrigger value="active">Active ({activeMatches.length})</TabsTrigger>
              <TabsTrigger value="history">History ({completedMatches.length})</TabsTrigger>
              <TabsTrigger value="transactions">Transactions ({transactions.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4 min-h-0 flex-1 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto pr-1">
                {activeMatches.length === 0 ? (
                  <AdminEmptyState
                    title="No active matches"
                    description="Open or in-progress matches for this user will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {activeMatches.map((match) => (
                      <MatchRow key={match.id} match={match} onOpen={(matchId) => navigate(`/admin/matches/${matchId}`)} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-4 min-h-0 flex-1 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto pr-1">
                {completedMatches.length === 0 ? (
                  <AdminEmptyState
                    title="No match history"
                    description="Completed, expired, or resolved matches for this user will appear here."
                  />
                ) : (
                  <div className="space-y-3">
                    {completedMatches.map((match) => (
                      <MatchRow key={match.id} match={match} onOpen={(matchId) => navigate(`/admin/matches/${matchId}`)} />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="transactions" className="mt-4 min-h-0 flex-1 data-[state=inactive]:hidden">
              <div className="h-full overflow-y-auto pr-1">
                {transactions.length === 0 ? (
                  <AdminEmptyState
                    title="No transactions"
                    description="Ledger entries tied to this account will appear here."
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
                              variant={
                                transaction.type === 'payout' || transaction.type === 'refund' || transaction.type === 'deposit'
                                  ? 'live'
                                  : 'completed'
                              }
                            >
                              {transaction.type}
                            </PremiumBadge>
                            <span className="truncate text-sm text-white/62">{transaction.description || 'No description'}</span>
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
    </AdminShell>
  );
}
