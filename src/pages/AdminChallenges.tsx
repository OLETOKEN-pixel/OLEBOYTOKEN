import { useMemo, useState } from 'react';
import { CalendarClock, Plus, RefreshCw, Target, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { AdminEmptyState, AdminPanel, AdminShell, AdminStatCard } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type ChallengeRow = Database['public']['Tables']['challenges']['Row'];

type ChallengeFormState = {
  id: string | null;
  title: string;
  description: string;
  type: 'daily' | 'weekly';
  metricType: string;
  targetValue: string;
  rewardXp: string;
  rewardCoin: string;
  sortOrder: string;
  isActive: boolean;
};

const METRIC_OPTIONS = [
  { value: 'match_completed', label: 'Match completed' },
  { value: 'ready_up_fast', label: 'Ready up fast' },
  { value: 'proof_uploaded', label: 'Proof uploaded' },
  { value: 'match_created_started', label: 'Match created started' },
];

const EMPTY_FORM: ChallengeFormState = {
  id: null,
  title: '',
  description: '',
  type: 'daily',
  metricType: METRIC_OPTIONS[0].value,
  targetValue: '1',
  rewardXp: '0',
  rewardCoin: '0',
  sortOrder: '0',
  isActive: true,
};

function describeReward(challenge: ChallengeRow) {
  const pieces: string[] = [];
  if (challenge.reward_xp > 0) pieces.push(`+${challenge.reward_xp} XP`);
  if (Number(challenge.reward_coin) > 0) pieces.push(`+${Number(challenge.reward_coin)} OBC`);
  return pieces.join(' • ') || 'No reward';
}

export default function AdminChallenges() {
  const { isAdmin } = useAdminStatus();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ChallengeFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const {
    data: challenges = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['admin-challenges'],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .order('type', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Error fetching admin challenges:', error);
        return [];
      }

      return (data || []) as ChallengeRow[];
    },
  });

  const dailyCount = challenges.filter((challenge) => challenge.type === 'daily').length;
  const weeklyCount = challenges.filter((challenge) => challenge.type === 'weekly').length;
  const activeCount = challenges.filter((challenge) => challenge.is_active).length;

  const groupedChallenges = useMemo(
    () => ({
      daily: challenges.filter((challenge) => challenge.type === 'daily'),
      weekly: challenges.filter((challenge) => challenge.type === 'weekly'),
    }),
    [challenges],
  );

  const openCreateDialog = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (challenge: ChallengeRow) => {
    setForm({
      id: challenge.id,
      title: challenge.title,
      description: challenge.description,
      type: challenge.type as 'daily' | 'weekly',
      metricType: challenge.metric_type,
      targetValue: String(challenge.target_value),
      rewardXp: String(challenge.reward_xp),
      rewardCoin: String(challenge.reward_coin),
      sortOrder: String(challenge.sort_order),
      isActive: Boolean(challenge.is_active),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);

    const { data, error } = await supabase.rpc('admin_upsert_challenge', {
      p_challenge_id: form.id || undefined,
      p_title: form.title,
      p_description: form.description,
      p_type: form.type,
      p_metric_type: form.metricType,
      p_target_value: Number(form.targetValue),
      p_reward_xp: Number(form.rewardXp || '0'),
      p_reward_coin: Number(form.rewardCoin || '0'),
      p_sort_order: Number(form.sortOrder || '0'),
      p_is_active: form.isActive,
    });

    setSaving(false);

    const result = data as { success?: boolean; error?: string } | null;
    if (error || !result?.success) {
      toast({
        title: 'Error',
        description: result?.error || error?.message || 'Unable to save challenge.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: form.id ? 'Challenge updated' : 'Challenge created',
      description: form.title,
    });
    setDialogOpen(false);
    setForm(EMPTY_FORM);
    await refetch();
  };

  const handleToggleActive = async (challenge: ChallengeRow) => {
    setTogglingId(challenge.id);

    const { data, error } = await supabase.rpc('admin_set_challenge_active', {
      p_challenge_id: challenge.id,
      p_is_active: !challenge.is_active,
    });

    setTogglingId(null);

    const result = data as { success?: boolean; error?: string } | null;
    if (error || !result?.success) {
      toast({
        title: 'Error',
        description: result?.error || error?.message || 'Unable to change challenge status.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: challenge.is_active ? 'Challenge deactivated' : 'Challenge activated',
      description: challenge.title,
    });
    await refetch();
  };

  return (
    <AdminShell
      title="Challenges"
      description="Create and tune daily or weekly tasks, reorder them, and push changes live to the site instantly."
      actions={
        <>
          <Button variant="outline" onClick={() => refetch()} className="border-white/14 bg-white/5 text-white hover:bg-white/10">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90">
            <Plus className="mr-2 h-4 w-4" />
            New challenge
          </Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-3">
        <AdminStatCard label="Active" value={String(activeCount)} icon={Trophy} />
        <AdminStatCard label="Daily" value={String(dailyCount)} icon={CalendarClock} accent="#72d2ff" />
        <AdminStatCard label="Weekly" value={String(weeklyCount)} icon={Target} accent="#72f1b8" />
      </div>

      {(['daily', 'weekly'] as const).map((type) => (
        <AdminPanel
          key={type}
          title={type === 'daily' ? 'Daily challenges' : 'Weekly challenges'}
          description={`Ordered by sort_order and instantly reflected on the public challenges surfaces.`}
        >
          {groupedChallenges[type].length === 0 && !isLoading ? (
            <AdminEmptyState
              title={`No ${type} challenges`}
              description="Create one from the dialog above and it will immediately appear in the live catalog."
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {groupedChallenges[type].map((challenge) => (
                <div key={challenge.id} className="rounded-[24px] border border-white/10 bg-black/18 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">{challenge.title}</h3>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-white/56">
                      {challenge.metric_type}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-white/56">
                      order {challenge.sort_order}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.2em] ${
                        challenge.is_active ? 'bg-[#72f1b8]/16 text-[#72f1b8]' : 'bg-white/8 text-white/46'
                      }`}
                    >
                      {challenge.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-white/56">{challenge.description}</p>

                  <div className="mt-4 grid gap-2 text-sm text-white/64 sm:grid-cols-2">
                    <div>Target: <span className="font-semibold text-white">{challenge.target_value}</span></div>
                    <div>Reward: <span className="font-semibold text-white">{describeReward(challenge)}</span></div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => openEditDialog(challenge)}
                      className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleToggleActive(challenge)}
                      disabled={togglingId === challenge.id}
                      className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                    >
                      {challenge.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      ))}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="border-white/14 bg-[#120b0f] text-white sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit challenge' : 'Create challenge'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Title</label>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="border-white/12 bg-white/5 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Type</label>
                <select
                  value={form.type}
                  onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as 'daily' | 'weekly' }))}
                  className="h-10 w-full rounded-md border border-white/12 bg-white/5 px-3 text-sm text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.22em] text-white/48">Description</label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-[110px] border-white/12 bg-white/5 text-white"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Metric</label>
                <select
                  value={form.metricType}
                  onChange={(event) => setForm((current) => ({ ...current, metricType: event.target.value }))}
                  className="h-10 w-full rounded-md border border-white/12 bg-white/5 px-3 text-sm text-white"
                >
                  {METRIC_OPTIONS.map((metric) => (
                    <option key={metric.value} value={metric.value}>
                      {metric.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Target</label>
                <Input
                  type="number"
                  min="1"
                  value={form.targetValue}
                  onChange={(event) => setForm((current) => ({ ...current, targetValue: event.target.value }))}
                  className="border-white/12 bg-white/5 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Reward XP</label>
                <Input
                  type="number"
                  min="0"
                  value={form.rewardXp}
                  onChange={(event) => setForm((current) => ({ ...current, rewardXp: event.target.value }))}
                  className="border-white/12 bg-white/5 text-white"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Reward OBC</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.rewardCoin}
                  onChange={(event) => setForm((current) => ({ ...current, rewardCoin: event.target.value }))}
                  className="border-white/12 bg-white/5 text-white"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Sort order</label>
                <Input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                  className="border-white/12 bg-white/5 text-white"
                />
              </div>

              <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/46">Active</p>
                  <p className="mt-1 text-sm text-white/70">When active, the challenge is visible and trackable on site.</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-white/12 bg-white/5 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#ff1654] text-white hover:bg-[#ff1654]/90">
              {saving ? 'Saving...' : form.id ? 'Save changes' : 'Create challenge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
