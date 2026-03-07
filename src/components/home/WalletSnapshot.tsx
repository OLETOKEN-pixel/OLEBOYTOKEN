import { Link } from 'react-router-dom';
import { Wallet, ArrowRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { useAuth } from '@/contexts/AuthContext';

export function WalletSnapshot() {
  const { user, wallet } = useAuth();

  if (!user) {
    return (
      <div className="hud-panel">
        <div className="py-4 px-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wider">
            <Wallet className="w-5 h-5 neon-text-gold" />
            Wallet
          </div>
        </div>
        <div className="px-5 py-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center bg-accent/10 border border-accent/20">
              <Wallet className="w-5 h-5 text-accent/60" />
            </div>
            <p className="text-sm text-muted-foreground mb-3" style={{ fontFamily: "'Rajdhani', sans-serif" }}>
              Sign in to track your balance
            </p>
            <Link to="/auth" className="btn-arena-secondary px-6 py-2 text-xs no-underline inline-block">
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const available = wallet?.balance ?? 0;
  const locked = wallet?.locked_balance ?? 0;
  const total = available + locked;

  return (
    <div className="hud-panel">
      <div className="py-4 px-5 border-b border-white/[0.06]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 font-display text-base font-bold uppercase tracking-wider">
            <Wallet className="w-5 h-5 neon-text-gold" />
            Wallet
          </span>
          <Link
            to="/wallet"
            className="flex items-center gap-1 text-xs font-display uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors group"
          >
            Manage
            <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-3 gap-2">
          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="p-3 text-center bg-emerald-500/[0.06] border border-emerald-500/20 hover:border-emerald-500/40 transition-all"
          >
            <CoinDisplay amount={available} size="sm" />
            <p className="text-xs text-muted-foreground mt-1.5 font-display uppercase tracking-wider">Available</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="p-3 text-center bg-yellow-500/[0.06] border border-yellow-500/20 transition-all"
          >
            <div className="flex items-center justify-center gap-1">
              <CoinDisplay amount={locked} size="sm" />
              {locked > 0 && <Lock className="w-3 h-3 text-warning" />}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 font-display uppercase tracking-wider">Locked</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.03 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="p-3 text-center bg-primary/[0.06] border border-primary/20 hover:border-primary/40 transition-all"
          >
            <CoinDisplay amount={total} size="sm" />
            <p className="text-xs text-muted-foreground mt-1.5 font-display uppercase tracking-wider">Total</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
