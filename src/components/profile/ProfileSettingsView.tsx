import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  ChevronDown,
  Clock3,
  Crown,
  Gamepad2,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Save,
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
import { getDiscordAvatarUrl } from '@/lib/avatar';
import { extractFunctionErrorInfo, startEpicAuth, startTwitterAuth, startTwitchAuth } from '@/lib/oauth';
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

const sections: Array<{
  id: ProfileSection;
  label: string;
  railLabel: string;
  icon?: ComponentType<{ className?: string }>;
}> = [
  { id: 'account', label: 'Account', railLabel: 'ACCOUNT', icon: User },
  { id: 'game', label: 'Game', railLabel: 'GAME', icon: Gamepad2 },
  { id: 'payments', label: 'Withdraw', railLabel: 'WITHDRAW', icon: Wallet },
  { id: 'connections', label: 'Connections', railLabel: 'CONNECTIONS', icon: Link2 },
];

const profileSecondaryButtonClass = "!h-11 !rounded-[14px] !border !border-white/[0.14] !bg-white/[0.04] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white hover:!border-[#ff1654]/35 hover:!bg-[#ff1654]/10";
const profileGhostButtonClass = "!h-11 !rounded-[14px] !border !border-white/[0.1] !bg-white/[0.03] px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white/72 hover:!border-white/[0.16] hover:!bg-white/[0.06] hover:!text-white";
const profileDangerButtonClass = "!h-11 !rounded-[14px] !border !border-[#ff1654]/30 !bg-[#ff1654]/10 px-5 text-[12px] font-semibold uppercase tracking-[0.12em] !text-[#ffc1d1] hover:!bg-[#ff1654]/16 hover:!border-[#ff1654]/44";
const profileSelectContentClass = "border-white/[0.1] bg-[linear-gradient(180deg,rgba(18,11,15,0.98)_0%,rgba(8,6,10,0.96)_100%)] text-white shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-[18px]";
const profileDialogContentClass = "!rounded-[28px] !border !border-white/[0.1] !bg-[linear-gradient(180deg,rgba(18,11,15,0.98)_0%,rgba(10,7,11,0.96)_100%)] !text-white shadow-[0_28px_80px_rgba(0,0,0,0.52)] backdrop-blur-[22px]";
const paypalPrimaryButtonClass = "!h-12 !rounded-[18px] !border !border-[#79d3ff]/26 !bg-[linear-gradient(135deg,#003087_0%,#005ea6_56%,#009cde_100%)] px-6 text-[12px] font-semibold uppercase tracking-[0.12em] !text-white shadow-[0_18px_42px_rgba(0,112,186,0.36)] transition hover:!brightness-110 hover:shadow-[0_22px_50px_rgba(0,112,186,0.46)] disabled:!cursor-not-allowed disabled:!border-white/[0.08] disabled:!bg-white/[0.06] disabled:!text-white/34 disabled:!shadow-none";
const paypalSecondaryButtonClass = "!h-11 !rounded-[16px] !border !border-[#58c8ff]/18 !bg-[linear-gradient(180deg,rgba(0,112,186,0.22)_0%,rgba(0,48,135,0.22)_100%)] px-4 text-[11px] font-semibold uppercase tracking-[0.12em] !text-[#dcf2ff] hover:!border-[#7fd7ff]/36 hover:!bg-[linear-gradient(180deg,rgba(0,112,186,0.3)_0%,rgba(0,48,135,0.3)_100%)] disabled:!opacity-45";
const figmaMainStageClass = 'relative overflow-hidden rounded-[16px] border border-[#ff1654] bg-[#2c2c2c] shadow-[0_8px_24px_rgba(0,0,0,0.3)]';
const figmaPinkCardClass = 'rounded-[16px] border-[3px] border-black bg-[#ff1654] shadow-[0_6px_14px_rgba(0,0,0,0.24)]';
const figmaDarkInsetClass = 'rounded-[16px] border border-white/10 bg-[rgba(0,0,0,0.14)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
const figmaPinkActionButtonClass = '!h-12 !rounded-[16px] !border !border-white/40 !bg-[#ff1654] px-5 text-[13px] font-semibold uppercase tracking-[0.08em] !text-white shadow-[0_16px_36px_rgba(255,22,84,0.32)] hover:!bg-[#ff2b68] hover:shadow-[0_20px_42px_rgba(255,22,84,0.4)] disabled:!cursor-not-allowed disabled:!opacity-45';
const figmaSectionTitleClass = 'whitespace-nowrap text-[38px] uppercase leading-[0.92] text-white xl:text-[54px]';

function SectionRailIcon({
  icon: Icon,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}) {
  if (Icon) {
    return <Icon aria-hidden className={cn('h-6 w-6', className)} />;
  }

  return null;
}

function ProfileAccentTriangles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 123.871 185.808" fill="none" aria-hidden>
      <path d="M67.6638 91.1534L16.3949 143.246L57.2726 163.501L67.6638 91.1534Z" fill="#FF1654" />
      <path d="M79.1608 76.9574L106.566 56.8805L113.134 77.0428L79.1608 76.9574Z" fill="#FF1654" />
      <path d="M76.5381 54.3349L83.605 57.5917L75.1141 66.7206L76.5381 54.3349Z" stroke="#FF1654" />
      <path d="M34.1068 97.4588L29.8539 82.9532L54.0587 83.7324L34.1068 97.4588Z" stroke="#FF1654" />
      <path d="M65.4807 76.639L45.3878 17.5911L14.2866 41.0083L65.4807 76.639Z" fill="#FF1654" />
    </svg>
  );
}

function ProfileDesktopUnderline({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('relative overflow-hidden', className)}>
      <div
        className="absolute left-0 top-0 h-full w-[28px] bg-[#ff1654]"
        style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}
      />
      <div className="absolute left-[18px] right-0 top-[22%] h-[56%] rounded-r-[2px] bg-[#ff1654]" />
    </div>
  );
}

function EpicGamesMark({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-[18px] border border-black/10 bg-white text-[#121212] shadow-[0_10px_24px_rgba(0,0,0,0.18)]',
        className
      )}
    >
      <div
        className={cn('flex flex-col items-center leading-none', compact ? 'gap-0.5' : 'gap-1')}
        style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
      >
        <span className={cn('font-black tracking-[0.18em]', compact ? 'text-[9px]' : 'text-[30px]')}>EPIC</span>
        <span
          className={cn(
            'font-semibold tracking-[0.34em] text-black/74',
            compact ? 'text-[5px]' : 'text-[11px]'
          )}
        >
          GAMES
        </span>
      </div>
    </div>
  );
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
  const [connectingTwitter, setConnectingTwitter] = useState(false);
  const [showDisconnectTwitterDialog, setShowDisconnectTwitterDialog] = useState(false);
  const [disconnectingTwitter, setDisconnectingTwitter] = useState(false);
  const [connectingTwitch, setConnectingTwitch] = useState(false);
  const [showDisconnectTwitchDialog, setShowDisconnectTwitchDialog] = useState(false);
  const [disconnectingTwitch, setDisconnectingTwitch] = useState(false);
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
  const avatarUrl = getDiscordAvatarUrl(profile);
  const parsedWithdrawAmount = Number.parseFloat(withdrawAmount);
  const previewTotalDeduction =
    (Number.isFinite(parsedWithdrawAmount) && parsedWithdrawAmount > 0 ? parsedWithdrawAmount : MIN_PAYPAL_WITHDRAWAL) +
    PAYPAL_WITHDRAWAL_FEE;
  const remainingToUnlock = Math.max(0, minimumUnlockedBalance - walletBalance);
  const epicConnected = Boolean(profile.epic_username);
  const twitterConnected = Boolean(profile.twitter_username);
  const twitchConnected = Boolean(profile.twitch_username);
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

  const saveAccountPreferences = async (nextRegion: Region, nextPlatform: Platform) => {
    if (!user) {
      return;
    }

    setSavingProfile(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          preferred_region: nextRegion,
          preferred_platform: nextPlatform,
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

  const handleRegionSelect = async (value: Region) => {
    setPreferredRegion(value);
    await saveAccountPreferences(value, preferredPlatform);
  };

  const handlePlatformSelect = async (value: Platform) => {
    setPreferredPlatform(value);
    await saveAccountPreferences(preferredRegion, value);
  };

  const handleSaveUsername = async () => {
    const normalizedUsername = username.trim();

    if (!isVip) {
      toast({
        title: 'VIP required',
        description: 'Username changes are reserved for VIP members.',
        variant: 'destructive',
      });
      return;
    }

    if (normalizedUsername.length < 3 || normalizedUsername.length > 20) {
      setUsernameError('Username must be between 3 and 20 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(normalizedUsername)) {
      setUsernameError('Use only letters, numbers and underscores.');
      return;
    }

    setUsernameError('');
    setUsername(normalizedUsername);
    setSavingProfile(true);

    try {
      const result = await changeUsername(normalizedUsername);
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

  const handleConnectTwitter = async () => {
    setConnectingTwitter(true);
    try {
      await startTwitterAuth();
    } catch (error) {
      toast({
        title: 'X (Twitter) connection failed',
        description: error instanceof Error ? error.message : 'Unable to start X (Twitter) login.',
        variant: 'destructive',
      });
      setConnectingTwitter(false);
    }
  };

  const handleDisconnectTwitter = async () => {
    if (!user) return;
    setDisconnectingTwitter(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          twitter_account_id: null,
          twitter_username: null,
          twitter_linked_at: null,
        })
        .eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: 'X (Twitter) disconnected', description: 'Your X (Twitter) connection has been removed.' });
      setShowDisconnectTwitterDialog(false);
    } catch (error) {
      toast({
        title: 'Disconnect failed',
        description: error instanceof Error ? error.message : 'Unable to remove X (Twitter) details.',
        variant: 'destructive',
      });
    } finally {
      setDisconnectingTwitter(false);
    }
  };

  const handleConnectTwitch = async () => {
    setConnectingTwitch(true);
    try {
      await startTwitchAuth();
    } catch (error) {
      toast({
        title: 'Twitch connection failed',
        description: error instanceof Error ? error.message : 'Unable to start Twitch login.',
        variant: 'destructive',
      });
      setConnectingTwitch(false);
    }
  };

  const handleDisconnectTwitch = async () => {
    if (!user) return;
    setDisconnectingTwitch(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          twitch_account_id: null,
          twitch_username: null,
          twitch_linked_at: null,
        })
        .eq('user_id', user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: 'Twitch disconnected', description: 'Your Twitch connection has been removed.' });
      setShowDisconnectTwitchDialog(false);
    } catch (error) {
      toast({
        title: 'Disconnect failed',
        description: error instanceof Error ? error.message : 'Unable to remove Twitch details.',
        variant: 'destructive',
      });
    } finally {
      setDisconnectingTwitch(false);
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

  const handleCommitUsername = async () => {
    const currentUsername = profile?.username ?? '';

    if (!isVip || savingProfile || username.trim() === currentUsername) {
      return;
    }

    await handleSaveUsername();
  };

  const renderStageHeader = (icon: ReactNode, title: string, subtitle: string) => (
    <div className="space-y-2">
      <div className="flex items-center gap-4">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-white/12 bg-black/18">
          {icon}
        </span>
        <h2 className={figmaSectionTitleClass} style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}>
          {title}
        </h2>
      </div>
      <p className="max-w-[780px] text-[15px] leading-6 text-white/68 lg:pl-[68px]">{subtitle}</p>
    </div>
  );

  const renderAccountSection = () => (
    <section
      className={cn(
        figmaMainStageClass,
        'h-full bg-[linear-gradient(180deg,rgba(44,44,44,0.98)_0%,rgba(27,20,24,0.98)_100%)] text-white'
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[16px] bg-[radial-gradient(circle_at_top_right,rgba(255,22,84,0.16)_0%,transparent_42%)]"
      />
      <div className="relative flex h-full min-h-[360px] flex-col px-6 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-7 lg:min-h-[486px] lg:px-[34px] lg:pb-[42px] lg:pt-[34px]">
        {savingProfile && (
          <span className="absolute right-6 top-6 text-white/72 lg:right-8 lg:top-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </span>
        )}

        <div>
          <div className="flex items-center gap-3 lg:gap-4">
            <User aria-hidden className="h-9 w-9 text-white lg:h-[46px] lg:w-[46px]" />
            <h2
              className="text-[clamp(28px,3vw,48px)] uppercase leading-[0.92] text-white"
              style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
            >
              ACCOUNT SETTINGS
            </h2>
          </div>
          <p
            className="mt-2 text-[clamp(12px,1.3vw,20px)] leading-[1.2] text-white/88 lg:mt-1"
            style={{ fontFamily: "'Base_Neue_Trial-Regular', 'Base Neue Trial', sans-serif" }}
          >
            Update your display preferences and keep your profile ready.
          </p>
        </div>

        <div className="mt-8 lg:mt-[48px]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
            <div className="w-full lg:max-w-[434px]">
              <p
                className="mb-3 text-[18px] uppercase leading-none text-white"
                style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}
              >
                USERNAME
              </p>
              <input
                value={username}
                readOnly={!isVip}
                onChange={(event) => {
                  if (!isVip) {
                    return;
                  }

                  setUsername(event.target.value);
                  setUsernameError('');
                }}
                onBlur={() => {
                  void handleCommitUsername();
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') {
                    return;
                  }

                  event.preventDefault();
                  event.currentTarget.blur();
                }}
                aria-label="Username"
                className={cn(
                  'h-[53px] w-full rounded-[16px] border border-white/50 bg-[#ff1654] px-4 text-[18px] text-white shadow-[0_4px_8px_rgba(0,0,0,0.24)] outline-none transition placeholder:text-white/58 focus:border-white/70',
                  !isVip && 'cursor-default',
                )}
                style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}
              />
            </div>

            <div className="flex h-[47px] w-full max-w-[222px] items-center rounded-[16px] border border-white/50 bg-[#ffd700] px-4 shadow-[0_4px_8px_rgba(0,0,0,0.25)] lg:mb-[3px]">
              <Crown aria-hidden className="h-[22px] w-[28px] text-[#ff1654]" />
              <span
                className="ml-2 text-[24px] uppercase leading-none text-black"
                style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
              >
                VIP ONLY
              </span>
            </div>
          </div>
        </div>

        {usernameError && (
          <p className="mt-3 text-sm text-[#ffb2c6]">{usernameError}</p>
        )}

        <div className="mt-8 grid gap-5 lg:mt-[34px] lg:grid-cols-[297px_297px] lg:justify-between lg:gap-12">
          <div>
            <p
              className="mb-3 text-[18px] uppercase leading-none text-white"
              style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}
            >
              PREFERRED REGION
            </p>
            <Select value={preferredRegion} onValueChange={(value) => void handleRegionSelect(value as Region)} disabled={savingProfile}>
              <SelectTrigger
                className="relative h-[53px] rounded-[16px] border-white/50 bg-[#ff1654] px-4 pr-16 text-left text-[18px] text-white shadow-[0_4px_8px_rgba(0,0,0,0.24)] focus:border-white/70 focus:ring-0 [&>svg]:hidden"
                style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}
                aria-label="Preferred Region"
              >
                <SelectValue placeholder="Select region" />
                <ChevronDown
                  aria-hidden
                  className="pointer-events-none absolute right-[14px] top-1/2 h-5 w-5 -translate-y-1/2 text-white"
                  strokeWidth={2.4}
                />
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

          <div>
            <p
              className="mb-3 text-[18px] uppercase leading-none text-white"
              style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}
            >
              PREFERRED PLATFORM
            </p>
            <Select value={preferredPlatform} onValueChange={(value) => void handlePlatformSelect(value as Platform)} disabled={savingProfile}>
              <SelectTrigger
                className="relative h-[53px] rounded-[16px] border-white/50 bg-[#ff1654] px-4 pr-16 text-left text-[18px] text-white shadow-[0_4px_8px_rgba(0,0,0,0.24)] focus:border-white/70 focus:ring-0 [&>svg]:hidden"
                style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}
                aria-label="Preferred Platform"
              >
                <SelectValue placeholder="Select platform" />
                <ChevronDown
                  aria-hidden
                  className="pointer-events-none absolute right-[14px] top-1/2 h-5 w-5 -translate-y-1/2 text-white"
                  strokeWidth={2.4}
                />
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
    </section>
  );

  const renderGameSection = () => (
    <div className="space-y-5">
      {renderStageHeader(
        <Gamepad2 aria-hidden className="h-6 w-6 text-white" />,
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
          <EpicGamesMark className="h-[150px] w-full" />

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
        <Link2 aria-hidden className="h-6 w-6 text-white" />,
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
                    <AvatarImage src={avatarUrl || undefined} alt={discordDisplayName} />
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
                  <EpicGamesMark compact className="h-12 w-12 rounded-[10px] shadow-none" />
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

            <div className={cn(figmaDarkInsetClass, 'p-4')}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-black">
                    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold uppercase text-white">X (Twitter)</p>
                    <p className="text-sm text-white/60">{twitterConnected ? `@${profile.twitter_username}` : 'Not connected'}</p>
                  </div>
                </div>
                {twitterConnected ? (
                  <FigmaStatusBadge tone="green" icon={<Check className="h-4 w-4" />}>Ready</FigmaStatusBadge>
                ) : (
                  <Button type="button" onClick={handleConnectTwitter} disabled={connectingTwitter} className={profileSecondaryButtonClass}>
                    {connectingTwitter ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Connect
                  </Button>
                )}
              </div>
              {twitterConnected && (
                <Button type="button" onClick={() => setShowDisconnectTwitterDialog(true)} className={cn(profileDangerButtonClass, 'mt-3 w-full')}>
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              )}
            </div>

            <div className={cn(figmaDarkInsetClass, 'p-4')}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-[#9146FF]">
                    <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                  </span>
                  <div>
                    <p className="text-sm font-semibold uppercase text-white">Twitch</p>
                    <p className="text-sm text-white/60">{twitchConnected ? profile.twitch_username : 'Not connected'}</p>
                  </div>
                </div>
                {twitchConnected ? (
                  <FigmaStatusBadge tone="green" icon={<Check className="h-4 w-4" />}>Ready</FigmaStatusBadge>
                ) : (
                  <Button type="button" onClick={handleConnectTwitch} disabled={connectingTwitch} className={profileSecondaryButtonClass}>
                    {connectingTwitch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
                    Connect
                  </Button>
                )}
              </div>
              {twitchConnected && (
                <Button type="button" onClick={() => setShowDisconnectTwitchDialog(true)} className={cn(profileDangerButtonClass, 'mt-3 w-full')}>
                  <Unlink className="mr-2 h-4 w-4" />
                  Disconnect
                </Button>
              )}
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

  const renderIdentityCard = (_compact = false) => (
    <div className="relative mx-auto w-full max-w-[304px] overflow-hidden rounded-[16px] border border-[#ff1654] bg-[#282828] text-white shadow-[0_4px_10px_rgba(0,0,0,0.28)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,22,84,0.16)_0%,transparent_48%)]"
      />
      <div className="aspect-[304/116] w-full">
        <Avatar className="absolute left-[1.32%] top-[18.97%] h-[57.76%] w-[22.04%] rounded-full border border-white/8">
          <AvatarImage src={avatarUrl} alt={discordDisplayName} className="object-cover" />
          <AvatarFallback className="bg-black/30 text-white">{discordDisplayName.charAt(0)}</AvatarFallback>
        </Avatar>

        <div aria-hidden className="absolute left-[35.82%] right-[14.47%] top-[58.19%] h-px bg-white/60" />

        <p
          className="absolute left-[42.11%] right-[8.55%] top-[16.38%] truncate text-[clamp(20px,1.8vw,32px)] uppercase leading-none text-white"
          style={{ fontFamily: "'Base_Neue_Trial-WideBlack', 'Base Neue Trial', sans-serif" }}
        >
          {discordDisplayName}
        </p>
        <p
          className="absolute left-[29.28%] right-[7.9%] top-[73.28%] truncate text-[clamp(11px,0.82vw,16px)] text-white/82"
          style={{ fontFamily: "'Base_Neue_Trial-Regular', 'Base Neue Trial', sans-serif" }}
        >
          {profile.email}
        </p>
      </div>
    </div>
  );

  const renderSectionRail = () => {
    const desktopOffsets: Record<ProfileSection, string> = {
      account: 'top-[18px]',
      game: 'top-[107px]',
      payments: 'top-[201px]',
      connections: 'top-[275px]',
    };

    return (
      <>
        <div className="relative hidden h-[357px] w-[300px] rounded-[16px] border border-[#ff1654] bg-[#282828] shadow-[0_4px_10px_rgba(0,0,0,0.28)] lg:block">
          <nav className="relative h-full w-full">
            {sections.map((section) => {
              const isActive = activeSection === section.id;

              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  aria-label={section.label}
                  className={cn(
                    'absolute left-[25px] flex h-[47px] w-[222px] items-center rounded-[16px] border border-white/50 bg-[#ff1654] px-4 text-left text-white shadow-[0_4px_8px_rgba(0,0,0,0.25)] transition',
                    desktopOffsets[section.id],
                    isActive
                      ? 'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_18px_rgba(255,22,84,0.24)]'
                      : 'hover:brightness-110'
                  )}
                >
                  {section.railLabel ? (
                    <>
                      <SectionRailIcon icon={section.icon} className="h-5 w-5" />
                      <span
                        className={cn(
                          section.icon ? 'ml-2' : '',
                          'truncate text-[18px] uppercase leading-none',
                          section.id === 'connections' && 'text-[17px]',
                        )}
                        style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}
                      >
                        {section.railLabel}
                      </span>
                    </>
                  ) : (
                    <span className="sr-only">{section.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="grid gap-3 lg:hidden">
          {sections.map((section) => {
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                aria-label={section.label}
                className={cn(
                  'flex h-[47px] items-center rounded-[16px] border border-white/50 bg-[#ff1654] px-4 text-left text-white shadow-[0_4px_8px_rgba(0,0,0,0.25)] transition',
                  isActive && 'shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_10px_18px_rgba(255,22,84,0.24)]'
                )}
                >
                  {section.railLabel ? (
                    <>
                      <SectionRailIcon icon={section.icon} className="h-5 w-5" />
                      <span
                        className={cn(
                          section.icon ? 'ml-2' : '',
                          'truncate text-[18px] uppercase leading-none',
                          section.id === 'connections' && 'text-[16px]',
                        )}
                      style={{ fontFamily: "'Base_Neue_Trial-Expanded', 'Base Neue Trial', sans-serif" }}
                    >
                      {section.railLabel}
                    </span>
                  </>
                ) : (
                  <span className="sr-only">{section.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </>
    );
  };

  const activeSectionContent =
    activeSection === 'game'
      ? renderGameSection()
      : activeSection === 'payments'
        ? renderPaymentsSection()
        : renderConnectionsSection();

  if (loading) {
    return <LoadingPage />;
  }

  if (!user || !profile) {
    return null;
  }

  return (
    <div className={cn('w-full text-white', mode === 'page' ? 'mx-auto max-w-[1950px]' : 'w-full')}>
      <div className="hidden lg:block">
        <div
          className="relative mx-auto aspect-[1920/809]"
          style={{ width: 'min(1920px, 100vw, calc((100vh - 146px) * 1920 / 809))' }}
        >
          {(mode === 'overlay' || onClose) && (
            <div className="absolute right-[3.4%] top-[7.2%] z-20 flex items-center gap-2">
              {mode === 'overlay' && (
                <Button type="button" className={profileGhostButtonClass} onClick={handleOpenProfilePage}>
                  Open Page
                </Button>
              )}
              {mode === 'overlay' && (
                <Button type="button" className={profileGhostButtonClass} onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign Out
                </Button>
              )}
              {onClose && (
                <Button type="button" className={profileGhostButtonClass} onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          )}

          <div className="absolute left-[9.79%] top-0 z-10 h-[25.74%] w-[65.57%]">
            <div className="relative h-full w-full">
              <ProfileAccentTriangles className="pointer-events-none absolute left-0 top-0 h-[89.25%] w-[9.84%]" />
              <h1
                className="absolute left-[6.52%] top-[39.39%] whitespace-nowrap text-[clamp(48px,4.15vw,80px)] uppercase leading-[0.92] text-white"
                style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
              >
                PROFILE SETTINGS
              </h1>

              <div className="absolute left-[4.71%] top-[78.87%] flex h-[21.15%] w-[95.29%] items-center">
                <ProfileDesktopUnderline className="h-[18px] w-full" />
              </div>
            </div>
          </div>

          <div className="absolute left-[12.55%] top-[29.30%] h-[14.34%] w-[15.83%]">
            {renderIdentityCard(true)}
          </div>

          <div className="absolute left-[12.76%] top-[45%] h-[44.13%] w-[15.63%]">
            {renderSectionRail()}
          </div>

          <div className="absolute left-[30.43%] top-[28.95%] h-[60.78%] w-[55.55%] max-w-[1068px]">
            {activeSection === 'account' ? (
              renderAccountSection()
            ) : (
              <section className={cn(figmaMainStageClass, 'h-full overflow-hidden')}>
                <div className="h-full min-h-0 overflow-y-auto px-[4.2%] py-[4.4%]">{activeSectionContent}</div>
              </section>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5 lg:hidden">
        <div className="relative pl-[62px] pt-2">
          <ProfileAccentTriangles className="pointer-events-none absolute left-0 top-0 h-[102px] w-[70px]" />
          <h1
            className="mt-1 whitespace-nowrap text-[46px] uppercase leading-[0.92] text-white sm:text-[58px]"
            style={{ fontFamily: "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif" }}
          >
            PROFILE SETTINGS
          </h1>
          <div aria-hidden className="mt-3 h-[14px] w-[260px] rounded-[2px] bg-[#ff1654] sm:w-[360px]" />
        </div>

        <div className="space-y-4">
          {renderIdentityCard(true)}
          {renderSectionRail()}
          {activeSection === 'account' ? (
            renderAccountSection()
          ) : (
            <section className={cn(figmaMainStageClass, 'min-h-0 overflow-hidden')}>
              <div className="h-full min-h-0 overflow-y-auto px-4 py-4">{activeSectionContent}</div>
            </section>
          )}
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

      <AlertDialog open={showDisconnectTwitterDialog} onOpenChange={setShowDisconnectTwitterDialog}>
        <AlertDialogContent className={profileDialogContentClass}>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect X (Twitter)?</AlertDialogTitle>
            <AlertDialogDescription>
              Your X (Twitter) account will be unlinked from your OBT profile. You can reconnect it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={profileGhostButtonClass} disabled={disconnectingTwitter}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className={profileDangerButtonClass} onClick={handleDisconnectTwitter} disabled={disconnectingTwitter}>
              {disconnectingTwitter ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDisconnectTwitchDialog} onOpenChange={setShowDisconnectTwitchDialog}>
        <AlertDialogContent className={profileDialogContentClass}>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect Twitch?</AlertDialogTitle>
            <AlertDialogDescription>
              Your Twitch account will be unlinked from your OBT profile. You can reconnect it at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={profileGhostButtonClass} disabled={disconnectingTwitch}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction className={profileDangerButtonClass} onClick={handleDisconnectTwitch} disabled={disconnectingTwitch}>
              {disconnectingTwitch ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
