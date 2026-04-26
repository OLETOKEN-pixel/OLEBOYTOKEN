import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Shield,
  Wallet,
  X,
} from 'lucide-react';
import {
  ADMIN_DIALOG_CLASS,
  ADMIN_FIELD_CLASS,
  ADMIN_INSET_PANEL_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
  AdminEmptyState,
  AdminFloatingRail,
  AdminShell,
} from '@/components/admin/AdminShell';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { ProofSection } from '@/components/matches/ProofSection';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useMatchDetail } from '@/hooks/useMatches';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ReadyLobbyScreen, getViewState } from '@/pages/MatchDetail';
import { PLATFORM_FEE } from '@/types';
import type { Match, MatchParticipant, ProfileSummary, Transaction } from '@/types';

type OverlayTab = 'moderation' | 'proofs' | 'finance';

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function OverlayTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-4 py-2 text-sm font-semibold transition',
        active
          ? 'border-[#ff1654] bg-[#221014] text-white'
          : 'border-[#39242b] bg-[#1c1c1c] text-[#aba1a5] hover:border-[#ff1654]/40 hover:bg-[#26161b] hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

function FinanceMetric({
  label,
  amount,
}: {
  label: string;
  amount: number;
}) {
  return (
    <div className={cn(ADMIN_INSET_PANEL_CLASS, 'p-4')}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-[#7a6b70]">{label}</p>
      <div className="mt-3">
        <CoinDisplay amount={amount} size="sm" />
      </div>
    </div>
  );
}

export default function AdminMatchDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdmin, isLoading } = useAdminStatus();
  const { toast } = useToast();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<OverlayTab>('moderation');
  const [adminNotes, setAdminNotes] = useState('');
  const [resolving, setResolving] = useState(false);
  const [forceExpireOpen, setForceExpireOpen] = useState(false);
  const [forceExpireReason, setForceExpireReason] = useState('');
  const [forceExpiring, setForceExpiring] = useState(false);

  const {
    data: matchRaw,
    isPending: matchLoading,
    error: matchError,
    refetch: refetchMatch,
  } = useMatchDetail(id);
  const match = matchRaw as Match | null;

  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ['admin-match-transactions', id],
    enabled: Boolean(id && user && isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('match_id', id!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as Transaction[];
    },
  });

  const refreshWorkspace = async () => {
    await Promise.all([refetchMatch(), refetchTransactions()]);
  };

  const participants = (match?.participants ?? []) as MatchParticipant[];
  const currentParticipant = user ? participants.find((participant) => participant.user_id === user.id) : undefined;
  const isParticipant = Boolean(currentParticipant);
  const isCreator = match?.creator_id === user?.id;
  const currentTeamSide =
    currentParticipant?.team_side === 'A' || currentParticipant?.team_side === 'B'
      ? currentParticipant.team_side
      : undefined;
  const amReady = Boolean(currentParticipant?.ready);
  const hasSubmittedResult = Boolean(currentParticipant?.result_choice);

  const teamSize = Math.max(Number(match?.team_size ?? 1), 1);
  const teamA = participants.filter((participant) => participant.team_side === 'A');
  const teamB = participants.filter((participant) => participant.team_side === 'B');
  const readyCount = participants.filter((participant) => participant.ready).length;
  const readyTotal = teamSize * 2;

  const { teamMap, profileMap } = useMemo(() => {
    const nextTeamMap: Record<string, 'A' | 'B'> = {};
    const nextProfileMap: Record<string, ProfileSummary> = {};

    participants.forEach((participant) => {
      if (participant.team_side === 'A' || participant.team_side === 'B') {
        nextTeamMap[participant.user_id] = participant.team_side;
      }

      if (participant.profile) {
        nextProfileMap[participant.user_id] = participant.profile as ProfileSummary;
      }
    });

    if (match?.creator) {
      nextProfileMap[match.creator_id] = match.creator as ProfileSummary;
    }

    return {
      teamMap: nextTeamMap,
      profileMap: nextProfileMap,
    };
  }, [match?.creator, match?.creator_id, participants]);

  const status = match?.status ?? 'open';
  const viewState = getViewState(status);
  const entryFee = Number(match?.entry_fee ?? 0);
  const totalPot = entryFee * teamSize * 2;
  const prize = totalPot * (1 - PLATFORM_FEE);
  const platformFee = totalPot * PLATFORM_FEE;
  const canResolve = ['disputed', 'in_progress', 'result_pending'].includes(status);
  const canForceExpire =
    !['expired', 'completed', 'admin_resolved', 'finished', 'canceled'].includes(status) &&
    status !== 'in_progress';
  const disputeReason = Array.isArray(match?.result)
    ? match?.result?.[0]?.dispute_reason
    : match?.result?.dispute_reason;
  const resolutionNotes = Array.isArray(match?.result)
    ? match?.result?.[0]?.admin_notes
    : match?.result?.admin_notes;

  const handleResolve = async (action: 'TEAM_A_WIN' | 'TEAM_B_WIN' | 'REFUND_BOTH') => {
    if (!match) return;

    if (action !== 'REFUND_BOTH' && !adminNotes.trim()) {
      toast({
        title: 'Notes required',
        description: 'Add a moderation note before assigning a winner.',
        variant: 'destructive',
      });
      return;
    }

    setResolving(true);

    const { data, error } = await supabase.rpc('admin_resolve_match_v3', {
      p_match_id: match.id,
      p_action: action,
      p_notes: adminNotes.trim() || null,
    });

    setResolving(false);

    const result = data as { success?: boolean; error?: string; message?: string } | null;
    if (error || !result?.success) {
      toast({
        title: 'Error',
        description: result?.error || error?.message || 'Unable to resolve the match.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Match resolved',
      description: result.message || 'The moderation decision has been applied.',
    });
    setAdminNotes('');
    await refreshWorkspace();
  };

  const handleForceExpire = async () => {
    if (!match) return;

    setForceExpiring(true);
    try {
      const { data, error } = await supabase.rpc('admin_force_expire_match', {
        p_match_id: match.id,
        p_reason: forceExpireReason.trim() || null,
      });

      const result = data as {
        success?: boolean;
        error?: string;
        refund_count?: number;
        refunded_total?: number;
      } | null;

      if (error || !result?.success) {
        toast({
          title: 'Error',
          description: result?.error || error?.message || 'Unable to force expire this match.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Force expire complete',
        description: `Refunds: ${result.refund_count ?? 0} · Total: ${Number(result.refunded_total ?? 0).toFixed(2)}`,
      });
      setForceExpireOpen(false);
      setForceExpireReason('');
      await refreshWorkspace();
    } finally {
      setForceExpiring(false);
    }
  };

  if (isLoading) {
    return (
      <AdminShell title="Match Detail" description="Loading admin access for this workspace.">
        <LoadingPage />
      </AdminShell>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (!id) {
    return (
      <AdminShell title="Match Detail" description="The requested match id is missing.">
        <AdminEmptyState
          title="Missing match id"
          description="Open the match again from the admin matches workspace."
        />
      </AdminShell>
    );
  }

  if (matchLoading) {
    return (
      <AdminShell title="Match Detail" description="Loading the shared public match scene for admin review.">
        <LoadingPage />
      </AdminShell>
    );
  }

  if (matchError || !match) {
    return (
      <AdminShell title="Match Detail" description="The requested match is no longer available.">
        <AdminEmptyState
          title="Match not found"
          description="Return to the matches workspace and open another row."
        />
      </AdminShell>
    );
  }

  return (
    <>
      <ReadyLobbyScreen
        match={match}
        status={status}
        viewState={viewState}
        currentUserId={user.id}
        currentTeamSide={currentTeamSide}
        isParticipant={isParticipant}
        isCreator={Boolean(isCreator)}
        amReady={amReady}
        hasSubmittedResult={hasSubmittedResult}
        teamSize={teamSize}
        teamA={teamA}
        teamB={teamB}
        teamMap={teamMap}
        profileMap={profileMap}
        readyCount={readyCount}
        readyTotal={readyTotal}
        readyPending={false}
        cancelPending={false}
        submitPending={false}
        onReady={() => undefined}
        onCancel={() => undefined}
        onSubmitResult={() => undefined}
        prize={prize}
        entryFee={entryFee}
        viewerIsAdmin
        showUserActions={false}
        chatIsAdmin
      />

      <div className="pointer-events-none fixed inset-0 z-[70]">
        <div className="pointer-events-auto absolute left-6 top-[166px] hidden lg:block">
          <AdminFloatingRail pathname={location.pathname} />
        </div>

        <div className="pointer-events-auto absolute left-6 top-[166px] lg:left-[286px]">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/matches')}
            className={cn('h-12 rounded-full px-5 text-sm font-semibold', ADMIN_OUTLINE_BUTTON_CLASS)}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to matches
          </Button>
        </div>

        <div className="pointer-events-auto absolute right-6 top-[166px] flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void refreshWorkspace()}
            className={cn('h-12 rounded-full px-5 text-sm font-semibold', ADMIN_OUTLINE_BUTTON_CLASS)}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setDrawerOpen((current) => !current)}
            className="h-12 rounded-full bg-[#ff1654] px-5 text-sm font-semibold text-white hover:bg-[#ff1654]/90"
          >
            <Shield className="mr-2 h-4 w-4" />
            {drawerOpen ? 'Close panel' : 'Admin panel'}
          </Button>
        </div>

        {drawerOpen ? (
          <aside className="pointer-events-auto absolute bottom-6 right-6 top-[224px] flex w-[420px] flex-col overflow-hidden rounded-[28px] border border-[#4a2a32] bg-[#12090b] shadow-[0_28px_80px_rgba(0,0,0,0.55)]">
            <div className="flex items-start justify-between gap-4 border-b border-[#2b1a1f] px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#ff8ead]">
                  Admin Panel
                </p>
                <h2 className="mt-2 font-['Base_Neue_Trial:Expanded_Black_Oblique','Base_Neue_Trial','sans-serif'] text-[30px] italic leading-none text-white">
                  MATCH CONTROL
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#9c9c9c]">
                  Moderate the live match without leaving the real player-facing scene.
                </p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDrawerOpen(false)}
                className="h-10 w-10 rounded-full border border-[#39242b] bg-[#1c1c1c] text-white hover:bg-[#26161b]"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="border-b border-[#2b1a1f] px-5 py-3">
              <div className="flex flex-wrap gap-2">
                <OverlayTabButton active={activeTab === 'moderation'} onClick={() => setActiveTab('moderation')}>
                  Moderation
                </OverlayTabButton>
                <OverlayTabButton active={activeTab === 'proofs'} onClick={() => setActiveTab('proofs')}>
                  Proofs
                </OverlayTabButton>
                <OverlayTabButton active={activeTab === 'finance'} onClick={() => setActiveTab('finance')}>
                  Finance
                </OverlayTabButton>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {activeTab === 'moderation' ? (
                <div className="space-y-4">
                  <div className={cn(ADMIN_INSET_PANEL_CLASS, 'p-4')}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[#7a6b70]">Match state</p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {match.mode} · {teamSize}v{teamSize}
                        </p>
                        <p className="mt-1 text-sm text-[#9c9c9c]">{match.id}</p>
                      </div>
                      <span className="rounded-full border border-[#ff1654]/30 bg-[#221014] px-3 py-1 text-xs uppercase tracking-[0.2em] text-white">
                        {status}
                      </span>
                    </div>
                  </div>

                  {canResolve ? (
                    <div className={cn(ADMIN_INSET_PANEL_CLASS, 'p-4')}>
                      <p className="text-sm font-semibold text-white">Resolve match</p>
                      <p className="mt-1 text-sm leading-6 text-[#9c9c9c]">
                        Assign a winner or refund both teams after the admin review.
                      </p>

                      <Textarea
                        placeholder="Admin notes are required when assigning a winner."
                        value={adminNotes}
                        onChange={(event) => setAdminNotes(event.target.value)}
                        className={cn('mt-4 min-h-[120px]', ADMIN_FIELD_CLASS)}
                      />

                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        <Button
                          onClick={() => handleResolve('TEAM_A_WIN')}
                          disabled={resolving}
                          className="bg-[#72f1b8] text-black hover:bg-[#72f1b8]/90"
                        >
                          {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Team A wins
                        </Button>
                        <Button
                          onClick={() => handleResolve('TEAM_B_WIN')}
                          disabled={resolving}
                          className="bg-[#72d2ff] text-black hover:bg-[#72d2ff]/90"
                        >
                          {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                          Team B wins
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handleResolve('REFUND_BOTH')}
                          disabled={resolving}
                          className={cn('sm:col-span-2', ADMIN_OUTLINE_BUTTON_CLASS)}
                        >
                          {resolving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Refund both
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className={cn(ADMIN_INSET_PANEL_CLASS, 'p-4')}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Force expire</p>
                        <p className="mt-1 text-sm leading-6 text-[#9c9c9c]">
                          Refund-only close for matches that are still recoverable.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        disabled={!canForceExpire}
                        onClick={() => setForceExpireOpen(true)}
                        className={cn('h-10 px-4', ADMIN_OUTLINE_BUTTON_CLASS)}
                      >
                        Force expire
                      </Button>
                    </div>
                    <p className="mt-4 text-sm text-[#9c9c9c]">
                      Current status: <span className="font-semibold text-white">{status}</span>
                    </p>
                    {!canForceExpire ? (
                      <p className="mt-2 text-sm text-[#8b7b80]">Not available for the current match state.</p>
                    ) : null}
                  </div>

                  {resolutionNotes ? (
                    <div className={cn(ADMIN_INSET_PANEL_CLASS, 'p-4')}>
                      <p className="text-sm font-semibold text-white">Stored resolution notes</p>
                      <p className="mt-3 text-sm leading-6 text-[#9c9c9c]">{resolutionNotes}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === 'proofs' ? (
                <div className="space-y-4">
                  {disputeReason ? (
                    <div className="rounded-[22px] border border-[#ff1654]/30 bg-[#221014] p-4">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-4 w-4 text-[#ff8ead]" />
                        <p className="text-sm font-semibold text-white">Dispute reason</p>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#d0c8cb]">{disputeReason}</p>
                    </div>
                  ) : null}

                  <div className={cn(ADMIN_INSET_PANEL_CLASS, 'min-h-[420px] p-4')}>
                    <ProofSection
                      matchId={match.id}
                      currentUserId={user.id}
                      isAdmin
                      isParticipant={false}
                    />
                  </div>
                </div>
              ) : null}

              {activeTab === 'finance' ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FinanceMetric label="Entry fee" amount={entryFee} />
                    <FinanceMetric label="Total pot" amount={totalPot} />
                    <FinanceMetric label="Prize pool" amount={prize} />
                    <FinanceMetric label="Platform fee" amount={platformFee} />
                  </div>

                  <div className={cn(ADMIN_INSET_PANEL_CLASS, 'p-4')}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">Transactions</p>
                        <p className="mt-1 text-sm text-[#9c9c9c]">
                          Ledger entries linked to this match.
                        </p>
                      </div>
                      {transactionsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#8f8488]" />
                      ) : null}
                    </div>

                    {transactions.length === 0 ? (
                      <div className="mt-4 rounded-[18px] border border-dashed border-[#352127] bg-[#171012] px-4 py-8 text-center text-sm text-[#8f8488]">
                        No transactions linked to this match yet.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {transactions.map((transaction) => (
                          <div
                            key={transaction.id}
                            className="flex items-center justify-between gap-4 rounded-[18px] border border-[#302025] bg-[#171012] px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold capitalize text-white">{transaction.type}</p>
                              <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-[#7a6b70]">
                                {formatDate(transaction.created_at)}
                              </p>
                              <p className="mt-2 text-sm text-[#9c9c9c]">
                                {transaction.description || 'No description'}
                              </p>
                            </div>
                            <CoinDisplay amount={transaction.amount} size="sm" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      <Dialog open={forceExpireOpen} onOpenChange={setForceExpireOpen}>
        <DialogContent className={ADMIN_DIALOG_CLASS}>
          <DialogHeader>
            <DialogTitle>Confirm force expire</DialogTitle>
            <DialogDescription>
              This action is refund-only and rejected when the match is already settled.
            </DialogDescription>
          </DialogHeader>

          <Textarea
            placeholder="Optional reason for the audit trail"
            value={forceExpireReason}
            onChange={(event) => setForceExpireReason(event.target.value)}
            className={cn('min-h-[120px]', ADMIN_FIELD_CLASS)}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setForceExpireOpen(false)}
              disabled={forceExpiring}
              className={ADMIN_OUTLINE_BUTTON_CLASS}
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
    </>
  );
}
