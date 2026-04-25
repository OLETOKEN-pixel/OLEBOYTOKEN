import { AlertTriangle, RefreshCw, Swords, TimerReset } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminPanel, AdminShell, AdminStatCard } from '@/components/admin/AdminShell';
import { GlobalSearchBar } from '@/components/admin/GlobalSearchBar';
import { MatchesTable } from '@/components/admin/MatchesTable';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/types';

export default function AdminMatches() {
  const { isAdmin } = useAdminStatus();
  const {
    data: matches = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-matches'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`*, creator:profiles!matches_creator_id_fkey(*), participants:match_participants(*, profile:profiles(*)), result:match_results(*)`)
        .order('created_at', { ascending: false })
        .limit(400);

      if (error) {
        console.error('Error fetching admin matches:', error);
        return [];
      }

      return (data || []) as unknown as Match[];
    },
  });

  const disputedCount = matches.filter((match) => match.status === 'disputed').length;
  const liveCount = matches.filter((match) => match.status === 'in_progress' || match.status === 'started').length;
  const readyCheckCount = matches.filter((match) => match.status === 'ready_check').length;

  return (
    <AdminShell
      title="Matches"
      description="Inspect the live arena queue, investigate disputes, and jump into each match detail page."
      actions={
        <>
          <div className="hidden min-w-[300px] lg:block">
            <GlobalSearchBar />
          </div>
          <Button variant="outline" onClick={() => refetch()} className="border-white/14 bg-white/5 text-white hover:bg-white/10">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatCard label="Matches loaded" value={String(matches.length)} icon={Swords} />
        <AdminStatCard label="Disputed" value={String(disputedCount)} icon={AlertTriangle} accent="#ff8a65" />
        <AdminStatCard label="Ready check" value={String(readyCheckCount + liveCount)} icon={TimerReset} accent="#72d2ff" />
      </div>

      <AdminPanel
        title="Match control"
        description="Use the operational filters below, then open a match to review proofs, chat, and admin actions."
      >
        <MatchesTable matches={matches} loading={isLoading} />
      </AdminPanel>
    </AdminShell>
  );
}
