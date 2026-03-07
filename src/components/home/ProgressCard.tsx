import { Link } from 'react-router-dom';
import { Sparkles, ShoppingBag, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useChallenges } from '@/hooks/useChallenges';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function ProgressCard() {
  const { user } = useAuth();
  const { userXp, isLoading } = useChallenges();
  
  const nextAvatarCost = 500;
  const progress = Math.min((userXp / nextAvatarCost) * 100, 100);
  const xpNeeded = Math.max(0, nextAvatarCost - userXp);
  const canAfford = userXp >= nextAvatarCost;

  if (!user) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="hud-panel p-5"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 flex items-center justify-center bg-primary/10 border border-primary/20">
              <Sparkles className="w-5 h-5 neon-text-cyan" />
            </div>
            <div>
              <p className="font-display text-sm font-bold uppercase tracking-wider">Complete Challenges</p>
              <p className="text-xs text-muted-foreground" style={{ fontFamily: "'Rajdhani', sans-serif" }}>Earn XP and unlock avatars</p>
            </div>
          </div>
          <Link to="/auth?next=/challenges" className="btn-arena-secondary px-4 py-2 text-xs no-underline">
            Sign In
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
      className={cn(
        "hud-panel p-5 transition-all duration-300",
        canAfford && "border-accent/30"
      )}
      style={canAfford ? { boxShadow: '0 0 30px rgba(255,184,0,0.15)' } : undefined}
    >
      <div className="flex items-center gap-4 lg:gap-5">
        <div className="flex-shrink-0">
          <div className={cn(
            "w-14 h-14 flex items-center justify-center border-2 transition-all",
            canAfford
              ? "bg-accent/20 border-accent/50 animate-pulse-soft"
              : "bg-accent/10 border-accent/30"
          )}
          style={canAfford ? { boxShadow: '0 0 15px rgba(255,184,0,0.2)' } : undefined}
          >
            <span className={cn(
              "text-lg font-bold font-mono",
              canAfford ? "neon-text-gold" : "text-accent/80"
            )}>
              {isLoading ? '...' : userXp}
            </span>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1 font-display uppercase tracking-wider">XP</p>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-display font-bold uppercase tracking-wider">Your Progress</p>
            <span className="text-xs font-mono">
              {canAfford ? (
                <span className="text-success font-medium flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Avatar available!
                </span>
              ) : (
                <span className="text-muted-foreground">{xpNeeded} XP to go</span>
              )}
            </span>
          </div>
          <div className="relative h-2.5 bg-white/[0.06] overflow-hidden" style={{ clipPath: 'polygon(0 0, calc(100% - 4px) 0, 100% 4px, 100% 100%, 4px 100%, 0 calc(100% - 4px))' }}>
            <div
              className="h-full transition-all duration-700 ease-out"
              style={{
                width: `${progress}%`,
                background: canAfford
                  ? 'linear-gradient(90deg, hsl(45 100% 55%), hsl(38 100% 46%))'
                  : 'linear-gradient(90deg, hsl(186 100% 50%), hsl(186 100% 42%))',
                boxShadow: canAfford
                  ? '0 0 10px hsl(45 100% 55% / 0.4)'
                  : '0 0 10px hsl(186 100% 50% / 0.3)',
              }}
            />
            {canAfford && (
              <div className="absolute inset-0 bg-accent/20 animate-pulse" />
            )}
          </div>
        </div>

        <Link
          to="/challenges"
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-xs no-underline",
            canAfford ? "btn-arena-gold" : "btn-arena-secondary"
          )}
        >
          <ShoppingBag className="w-4 h-4" />
          <span className="hidden sm:inline">Shop</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.div>
  );
}
