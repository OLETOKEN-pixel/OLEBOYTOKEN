import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, ExternalLink, RefreshCw, Users, Wrench, XCircle } from 'lucide-react';
import {
  ADMIN_DIALOG_CLASS,
  ADMIN_INSET_PANEL_CLASS,
  ADMIN_OUTLINE_BUTTON_CLASS,
} from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { PremiumBadge } from '@/components/ui/premium-badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Match } from '@/types';

interface LegacyCleanupResult {
  success: boolean;
  non_terminal_processed?: number;
  terminal_stuck_processed?: number;
  total_matches_processed?: number;
  total_refunded?: number;
  processed_match_ids?: string[];
  orphan_fix_result?: { fixed_wallets?: number; fixed_total?: number };
  error?: string;
}

interface IssueStats {
  disputed: number;
  expired_with_locks: number;
  stuck_ready_check: number;
  inconsistent_results: number;
  total: number;
}

interface IssueCenterProps {
  matches: Match[];
  onRefresh: () => void;
}

export function IssueCenter({ matches, onRefresh }: IssueCenterProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<IssueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<LegacyCleanupResult | null>(null);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_admin_issue_stats');
    if (!error && data) {
      setStats(data as unknown as IssueStats);
    }
    setLoading(false);
  };

  const handleLegacyCleanup = async () => {
    setCleaningUp(true);
    try {
      const { data, error } = await supabase.rpc('admin_cleanup_legacy_stuck_matches', {
        p_cutoff_minutes: 35,
      });

      if (error) {
        toast({ title: 'Errore', description: error.message, variant: 'destructive' });
        return;
      }

      const result = data as unknown as LegacyCleanupResult;
      setCleanupResult(result);
      setShowCleanupDialog(true);

      if (result.success) {
        toast({
          title: 'Pulizia completata',
          description: `${result.total_matches_processed || 0} match processati, ${result.total_refunded || 0} Coins rimborsati`,
        });
        void fetchStats();
        onRefresh();
      }
    } catch {
      toast({
        title: 'Errore',
        description: 'Errore durante la pulizia',
        variant: 'destructive',
      });
    } finally {
      setCleaningUp(false);
    }
  };

  useEffect(() => {
    void fetchStats();
  }, [matches]);

  const disputedMatches = matches.filter((match) => match.status === 'disputed');
  const expiredMatches = matches.filter((match) => match.status === 'expired');
  const stuckReadyMatches = matches.filter(
    (match) => match.status === 'ready_check' && new Date(match.created_at).getTime() < Date.now() - 10 * 60 * 1000,
  );
  const inconsistentMatches = matches.filter((match) => {
    if (!match.participants || match.status !== 'finished') return false;
    const teamAChoice = match.participants.find((participant) => participant.team_side === 'A')?.result_choice;
    const teamBChoice = match.participants.find((participant) => participant.team_side === 'B')?.result_choice;
    return teamAChoice && teamBChoice && teamAChoice === teamBChoice;
  });

  const issueCategories = [
    {
      key: 'disputed',
      label: 'Disputes',
      icon: AlertTriangle,
      count: stats?.disputed ?? disputedMatches.length,
      items: disputedMatches,
      accent: '#ff8a65',
    },
    {
      key: 'expired_with_locks',
      label: 'Expired with funds',
      icon: Clock,
      count: stats?.expired_with_locks ?? 0,
      items: expiredMatches,
      accent: '#ffd166',
    },
    {
      key: 'stuck_ready',
      label: 'Stuck ready check',
      icon: Users,
      count: stats?.stuck_ready_check ?? stuckReadyMatches.length,
      items: stuckReadyMatches,
      accent: '#72d2ff',
    },
    {
      key: 'inconsistent',
      label: 'Inconsistent results',
      icon: XCircle,
      count: stats?.inconsistent_results ?? inconsistentMatches.length,
      items: inconsistentMatches,
      accent: '#c98dff',
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/42">Issue center</p>
          <h3 className="mt-1 text-xl font-semibold text-white">Automated match diagnostics</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLegacyCleanup}
            disabled={cleaningUp}
            className={ADMIN_OUTLINE_BUTTON_CLASS}
          >
            <Wrench className="mr-2 h-4 w-4" />
            {cleaningUp ? 'Cleaning...' : 'Repair legacy'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchStats();
              onRefresh();
            }}
            disabled={loading}
            className={ADMIN_OUTLINE_BUTTON_CLASS}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {issueCategories.map((category) => (
          <div key={category.key} className={ADMIN_INSET_PANEL_CLASS + ' p-4'}>
            <div className="flex items-center justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-[16px] border border-[#302025] bg-[#151012]">
                <category.icon className="h-4 w-4" style={{ color: category.accent }} />
              </div>
              <p className="text-3xl font-semibold leading-none text-white">{category.count}</p>
            </div>
            <p className="mt-4 text-sm font-medium text-white">{category.label}</p>
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-2">
        {issueCategories
          .filter((category) => category.count > 0)
          .map((category) => (
            <div key={category.key} className="flex min-h-0 flex-col overflow-hidden rounded-[24px] border border-[#302025] bg-[#171012]">
              <div className="flex shrink-0 items-center gap-3 border-b border-[#2b1a1f] px-4 py-4">
                <category.icon className="h-4 w-4" style={{ color: category.accent }} />
                <span className="text-sm font-semibold text-white">{category.label}</span>
                <PremiumBadge variant="open" className="ml-auto">
                  {category.count}
                </PremiumBadge>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {category.items.slice(0, 6).map((match) => (
                    <div
                      key={match.id}
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-[#302025] bg-[#1c1c1c] p-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">
                          {match.team_size}v{match.team_size} {match.mode}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/42">
                          {match.region} • {match.entry_fee} Coins
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/admin/matches/${match.id}`)}
                        className="border border-[#39242b] bg-[#171012] text-white hover:bg-[#26161b]"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {category.items.length > 6 ? (
                    <p className="text-center text-xs uppercase tracking-[0.18em] text-white/40">
                      +{category.items.length - 6} more
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

        {(stats?.total ?? 0) === 0 ? (
          <div className="grid place-items-center rounded-[24px] border border-dashed border-[#352127] bg-[#13090b] px-4 py-10 text-center xl:col-span-2">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#72f1b8]/12">
                <AlertTriangle className="h-5 w-5 text-[#72f1b8]" />
              </div>
              <p className="mt-4 text-lg font-semibold text-white">No active issues</p>
              <p className="mt-2 text-sm text-white/52">All monitored match states are currently clean.</p>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={showCleanupDialog} onOpenChange={setShowCleanupDialog}>
        <DialogContent className={ADMIN_DIALOG_CLASS}>
          <DialogHeader>
            <DialogTitle>Legacy cleanup result</DialogTitle>
            <DialogDescription>Summary of the maintenance operation.</DialogDescription>
          </DialogHeader>

          {cleanupResult ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[#302025] bg-[#1c1c1c] p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">Non-terminal</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{cleanupResult.non_terminal_processed || 0}</p>
                </div>
                <div className="rounded-[18px] border border-[#302025] bg-[#1c1c1c] p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">Stuck terminal</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{cleanupResult.terminal_stuck_processed || 0}</p>
                </div>
              </div>

              <div className="rounded-[18px] border border-[#302025] bg-[#1c1c1c] p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">Refunded total</p>
                <p className="mt-3 text-3xl font-semibold text-white">{cleanupResult.total_refunded || 0} Coins</p>
              </div>

              {cleanupResult.processed_match_ids?.length ? (
                <div className="rounded-[18px] border border-[#302025] bg-[#1c1c1c] p-4">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-white/42">Processed matches</p>
                  <div className="mt-3 max-h-[140px] space-y-2 overflow-y-auto font-mono text-xs text-white/58">
                    {cleanupResult.processed_match_ids.map((matchId) => (
                      <div key={matchId}>{matchId}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
