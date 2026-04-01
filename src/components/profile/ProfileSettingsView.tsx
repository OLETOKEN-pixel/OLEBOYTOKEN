import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  CreditCard,
  Gamepad2,
  Link2,
  Loader2,
  LogOut,
  Save,
  ShieldCheck,
  Unlink,
  User,
  Wallet,
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useVipStatus } from '@/hooks/useVipStatus';
import { supabase } from '@/integrations/supabase/client';
import { startEpicAuth } from '@/lib/oauth';
import {
  describeStripeDestination,
  getStripePayoutCountryLabel,
  MIN_STRIPE_WITHDRAWAL,
  STRIPE_PAYOUT_COUNTRIES,
  STRIPE_WITHDRAWAL_FEE,
  type StripePayoutStatus,
  type WithdrawalDestinationSnapshot,
} from '@/lib/stripePayouts';
import { cn } from '@/lib/utils';
import type { Platform, Region, WithdrawalRequest } from '@/types';
import { PLATFORMS, REGIONS } from '@/types';

export type ProfileSection = 'account' | 'game' | 'payments' | 'connections';

interface StripeConnectedAccount {
  onboarding_complete: boolean | null;
  payouts_enabled: boolean | null;
  charges_enabled: boolean | null;
  details_submitted: boolean | null;
  country: string | null;
  payouts_status: StripePayoutStatus | null;
  requirements_due: string[] | null;
  requirements_pending_verification: string[] | null;
  external_account_present: boolean | null;
  external_account_types: string[] | null;
  stripe_account_id: string;
}

interface ProfileSettingsViewProps {
  initialSection?: ProfileSection;
  mode?: 'overlay' | 'page';
  onClose?: () => void;
}

const sections: Array<{ id: ProfileSection; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'game', label: 'Game', icon: Gamepad2 },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'connections', label: 'Connections', icon: Link2 },
];

const profilePrimaryButtonClass = "!h-11 !rounded-[14px] !border !border-[#ff6f98]/35 !bg-[#ff1654] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white shadow-[0_14px_30px_rgba(255,22,84,0.26)] hover:!bg-[#ff2d68] hover:shadow-[0_18px_36px_rgba(255,22,84,0.34)] disabled:!cursor-not-allowed disabled:!opacity-45";
const profileSecondaryButtonClass = "!h-11 !rounded-[14px] !border !border-white/[0.14] !bg-white/[0.04] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white hover:!border-[#ff1654]/35 hover:!bg-[#ff1654]/10";
const profileGhostButtonClass = "!h-11 !rounded-[14px] !border !border-white/[0.1] !bg-white/[0.03] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white/72 hover:!border-white/[0.16] hover:!bg-white/[0.06] hover:!text-white";
const profileDangerButtonClass = "!h-11 !rounded-[14px] !border !border-[#ff1654]/30 !bg-[#ff1654]/10 px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-[#ffc1d1] hover:!bg-[#ff1654]/16 hover:!border-[#ff1654]/44";
const profileInputClass = "h-11 rounded-[14px] border-white/[0.12] bg-black/20 text-white placeholder:text-white/25 focus-visible:border-[#ff1654]/35 focus-visible:ring-2 focus-visible:ring-[#ff1654]/20";
const profileSelectTriggerClass = "h-11 rounded-[14px] border-white/[0.12] bg-black/20 text-white focus:border-[#ff1654]/35 focus:ring-2 focus:ring-[#ff1654]/20";
const profileSelectContentClass = "border-white/[0.1] bg-[linear-gradient(180deg,rgba(18,11,15,0.98)_0%,rgba(8,6,10,0.96)_100%)] text-white shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-[18px]";
const profileDialogContentClass = "!rounded-[28px] !border !border-white/[0.1] !bg-[linear-gradient(180deg,rgba(18,11,15,0.98)_0%,rgba(10,7,11,0.96)_100%)] !text-white shadow-[0_28px_80px_rgba(0,0,0,0.52)] backdrop-blur-[22px]";
const profileBadgeBaseClass = "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em]";
const profileBadgeNeutralClass = `${profileBadgeBaseClass} border-white/[0.12] bg-white/[0.05] text-white/82`;
const profileBadgeAccentClass = `${profileBadgeBaseClass} border-[#ff1654]/30 bg-[#ff1654]/10 text-[#ffbfd1]`;
const profileBadgeDangerClass = `${profileBadgeBaseClass} border-[#ff6b95]/22 bg-[#ff6b95]/10 text-[#ffb4ca]`;

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  );
}

export function ProfileSettingsView({
  initialSection = 'account',
  mode = 'overlay',
  onClose,
}: ProfileSettingsViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, wallet, loading, refreshProfile, refreshWallet, isProfileComplete, signOut } = useAuth();
  const { isVip, changeUsername } = useVipStatus();

  const [activeSection, setActiveSection] = useState<ProfileSection>(initialSection);
  const [username, setUsername] = useState('');
  const [preferredRegion, setPreferredRegion] = useState<Region>('EU');
  const [preferredPlatform, setPreferredPlatform] = useState<Platform>('PC');
  const [stripeAccount, setStripeAccount] = useState<StripeConnectedAccount | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [connectingEpic, setConnectingEpic] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [showDisconnectEpicDialog, setShowDisconnectEpicDialog] = useState(false);
  const [disconnectingEpic, setDisconnectingEpic] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [managingStripe, setManagingStripe] = useState(false);
  const [payoutCountry, setPayoutCountry] = useState('IT');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  const loadPaymentData = async (targetUserId: string) => {
    const [stripeRes, withdrawalsRes] = await Promise.all([
      supabase
        .from('stripe_connected_accounts')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle(),
      supabase
        .from('withdrawal_requests')
        .select('*')
        .eq('user_id', targetUserId)
        .order('created_at', { ascending: false })
        .limit(6),
    ]);

    if (stripeRes.data) {
      const connectedAccount = stripeRes.data as StripeConnectedAccount;
      setStripeAccount(connectedAccount);
      if (connectedAccount.country) {
        setPayoutCountry(connectedAccount.country);
      }
    } else {
      setStripeAccount(null);
    }

    if (withdrawalsRes.data) {
      setWithdrawals(withdrawalsRes.data as WithdrawalRequest[]);
    } else {
      setWithdrawals([]);
    }
  };

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setUsername(profile.username || '');
    setPreferredRegion((profile.preferred_region as Region) || 'EU');
    setPreferredPlatform((profile.preferred_platform as Platform) || 'PC');
  }, [profile]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadPaymentData(user.id);
  }, [user]);

  const walletBalance = wallet?.balance ?? 0;
  const lockedBalance = wallet?.locked_balance ?? 0;
  const totalBalance = walletBalance + lockedBalance;
  const stripeStatus = stripeAccount?.payouts_status ?? 'missing';
  const isStripeVerified = stripeStatus === 'enabled' && stripeAccount?.external_account_present === true;
  const canWithdraw = isStripeVerified && walletBalance >= MIN_STRIPE_WITHDRAWAL + STRIPE_WITHDRAWAL_FEE;
  const stripeCountryLabel = getStripePayoutCountryLabel(stripeAccount?.country || payoutCountry);
  const stripeRequirementsDue = stripeAccount?.requirements_due?.length ?? 0;
  const stripeRequirementsPending = stripeAccount?.requirements_pending_verification?.length ?? 0;
  const hasStripeAccount = Boolean(stripeAccount?.stripe_account_id);
  const discordDisplayName = profile?.discord_display_name || profile?.discord_username || profile?.username || 'User';
  const avatarUrl = profile?.discord_avatar_url || profile?.avatar_url || undefined;

  const withdrawalStatusMap = useMemo(
    () => ({
      pending: { label: 'Queued', className: profileBadgeAccentClass },
      processing: { label: 'Processing', className: profileBadgeNeutralClass },
      approved: { label: 'Approved', className: profileBadgeNeutralClass },
      completed: { label: 'Paid', className: profileBadgeNeutralClass },
      failed: { label: 'Failed', className: profileBadgeDangerClass },
      rejected: { label: 'Rejected', className: profileBadgeDangerClass },
    }),
    []
  );

  const stripeStatusPresentation = useMemo(() => {
    switch (stripeStatus) {
      case 'enabled':
        return {
          label: 'Ready',
          className: profileBadgeNeutralClass,
          description: 'Stripe can now pay out to the default bank account or supported debit card linked to this account.',
        };
      case 'restricted':
        return {
          label: 'Action required',
          className: profileBadgeDangerClass,
          description: 'Stripe still needs extra verification or payout method updates before withdrawals can be completed.',
        };
      case 'pending':
        return {
          label: 'Pending',
          className: profileBadgeAccentClass,
          description: 'Stripe onboarding is in progress. Finish setup and add a payout method to unlock withdrawals.',
        };
      case 'disabled':
        return {
          label: 'Unavailable',
          className: profileBadgeDangerClass,
          description: 'Stripe payout controls are currently unavailable for this account.',
        };
      default:
        return {
          label: 'Missing',
          className: profileBadgeAccentClass,
          description: 'Create your Stripe payout account to receive withdrawals from your OBT wallet.',
        };
    }
  }, [stripeStatus]);

  const handleSaveAccount = async () => {
    if (!user) {
      return;
    }

    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_region: preferredRegion,
          preferred_platform: preferredPlatform,
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      toast({
        title: 'Profile updated',
        description: 'Your account settings have been saved.',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unable to save your profile settings.',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveUsername = async () => {
    if (!isVip) {
      toast({
        title: 'VIP required',
        description: 'Username changes are reserved for VIP members.',
        variant: 'destructive',
      });
      return;
    }

    if (username.length < 3 || username.length > 20) {
      setUsernameError('Username must be between 3 and 20 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setUsernameError('Use only letters, numbers and underscores.');
      return;
    }

    setUsernameError('');
    setSavingProfile(true);

    try {
      const result = await changeUsername(username);
      if (!result.success) {
        throw new Error(result.error || 'Unable to change username.');
      }

      await refreshProfile();
      toast({
        title: 'Username updated',
        description: 'Your VIP username change is now live.',
      });
    } catch (error) {
      setUsernameError(error instanceof Error ? error.message : 'Unable to change username.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleConnectEpic = async () => {
    setConnectingEpic(true);

    try {
      await startEpicAuth();
    } catch (error) {
      toast({
        title: 'Epic connection failed',
        description: error instanceof Error ? error.message : 'Unable to start Epic Games login.',
        variant: 'destructive',
      });
      setConnectingEpic(false);
    }
  };

  const handleDisconnectEpic = async () => {
    if (!user) {
      return;
    }

    setDisconnectingEpic(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          epic_account_id: null,
          epic_username: null,
          epic_linked_at: null,
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      toast({
        title: 'Epic disconnected',
        description: 'Your Epic Games connection has been removed.',
      });
      setShowDisconnectEpicDialog(false);
    } catch (error) {
      toast({
        title: 'Disconnect failed',
        description: error instanceof Error ? error.message : 'Unable to remove Epic details.',
        variant: 'destructive',
      });
    } finally {
      setDisconnectingEpic(false);
    }
  };

  const handleConnectStripe = async () => {
    if (!hasStripeAccount && !payoutCountry) {
      toast({
        title: 'Select a payout country',
        description: 'Choose the country where Stripe will onboard your payout account before continuing.',
        variant: 'destructive',
      });
      return;
    }

    setConnectingStripe(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-connect-account', {
        body: { country: payoutCountry },
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      toast({
        title: 'Stripe ready',
        description: 'Your payout account is already configured.',
      });
    } catch (error) {
      toast({
        title: 'Stripe error',
        description: error instanceof Error ? error.message : 'Unable to start Stripe onboarding.',
        variant: 'destructive',
      });
    } finally {
      setConnectingStripe(false);
    }
  };

  const handleManageStripe = async () => {
    setManagingStripe(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-connect-login-link');

      if (error) {
        throw error;
      }

      if (!data?.url) {
        throw new Error('Unable to open Stripe Express dashboard.');
      }

      window.location.href = data.url;
    } catch (error) {
      toast({
        title: 'Stripe dashboard unavailable',
        description: error instanceof Error ? error.message : 'Unable to open the Stripe payout dashboard.',
        variant: 'destructive',
      });
    } finally {
      setManagingStripe(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number.parseFloat(withdrawAmount);
    const totalDeduction = amount + STRIPE_WITHDRAWAL_FEE;

    if (!Number.isFinite(amount) || amount < MIN_STRIPE_WITHDRAWAL) {
      toast({
        title: 'Invalid amount',
        description: `Minimum withdrawal is €${MIN_STRIPE_WITHDRAWAL}.`,
        variant: 'destructive',
      });
      return;
    }

    if (totalDeduction > walletBalance) {
      toast({
        title: 'Insufficient balance',
        description: `You need €${totalDeduction.toFixed(2)} including the €${STRIPE_WITHDRAWAL_FEE.toFixed(2)} fee.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmittingWithdrawal(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-payout', {
        body: { amount },
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Unable to complete the withdrawal.');
      }

      await refreshWallet();
      if (user?.id) {
        await loadPaymentData(user.id);
      }
      setWithdrawOpen(false);
      setWithdrawAmount('');

      toast({
        title: 'Withdrawal registered',
        description: 'Stripe is processing your payout and the status will update automatically.',
      });
    } catch (error) {
      toast({
        title: 'Withdrawal failed',
        description: error instanceof Error ? error.message : 'Unable to complete the withdrawal.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const handleOpenProfilePage = () => {
    navigate(`/profile?tab=${activeSection}`);
    onClose?.();
  };

  const handleSignOut = async () => {
    await signOut();
    onClose?.();
    navigate('/');
  };

  if (loading) {
    return <LoadingPage />;
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className={cn('text-white', mode === 'page' ? 'mx-auto w-full max-w-[1180px]' : 'w-full')}>
      <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(19,10,13,0.98)_0%,rgba(11,6,9,0.96)_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-6 py-5 lg:px-8">
          <div>
            <p className="text-xs font-display uppercase tracking-[0.2em] text-[#ff9ab3]">My Profile</p>
            <h1
              className="mt-2 text-[34px] uppercase leading-none text-white lg:text-[42px]"
              style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
            >
              Profile Settings
            </h1>
            <p className="mt-3 max-w-[760px] text-sm leading-6 text-white/60 lg:text-base">
              Manage your OBT profile, Epic Games connection, payout setup and linked accounts from one place.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {mode === 'overlay' && (
              <Button type="button" className={profileGhostButtonClass} onClick={handleOpenProfilePage}>
                Open Page
              </Button>
            )}

            <Button type="button" className={profileGhostButtonClass} onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>

            {onClose && (
              <button type="button" onClick={onClose} className={profileGhostButtonClass}>
                Close
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-6 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8 lg:py-8">
          <aside className="space-y-4">
            <div className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 border-2 border-white/[0.08]">
                  <AvatarImage src={avatarUrl} alt={discordDisplayName} className="object-cover" />
                  <AvatarFallback className="bg-white/[0.08] text-xl uppercase text-white">
                    {discordDisplayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold uppercase text-white">{discordDisplayName}</p>
                  <p className="truncate text-sm text-white/46">{profile.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="inline-flex rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/70">
                      {isVip ? 'VIP' : 'STANDARD'}
                    </span>
                    {!isProfileComplete && (
                      <span className="inline-flex rounded-full border border-[#ff1654]/28 bg-[#ff1654]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ffbfd1]">
                        Epic Missing
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <nav className="grid gap-1">
                {sections.map((section) => {
                  const Icon = section.icon;
                  const isActive = activeSection === section.id;

                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        'flex items-center gap-3 rounded-[16px] px-4 py-3 text-left transition',
                        isActive
                          ? 'bg-[#ff1654]/14 text-white shadow-[inset_0_0_0_1px_rgba(255,22,84,0.35)]'
                          : 'text-white/54 hover:bg-white/[0.05] hover:text-white'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-none" />
                      <span className="text-sm font-semibold uppercase tracking-[0.08em]">{section.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <section className="rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:p-6">
            {activeSection === 'account' && (
              <div className="space-y-6">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold uppercase text-white">
                    <User className="h-5 w-5 text-[#ff1654]" />
                    Account Settings
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    Update your display preferences and keep your competitive profile ready.
                  </p>
                </div>

                <div className="grid gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-[0.16em] text-white/42">Username</Label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <Input
                        value={username}
                        onChange={(event) => {
                          setUsername(event.target.value);
                          setUsernameError('');
                        }}
                        className={profileInputClass}
                        disabled={!isVip}
                      />
                      <Button
                        type="button"
                        onClick={handleSaveUsername}
                        disabled={savingProfile || username === profile.username}
                        className={cn(isVip ? profileSecondaryButtonClass : profilePrimaryButtonClass)}
                      >
                        {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        {isVip ? 'Save' : 'VIP Only'}
                      </Button>
                    </div>
                    {usernameError && <p className="text-sm text-red-300">{usernameError}</p>}
                    {!isVip && (
                      <p className="text-sm text-white/48">
                        Username changes are reserved for VIP members. Your base username stays synced from Discord.
                      </p>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-[0.16em] text-white/42">Preferred Region</Label>
                      <Select value={preferredRegion} onValueChange={(value) => setPreferredRegion(value as Region)}>
                        <SelectTrigger className={profileSelectTriggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={profileSelectContentClass}>
                          {REGIONS.map((regionOption) => (
                            <SelectItem key={regionOption} value={regionOption}>
                              {regionOption}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-[0.16em] text-white/42">Preferred Platform</Label>
                      <Select value={preferredPlatform} onValueChange={(value) => setPreferredPlatform(value as Platform)}>
                        <SelectTrigger className={profileSelectTriggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={profileSelectContentClass}>
                          {PLATFORMS.map((platformOption) => (
                            <SelectItem key={platformOption} value={platformOption}>
                              {platformOption}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button type="button" onClick={handleSaveAccount} disabled={savingProfile} className={profilePrimaryButtonClass}>
                      {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Account
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'game' && (
              <div className="space-y-6">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold uppercase text-white">
                    <Gamepad2 className="h-5 w-5 text-[#ff1654]" />
                    Game Settings
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    Connect Epic Games to sync the display name used inside matches and friend-request flows.
                  </p>
                </div>

                <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase text-white">Epic Games</p>
                      <p className="mt-1 text-sm text-white/50">{profile.epic_username || 'Not connected yet'}</p>
                    </div>

                    {profile.epic_username ? (
                      <span className={profileBadgeNeutralClass}>
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Ready
                      </span>
                    ) : (
                      <span className={profileBadgeAccentClass}>
                        <AlertCircle className="mr-1 h-3.5 w-3.5" />
                        Missing
                      </span>
                    )}
                  </div>

                  <div className="mt-5 rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/42">Match Visibility</p>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      Your Epic display name is shown inside matches so players can add each other without using the
                      Discord platform identity tied to your OBT account.
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {profile.epic_username ? (
                      <Button type="button" onClick={() => setShowDisconnectEpicDialog(true)} className={profileDangerButtonClass}>
                        <Unlink className="mr-2 h-4 w-4" />
                        Disconnect Epic Games
                      </Button>
                    ) : (
                      <Button type="button" onClick={handleConnectEpic} disabled={connectingEpic} className={profilePrimaryButtonClass}>
                        {connectingEpic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                        Connect Epic Games
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'payments' && (
              <div className="space-y-6">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold uppercase text-white">
                    <CreditCard className="h-5 w-5 text-[#ff1654]" />
                    Payments & Payouts
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    Configure Stripe Connect, review your wallet status and withdraw winnings to the default payout
                    method managed in Stripe.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/38">Available</p>
                    <div className="mt-3">
                      <CoinDisplay amount={walletBalance} size="lg" />
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/38">Locked</p>
                    <div className="mt-3">
                      <CoinDisplay amount={lockedBalance} size="lg" />
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/38">Total</p>
                    <div className="mt-3">
                      <CoinDisplay amount={totalBalance} size="lg" />
                    </div>
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase text-white">Stripe Connect</p>
                      <p className="mt-1 text-sm text-white/52">
                        {stripeStatusPresentation.description}
                      </p>
                    </div>

                    <span className={stripeStatusPresentation.className}>
                      <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                      {stripeStatusPresentation.label}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-[0.16em] text-white/42">Payout Country</Label>
                      <Select value={payoutCountry} onValueChange={setPayoutCountry} disabled={hasStripeAccount}>
                        <SelectTrigger className={profileSelectTriggerClass}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={profileSelectContentClass}>
                          {STRIPE_PAYOUT_COUNTRIES.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-white/48">
                        {hasStripeAccount
                          ? `Locked to ${stripeCountryLabel}. Stripe account countries can't be changed after creation.`
                          : 'Choose the country where Stripe should onboard and pay out this account. The country locks after account creation.'}
                      </p>
                    </div>

                    <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-white/42">Payout Readiness</p>
                      <div className="mt-3 space-y-3 text-sm leading-6 text-white/58">
                        <p>
                          Country: <span className="text-white/82">{stripeCountryLabel}</span>
                        </p>
                        <p>
                          Method on file:{' '}
                          <span className="text-white/82">
                            {stripeAccount?.external_account_present
                              ? 'Stripe has a payout destination ready'
                              : 'No payout destination configured yet'}
                          </span>
                        </p>
                        <p>
                          Requirements:{' '}
                          <span className="text-white/82">
                            {stripeRequirementsDue + stripeRequirementsPending > 0
                              ? `${stripeRequirementsDue + stripeRequirementsPending} item(s) still open`
                              : 'No open Stripe requirements'}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[18px] border border-white/[0.08] bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/42">Withdrawals</p>
                    <p className="mt-2 text-sm leading-6 text-white/58">
                      Withdrawals are sent automatically to the default bank account or eligible debit card configured
                      inside Stripe Express. OBT does not store those payout details directly.
                    </p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Button type="button" onClick={handleConnectStripe} disabled={connectingStripe} className={profilePrimaryButtonClass}>
                      {connectingStripe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
                      {hasStripeAccount ? 'Continue Stripe Setup' : 'Setup Stripe Payouts'}
                    </Button>

                    {hasStripeAccount && (
                      <Button type="button" onClick={handleManageStripe} disabled={managingStripe} className={profileSecondaryButtonClass}>
                        {managingStripe ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                        Manage Payout Method
                      </Button>
                    )}
                  </div>

                  {isStripeVerified && (
                    <div className="mt-5">
                      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                        <DialogTrigger asChild>
                          <Button type="button" disabled={!canWithdraw} className={profilePrimaryButtonClass}>
                            <Wallet className="mr-2 h-4 w-4" />
                            Withdraw
                          </Button>
                        </DialogTrigger>
                        <DialogContent className={profileDialogContentClass}>
                          <DialogHeader>
                            <DialogTitle>Request Withdrawal</DialogTitle>
                            <DialogDescription>
                              Minimum €{MIN_STRIPE_WITHDRAWAL} and a fee of €{STRIPE_WITHDRAWAL_FEE.toFixed(2)} per withdrawal.
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-3 py-2">
                            <Label className="text-xs uppercase tracking-[0.16em] text-white/42">Amount</Label>
                            <Input
                              type="number"
                              min={MIN_STRIPE_WITHDRAWAL}
                              max={Math.max(0, walletBalance - STRIPE_WITHDRAWAL_FEE)}
                              value={withdrawAmount}
                              onChange={(event) => setWithdrawAmount(event.target.value)}
                              placeholder={`${MIN_STRIPE_WITHDRAWAL}.00`}
                              className={profileInputClass}
                            />
                            <p className="text-sm text-white/52">
                              Stripe will use your default payout method. Your current available balance is €{walletBalance.toFixed(2)} and the total deduction will include the €{STRIPE_WITHDRAWAL_FEE.toFixed(2)} fee.
                            </p>
                          </div>

                          <DialogFooter>
                            <Button type="button" className={profileGhostButtonClass} onClick={() => setWithdrawOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="button" className={profilePrimaryButtonClass} onClick={handleWithdraw} disabled={submittingWithdrawal}>
                              {submittingWithdrawal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Confirm Withdrawal
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>

                <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold uppercase text-white">Recent Withdrawal Requests</p>
                    {mode === 'overlay' && (
                      <Button type="button" className={profileGhostButtonClass} onClick={() => navigate('/wallet')}>
                        Open Wallet Page
                      </Button>
                    )}
                  </div>

                  {withdrawals.length === 0 ? (
                    <p className="mt-4 text-sm text-white/52">No withdrawal requests yet.</p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {withdrawals.map((withdrawal) => {
                        const status = withdrawalStatusMap[withdrawal.status] ?? withdrawalStatusMap.pending;
                        const destination = describeStripeDestination(
                          (withdrawal.payout_destination_snapshot as WithdrawalDestinationSnapshot | null | undefined) ?? null
                        );

                        return (
                          <div
                            key={withdrawal.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-white/[0.08] bg-white/[0.03] px-4 py-3"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">€{withdrawal.amount.toFixed(2)}</p>
                              <p className="text-xs text-white/44">
                                {new Date(withdrawal.created_at).toLocaleDateString('it-IT', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </p>
                              <p className="mt-1 text-xs text-white/44">
                                Fee €{(withdrawal.fee_amount ?? STRIPE_WITHDRAWAL_FEE).toFixed(2)} • {destination}
                              </p>
                              {withdrawal.status === 'failed' && withdrawal.stripe_error_message && (
                                <p className="mt-2 max-w-[480px] text-xs leading-5 text-[#ffb4ca]">
                                  {withdrawal.stripe_error_message}
                                </p>
                              )}
                            </div>

                            <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', status.className)}>
                              {status.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSection === 'connections' && (
              <div className="space-y-6">
                <div>
                  <h2 className="flex items-center gap-2 text-xl font-semibold uppercase text-white">
                    <Link2 className="h-5 w-5 text-[#ff1654]" />
                    Connected Accounts
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    Review the accounts currently attached to your OBT profile.
                  </p>
                </div>

                <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 border border-white/[0.08]">
                        <AvatarImage src={profile.discord_avatar_url || undefined} alt={discordDisplayName} />
                        <AvatarFallback className="bg-[#5865F2] text-white">
                          <DiscordIcon className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-semibold uppercase text-white">Discord</p>
                        <p className="text-sm text-white/50">{profile.discord_username || discordDisplayName}</p>
                      </div>
                    </div>

                    <span className={profileBadgeNeutralClass}>
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Connected
                    </span>
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/[0.08] bg-black/20 p-5 text-sm leading-6 text-white/56">
                  Discord is the primary identity provider for your OBT account. If you need to switch accounts, sign out and log in again with a different Discord user.
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <AlertDialog open={showDisconnectEpicDialog} onOpenChange={setShowDisconnectEpicDialog}>
        <AlertDialogContent className={profileDialogContentClass}>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Epic Games?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to reconnect Epic Games before creating or joining new matches again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={profileGhostButtonClass} disabled={disconnectingEpic}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className={profileDangerButtonClass} onClick={handleDisconnectEpic} disabled={disconnectingEpic}>
              {disconnectingEpic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
