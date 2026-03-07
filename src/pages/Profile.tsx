import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, 
  Gamepad2, 
  CreditCard, 
  Link2, 
  Crown,
  Check,
  ExternalLink,
  Save,
  Loader2,
  Unlink,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useVipStatus } from '@/hooks/useVipStatus';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { VipModal } from '@/components/vip/VipModal';
import { ProfileAvatarSection } from '@/components/avatars/ProfileAvatarSection';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { cn } from '@/lib/utils';
import { REGIONS, PLATFORMS, type Region, type Platform } from '@/types';
import { AlertTriangle } from 'lucide-react';

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="currentColor" d="M20.317 4.492c-1.53-.69-3.17-1.2-4.885-1.49a.075.075 0 0 0-.079.036c-.21.369-.444.85-.608 1.23a18.566 18.566 0 0 0-5.487 0 12.36 12.36 0 0 0-.617-1.23A.077.077 0 0 0 8.562 3c-1.714.29-3.354.8-4.885 1.491a.07.07 0 0 0-.032.027C.533 9.093-.32 13.555.099 17.961a.08.08 0 0 0 .031.055 20.03 20.03 0 0 0 5.993 2.98.078.078 0 0 0 .084-.026 13.83 13.83 0 0 0 1.226-1.963.074.074 0 0 0-.041-.104 13.201 13.201 0 0 1-1.872-.878.075.075 0 0 1-.008-.125c.126-.093.252-.19.372-.287a.075.075 0 0 1 .078-.01c3.927 1.764 8.18 1.764 12.061 0a.075.075 0 0 1 .079.009c.12.098.245.195.372.288a.075.075 0 0 1-.006.125c-.598.344-1.22.635-1.873.877a.075.075 0 0 0-.041.105c.36.687.772 1.341 1.225 1.962a.077.077 0 0 0 .084.028 19.963 19.963 0 0 0 6.002-2.981.076.076 0 0 0 .032-.054c.5-5.094-.838-9.52-3.549-13.442a.06.06 0 0 0-.031-.028zM8.02 15.278c-1.182 0-2.157-1.069-2.157-2.38 0-1.312.956-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.956 2.38-2.157 2.38zm7.975 0c-1.183 0-2.157-1.069-2.157-2.38 0-1.312.955-2.38 2.157-2.38 1.21 0 2.176 1.077 2.157 2.38 0 1.312-.946 2.38-2.157 2.38z"/>
    </svg>
  );
}

type ProfileSection = 'account' | 'game' | 'payments' | 'connections';

const sections = [
  { id: 'account' as const, label: 'Account', icon: User },
  { id: 'game' as const, label: 'Game', icon: Gamepad2 },
  { id: 'payments' as const, label: 'Payments', icon: CreditCard },
  { id: 'connections' as const, label: 'Connections', icon: Link2 },
];

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, profile, loading, refreshProfile, isProfileComplete } = useAuth();
  const { isVip, changeUsername } = useVipStatus();
  
  const [activeSection, setActiveSection] = useState<ProfileSection>('account');
  const [showVipModal, setShowVipModal] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  
  const [username, setUsername] = useState('');
  const [epicUsername, setEpicUsername] = useState('');
  const [preferredRegion, setPreferredRegion] = useState<Region>('EU');
  const [preferredPlatform, setPreferredPlatform] = useState<Platform>('PC');
  const [isSaving, setIsSaving] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  
  const [isSavingEpic, setIsSavingEpic] = useState(false);
  const [showDisconnectEpicDialog, setShowDisconnectEpicDialog] = useState(false);
  const [isDisconnectingEpic, setIsDisconnectingEpic] = useState(false);

  const redirectAfterComplete = searchParams.get('next');
  
  const isEpicConnected = !!profile?.epic_username;
  const isDiscordConnected = !!profile?.discord_user_id;

  useEffect(() => {
    if (!user && !loading) {
      navigate(`/auth?next=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || '');
      setEpicUsername(profile.epic_username || '');
      setPreferredRegion((profile.preferred_region as Region) || 'EU');
      setPreferredPlatform((profile.preferred_platform as Platform) || 'PC');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          epic_username: epicUsername || null,
          preferred_region: preferredRegion,
          preferred_platform: preferredPlatform,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      await refreshProfile();
      toast.success('Profile updated!');
      
      if (!isProfileComplete && !!epicUsername && redirectAfterComplete) {
        navigate(redirectAfterComplete, { replace: true });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error saving changes';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!isVip) {
      setShowVipModal(true);
      return;
    }
    
    if (username.length < 3 || username.length > 20) {
      setUsernameError('Username must be 3-20 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError('Letters, numbers and underscores only');
      return;
    }
    
    setUsernameError('');
    setIsSaving(true);
    
    try {
      const result = await changeUsername(username);
      if (result.success) {
        toast.success('Username updated!');
        await refreshProfile();
      } else {
        setUsernameError(result.error || 'Error changing username');
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEpicUsername = async () => {
    if (!user || !epicUsername.trim()) return;
    setIsSavingEpic(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ epic_username: epicUsername.trim() })
        .eq('user_id', user.id);

      if (error) throw error;
      await refreshProfile();
      toast.success('Epic Username salvato!');

      if (!isProfileComplete && redirectAfterComplete) {
        navigate(redirectAfterComplete, { replace: true });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Errore nel salvataggio';
      toast.error(message);
    } finally {
      setIsSavingEpic(false);
    }
  };

  const handleDisconnectEpic = async () => {
    if (!user) return;
    
    setIsDisconnectingEpic(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          epic_account_id: null,
          epic_username: null,
          epic_linked_at: null,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      await refreshProfile();
      toast.success('Epic Games disconnected');
      setShowDisconnectEpicDialog(false);
      setEpicUsername('');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error disconnecting';
      toast.error(message);
    } finally {
      setIsDisconnectingEpic(false);
    }
  };

  if (loading) return <MainLayout><LoadingPage /></MainLayout>;
  if (!user || !profile) return null;

  const discordDisplayName = profile.discord_display_name || profile.discord_username || profile.username;
  const discordAvatarUrl = profile.discord_avatar_url;

  return (
    <MainLayout>
      <div className="space-y-6">
        {!isProfileComplete && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-4 flex items-start gap-3" style={{ borderColor: 'hsl(0 65% 50% / 0.3)' }}>
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'hsl(0 65% 50%)' }} />
              <div>
                <p className="text-sm font-bold" style={{ color: 'hsl(0 65% 50%)' }}>Complete your profile</p>
                <p className="text-sm text-muted-foreground">Add your Epic Games Username to create or join matches.</p>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className={cn(
            "bg-[#121212] border border-[#1f2937] rounded-[16px] relative overflow-hidden p-6 lg:p-8",
            isVip && "ring-1 ring-[#FFC805]/20"
          )}>
            <div className="relative flex items-center justify-between flex-wrap gap-4 lg:gap-6">
              <div className="flex items-center gap-5 lg:gap-6">
                <button
                  onClick={() => setShowAvatarModal(true)}
                  className="relative group cursor-pointer"
                >
                  <div className={cn(
                    "w-20 h-20 rounded-full overflow-hidden",
                    "ring-2 ring-offset-2 ring-offset-[#0a0a0a]",
                    isVip
                      ? "ring-[#FFC805]/50"
                      : "ring-[#1f2937]"
                  )}>
                    <Avatar className="w-full h-full">
                      <AvatarImage 
                        src={discordAvatarUrl || profile.avatar_url || undefined} 
                        alt={profile.username}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-[hsl(var(--bg-2))] text-2xl lg:text-3xl font-bold">
                        {profile.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    <span className="text-xs text-white font-semibold">Edit</span>
                  </div>
                </button>

                <div>
                  <div className="flex items-center gap-2 lg:gap-3">
                    <h1 className="text-xl lg:text-3xl font-extrabold tracking-tight text-foreground">
                      {discordDisplayName}
                    </h1>
                    {isVip && (
                      <span className="badge-vip text-[10px]">VIP</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">{profile.email}</p>
                  {isDiscordConnected && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <DiscordIcon className="w-3 h-3" />
                      <span>Synced from Discord</span>
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex gap-2 lg:gap-3">
                {!isVip && (
                  <Button 
                    onClick={() => setShowVipModal(true)}
                    className="btn-premium px-5 py-2.5 text-sm font-semibold"
                  >
                    <Crown className="w-4 h-4 mr-1.5" /> Become VIP
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
        
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4 lg:gap-6">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-2 h-fit">
              <nav className="flex lg:flex-col gap-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-200 w-full rounded-lg",
                        isActive 
                          ? "bg-[#FFC805]/10 text-[#FFC805]" 
                          : "text-muted-foreground hover:bg-[#1e1e1e] hover:text-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-semibold">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] overflow-y-auto">
              <div className="p-5 lg:p-8">
                {activeSection === 'account' && (
                  <div className="space-y-5">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <User className="w-5 h-5" />
                      Account Settings
                    </h2>
                    <div className="neon-line" />
                    
                    <div className="space-y-2">
                      <Label htmlFor="username" className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Username
                        {isVip && (
                          <span className="badge-vip text-[9px] py-0">VIP</span>
                        )}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          id="username"
                          value={username}
                          onChange={(e) => { setUsername(e.target.value); setUsernameError(''); }}
                          className="flex-1 input-premium px-4 py-2.5"
                          disabled={!isVip}
                        />
                        <Button 
                          onClick={handleSaveUsername}
                          disabled={isSaving || username === profile.username}
                          className={isVip ? "btn-premium-secondary" : "btn-premium"}
                        >
                          {isVip ? "Save" : <><Crown className="w-4 h-4 mr-1" /> VIP</>}
                        </Button>
                      </div>
                      {usernameError && <p className="text-xs" style={{ color: 'hsl(0 65% 50%)' }}>{usernameError}</p>}
                      {!isVip && (
                        <p className="text-xs text-muted-foreground">
                          Only VIP members can change username. Your username comes from Discord.
                        </p>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Region</Label>
                        <Select value={preferredRegion} onValueChange={(v) => setPreferredRegion(v as Region)}>
                          <SelectTrigger className="input-premium">
                            <SelectValue placeholder="Select region" />
                          </SelectTrigger>
                          <SelectContent className="premium-surface">
                            {REGIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Platform</Label>
                        <Select value={preferredPlatform} onValueChange={(v) => setPreferredPlatform(v as Platform)}>
                          <SelectTrigger className="input-premium">
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                          <SelectContent className="premium-surface">
                            {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <Button onClick={handleSave} disabled={isSaving} className="btn-premium px-6 py-2.5 text-sm font-semibold">
                      <Save className="w-4 h-4 mr-2" />
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                )}
                
                {activeSection === 'game' && (
                  <div className="space-y-5">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <Gamepad2 className="w-5 h-5" />
                      Game Accounts
                    </h2>
                    <div className="neon-line" />
                    
                    <div className="bg-[#1e1e1e] p-4 rounded-xl">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#121212]">
                            <Gamepad2 className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-bold">Epic Games</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {isEpicConnected ? profile.epic_username : 'Non connesso'}
                            </p>
                          </div>
                        </div>
                        
                        {isEpicConnected ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold rounded-full" style={{ background: 'hsl(145 60% 42% / 0.1)', color: 'hsl(145 60% 42%)', border: '1px solid hsl(145 60% 42% / 0.2)' }}>
                            <Check className="w-3 h-3 mr-1" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold rounded-full text-muted-foreground border border-[hsl(var(--border-soft))]">
                            Not connected
                          </span>
                        )}
                      </div>
                      
                      {!isEpicConnected && (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Inserisci il tuo Epic Username per partecipare ai match.
                          </p>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Il tuo Epic Username"
                              value={epicUsername}
                              onChange={(e) => setEpicUsername(e.target.value)}
                              className="flex-1 input-premium px-4 py-2.5"
                            />
                            <Button
                              onClick={handleSaveEpicUsername}
                              disabled={isSavingEpic || !epicUsername.trim()}
                              className="btn-premium"
                            >
                              {isSavingEpic ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Save className="w-4 h-4 mr-2" />
                              )}
                              {isSavingEpic ? '' : 'Save'}
                            </Button>
                          </div>
                        </div>
                      )}

                      {isEpicConnected && (
                        <div className="space-y-4">
                          <div>
                            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Epic Username</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input
                                value={epicUsername}
                                onChange={(e) => setEpicUsername(e.target.value)}
                                className="flex-1 input-premium px-4 py-2.5"
                              />
                              <Button
                                size="sm"
                                onClick={handleSaveEpicUsername}
                                disabled={isSavingEpic || epicUsername === profile.epic_username}
                                className="btn-premium-secondary"
                              >
                                {isSavingEpic ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              </Button>
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowDisconnectEpicDialog(true)}
                            className="btn-premium-danger text-xs"
                          >
                            <Unlink className="w-4 h-4 mr-2" />
                            Remove Epic Username
                          </Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="neon-line" />
                    <div>
                      <h3 className="text-sm font-bold mb-3 text-foreground flex items-center gap-2">
                        Avatar
                      </h3>
                      <ProfileAvatarSection />
                    </div>
                  </div>
                )}
                
                {activeSection === 'payments' && (
                  <div className="space-y-5">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <CreditCard className="w-5 h-5" />
                      Payments
                    </h2>
                    <div className="neon-line" />
                    
                    <div className="bg-[#1e1e1e] p-4 rounded-xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#121212]">
                          <CreditCard className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Stripe Connect</p>
                          <p className="text-sm text-muted-foreground">
                            Per ricevere i pagamenti delle vincite
                          </p>
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-[#121212]">
                        <p className="text-sm text-muted-foreground mb-3">
                          Configura e gestisci i prelievi dalla pagina Wallet.
                        </p>
                        <Button 
                          onClick={() => navigate('/wallet')}
                          className="btn-premium-secondary"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Go to Wallet
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {activeSection === 'connections' && (
                  <div className="space-y-5">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
                      <Link2 className="w-5 h-5" />
                      Connected Accounts
                    </h2>
                    <div className="neon-line" />
                    
                    <div className="bg-[#1e1e1e] p-4 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 ring-1 ring-[#5865F2]/30">
                            <AvatarImage src={discordAvatarUrl || undefined} />
                            <AvatarFallback className="bg-[#5865F2]">
                              <DiscordIcon className="w-5 h-5 text-white" />
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-bold">Discord</p>
                            <p className="text-sm text-muted-foreground font-mono">
                              {profile.discord_username || discordDisplayName}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-1 text-[10px] font-semibold rounded-full" style={{ background: 'hsl(145 60% 42% / 0.1)', color: 'hsl(145 60% 42%)', border: '1px solid hsl(145 60% 42% / 0.2)' }}>
                          <Check className="w-3 h-3 mr-1" /> Connected
                        </span>
                      </div>
                    </div>
                    
                    {profile.discord_linked_at && (
                      <p className="text-sm text-muted-foreground font-mono">
                        Connected on {new Date(profile.discord_linked_at).toLocaleDateString('it-IT')}
                      </p>
                    )}
                    
                    <div className="bg-[#1e1e1e] p-4 rounded-xl">
                      <p className="text-sm text-muted-foreground">
                        Il tuo account OLEBOY TOKEN è collegato a Discord. 
                        Per accedere con un altro account, effettua il logout e accedi nuovamente con un diverso account Discord.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <VipModal open={showVipModal} onOpenChange={setShowVipModal} />
      
      {showAvatarModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAvatarModal(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#121212] border border-[#1f2937] rounded-[16px] w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-1">Manage Avatar</h2>
              <div className="neon-line mb-4" />
              <p className="text-sm text-muted-foreground mb-4">Seleziona un avatar o acquistane uno nuovo</p>
              <ProfileAvatarSection />
            </div>
          </motion.div>
        </div>
      )}

      <AlertDialog open={showDisconnectEpicDialog} onOpenChange={setShowDisconnectEpicDialog}>
        <AlertDialogContent className="premium-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Disconnect Epic Games?</AlertDialogTitle>
            <AlertDialogDescription>
              Dovrai ricollegare il tuo account Epic Games per partecipare ai match.
              Il tuo Epic Username verificato verrà rimosso dal profilo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDisconnectingEpic} className="btn-premium-ghost">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDisconnectEpic}
              className="btn-premium-danger"
              disabled={isDisconnectingEpic}
            >
              {isDisconnectingEpic ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Disconnecting...
                </>
              ) : (
                'Disconnect'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
