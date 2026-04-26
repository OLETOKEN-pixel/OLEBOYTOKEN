import { RefreshCw, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ADMIN_OUTLINE_BUTTON_CLASS, AdminPanel, AdminShell, AdminStatCard } from '@/components/admin/AdminShell';
import { GlobalSearchBar } from '@/components/admin/GlobalSearchBar';
import { UsersTable } from '@/components/admin/UsersTable';
import { Button } from '@/components/ui/button';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { supabase } from '@/integrations/supabase/client';
import type { Profile } from '@/types';

export default function AdminUsers() {
  const { isAdmin } = useAdminStatus();
  const {
    data: users = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-users'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching admin users:', error);
        return [];
      }

      return (data || []) as Profile[];
    },
  });

  const bannedCount = users.filter((user) => user.is_banned).length;
  const adminCount = users.filter((user) => user.role === 'admin').length;

  return (
    <AdminShell
      title="Users"
      description="Moderation workspace for roles, bans, balances, and direct access to each player profile."
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
          <AdminStatCard label="Total users" value={String(users.length)} icon={Users} />
          <AdminStatCard label="Admins" value={String(adminCount)} icon={ShieldCheck} accent="#72f1b8" />
          <AdminStatCard label="Banned" value={String(bannedCount)} icon={ShieldAlert} accent="#ff8a65" />
        </div>

        <AdminPanel
          title="User directory"
          description="Filter, export, moderate, and open a user profile without leaving the full-screen workspace."
          className="h-full"
          contentClassName="h-full"
        >
          <UsersTable users={users} loading={isLoading} onUserUpdated={() => void refetch()} fullHeight />
        </AdminPanel>
      </div>
    </AdminShell>
  );
}
