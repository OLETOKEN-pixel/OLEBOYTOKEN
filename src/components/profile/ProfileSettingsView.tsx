import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Clock3,
  CreditCard,
  Gamepad2,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  Unlink,
  User,
  Wallet,
} from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useVipStatus } from '@/hooks/useVipStatus';
import { supabase } from '@/integrations/supabase/client';
import { extractFunctionErrorInfo, startEpicAuth } from '@/lib/oauth';
import {
  describePayPalDestination,
  isValidPayPalEmail,
  MIN_PAYPAL_WITHDRAWAL,
  PAYPAL_WITHDRAWAL_FEE,
} from '@/lib/paypalPayouts';
import { cn } from '@/lib/utils';
import type { Platform, Region, WithdrawalDestinationSnapshot, WithdrawalRequest } from '@/types';
import { PLATFORMS, REGIONS } from '@/types';

export type ProfileSection = 'account' | 'game' | 'payments' | 'connections';

interface ProfileSettingsViewProps {
  initialSection?: ProfileSection;
  mode?: 'overlay' | 'page';
  onClose?: () => void;
}

type PaymentsActivityState = 'processing' | 'completed';

interface PaymentsActivityItem {
  id: string;
  amount: number;
  destination: string;
  createdAt: string;
  state: PaymentsActivityState;
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
const paypalPrimaryButtonClass = "!h-12 !rounded-[18px] !border !border-[#79d3ff]/26 !bg-[linear-gradient(135deg,#003087_0%,#005ea6_56%,#009cde_100%)] px-6 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white shadow-[0_18px_42px_rgba(0,112,186,0.36)] transition hover:!brightness-110 hover:shadow-[0_22px_50px_rgba(0,112,186,0.46)] disabled:!cursor-not-allowed disabled:!border-white/[0.08] disabled:!bg-white/[0.06] disabled:!text-white/34 disabled:!shadow-none";
const paypalSecondaryButtonClass = "!h-11 !rounded-[16px] !border !border-[#58c8ff]/18 !bg-[linear-gradient(180deg,rgba(0,112,186,0.22)_0%,rgba(0,48,135,0.22)_100%)] px-4 text-[11px] font-semibold uppercase tracking-[0.12em] !text-[#dcf2ff] hover:!border-[#7fd7ff]/36 hover:!bg-[linear-gradient(180deg,rgba(0,112,186,0.3)_0%,rgba(0,48,135,0.3)_100%)] disabled:!opacity-45";

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
  const [paypalEmail, setPaypalEmail] = useState('');
  const [paypalEmailError, setPaypalEmailError] = useState('');
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPayPal, setSavingPayPal] = useState(false);
  const [connectingEpic, setConnectingEpic] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [showDisconnectEpicDialog, setShowDisconnectEpicDialog] = useState(false);
  const [disconnectingEpic, setDisconnectingEpic] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  const loadPaymentData = useCallback(async (targetUserId: string) => {
    const { data, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false })
      .limit(6);

    if (error) {
      console.error('[Payments] Unable to load withdrawals', error);
      setWithdrawals([]);
      return;
    }

    setWithdrawals((data as WithdrawalRequest[] | null) ?? []);
  }, []);

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
    setPaypalEmail(profile.paypal_email || '');
    setPaypalEmailError('');
  }, [profile]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadPaymentData(user.id);
  }, [loadPaymentData, user]);

  const walletBalance = wallet?.balance ?? 0;
  const normalizedPayPalEmail = paypalEmail.trim().toLowerCase();
  const hasValidPayPalEmail = isValidPayPalEmail(normalizedPayPalEmail);
  const minimumUnlockedBalance = MIN_PAYPAL_WITHDRAWAL + PAYPAL_WITHDRAWAL_FEE;
  const canWithdraw = hasValidPayPalEmail && walletBalance >= minimumUnlockedBalance;
  const discordDisplayName = profile?.discord_display_name || profile?.discord_username || profile?.username || 'User';
  const avatarUrl = profile?.discord_avatar_url || profile?.avatar_url || undefined;
  const isPaymentsSection = activeSection === 'payments';
  const isPaymentsDenseLayout = isPaymentsSection && mode === 'page';
  const parsedWithdrawAmount = Number.parseFloat(withdrawAmount);
  const previewTotalDeduction =
    (Number.isFinite(parsedWithdrawAmount) && parsedWithdrawAmount > 0 ? parsedWithdrawAmount : MIN_PAYPAL_WITHDRAWAL) +
    PAYPAL_WITHDRAWAL_FEE;
  const remainingToUnlock = Math.max(0, minimumUnlockedBalance - walletBalance);

  const payoutHeadline = 'Withdraw to PayPal';

  const payoutDescription = canWithdraw
    ? `Your PayPal email is saved and your balance is ready. Tap the blue button, choose the amount, and confirm the payout.`
    : hasValidPayPalEmail
      ? `Your PayPal email is already saved as ${normalizedPayPalEmail}. Reach €${minimumUnlockedBalance.toFixed(2)} available and then tap Withdraw to PayPal.`
      : 'Start by saving your PayPal email. After that, every withdrawal happens from this page.';

  const payoutReadiness = canWithdraw
    ? {
        label: 'Ready to withdraw',
        className: 'border-[#71d1ff]/26 bg-[#0a5ca1]/20 text-[#d8f2ff]',
      }
    : hasValidPayPalEmail
      ? {
          label: 'PayPal saved',
          className: 'border-white/[0.14] bg-white/[0.06] text-white/82',
        }
      : {
          label: 'Save PayPal email',
          className: 'border-[#ff1654]/28 bg-[#ff1654]/10 text-[#ffc2d2]',
        };

  const withdrawActionLabel = canWithdraw ? 'Withdraw to PayPal' : 'Withdraw to PayPal';

  const paymentsActivity = useMemo<PaymentsActivityItem[]>(() => {
    const mapped = withdrawals
      .filter((withdrawal) => withdrawal.payment_method === 'paypal')
      .map((withdrawal) => {
        let state: PaymentsActivityState | null = null;

        if (withdrawal.status === 'completed') {
          state = 'completed';
        } else if (withdrawal.status === 'pending' || withdrawal.status === 'processing' || withdrawal.status === 'approved') {
          state = 'processing';
        }

        if (!state) {
          return null;
        }

        return {
          id: withdrawal.id,
          amount: withdrawal.amount,
          createdAt: withdrawal.created_at,
          destination: describePayPalDestination(
            (withdrawal.payout_destination_snapshot as WithdrawalDestinationSnapshot | null | undefined) ?? null,
            withdrawal.payment_details
          ),
          state,
        };
      })
      .filter((item): item is PaymentsActivityItem => item !== null);

    return mapped.slice(0, 3);
  }, [withdrawals]);

  const logPayPalFunctionError = useCallback(
    (
      context: string,
      info: {
        message: string;
        details: string | null;
        code: string | null;
        requestId: string | null;
      },
      error: unknown
    ) => {
      console.error(`[PayPal] ${context}`, {
        message: info.message,
        details: info.details,
        code: info.code,
        requestId: info.requestId,
        error,
      });
    },
    []
  );

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

  const handleSavePayPalEmail = async () => {
    if (!user) {
      return;
    }

    if (!hasValidPayPalEmail) {
      setPaypalEmailError('Insert a valid PayPal email to receive withdrawals.');
      return;
    }

    setSavingPayPal(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          paypal_email: normalizedPayPalEmail,
        })
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      setPaypalEmail(normalizedPayPalEmail);
      setPaypalEmailError('');
      toast({
        title: 'PayPal saved',
        description: 'Your PayPal email is ready for future withdrawals.',
      });
    } catch (error) {
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Unable to save the PayPal email.',
        variant: 'destructive',
      });
    } finally {
      setSavingPayPal(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = Number.parseFloat(withdrawAmount);
    const totalDeduction = amount + PAYPAL_WITHDRAWAL_FEE;

    if (!hasValidPayPalEmail) {
      toast({
        title: 'PayPal email required',
        description: 'Save a valid PayPal email before requesting a withdrawal.',
        variant: 'destructive',
      });
      return;
    }

    if (!Number.isFinite(amount) || amount < MIN_PAYPAL_WITHDRAWAL) {
      toast({
        title: 'Invalid amount',
        description: `Minimum withdrawal is €${MIN_PAYPAL_WITHDRAWAL}.`,
        variant: 'destructive',
      });
      return;
    }

    if (totalDeduction > walletBalance) {
      toast({
        title: 'Insufficient balance',
        description: `You need €${totalDeduction.toFixed(2)} including the €${PAYPAL_WITHDRAWAL_FEE.toFixed(2)} fee.`,
        variant: 'destructive',
      });
      return;
    }

    setSubmittingWithdrawal(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        throw new Error('You must be logged in to request a withdrawal.');
      }

      const { data, error } = await supabase.functions.invoke('create-paypal-payout', {
        body: { amount },
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
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
        description:
          data?.status === 'completed'
            ? 'Your PayPal payout completed immediately.'
            : 'PayPal is processing your payout and the status will update automatically.',
      });
    } catch (error) {
      const info = await extractFunctionErrorInfo(error, 'Unable to complete the withdrawal.');
      logPayPalFunctionError('create-payout', info, error);
      toast({
        title: 'Withdrawal failed',
        description: info.message,
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
    <div className={cn('text-white', mode === 'page' ? cn('mx-auto w-full', isPaymentsDenseLayout ? 'max-w-[1320px]' : 'max-w-[1180px]') : 'w-full')}>
      <div
        className={cn(
          'overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(19,10,13,0.98)_0%,rgba(11,6,9,0.96)_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.45)]',
          isPaymentsDenseLayout && 'lg:flex lg:h-[calc(100vh-176px)] lg:flex-col'
        )}
      >
        <div className={cn('flex items-center justify-between gap-4 border-b border-white/[0.08] px-6 py-5 lg:px-8', isPaymentsDenseLayout && 'lg:px-7 lg:py-4')}>
          <div>
            <p className="text-xs font-display uppercase tracking-[0.2em] text-[#ff9ab3]">My Profile</p>
            <h1
              className={cn('mt-2 text-[34px] uppercase leading-none text-white lg:text-[42px]', isPaymentsDenseLayout && 'lg:text-[34px]')}
              style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
            >
              Profile Settings
            </h1>
            <p className={cn('mt-3 max-w-[760px] text-sm leading-6 text-white/60 lg:text-base', isPaymentsDenseLayout && 'max-w-[620px] lg:mt-2 lg:text-[14px] lg:leading-6')}>
              {isPaymentsSection
                ? 'Shape your payout lane, keep PayPal locked in, and move wins through a cleaner premium cashout flow.'
                : 'Manage your OBT profile, Epic Games connection, withdrawal destination and linked accounts from one place.'}
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

        <div
          className={cn(
            'grid gap-6 px-6 py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8 lg:py-8',
            isPaymentsDenseLayout && 'lg:min-h-0 lg:flex-1 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-4 lg:px-6 lg:py-5'
          )}
        >
          <aside className={cn('space-y-4', isPaymentsDenseLayout && 'lg:space-y-3')}>
            <div className={cn('rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', isPaymentsDenseLayout && 'lg:p-4 lg:opacity-90')}>
              <div className="flex items-center gap-4">
                <Avatar className={cn('h-20 w-20 border-2 border-white/[0.08]', isPaymentsDenseLayout && 'lg:h-16 lg:w-16')}>
                  <AvatarImage src={avatarUrl} alt={discordDisplayName} className="object-cover" />
                  <AvatarFallback className="bg-white/[0.08] text-xl uppercase text-white">
                    {discordDisplayName.charAt(0)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                    <p className={cn('truncate text-lg font-semibold uppercase text-white', isPaymentsDenseLayout && 'lg:text-base')}>{discordDisplayName}</p>
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

            <div className={cn('rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]', isPaymentsDenseLayout && 'lg:opacity-82')}>
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

          <section
            className={cn(
              'rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:p-6',
              isPaymentsDenseLayout && 'lg:min-h-0 lg:p-5'
            )}
          >
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
              <div className={cn('space-y-6', isPaymentsDenseLayout && 'lg:flex lg:h-full lg:flex-col lg:space-y-4')}>
                <div className={cn(isPaymentsDenseLayout && 'lg:hidden')}>
                  <h2 className="flex items-center gap-2 text-xl font-semibold uppercase text-white">
                    <CreditCard className="h-5 w-5 text-[#ff1654]" />
                    Payments & Payouts
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/56">
                    Review your wallet status and withdraw winnings to your saved PayPal email. Stripe stays active
                    only for deposits.
                  </p>
                </div>

                <div
                  className={cn(
                    'space-y-4',
                    isPaymentsDenseLayout && 'lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-1 lg:grid-rows-[auto_auto_minmax(0,1fr)] lg:gap-4 lg:space-y-0'
                  )}
                >
                  <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(145deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.018)_45%,rgba(255,255,255,0.012)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] lg:p-6">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,112,186,0.26),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(255,22,84,0.16),transparent_34%)]" />
                    <div className="pointer-events-none absolute -right-20 top-6 h-40 w-40 rounded-full bg-[#009cde]/12 blur-3xl" />
                    <div className="pointer-events-none absolute bottom-0 left-0 h-24 w-full bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(0,0,0,0.12)_100%)]" />

                    <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_360px]">
                      <div className="flex flex-col justify-between rounded-[24px] border border-white/[0.08] bg-black/18 p-5 backdrop-blur-[18px]">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 rounded-full border border-[#69d3ff]/20 bg-[#003087]/22 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#dff4ff]">
                              <img src="/paypal/pp258.png" alt="PayPal" className="h-4 w-4 object-contain" />
                              PayPal payouts
                            </span>
                            <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]', payoutReadiness.className)}>
                              {hasValidPayPalEmail ? <Check className="mr-1 h-3.5 w-3.5" /> : <AlertCircle className="mr-1 h-3.5 w-3.5" />}
                              {payoutReadiness.label}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/72">
                              <ShieldCheck className="mr-1 h-3.5 w-3.5" />
                              Stripe stays for deposits
                            </span>
                          </div>

                          <h2
                            className="mt-5 max-w-[14ch] text-[34px] uppercase leading-[0.94] text-white sm:text-[42px]"
                            style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
                          >
                            {payoutHeadline}
                          </h2>
                          <p className="mt-3 max-w-[620px] text-sm leading-6 text-white/68 lg:text-[15px]">
                            {payoutDescription}
                          </p>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Step 1</p>
                            <p className="mt-2 text-sm font-semibold text-white">Save your PayPal email</p>
                            <p className="mt-1 text-xs leading-5 text-white/54">Only once. Every payout uses this email.</p>
                          </div>
                          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Step 2</p>
                            <p className="mt-2 text-sm font-semibold text-white">Tap Withdraw to PayPal</p>
                            <p className="mt-1 text-xs leading-5 text-white/54">Choose the amount and confirm the payout.</p>
                          </div>
                          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Step 3</p>
                            <p className="mt-2 text-sm font-semibold text-white">Track payout status below</p>
                            <p className="mt-1 text-xs leading-5 text-white/54">Only processing and completed payouts appear here.</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[26px] border border-[#69d3ff]/18 bg-[linear-gradient(180deg,rgba(0,48,135,0.3)_0%,rgba(10,15,24,0.82)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_22px_56px_rgba(0,48,135,0.24)]">
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white shadow-[0_14px_34px_rgba(0,48,135,0.24)]">
                            <img src="/paypal/pp258.png" alt="PayPal" className="h-8 w-8 object-contain" />
                          </span>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#dff4ff]">Saved destination</p>
                            <p className="mt-1 text-sm text-white/76">{hasValidPayPalEmail ? normalizedPayPalEmail : 'No PayPal email saved yet'}</p>
                          </div>
                        </div>

                        <div className="mt-5 rounded-[20px] border border-white/[0.08] bg-black/20 px-4 py-4">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">Available to withdraw</p>
                          <CoinDisplay amount={walletBalance} size="lg" className="mt-2 text-[34px] text-white" />
                        </div>

                        <Button
                          type="button"
                          disabled={!canWithdraw}
                          className={cn(paypalPrimaryButtonClass, 'mt-4 !h-14 w-full text-[13px] shadow-[0_22px_50px_rgba(0,112,186,0.42)]')}
                          onClick={() => setWithdrawOpen(true)}
                        >
                          <Wallet className="mr-2 h-4 w-4" />
                          {withdrawActionLabel}
                        </Button>

                        <div className="mt-4 rounded-[18px] border border-white/[0.08] bg-black/18 px-4 py-4 text-sm leading-6 text-white/64">
                          {canWithdraw ? (
                            <p>
                              You are ready. Tap <span className="font-semibold text-white">Withdraw to PayPal</span>, enter the amount, and confirm.
                            </p>
                          ) : hasValidPayPalEmail ? (
                            <p>
                              Your PayPal email is saved. You still need <span className="font-semibold text-white">€{remainingToUnlock.toFixed(2)}</span> more available balance before the button unlocks.
                            </p>
                          ) : (
                            <p>
                              Save your PayPal email first. As soon as it is saved, this blue button becomes your payout action.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_320px]">
                    <div className="rounded-[24px] border border-white/[0.08] bg-black/16 p-5 backdrop-blur-[18px]">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8adfff]">Step 1</p>
                          <h3 className="mt-2 text-xl font-semibold uppercase text-white">Save your PayPal email</h3>
                        </div>
                        <span className="rounded-full border border-white/[0.12] bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/74">
                          One-time setup
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-white/60">
                        This is the address used for every payout. You can change it here any time before you withdraw.
                      </p>

                      <div className="mt-4 space-y-2">
                        <Label className="text-xs uppercase tracking-[0.16em] text-white/48">PayPal email</Label>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <div className="relative flex-1">
                            <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8adfff]" />
                            <Input
                              type="email"
                              value={paypalEmail}
                              onChange={(event) => {
                                setPaypalEmail(event.target.value);
                                setPaypalEmailError('');
                              }}
                              placeholder="wallet@paypal.com"
                              className="h-12 rounded-[18px] border-[#69d3ff]/14 bg-black/22 pl-11 text-white placeholder:text-white/24 focus-visible:border-[#69d3ff]/36 focus-visible:ring-2 focus-visible:ring-[#009cde]/16"
                            />
                          </div>

                          <Button
                            type="button"
                            onClick={handleSavePayPalEmail}
                            disabled={savingPayPal || normalizedPayPalEmail === (profile.paypal_email || '').trim().toLowerCase()}
                            className={paypalSecondaryButtonClass}
                          >
                            {savingPayPal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save Email
                          </Button>
                        </div>
                        {paypalEmailError && <p className="pt-1 text-sm text-red-300">{paypalEmailError}</p>}
                        <p className="pt-1 text-xs leading-5 text-white/52">
                          Saved now: <span className="text-white/82">{hasValidPayPalEmail ? normalizedPayPalEmail : 'nothing saved yet'}</span>
                        </p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.02)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-[#8adfff]" />
                        <p className="text-sm font-semibold uppercase text-white">Withdrawal Rules</p>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <div className="rounded-[18px] border border-white/[0.08] bg-black/18 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Minimum</p>
                          <p className="mt-1 text-lg font-semibold text-white">€{MIN_PAYPAL_WITHDRAWAL.toFixed(2)}</p>
                        </div>
                        <div className="rounded-[18px] border border-white/[0.08] bg-black/18 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Fee</p>
                          <p className="mt-1 text-lg font-semibold text-white">€{PAYPAL_WITHDRAWAL_FEE.toFixed(2)}</p>
                        </div>
                        <div className="rounded-[18px] border border-white/[0.08] bg-black/18 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Total required</p>
                          <p className="mt-1 text-lg font-semibold text-white">€{minimumUnlockedBalance.toFixed(2)}</p>
                        </div>
                        <div className="rounded-[18px] border border-white/[0.08] bg-black/18 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Status now</p>
                          <p className="mt-1 text-sm leading-6 text-white/72">
                            {canWithdraw
                              ? 'Ready to withdraw right now.'
                              : hasValidPayPalEmail
                                ? `You need €${remainingToUnlock.toFixed(2)} more available balance.`
                                : 'Save your PayPal email to unlock withdrawals.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[28px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.018)_100%)] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] lg:col-span-2">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase text-white">Recent Payouts</p>
                        <p className="mt-1 text-sm text-white/52">
                          This list only shows payouts that are processing or already completed.
                        </p>
                      </div>
                    </div>

                    {paymentsActivity.length === 0 ? (
                      <div className="relative mt-4 overflow-hidden rounded-[24px] border border-[#69d3ff]/14 bg-[linear-gradient(135deg,rgba(0,48,135,0.16)_0%,rgba(255,22,84,0.1)_100%)] px-5 py-5">
                        <div className="pointer-events-none absolute -left-16 top-0 h-28 w-28 rounded-full bg-[#009cde]/14 blur-3xl" />
                        <div className="pointer-events-none absolute right-0 top-8 h-24 w-24 rounded-full bg-[#ff1654]/12 blur-3xl" />

                        <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
                          <div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.06] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#dff4ff]">
                              <Sparkles className="h-3.5 w-3.5 text-[#8adfff]" />
                              No payouts yet
                            </span>
                            <h3 className="mt-4 text-[28px] uppercase leading-[0.96] text-white" style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}>
                              Your completed withdrawals will appear here.
                            </h3>
                            <p className="mt-3 max-w-[540px] text-sm leading-6 text-white/62">
                              Save your PayPal email, tap the withdrawal button, and this area will show processing and completed payouts only.
                            </p>
                          </div>

                          <div className="grid gap-3">
                            <div className="rounded-[18px] border border-white/[0.08] bg-black/18 px-4 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Step 1</p>
                              <p className="mt-2 text-sm font-semibold text-white">Save PayPal email</p>
                            </div>
                            <div className="rounded-[18px] border border-white/[0.08] bg-black/18 px-4 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Step 2</p>
                              <p className="mt-2 text-sm font-semibold text-white">Tap withdraw</p>
                            </div>
                            <div className="rounded-[18px] border border-white/[0.08] bg-black/18 px-4 py-3">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">Step 3</p>
                              <p className="mt-2 text-sm font-semibold text-white">Track live + completed payouts</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 grid gap-3 xl:grid-cols-3">
                        {paymentsActivity.map((withdrawal) => {
                          const isCompleted = withdrawal.state === 'completed';
                          const dateLabel = new Date(withdrawal.createdAt).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                          });

                          return (
                            <div
                              key={withdrawal.id}
                              className={cn(
                                'relative overflow-hidden rounded-[22px] border px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
                                isCompleted
                                  ? 'border-[#69d3ff]/18 bg-[linear-gradient(180deg,rgba(0,48,135,0.2)_0%,rgba(7,12,20,0.92)_100%)]'
                                  : 'border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.045)_0%,rgba(255,255,255,0.015)_100%)]'
                              )}
                            >
                              <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-1', isCompleted ? 'bg-[linear-gradient(90deg,#009cde_0%,#61d3ff_100%)]' : 'bg-[linear-gradient(90deg,rgba(255,255,255,0.26)_0%,rgba(255,255,255,0)_100%)]')} />

                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/42">{dateLabel}</p>
                                  <p className="mt-2 text-[30px] font-semibold leading-none text-white">€{withdrawal.amount.toFixed(2)}</p>
                                </div>

                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]',
                                    isCompleted
                                      ? 'border-[#6ed4ff]/24 bg-[#0a5ca1]/18 text-[#dff4ff]'
                                      : 'border-white/[0.12] bg-white/[0.06] text-white/78'
                                  )}
                                >
                                  {isCompleted ? <Check className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}
                                  {isCompleted ? 'Completed' : 'Processing'}
                                </span>
                              </div>

                              <div className="mt-5 space-y-2">
                                <p className="text-xs uppercase tracking-[0.16em] text-white/40">Destination</p>
                                <p className="truncate text-sm text-white/76">{withdrawal.destination}</p>
                              </div>

                              <div className="mt-4 flex items-center justify-between text-xs text-white/48">
                                <span>PayPal</span>
                                <span>{isCompleted ? 'Completed' : 'Processing'}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
                    <DialogContent className={cn(profileDialogContentClass, '!max-w-[560px] !overflow-hidden !border-[#69d3ff]/16')}>
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(0,112,186,0.26),transparent_45%)]" />

                      <DialogHeader className="relative">
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white shadow-[0_14px_34px_rgba(0,48,135,0.24)]">
                            <img src="/paypal/pp258.png" alt="PayPal icon" className="h-7 w-7 object-contain" />
                          </span>
                          <div>
                            <DialogTitle className="text-left text-[24px] uppercase text-white">Confirm PayPal Withdrawal</DialogTitle>
                            <DialogDescription className="text-left text-white/58">
                              Check the destination, enter the amount, and confirm the payout to your saved PayPal email.
                            </DialogDescription>
                          </div>
                        </div>
                      </DialogHeader>

                      <div className="relative space-y-4 py-2">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">Available</p>
                            <p className="mt-2 text-lg font-semibold text-white">€{walletBalance.toFixed(2)}</p>
                          </div>
                          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">Fee</p>
                            <p className="mt-2 text-lg font-semibold text-white">€{PAYPAL_WITHDRAWAL_FEE.toFixed(2)}</p>
                          </div>
                          <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                            <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">Total deduction</p>
                            <p className="mt-2 text-lg font-semibold text-white">€{previewTotalDeduction.toFixed(2)}</p>
                          </div>
                        </div>

                        <div className="rounded-[18px] border border-[#69d3ff]/14 bg-[linear-gradient(180deg,rgba(0,48,135,0.18)_0%,rgba(13,18,28,0.72)_100%)] px-4 py-4">
                          <p className="text-[10px] uppercase tracking-[0.16em] text-white/42">PayPal destination</p>
                          <p className="mt-2 text-sm text-white/82">{normalizedPayPalEmail}</p>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs uppercase tracking-[0.16em] text-white/42">Amount</Label>
                          <Input
                            type="number"
                            min={MIN_PAYPAL_WITHDRAWAL}
                            max={Math.max(0, walletBalance - PAYPAL_WITHDRAWAL_FEE)}
                            value={withdrawAmount}
                            onChange={(event) => setWithdrawAmount(event.target.value)}
                            placeholder={`${MIN_PAYPAL_WITHDRAWAL}.00`}
                            className="h-12 rounded-[18px] border-[#69d3ff]/14 bg-black/22 text-white placeholder:text-white/24 focus-visible:border-[#69d3ff]/36 focus-visible:ring-2 focus-visible:ring-[#009cde]/16"
                          />
                          <p className="text-sm leading-6 text-white/54">
                            You receive the amount above on PayPal. Your wallet deduction includes the €{PAYPAL_WITHDRAWAL_FEE.toFixed(2)} fee.
                          </p>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button type="button" className={profileGhostButtonClass} onClick={() => setWithdrawOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="button" className={paypalPrimaryButtonClass} onClick={handleWithdraw} disabled={submittingWithdrawal}>
                          {submittingWithdrawal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
                          Confirm Withdrawal
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
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
