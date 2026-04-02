import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Clock3,
  Gamepad2,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Save,
  ShieldCheck,
  Unlink,
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

const PROFILE_TRIANGLES_ASSET = '/figma-profile/profile-triangles.svg';
const PROFILE_UNDERLINE_ASSET = '/figma-profile/profile-underline.svg';
const PROFILE_EPIC_LOGO_ASSET = '/figma-profile/epic-logo.svg';
const PROFILE_ACCOUNT_ICON_ASSET = '/figma-profile/nav-icon-account.svg';
const PROFILE_GAME_ICON_ASSET = '/figma-profile/nav-icon-game.svg';
const PROFILE_WITHDRAW_ICON_ASSET = '/figma-profile/nav-icon-withdraw.svg';
const PROFILE_PFP_FALLBACK_ASSET = '/figma-assets/marv-pfp.png';

const sections: Array<{
  id: ProfileSection;
  label: string;
  assetSrc?: string;
  icon?: ComponentType<{ className?: string }>;
}> = [
  { id: 'account', label: 'Account', assetSrc: PROFILE_ACCOUNT_ICON_ASSET },
  { id: 'game', label: 'Game', assetSrc: PROFILE_GAME_ICON_ASSET },
  { id: 'payments', label: 'Withdraw', assetSrc: PROFILE_WITHDRAW_ICON_ASSET },
  { id: 'connections', label: 'Connections', icon: Link2 },
];

const profileSecondaryButtonClass = "!h-11 !rounded-[14px] !border !border-white/[0.14] !bg-white/[0.04] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white hover:!border-[#ff1654]/35 hover:!bg-[#ff1654]/10";
const profileGhostButtonClass = "!h-11 !rounded-[14px] !border !border-white/[0.1] !bg-white/[0.03] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white/72 hover:!border-white/[0.16] hover:!bg-white/[0.06] hover:!text-white";
const profileDangerButtonClass = "!h-11 !rounded-[14px] !border !border-[#ff1654]/30 !bg-[#ff1654]/10 px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-[#ffc1d1] hover:!bg-[#ff1654]/16 hover:!border-[#ff1654]/44";
const profileSelectContentClass = "border-white/[0.1] bg-[linear-gradient(180deg,rgba(18,11,15,0.98)_0%,rgba(8,6,10,0.96)_100%)] text-white shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-[18px]";
const profileDialogContentClass = "!rounded-[28px] !border !border-white/[0.1] !bg-[linear-gradient(180deg,rgba(18,11,15,0.98)_0%,rgba(10,7,11,0.96)_100%)] !text-white shadow-[0_28px_80px_rgba(0,0,0,0.52)] backdrop-blur-[22px]";
const paypalPrimaryButtonClass = "!h-12 !rounded-[18px] !border !border-[#79d3ff]/26 !bg-[linear-gradient(135deg,#003087_0%,#005ea6_56%,#009cde_100%)] px-6 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white shadow-[0_18px_42px_rgba(0,112,186,0.36)] transition hover:!brightness-110 hover:shadow-[0_22px_50px_rgba(0,112,186,0.46)] disabled:!cursor-not-allowed disabled:!border-white/[0.08] disabled:!bg-white/[0.06] disabled:!text-white/34 disabled:!shadow-none";
const paypalSecondaryButtonClass = "!h-11 !rounded-[16px] !border !border-[#58c8ff]/18 !bg-[linear-gradient(180deg,rgba(0,112,186,0.22)_0%,rgba(0,48,135,0.22)_100%)] px-4 text-[11px] font-semibold uppercase tracking-[0.12em] !text-[#dcf2ff] hover:!border-[#7fd7ff]/36 hover:!bg-[linear-gradient(180deg,rgba(0,112,186,0.3)_0%,rgba(0,48,135,0.3)_100%)] disabled:!opacity-45";
const figmaMainStageClass = 'relative overflow-hidden rounded-[18px] border border-[#ff1654] bg-[#2c2c2c] shadow-[0_6px_22px_rgba(0,0,0,0.34)]';
const figmaPinkCardClass = 'rounded-[16px] border-[3px] border-black bg-[#ff1654] shadow-[0_6px_18px_rgba(0,0,0,0.25)]';
const figmaDarkInsetClass = 'rounded-[16px] border border-white/10 bg-black/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]';
const figmaPinkActionButtonClass = '!h-12 !rounded-[16px] !border !border-white/40 !bg-[#ff1654] px-5 text-[13px] font-semibold uppercase tracking-[0.08em] !text-white shadow-[0_16px_36px_rgba(255,22,84,0.32)] hover:!bg-[#ff2b68] hover:shadow-[0_20px_42px_rgba(255,22,84,0.4)] disabled:!cursor-not-allowed disabled:!opacity-45';
const figmaRailButtonBaseClass = 'relative flex h-[54px] w-full items-center gap-3 rounded-[16px] border border-white/30 bg-[#ff1654] px-4 text-left text-white shadow-[0_4px_8px_rgba(0,0,0,0.25)] transition';
const figmaSectionTitleClass = 'text-[36px] uppercase leading-[0.94] text-white lg:text-[44px]';

function SectionRailIcon({
  assetSrc,
  icon: Icon,
  className,
}: {
  assetSrc?: string;
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}) {
  if (assetSrc) {
    return <img src={assetSrc} alt="" aria-hidden className={cn('h-6 w-6 object-contain', className)} />;
  }

  if (Icon) {
    return <Icon className={className} />;
  }

  return null;
}

function FigmaStatusBadge({
  tone,
  children,
  icon,
}: {
  tone: 'green' | 'red' | 'dark' | 'blue';
  children: string;
  icon?: ReactNode;
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-[#2cf804] border-white/40 text-white'
      : tone === 'red'
        ? 'bg-[#ff0409] border-white/40 text-white'
        : tone === 'blue'
          ? 'bg-[#123b73] border-white/20 text-[#dff4ff]'
          : 'bg-[#282828] border-white/16 text-white/88';

  return (
    <span
      className={cn(
        'inline-flex h-[40px] items-center gap-2 rounded-[14px] border px-4 text-[15px] font-semibold uppercase tracking-[0.04em] shadow-[0_4px_8px_rgba(0,0,0,0.2)]',
        toneClass
      )}
      style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
    >
      {icon}
      {children}
    </span>
  );
}

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
  const { user, profile, wallet, loading, refreshProfile, refreshWallet, signOut } = useAuth();
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
  const avatarUrl = profile?.discord_avatar_url || profile?.avatar_url || PROFILE_PFP_FALLBACK_ASSET;
  const isDesktopFigmaShell = mode === 'page';
  const parsedWithdrawAmount = Number.parseFloat(withdrawAmount);
  const previewTotalDeduction =
    (Number.isFinite(parsedWithdrawAmount) && parsedWithdrawAmount > 0 ? parsedWithdrawAmount : MIN_PAYPAL_WITHDRAWAL) +
    PAYPAL_WITHDRAWAL_FEE;
  const remainingToUnlock = Math.max(0, minimumUnlockedBalance - walletBalance);
  const epicConnected = Boolean(profile.epic_username);
  const savedPayPalAddress = hasValidPayPalEmail ? normalizedPayPalEmail : 'No PayPal email saved yet';
  const withdrawStatus = canWithdraw
    ? { tone: 'green' as const, label: 'Ready', copy: 'Your cashout lane is live. Choose the amount and withdraw right now.' }
    : hasValidPayPalEmail
      ? {
          tone: 'dark' as const,
          label: 'Low balance',
          copy: `Your PayPal email is saved. You need €${remainingToUnlock.toFixed(2)} more available balance before cashout unlocks.`,
        }
      : {
          tone: 'red' as const,
          label: 'Setup needed',
          copy: 'Save your PayPal email first. After that, every withdrawal starts from this screen.',
        };

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

  const renderStageHeader = (icon: ReactNode, title: string, subtitle: string) => (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-white/12 bg-black/20">
          {icon}
        </span>
        <h2 className={figmaSectionTitleClass} style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}>
          {title}
        </h2>
      </div>
      <p className="max-w-[780px] text-[15px] leading-6 text-white/68">{subtitle}</p>
    </div>
  );

  const renderAccountSection = () => (
    <div className="space-y-5">
      {renderStageHeader(
        <img src={PROFILE_ACCOUNT_ICON_ASSET} alt="" aria-hidden className="h-6 w-6 object-contain" />,
        'ACCOUNT SETTINGS',
        'Tune your competitive identity, lock your preferred region, and keep the main account lane ready.'
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_280px]">
        <div className={cn(figmaPinkCardClass, 'p-5 lg:p-6')}>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-[11px] uppercase tracking-[0.18em] text-white/82">Username</Label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={username}
                    onChange={(event) => {
                      setUsername(event.target.value);
                      setUsernameError('');
                    }}
                    className="h-12 rounded-[16px] border border-black/20 bg-black/12 text-white placeholder:text-white/32 focus-visible:border-black/25 focus-visible:ring-2 focus-visible:ring-black/10"
                    disabled={!isVip}
                  />
                  <Button
                    type="button"
                    onClick={handleSaveUsername}
                    disabled={savingProfile || username === profile.username}
                    className={isVip ? profileSecondaryButtonClass : figmaPinkActionButtonClass}
                  >
                    {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    {isVip ? 'Save' : 'VIP only'}
                  </Button>
                </div>
                {usernameError && <p className="text-sm text-[#3a0911]">{usernameError}</p>}
                {!isVip && (
                  <p className="text-sm leading-6 text-[#3a0911]">
                    Username changes are locked to VIP members. Your base identity stays synced from Discord.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[11px] uppercase tracking-[0.18em] text-white/82">Preferred Region</Label>
                  <Select value={preferredRegion} onValueChange={(value) => setPreferredRegion(value as Region)}>
                    <SelectTrigger className="h-12 rounded-[16px] border border-black/20 bg-black/12 text-white focus:border-black/25 focus:ring-2 focus:ring-black/10">
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
                  <Label className="text-[11px] uppercase tracking-[0.18em] text-white/82">Preferred Platform</Label>
                  <Select value={preferredPlatform} onValueChange={(value) => setPreferredPlatform(value as Platform)}>
                    <SelectTrigger className="h-12 rounded-[16px] border border-black/20 bg-black/12 text-white focus:border-black/25 focus:ring-2 focus:ring-black/10">
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
            </div>

            <div className="space-y-3">
              <div className={cn(figmaDarkInsetClass, 'p-4')}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Discord source</p>
                <p className="mt-2 text-lg font-semibold uppercase text-white">{discordDisplayName}</p>
                <p className="mt-1 break-all text-sm text-white/66">{profile.email}</p>
              </div>

              <div className={cn(figmaDarkInsetClass, 'p-4')}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Profile status</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <FigmaStatusBadge tone="dark" icon={<ShieldCheck className="h-4 w-4" />}>
                    {isVip ? 'VIP' : 'Standard'}
                  </FigmaStatusBadge>
                  <FigmaStatusBadge tone={epicConnected ? 'green' : 'red'} icon={epicConnected ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}>
                    {epicConnected ? 'Epic ready' : 'Epic missing'}
                  </FigmaStatusBadge>
                </div>
              </div>

              <Button type="button" onClick={handleSaveAccount} disabled={savingProfile} className={figmaPinkActionButtonClass}>
                {savingProfile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save account
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 content-start">
          <div className={cn(figmaDarkInsetClass, 'p-4')}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Main lane</p>
            <p className="mt-2 text-base font-semibold uppercase text-white">Account identity</p>
            <p className="mt-2 text-sm leading-6 text-white/64">Your profile controls your match preferences and keeps the settings lane synced across the site.</p>
          </div>
          <div className={cn(figmaDarkInsetClass, 'p-4')}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Current setup</p>
            <p className="mt-2 text-sm leading-6 text-white/72">
              Region: <span className="font-semibold text-white">{preferredRegion}</span>
              <br />
              Platform: <span className="font-semibold text-white">{preferredPlatform}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderGameSection = () => (
    <div className="space-y-5">
      {renderStageHeader(
        <img src={PROFILE_GAME_ICON_ASSET} alt="" aria-hidden className="h-6 w-6 object-contain" />,
        'GAME SETTINGS',
        'Connect Epic Games to sync the display name used inside matches and friend-request flows.'
      )}

      <div className={cn(figmaPinkCardClass, 'p-5 lg:p-6')}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[30px] font-semibold uppercase leading-none text-white" style={{ fontFamily: "'Base_Neue_Trial-WideBlack', 'Base Neue Trial', sans-serif" }}>
              EPIC GAMES
            </p>
            <p className="mt-2 text-sm text-[#3a0911]">
              {epicConnected ? `Connected as ${profile.epic_username}` : 'Not connected yet'}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <FigmaStatusBadge tone={epicConnected ? 'green' : 'red'} icon={epicConnected ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}>
              {epicConnected ? 'Ready' : 'Missing'}
            </FigmaStatusBadge>
            <FigmaStatusBadge tone="dark" icon={<Gamepad2 className="h-4 w-4" />}>
              {epicConnected ? 'Live ID' : 'Connect lane'}
            </FigmaStatusBadge>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:items-end">
          <div className="rounded-[18px] bg-white px-5 py-4 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
            <img src={PROFILE_EPIC_LOGO_ASSET} alt="Epic Games" className="h-[150px] w-full object-contain" />
          </div>

          <div className="space-y-4">
            <div className={cn(figmaDarkInsetClass, 'p-4')}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Match visibility</p>
              <p className="mt-2 text-sm leading-6 text-white/72">
                Your Epic display name is shown inside matches so players can add each other without using the Discord
                platform identity tied to your OBT account.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {epicConnected ? (
                <Button type="button" onClick={() => setShowDisconnectEpicDialog(true)} className={profileDangerButtonClass}>
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect Epic Games
                </Button>
              ) : (
                <Button type="button" onClick={handleConnectEpic} disabled={connectingEpic} className={figmaPinkActionButtonClass}>
                  {connectingEpic ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                  Connect Epic Games
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPaymentsSection = () => (
    <div className="flex h-full min-h-0 flex-col gap-5">
      {renderStageHeader(
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-white">
          <img src="/paypal/pp258.png" alt="" aria-hidden className="h-5 w-5 object-contain" />
        </span>,
        'WITHDRAW',
        'Save one PayPal email, hit the blue cashout button, and move your available balance out from here.'
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_280px]">
        <div className={cn(figmaPinkCardClass, 'p-5 lg:p-6')}>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white shadow-[0_10px_24px_rgba(0,0,0,0.18)]">
                  <img src="/paypal/pp258.png" alt="PayPal" className="h-8 w-8 object-contain" />
                </span>
                <div>
                  <p className="text-[28px] font-semibold uppercase leading-none text-white" style={{ fontFamily: "'Base_Neue_Trial-WideBlack', 'Base Neue Trial', sans-serif" }}>
                    PAYPAL CASHOUT
                  </p>
                  <p className="mt-1 text-sm text-[#3a0911]">{savedPayPalAddress}</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <FigmaStatusBadge tone={withdrawStatus.tone} icon={canWithdraw ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}>
                {withdrawStatus.label}
              </FigmaStatusBadge>
              <FigmaStatusBadge tone="blue" icon={<Wallet className="h-4 w-4" />}>
                €{walletBalance.toFixed(2)} available
              </FigmaStatusBadge>
            </div>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-4">
              <div className={cn(figmaDarkInsetClass, 'p-4')}>
                <Label className="text-[11px] uppercase tracking-[0.18em] text-white/48">PayPal email</Label>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7bd8ff]" />
                    <Input
                      type="email"
                      value={paypalEmail}
                      onChange={(event) => {
                        setPaypalEmail(event.target.value);
                        setPaypalEmailError('');
                      }}
                      placeholder="wallet@paypal.com"
                      className="h-12 rounded-[16px] border border-[#0a3d71]/18 bg-black/18 pl-11 text-white placeholder:text-white/26 focus-visible:border-[#0a5ca1]/28 focus-visible:ring-2 focus-visible:ring-[#009cde]/16"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={handleSavePayPalEmail}
                    disabled={savingPayPal || normalizedPayPalEmail === (profile.paypal_email || '').trim().toLowerCase()}
                    className={paypalSecondaryButtonClass}
                  >
                    {savingPayPal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save email
                  </Button>
                </div>
                {paypalEmailError && <p className="pt-2 text-sm text-white">{paypalEmailError}</p>}
              </div>

              <div className={cn(figmaDarkInsetClass, 'p-4')}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Cashout flow</p>
                <p className="mt-2 text-sm leading-6 text-white/72">{withdrawStatus.copy}</p>
              </div>
            </div>

            <div className={cn(figmaDarkInsetClass, 'flex flex-col justify-between p-4')}>
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Available right now</p>
                <CoinDisplay amount={walletBalance} size="lg" className="mt-3 text-[34px] text-white" />
              </div>
              <div className="mt-4 space-y-3">
                <Button
                  type="button"
                  disabled={!canWithdraw}
                  className={cn(paypalPrimaryButtonClass, 'w-full')}
                  onClick={() => setWithdrawOpen(true)}
                >
                  <Wallet className="mr-2 h-4 w-4" />
                  Withdraw to PayPal
                </Button>
                <p className="text-xs leading-5 text-white/54">
                  Minimum €{MIN_PAYPAL_WITHDRAWAL.toFixed(2)} + €{PAYPAL_WITHDRAWAL_FEE.toFixed(2)} fee.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 content-start">
          <div className={cn(figmaDarkInsetClass, 'p-4')}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Minimum</p>
            <p className="mt-2 text-[26px] font-semibold leading-none text-white">€{MIN_PAYPAL_WITHDRAWAL.toFixed(2)}</p>
          </div>
          <div className={cn(figmaDarkInsetClass, 'p-4')}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Fee</p>
            <p className="mt-2 text-[26px] font-semibold leading-none text-white">€{PAYPAL_WITHDRAWAL_FEE.toFixed(2)}</p>
          </div>
          <div className={cn(figmaDarkInsetClass, 'p-4')}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Unlock amount</p>
            <p className="mt-2 text-[26px] font-semibold leading-none text-white">€{minimumUnlockedBalance.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className={cn(figmaDarkInsetClass, 'flex min-h-0 flex-1 flex-col p-5')}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/48">Payout reel</p>
            <p className="mt-2 text-sm text-white/64">Only live and completed cashouts stay in this reel.</p>
          </div>
        </div>

        {paymentsActivity.length === 0 ? (
          <div className={cn(figmaPinkCardClass, 'mt-4 flex flex-1 items-center p-5')}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
              <div>
                <p className="text-[30px] font-semibold uppercase leading-[0.92] text-white" style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}>
                  Your clean cashouts land here.
                </p>
                <p className="mt-3 max-w-[520px] text-sm leading-6 text-[#3a0911]">
                  Save the PayPal email, tap withdraw, and this reel will only show payouts that are actually moving or already completed.
                </p>
              </div>

              <div className="grid gap-3">
                <div className={cn(figmaDarkInsetClass, 'p-4')}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Step 1</p>
                  <p className="mt-2 text-sm font-semibold uppercase text-white">Save PayPal email</p>
                </div>
                <div className={cn(figmaDarkInsetClass, 'p-4')}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Step 2</p>
                  <p className="mt-2 text-sm font-semibold uppercase text-white">Tap withdraw</p>
                </div>
                <div className={cn(figmaDarkInsetClass, 'p-4')}>
                  <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Step 3</p>
                  <p className="mt-2 text-sm font-semibold uppercase text-white">Track it here</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid min-h-0 gap-3 overflow-y-auto pr-1 xl:grid-cols-3">
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
                    'rounded-[18px] border p-4 shadow-[0_4px_8px_rgba(0,0,0,0.22)]',
                    isCompleted ? 'border-[#0a5ca1]/26 bg-[linear-gradient(180deg,rgba(0,94,166,0.28)_0%,rgba(8,19,30,0.94)_100%)]' : 'border-white/10 bg-black/18'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">{dateLabel}</p>
                      <p className="mt-2 text-[30px] font-semibold leading-none text-white">€{withdrawal.amount.toFixed(2)}</p>
                    </div>
                    <FigmaStatusBadge tone={isCompleted ? 'green' : 'dark'} icon={isCompleted ? <Check className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}>
                      {isCompleted ? 'Completed' : 'Processing'}
                    </FigmaStatusBadge>
                  </div>

                  <div className="mt-4">
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Destination</p>
                    <p className="mt-2 truncate text-sm text-white/76">{withdrawal.destination}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className={cn(profileDialogContentClass, '!max-w-[560px] !overflow-hidden !border-[#ff1654]/22')}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top_left,rgba(255,22,84,0.22),transparent_48%)]" />

          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-white">
                <img src="/paypal/pp258.png" alt="PayPal icon" className="h-7 w-7 object-contain" />
              </span>
              <div>
                <DialogTitle className="text-left text-[24px] uppercase text-white">Withdraw to PayPal</DialogTitle>
                <DialogDescription className="text-left text-white/58">
                  Confirm the amount and send the payout to your saved PayPal email.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="relative space-y-4 py-2">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={cn(figmaDarkInsetClass, 'p-4')}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Available</p>
                <p className="mt-2 text-lg font-semibold text-white">€{walletBalance.toFixed(2)}</p>
              </div>
              <div className={cn(figmaDarkInsetClass, 'p-4')}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Fee</p>
                <p className="mt-2 text-lg font-semibold text-white">€{PAYPAL_WITHDRAWAL_FEE.toFixed(2)}</p>
              </div>
              <div className={cn(figmaDarkInsetClass, 'p-4')}>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Total deduction</p>
                <p className="mt-2 text-lg font-semibold text-white">€{previewTotalDeduction.toFixed(2)}</p>
              </div>
            </div>

            <div className={cn(figmaPinkCardClass, 'p-4')}>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/82">PayPal destination</p>
              <p className="mt-2 text-sm text-white">{normalizedPayPalEmail}</p>
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
                className="h-12 rounded-[16px] border-white/[0.12] bg-black/20 text-white placeholder:text-white/24 focus-visible:border-[#ff1654]/35 focus-visible:ring-2 focus-visible:ring-[#ff1654]/18"
              />
              <p className="text-sm leading-6 text-white/54">
                The payout sends the amount above to PayPal. Your wallet deduction includes the €{PAYPAL_WITHDRAWAL_FEE.toFixed(2)} fee.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" className={profileGhostButtonClass} onClick={() => setWithdrawOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className={paypalPrimaryButtonClass} onClick={handleWithdraw} disabled={submittingWithdrawal}>
              {submittingWithdrawal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowUpRight className="mr-2 h-4 w-4" />}
              Confirm withdrawal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderConnectionsSection = () => (
    <div className="space-y-5">
      {renderStageHeader(
        <Link2 className="h-5 w-5 text-white" />,
        'CONNECTIONS',
        'Review the identities and payout lanes currently attached to your OBT profile.'
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_280px]">
        <div className={cn(figmaPinkCardClass, 'p-5 lg:p-6')}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className={cn(figmaDarkInsetClass, 'p-4')}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 border border-white/10">
                    <AvatarImage src={profile.discord_avatar_url || undefined} alt={discordDisplayName} />
                    <AvatarFallback className="bg-[#5865F2] text-white">
                      <DiscordIcon className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold uppercase text-white">Discord</p>
                    <p className="text-sm text-white/60">{profile.discord_username || discordDisplayName}</p>
                  </div>
                </div>
                <FigmaStatusBadge tone="green" icon={<Check className="h-4 w-4" />}>
                  Connected
                </FigmaStatusBadge>
              </div>
            </div>

            <div className={cn(figmaDarkInsetClass, 'p-4')}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={PROFILE_EPIC_LOGO_ASSET} alt="Epic Games" className="h-12 w-12 rounded-[10px] bg-white p-1.5 object-contain" />
                  <div>
                    <p className="text-sm font-semibold uppercase text-white">Epic Games</p>
                    <p className="text-sm text-white/60">{profile.epic_username || 'Not connected'}</p>
                  </div>
                </div>
                <FigmaStatusBadge tone={epicConnected ? 'green' : 'red'} icon={epicConnected ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}>
                  {epicConnected ? 'Ready' : 'Missing'}
                </FigmaStatusBadge>
              </div>
            </div>

            <div className={cn(figmaDarkInsetClass, 'p-4 lg:col-span-2')}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-white">
                    <img src="/paypal/pp258.png" alt="PayPal" className="h-7 w-7 object-contain" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold uppercase text-white">PayPal payout lane</p>
                    <p className="text-sm text-white/60">{savedPayPalAddress}</p>
                  </div>
                </div>
                <FigmaStatusBadge tone={hasValidPayPalEmail ? 'green' : 'red'} icon={hasValidPayPalEmail ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}>
                  {hasValidPayPalEmail ? 'Saved' : 'Missing'}
                </FigmaStatusBadge>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 content-start">
          <div className={cn(figmaDarkInsetClass, 'p-4')}>
            <p className="text-[10px] uppercase tracking-[0.16em] text-white/40">Primary identity</p>
            <p className="mt-2 text-sm leading-6 text-white/72">
              Discord is the primary identity provider for your OBT account. If you need to switch accounts, sign out and log in again with a different Discord user.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <LoadingPage />;
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className={cn('text-white', mode === 'page' ? 'mx-auto w-full max-w-[1560px]' : 'w-full')}>
      <div
        className={cn(
          'relative overflow-hidden rounded-[28px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(24,7,9,0.98)_0%,rgba(11,4,5,0.98)_100%)] shadow-[0_28px_80px_rgba(0,0,0,0.42)]',
          isDesktopFigmaShell ? 'lg:h-[calc(100vh-194px)]' : 'lg:h-full'
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[146px] bg-[radial-gradient(circle_at_top,rgba(255,22,84,0.16),transparent_48%)]" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-[146px] w-full bg-[radial-gradient(circle_at_bottom,rgba(255,22,84,0.18),transparent_52%)]" />

        <div className="relative flex h-full min-h-0 flex-col px-5 pb-5 pt-5 lg:px-8 lg:pb-6 lg:pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="relative max-w-[760px] pl-10 pt-2">
              <img
                src={PROFILE_TRIANGLES_ASSET}
                alt=""
                aria-hidden
                className="pointer-events-none absolute -left-3 -top-1 h-[108px] w-[76px] object-contain"
              />
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#ff96ad]">MY PROFILE</p>
              <h1
                className="mt-1 text-[48px] uppercase leading-[0.92] text-white sm:text-[58px] lg:text-[64px]"
                style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
              >
                PROFILE SETTINGS
              </h1>
              <img src={PROFILE_UNDERLINE_ASSET} alt="" aria-hidden className="mt-2 h-[18px] w-[520px] max-w-full object-contain" />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
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
                <Button type="button" className={profileGhostButtonClass} onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </div>

          <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
            <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[82px] hidden bg-[#ff1654] shadow-[0_20px_60px_rgba(255,22,84,0.18)] lg:block" />

            <div className="relative grid min-h-0 flex-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-5">
              <aside className="space-y-4 pt-2 lg:pt-3">
                <div className="rounded-[16px] border border-[#ff1654] bg-[#2c2c2c] p-4 shadow-[0_4px_10px_rgba(0,0,0,0.28)]">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-[62px] w-[62px] rounded-[18px] border border-white/10">
                      <AvatarImage src={avatarUrl} alt={discordDisplayName} className="object-cover" />
                      <AvatarFallback className="bg-black/30 text-white">{discordDisplayName.charAt(0)}</AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="truncate text-[30px] font-semibold uppercase leading-none text-white" style={{ fontFamily: "'Base_Neue_Trial-WideBlack', 'Base Neue Trial', sans-serif" }}>
                        {discordDisplayName}
                      </p>
                      <p className="truncate text-sm text-white/76">{profile.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="inline-flex h-[28px] items-center rounded-[999px] border border-white/16 bg-black/18 px-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-white/82">
                          {isVip ? 'VIP' : 'STANDARD'}
                        </span>
                        <span
                          className={cn(
                            'inline-flex h-[28px] items-center rounded-[999px] border px-3 text-[11px] font-semibold uppercase tracking-[0.1em]',
                            epicConnected ? 'border-[#2cf804]/30 bg-[#2cf804]/12 text-[#d9ffd1]' : 'border-[#ff1654]/32 bg-[#ff1654]/12 text-[#ffc0d0]'
                          )}
                        >
                          {epicConnected ? 'EPIC READY' : 'EPIC MISSING'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[16px] border border-[#ff1654] bg-[#2c2c2c] p-4 shadow-[0_4px_10px_rgba(0,0,0,0.28)]">
                  <nav className="grid gap-4">
                    {sections.map((section) => {
                      const isActive = activeSection === section.id;

                      return (
                        <button
                          key={section.id}
                          type="button"
                          onClick={() => setActiveSection(section.id)}
                          className={cn(
                            figmaRailButtonBaseClass,
                            isActive
                              ? 'border-white/50 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_12px_24px_rgba(255,22,84,0.28)]'
                              : 'opacity-92 hover:opacity-100 hover:shadow-[0_10px_20px_rgba(255,22,84,0.22)]'
                          )}
                        >
                          <SectionRailIcon assetSrc={section.assetSrc} icon={section.icon} className={cn(section.assetSrc ? 'h-7 w-7' : 'h-5 w-5')} />
                          <span className="truncate text-[24px] uppercase leading-none" style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}>
                            {section.label}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </aside>

              <section className={cn(figmaMainStageClass, 'min-h-0 overflow-hidden lg:mt-2')}>
                <div className="h-full min-h-0 overflow-y-auto px-5 py-5 lg:px-6 lg:py-6">
                  {activeSection === 'account' && renderAccountSection()}
                  {activeSection === 'game' && renderGameSection()}
                  {activeSection === 'payments' && renderPaymentsSection()}
                  {activeSection === 'connections' && renderConnectionsSection()}
                </div>
              </section>
            </div>
          </div>
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
