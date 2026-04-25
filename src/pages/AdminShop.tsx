import { useMemo, useState } from 'react';
import { ImagePlus, Package, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { AdminEmptyState, AdminPanel, AdminShell, AdminStatCard } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useShopLevelRewards } from '@/hooks/useShopLevelRewards';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { LevelReward } from '@/lib/levelRewards';

type RewardFormState = {
  id: string | null;
  name: string;
  description: string;
  levelRequired: string;
  isActive: boolean;
  imagePath: string;
  imagePreview: string;
  file: File | null;
};

const EMPTY_FORM: RewardFormState = {
  id: null,
  name: '',
  description: '',
  levelRequired: '',
  isActive: true,
  imagePath: '',
  imagePreview: '',
  file: null,
};

function buildSafeFileName(file: File) {
  const extension = file.name.includes('.') ? file.name.split('.').pop() : 'png';
  const base = file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').toLowerCase();
  return `reward-${Date.now()}-${base || 'item'}.${extension}`;
}

function canDeleteStorageObject(path: string) {
  return Boolean(path) && !path.startsWith('/') && !path.startsWith('http://') && !path.startsWith('https://');
}

export default function AdminShop() {
  const { toast } = useToast();
  const { rewards, isLoading, refetch } = useShopLevelRewards({ includeInactive: true });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<RewardFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const activeRewards = useMemo(
    () => rewards.filter((reward) => reward.isActive !== false),
    [rewards],
  );

  const openCreateDialog = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEditDialog = (reward: LevelReward) => {
    setForm({
      id: reward.id,
      name: reward.name,
      description: reward.description || '',
      levelRequired: String(reward.levelRequired),
      isActive: reward.isActive !== false,
      imagePath: reward.imagePath || reward.image,
      imagePreview: reward.image,
      file: null,
    });
    setDialogOpen(true);
  };

  const uploadSelectedFile = async () => {
    if (!form.file) {
      return form.imagePath;
    }

    const path = buildSafeFileName(form.file);
    const { error } = await supabase.storage.from('shop-rewards').upload(path, form.file, {
      upsert: false,
      contentType: form.file.type || 'image/png',
    });

    if (error) {
      throw error;
    }

    return path;
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const uploadedPath = await uploadSelectedFile();
      const previousPath = form.id
        ? rewards.find((reward) => reward.id === form.id)?.imagePath || ''
        : '';

      const { data, error } = await supabase.rpc('admin_upsert_shop_level_reward', {
        p_reward_id: form.id || undefined,
        p_name: form.name,
        p_description: form.description,
        p_level_required: Number(form.levelRequired),
        p_image_path: uploadedPath,
        p_is_active: form.isActive,
      });

      const result = data as { success?: boolean; error?: string } | null;

      if (error || !result?.success) {
        if (form.file && uploadedPath && canDeleteStorageObject(uploadedPath)) {
          await supabase.storage.from('shop-rewards').remove([uploadedPath]);
        }
        toast({
          title: 'Error',
          description: result?.error || error?.message || 'Unable to save reward.',
          variant: 'destructive',
        });
        return;
      }

      if (
        form.file &&
        previousPath &&
        previousPath !== uploadedPath &&
        canDeleteStorageObject(previousPath)
      ) {
        await supabase.storage.from('shop-rewards').remove([previousPath]);
      }

      toast({
        title: form.id ? 'Reward updated' : 'Reward created',
        description: form.name,
      });
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Unable to upload reward image.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (reward: LevelReward) => {
    setTogglingId(reward.id);

    const { data, error } = await supabase.rpc('admin_set_shop_level_reward_active', {
      p_reward_id: reward.id,
      p_is_active: !(reward.isActive !== false),
    });

    setTogglingId(null);

    const result = data as { success?: boolean; error?: string } | null;
    if (error || !result?.success) {
      toast({
        title: 'Error',
        description: result?.error || error?.message || 'Unable to change reward status.',
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: reward.isActive !== false ? 'Reward deactivated' : 'Reward activated',
      description: reward.name,
    });
    await refetch();
  };

  return (
    <AdminShell
      title="Shop Rewards"
      description="Live catalog management for the public level rewards shown in the shop and next-reward surfaces."
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="h-11 border-white/12 bg-white/[0.04] text-white hover:bg-white/[0.08]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog} className="h-11 bg-[#ff1654] text-white hover:bg-[#ff1654]/90">
            <Plus className="mr-2 h-4 w-4" />
            New reward
          </Button>
        </>
      }
    >
      <div className="grid h-full min-h-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <div className="grid min-h-0 gap-4 xl:grid-rows-[repeat(3,minmax(0,120px))_minmax(0,1fr)]">
          <AdminStatCard label="Total rewards" value={String(rewards.length)} icon={Package} />
          <AdminStatCard label="Active rewards" value={String(activeRewards.length)} icon={Sparkles} accent="#72f1b8" />
          <AdminStatCard
            label="Next open slot"
            value={`LVL ${activeRewards.length > 0 ? Math.max(...activeRewards.map((reward) => reward.levelRequired)) + 1 : 1}`}
            icon={ImagePlus}
            accent="#72d2ff"
          />

          <AdminPanel
            title="Publishing rules"
            description="Only one active reward per level. Saving here updates the live public surfaces immediately."
            className="min-h-0"
            contentClassName="min-h-0 overflow-y-auto pr-1"
          >
            <div className="space-y-3 text-sm leading-6 text-white/58">
              <p>Use consistent product names, clear descriptions, and a clean asset upload for each level unlock.</p>
              <p>Inactive rewards remain available in admin but disappear from the live shop until reactivated.</p>
            </div>
          </AdminPanel>
        </div>

        <AdminPanel
          title="Live reward catalog"
          description="Catalog rows scroll internally while the workspace header and actions stay fixed."
          className="h-full"
          contentClassName="min-h-0 h-full overflow-y-auto pr-1"
        >
          {rewards.length === 0 && !isLoading ? (
            <AdminEmptyState
              title="No rewards configured yet"
              description="Create the first level reward to populate the public shop carousel."
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-black/18 p-4 2xl:flex-row 2xl:items-center"
                >
                  <div className="flex h-[150px] w-full items-center justify-center overflow-hidden rounded-[18px] border border-white/10 bg-[#1a0808] 2xl:w-[200px]">
                    <img src={reward.image} alt={reward.name} className="h-full w-full object-contain p-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold text-white">{reward.name}</h3>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs uppercase tracking-[0.2em] text-white/56">
                        LVL {reward.levelRequired}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs uppercase tracking-[0.2em] ${
                          reward.isActive !== false ? 'bg-[#72f1b8]/16 text-[#72f1b8]' : 'bg-white/8 text-white/46'
                        }`}
                      >
                        {reward.isActive !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-white/58">
                      {reward.description || 'No description provided.'}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => openEditDialog(reward)}
                        className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                      >
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleToggleActive(reward)}
                        disabled={togglingId === reward.id}
                        className="border-white/12 bg-white/5 text-white hover:bg-white/10"
                      >
                        {reward.isActive !== false ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminPanel>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setForm(EMPTY_FORM);
          }
        }}
      >
        <DialogContent className="border-white/14 bg-[#120b0f] text-white sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit reward' : 'Create reward'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Name</label>
                <Input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="border-white/12 bg-white/5 text-white"
                  placeholder="MOUSE"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Level required</label>
                <Input
                  type="number"
                  min="1"
                  value={form.levelRequired}
                  onChange={(event) => setForm((current) => ({ ...current, levelRequired: event.target.value }))}
                  className="border-white/12 bg-white/5 text-white"
                  placeholder="30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.22em] text-white/48">Description</label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                className="min-h-[110px] border-white/12 bg-white/5 text-white"
                placeholder="Official reward description"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.22em] text-white/48">Reward image</label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(event) => {
                    const file = event.target.files?.[0] || null;
                    setForm((current) => ({
                      ...current,
                      file,
                      imagePreview: file ? URL.createObjectURL(file) : current.imagePreview,
                    }));
                  }}
                  className="border-white/12 bg-white/5 text-white file:text-white"
                />
                <p className="text-xs text-white/42">
                  Upload a new asset or leave it untouched to keep the current image.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/46">Active</p>
                  <p className="mt-1 text-sm text-white/70">Instantly visible on site</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
              </div>
            </div>

            {form.imagePreview ? (
              <div className="flex h-[180px] items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-[#1a0808]">
                <img src={form.imagePreview} alt="Reward preview" className="h-full w-full object-contain p-4" />
              </div>
            ) : null}
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
              {saving ? 'Saving...' : form.id ? 'Save changes' : 'Create reward'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}
