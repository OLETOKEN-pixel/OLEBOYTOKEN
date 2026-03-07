import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Sparkles, Users, Wallet, Star, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useChallenges } from '@/hooks/useChallenges';

const quickLinks = [
  { icon: Trophy, title: 'Leaderboard', desc: 'Top players', href: '/leaderboard', accent: '#FFC805' },
  { icon: Sparkles, title: 'Challenges', desc: 'Earn XP', href: '/challenges', accent: '#5BA3A3' },
  { icon: Star, title: 'Highlights', desc: 'Best plays', href: '/highlights', accent: '#FFC805' },
  { icon: Users, title: 'Teams', desc: 'Squad up', href: '/teams', accent: '#5BA3A3' },
  { icon: Wallet, title: 'Wallet', desc: 'Your balance', href: '/wallet', accent: '#FFC805' },
];

export function HighlightsCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user, wallet } = useAuth();
  const { userXp } = useChallenges();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="flex-shrink-0"
    >
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide pb-1"
        style={{ scrollSnapType: 'x mandatory', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
      >
        {user && (
          <Link
            to="/wallet"
            className="flex-shrink-0 w-[170px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 no-underline transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]"
            style={{ scrollSnapAlign: 'start' }}
          >
            <Wallet className="w-5 h-5 text-[#FFC805]/60 mb-3" />
            <p className="text-lg font-bold text-white font-mono">{wallet?.balance ?? 0}</p>
            <p className="text-xs text-white/30 mt-0.5">Available coins</p>
          </Link>
        )}

        {user && (
          <Link
            to="/challenges"
            className="flex-shrink-0 w-[170px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 no-underline transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]"
            style={{ scrollSnapAlign: 'start' }}
          >
            <Sparkles className="w-5 h-5 text-[#5BA3A3]/60 mb-3" />
            <p className="text-lg font-bold text-white font-mono">{userXp} XP</p>
            <p className="text-xs text-white/30 mt-0.5">Your progress</p>
          </Link>
        )}

        {quickLinks.map(({ icon: Icon, title, desc, href, accent }, index) => (
          <Link
            key={title}
            to={href}
            className="flex-shrink-0 w-[170px] rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 no-underline transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04] group"
            style={{ scrollSnapAlign: 'start' }}
          >
            <Icon className="w-5 h-5 mb-3" style={{ color: `${accent}80` }} />
            <p className="text-sm font-semibold text-white group-hover:text-white/90">{title}</p>
            <div className="flex items-center gap-1 mt-1">
              <p className="text-xs text-white/30">{desc}</p>
              <ArrowRight className="w-3 h-3 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
