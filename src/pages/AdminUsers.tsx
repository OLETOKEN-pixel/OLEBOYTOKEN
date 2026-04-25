import { RefreshCw, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminPanel, AdminShell, AdminStatCard } from '@/components/admin/AdminShell';
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
      description="Manage roles, bans, balances, and open a full user profile without leaving the admin suite."
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
        <AdminStatCard label="Total users" value={String(users.length)} icon={Users} />
        <AdminStatCard label="Admins" value={String(adminCount)} icon={ShieldCheck} accent="#72f1b8" />
        <AdminStatCard label="Banned" value={String(bannedCount)} icon={ShieldAlert} accent="#ff8a65" />
      </div>

      <AdminPanel
        title="User directory"
        description="Filter, export, moderate, and jump into a specific account."
      >
        <UsersTable users={users} loading={isLoading} onUserUpdated={() => void refetch()} />
      </AdminPanel>
    </AdminShell>
  );
}
