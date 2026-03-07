import { useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useChallenges } from '@/hooks/useChallenges';
import { useAvatarShop } from '@/hooks/useAvatarShop';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';
import { ChallengeCountdown } from '@/components/challenges/ChallengeCountdown';
import { AvatarGrid } from '@/components/avatars/AvatarGrid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Zap, Calendar, Star, ShoppingBag, Sparkles, ArrowRight, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Challenges() {
  const { user, loading: authLoading } = useAuth();
  const {
    dailyChallenges,
    weeklyChallenges,
    userXp,
    isLoading,
    claimChallenge,
    isClaiming,
    getResetTimes,
  } = useChallenges();

  const {
    avatars,
    isLoading: avatarsLoading,
    purchaseAvatar,
    equipAvatar,
    isPurchasing,
    isEquipping,
  } = useAvatarShop();

  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'shop'>('daily');

  const resetTimes = useMemo(() => getResetTimes(), [getResetTimes]);

  const dailyCompleted = dailyChallenges.filter((c) => c.is_claimed).length;
  const weeklyCompleted = weeklyChallenges.filter((c) => c.is_claimed).length;
  const dailyTotal = dailyChallenges.length;
  const weeklyTotal = weeklyChallenges.length;
  const ownedAvatarsCount = avatars.filter((a) => a.is_owned).length;
  const canAffordAvatar = userXp >= 500;
  const xpNeeded = Math.max(0, 500 - userXp);

  if (!authLoading && !user) {
    return <Navigate to="/auth?next=/challenges" replace />;
  }

  return (
    <MainLayout>
      <div className="pb-8 space-y-8 max-w-4xl mx-auto py-4 lg:py-8">

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-[36px] font-bold uppercase tracking-tight">
              CHALLENGES
            </h1>
            <div className="flex items-center gap-4 mt-3">
              <ChallengeCountdown
                targetDate={resetTimes.dailyReset}
                label="Daily reset"
              />
              <ChallengeCountdown
                targetDate={resetTimes.weeklyReset}
                label="Weekly reset"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#121212] border border-[#1f2937]">
            <Sparkles className="w-4 h-4 text-[#FFC805]" />
            <span className="font-mono text-lg font-bold text-[#FFC805]">
              {userXp.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">XP</span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className={cn(
            "bg-[#121212] border border-[#1f2937] rounded-[16px] p-5 overflow-hidden",
            canAffordAvatar && "border-[#FFC805]/30"
          )}
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex -space-x-3">
                {avatars.slice(0, 3).map((avatar, i) => (
                  <div
                    key={avatar.id}
                    className="w-11 h-11 rounded-xl overflow-hidden border-2 border-[#0a0a0a]"
                    style={{ zIndex: 3 - i }}
                  >
                    <img
                      src={avatar.image_url}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ))}
                {avatars.length > 3 && (
                  <div className="w-11 h-11 rounded-xl bg-[#1e1e1e] border-2 border-[#0a0a0a] flex items-center justify-center text-xs font-mono font-bold">
                    +{avatars.length - 3}
                  </div>
                )}
              </div>

              <div>
                <h2 className="font-semibold text-sm flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#FFC805]" />
                  Avatar Shop
                </h2>
                <p className="text-sm text-muted-foreground">
                  {canAffordAvatar ? (
                    <span className="text-green-500 font-medium">You have enough XP for a new avatar!</span>
                  ) : (
                    <>You need <span className="text-[#FFC805] font-mono font-semibold">{xpNeeded} XP</span> more</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono text-xs px-3 py-1.5 rounded-full bg-[#1e1e1e] border border-[#1f2937] text-muted-foreground">
                {ownedAvatarsCount}/{avatars.length + 1}
              </span>
              <Button
                onClick={() => setActiveTab('shop')}
                className={cn(
                  "btn-premium h-9 px-5 text-sm",
                  canAffordAvatar && "animate-pulse"
                )}
              >
                Open Shop
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'daily' | 'weekly' | 'shop')}
            className="space-y-6"
          >
            <TabsList className="grid w-full max-w-lg grid-cols-3 mx-auto bg-[#121212] border border-[#1f2937] p-1 rounded-xl">
              <TabsTrigger value="daily" className="gap-2 rounded-lg text-xs font-medium data-[state=active]:bg-[#1e1e1e] data-[state=active]:text-[#FFC805]">
                <Calendar className="w-4 h-4" />
                Daily
                <Badge
                  variant="secondary"
                  className={cn(
                    'ml-1 text-[10px] font-mono px-1.5',
                    dailyCompleted === dailyTotal && dailyTotal > 0 && 'bg-[#FFC805]/15 text-[#FFC805]'
                  )}
                >
                  {dailyCompleted}/{dailyTotal}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="weekly" className="gap-2 rounded-lg text-xs font-medium data-[state=active]:bg-[#1e1e1e] data-[state=active]:text-[#FFC805]">
                <Star className="w-4 h-4" />
                Weekly
                <Badge
                  variant="secondary"
                  className={cn(
                    'ml-1 text-[10px] font-mono px-1.5',
                    weeklyCompleted === weeklyTotal && weeklyTotal > 0 && 'bg-[#FFC805]/15 text-[#FFC805]'
                  )}
                >
                  {weeklyCompleted}/{weeklyTotal}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="shop"
                className={cn(
                  "gap-2 rounded-lg text-xs font-medium data-[state=active]:bg-[#1e1e1e] data-[state=active]:text-[#FFC805]",
                  canAffordAvatar && "ring-1 ring-[#FFC805]/30"
                )}
              >
                <ShoppingBag className="w-4 h-4" />
                Shop
                {canAffordAvatar && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFC805]" />
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="daily" className="mt-6">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-44 skeleton-premium rounded-2xl" />
                  ))}
                </div>
              ) : dailyChallenges.length === 0 ? (
                <EmptyState type="daily" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {dailyChallenges.map((challenge, index) => (
                    <motion.div
                      key={challenge.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05, duration: 0.4 }}
                    >
                      <ChallengeCard
                        challenge={challenge}
                        onClaim={claimChallenge}
                        isClaiming={isClaiming}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="weekly" className="mt-6">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-44 skeleton-premium rounded-2xl" />
                  ))}
                </div>
              ) : weeklyChallenges.length === 0 ? (
                <EmptyState type="weekly" />
              ) : (
                <>
                  <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] mb-4 overflow-hidden">
                    <div className="p-4 flex items-center gap-2 text-sm">
                      <Zap className="w-4 h-4 text-[#FFC805]" />
                      <span className="font-semibold text-[#FFC805] text-xs">Weekly Coin Cap:</span>
                      <span className="text-muted-foreground">
                        Max 1 Coin per week. Complete all for XP bonus!
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {weeklyChallenges.map((challenge, index) => (
                      <motion.div
                        key={challenge.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05, duration: 0.4 }}
                      >
                        <ChallengeCard
                          challenge={challenge}
                          onClaim={claimChallenge}
                          isClaiming={isClaiming}
                        />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="shop" className="mt-6">
              <div className="bg-[#121212] border border-[#FFC805]/20 rounded-[16px] mb-4 overflow-hidden">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <ShoppingBag className="w-4 h-4 text-[#FFC805]" />
                    <span className="font-semibold text-[#FFC805] text-xs">Avatar Shop:</span>
                    <span className="text-muted-foreground">
                      Use XP to unlock new avatars.
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-sm px-3 py-1 rounded-full bg-[#1e1e1e] border border-[#1f2937]">
                    <Sparkles className="w-3 h-3 text-[#FFC805]" />
                    <span className="text-[#FFC805] font-bold">{userXp.toLocaleString()}</span>
                    <span className="text-muted-foreground text-xs">XP</span>
                  </div>
                </div>
              </div>

              <AvatarGrid
                avatars={avatars}
                userXp={userXp}
                onPurchase={purchaseAvatar}
                onEquip={equipAvatar}
                isPurchasing={isPurchasing}
                isEquipping={isEquipping}
                isLoading={avatarsLoading}
              />

              <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] mt-6 overflow-hidden">
                <div className="p-5 text-center">
                  <p className="text-sm text-muted-foreground mb-3">
                    Manage your purchased avatars from your profile
                  </p>
                  <Button variant="outline" size="sm" asChild className="btn-premium-secondary h-9 px-5 text-sm">
                    <Link to="/profile">
                      Go to Profile
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </MainLayout>
  );
}

function EmptyState({ type }: { type: 'daily' | 'weekly' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-center py-16 px-4"
    >
      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#121212] border border-[#1f2937] flex items-center justify-center">
        <Trophy className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-bold text-lg">No {type} challenges</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Check back later for new challenges
      </p>
    </motion.div>
  );
}
