import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Users, Trophy, MapPin, Monitor, Crosshair, Target, Lock, Coins, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Switch } from '@/components/ui/switch';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { EpicUsernameWarning } from '@/components/common/EpicUsernameWarning';
import { TeamSelector } from '@/components/teams/TeamSelector';
import { PaymentModeSelector } from '@/components/teams/PaymentModeSelector';
import { PageTransition, FadeIn } from '@/components/ui/motion';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { REGIONS, PLATFORMS, GAME_MODES, FIRST_TO_OPTIONS, ENTRY_FEE_PRESETS, TEAM_SIZES, type Region, type Platform, type GameMode, type PaymentMode, type Team, type TeamMember, type Profile, type TeamMemberWithBalance } from '@/types';
import { cn } from '@/lib/utils';

interface SelectedTeam extends Team {
  members: (TeamMember & { profile: Profile })[];
  memberBalances?: TeamMemberWithBalance[];
  acceptedMemberCount: number;
}

export default function CreateMatch() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile, wallet, isProfileComplete, refreshWallet } = useAuth();

  const [isPrivate, setIsPrivate] = useState(false);
  const [entryFee, setEntryFee] = useState<number>(1);
  const [customFee, setCustomFee] = useState('');
  const [region, setRegion] = useState<Region>('EU');
  const [platform, setPlatform] = useState<Platform>('All');
  const [mode, setMode] = useState<GameMode>('Box Fight');
  const [teamSize, setTeamSize] = useState(1);
  const [firstTo, setFirstTo] = useState(3);
  const [creating, setCreating] = useState(false);
  
  const [selectedTeam, setSelectedTeam] = useState<SelectedTeam | null>(null);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cover');

  const actualFee = customFee ? parseFloat(customFee) : entryFee;
  const isTeamMatch = teamSize > 1;
  const totalCost = isTeamMatch ? actualFee * teamSize : actualFee;
  
  const canAffordSolo = wallet && wallet.balance >= actualFee;
  const canAffordCover = wallet && wallet.balance >= totalCost;
  
  const canAffordSplit = selectedTeam?.memberBalances?.every(m => m.balance >= actualFee) ?? false;
  
  const canAfford = isTeamMatch 
    ? (paymentMode === 'cover' ? canAffordCover : canAffordSplit)
    : canAffordSolo;
    
  const canCreate = isTeamMatch ? (selectedTeam !== null && canAfford) : canAfford;

  if (!user) {
    return (
      <MainLayout showChat={false}>
        <PageTransition>
          <div className="max-w-md mx-auto text-center py-16">
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-10">
              <div className="mx-auto mb-6 w-14 h-14 rounded-2xl bg-[#1e1e1e] flex items-center justify-center">
                <Lock className="w-6 h-6 text-gray-500" />
              </div>
              <h1 className="text-xl font-bold mb-3">
                Sign in required
              </h1>
              <p className="text-sm text-gray-400 mb-6">
                You need to be signed in to create a match.
              </p>
              <Link to="/auth" className="btn-premium inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-xl">
                Sign In
              </Link>
            </div>
          </div>
        </PageTransition>
      </MainLayout>
    );
  }

  const handleCreate = async () => {
    if (!isProfileComplete) {
      toast({
        title: 'Complete your profile',
        description: 'Add your Epic Games Username before creating matches.',
        variant: 'destructive',
      });
      return;
    }

    if (!canCreate) {
      toast({
        title: 'Cannot create match',
        description: isTeamMatch && !selectedTeam 
          ? 'Please select a team first.'
          : 'Insufficient balance.',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);

    try {
      if (isTeamMatch && selectedTeam) {
        const { data, error } = await supabase.rpc('create_team_match', {
          p_team_id: selectedTeam.id,
          p_entry_fee: actualFee,
          p_region: region,
          p_platform: platform,
          p_mode: mode,
          p_team_size: teamSize,
          p_first_to: firstTo,
          p_payment_mode: paymentMode,
          p_is_private: isPrivate,
        });

        if (error) throw error;

        const result = data as { success: boolean; error?: string; match_id?: string } | null;
        if (result && !result.success) {
          throw new Error(result.error);
        }

        await refreshWallet();

        toast({
          title: 'Match created!',
          description: 'Your team match is now live.',
        });

        navigate(`/matches/${result?.match_id}`);
      } else {
        const { data, error } = await supabase.rpc('create_match_1v1', {
          p_entry_fee: actualFee,
          p_region: region,
          p_platform: platform,
          p_mode: mode,
          p_first_to: firstTo,
          p_is_private: isPrivate,
        });

        if (error) throw error;

        const result = data as { success: boolean; error?: string; match_id?: string } | null;
        if (result && !result.success) {
          throw new Error(result.error);
        }

        await refreshWallet();

        toast({
          title: 'Match created!',
          description: 'Your match is now live.',
        });

        navigate(`/matches/${result?.match_id}`);
      }
    } catch (error: unknown) {
      console.error('Match creation error:', error);
      
      let errorMessage = 'Failed to create match. Please try again.';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String((error as { message: unknown }).message);
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleTeamSizeChange = (size: number) => {
    setTeamSize(size);
    setSelectedTeam(null);
    if (size === 1) {
      setPaymentMode('cover');
    }
  };

  return (
    <MainLayout showChat={false}>
      <PageTransition>
        <div className="space-y-6 max-w-[640px] mx-auto">
          <FadeIn>
            <Link
              to="/matches"
              className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Matches
            </Link>
          </FadeIn>

          {!isProfileComplete && (
            <FadeIn delay={0.05}>
              <EpicUsernameWarning />
            </FadeIn>
          )}

          <FadeIn delay={0.1}>
            <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#1f2937]">
                <h1 className="text-[36px] font-bold tracking-[0.9px]">CREATE MATCH</h1>
                <p className="text-sm text-gray-400 mt-1">Set up your match parameters</p>
              </div>

              <div className="p-6 space-y-7">

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
                    <Coins className="w-4 h-4 text-[#FFC805]" />
                    Entry Fee (per player)
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {ENTRY_FEE_PRESETS.map((fee) => (
                      <button
                        key={fee}
                        type="button"
                        onClick={() => { setEntryFee(fee); setCustomFee(''); }}
                        className={cn(
                          "h-11 font-mono font-bold text-sm rounded-xl border transition-all",
                          entryFee === fee && !customFee
                            ? "bg-[#FFC805] border-[#FFC805] text-black"
                            : "bg-[#1e1e1e] border-[#374151] text-gray-400 hover:border-[#FFC805] hover:text-[#FFC805]"
                        )}
                      >
                        {fee}
                      </button>
                    ))}
                  </div>
                  <input
                    type="number"
                    placeholder="Custom amount"
                    value={customFee}
                    onChange={(e) => setCustomFee(e.target.value)}
                    min={0.5}
                    step={0.5}
                    className="w-full px-4 py-2.5 text-sm font-mono bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white placeholder-gray-500"
                  />
                </div>

                <div className="h-px bg-[#1f2937]" />

                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
                    <Users className="w-4 h-4 text-teal-400" />
                    Match Size
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {TEAM_SIZES.map((ts) => (
                      <button
                        key={ts.value}
                        type="button"
                        onClick={() => handleTeamSizeChange(ts.value)}
                        className={cn(
                          "h-12 font-semibold text-sm rounded-xl border transition-all",
                          teamSize === ts.value
                            ? "bg-[#FFC805] border-[#FFC805] text-black"
                            : "bg-[#1e1e1e] border-[#374151] text-gray-400 hover:border-[#FFC805]"
                        )}
                      >
                        {ts.label}
                      </button>
                    ))}
                  </div>
                </div>

                {isTeamMatch && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
                      <Users className="w-4 h-4 text-teal-400" />
                      Select Your Team
                    </label>
                    <TeamSelector
                      teamSize={teamSize}
                      entryFee={actualFee}
                      selectedTeamId={selectedTeam?.id ?? null}
                      onSelectTeam={(team) => setSelectedTeam(team as SelectedTeam | null)}
                      paymentMode={paymentMode}
                    />
                  </motion.div>
                )}

                {isTeamMatch && selectedTeam && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3"
                  >
                    <label className="text-sm font-medium text-gray-400">Payment Mode</label>
                    <PaymentModeSelector
                      paymentMode={paymentMode}
                      onChangePaymentMode={setPaymentMode}
                      entryFee={actualFee}
                      teamSize={teamSize}
                      memberBalances={selectedTeam.memberBalances}
                      userBalance={wallet?.balance ?? 0}
                    />
                  </motion.div>
                )}

                <div className="h-px bg-[#1f2937]" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
                      <MapPin className="w-4 h-4 opacity-60" />
                      Region
                    </label>
                    <select
                      value={region}
                      onChange={(e) => setRegion(e.target.value as Region)}
                      className="w-full px-3 py-2.5 text-sm bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
                    >
                      {REGIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
                      <Monitor className="w-4 h-4 opacity-60" />
                      Platform
                    </label>
                    <select
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as Platform)}
                      className="w-full px-3 py-2.5 text-sm bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
                      <Crosshair className="w-4 h-4 opacity-60" />
                      Game Mode
                    </label>
                    <select
                      value={mode}
                      onChange={(e) => setMode(e.target.value as GameMode)}
                      className="w-full px-3 py-2.5 text-sm bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
                    >
                      {GAME_MODES.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-400">
                      <Target className="w-4 h-4 opacity-60" />
                      First to (wins)
                    </label>
                    <select
                      value={String(firstTo)}
                      onChange={(e) => setFirstTo(parseInt(e.target.value))}
                      className="w-full px-3 py-2.5 text-sm bg-[#1e1e1e] border border-[#374151] rounded-[12px] focus:border-[#FFC805] focus:outline-none transition-colors text-white"
                    >
                      {FIRST_TO_OPTIONS.map((n) => (
                        <option key={n} value={String(n)}>First to {n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="h-px bg-[#1f2937]" />

                <div className="bg-[#1e1e1e] border border-[#374151] rounded-[16px] p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-gray-400" />
                    <div>
                      <span className="text-sm font-medium">Private Match</span>
                      <p className="text-xs text-gray-500">Only people with the link can join</p>
                    </div>
                  </div>
                  <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
                </div>

                <div className="bg-[#121212] border border-[#FFC805] rounded-[16px] p-5 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-[#FFC805]" />
                    <span className="text-sm font-semibold text-[#FFC805]">
                      Match Summary
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Entry Fee (per player)</span>
                    <span className="font-mono font-bold text-[#FFC805]">
                      <CoinDisplay amount={actualFee} />
                    </span>
                  </div>
                  {isTeamMatch && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-400">Team Cost ({teamSize} players)</span>
                      <span className="font-mono font-bold">
                        <CoinDisplay amount={totalCost} />
                      </span>
                    </div>
                  )}
                  {isTeamMatch && selectedTeam && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-400">Payment</span>
                      <span>{paymentMode === 'cover' ? 'You pay all' : 'Split between members'}</span>
                    </div>
                  )}
                  <div className="h-px bg-[#1f2937]" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Total Prize Pool</span>
                    <span className="font-mono font-bold text-[#FFC805] text-lg">
                      <CoinDisplay amount={totalCost * 2 * 0.95} />
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Platform Fee (5%)</span>
                    <span className="font-mono text-gray-500">
                      <CoinDisplay amount={totalCost * 2 * 0.05} />
                    </span>
                  </div>
                </div>

                {!canCreate && (
                  <div className="p-4 rounded-[16px] border border-red-500/30 bg-red-500/5 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                    <span className="text-sm text-red-500">
                      {isTeamMatch && !selectedTeam 
                        ? 'Select a team to continue'
                        : `Insufficient balance. ${paymentMode === 'cover' ? `You need ${totalCost} Coins.` : 'Some team members need more Coins.'}`}
                      {' '}
                      <Link to="/buy" className="underline font-semibold text-teal-400 hover:opacity-80">Buy Coins</Link>
                    </span>
                  </div>
                )}

                <button
                  className={cn(
                    "w-full h-[56px] text-base btn-premium font-semibold rounded-xl inline-flex items-center justify-center gap-2",
                    (creating || !canCreate || !isProfileComplete) && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={handleCreate}
                  disabled={creating || !canCreate || !isProfileComplete}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'CREATE MATCH'
                  )}
                </button>
              </div>
            </div>
          </FadeIn>
        </div>
      </PageTransition>
    </MainLayout>
  );
}
