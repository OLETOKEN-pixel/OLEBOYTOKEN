import { AlertTriangle, RefreshCw, Swords, TimerReset } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_OUTLINE_BUTTON_CLASS, AdminPanel, AdminShell, AdminStatCard } from '@/components/admin/AdminShell';
import { GlobalSearchBar } from '@/components/admin/GlobalSearchBar';
import { MatchesTable } from '@/components/admin/MatchesTable';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/types';

export default function AdminMatches() {
  const { isAdmin } = useAdminStatus();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') ?? undefined;
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
      description="Operational workspace for live queue monitoring, disputes, proofs, and match deep-dives."
      actions={
        <>
          <div className="w-full max-w-[360px]">
            <GlobalSearchBar />
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className={`h-11 ${ADMIN_OUTLINE_BUTTON_CLASS}`}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <div className="grid min-h-0 gap-4 xl:grid-rows-[repeat(3,minmax(0,1fr))]">
          <AdminStatCard label="Matches loaded" value={String(matches.length)} icon={Swords} />
          <AdminStatCard label="Disputed" value={String(disputedCount)} icon={AlertTriangle} accent="#ff8a65" />
          <AdminStatCard label="Ready / live" value={String(readyCheckCount + liveCount)} icon={TimerReset} accent="#72d2ff" />
        </div>

        <AdminPanel
          title="Match control"
          description="Search, filter, export, and jump into the dedicated full-screen match detail view."
          className="h-full"
          contentClassName="h-full"
        >
          <MatchesTable matches={matches} loading={isLoading} fullHeight initialStatusFilter={initialStatus} />
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
