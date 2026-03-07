import { Trophy, Users, Zap, Coins } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/ui/motion';

interface StatItemProps {
  icon: React.ReactNode;
  value: number;
  prefix?: string;
  label: string;
  index: number;
}

function StatItem({ icon, value, prefix, label, index }: StatItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="flex items-center gap-3 py-4 px-5"
    >
      <div className="p-2 rounded-lg bg-white/[0.04]">
        {icon}
      </div>
      <div>
        <p className="text-2xl lg:text-3xl font-bold font-mono leading-none text-foreground">
          {prefix}<AnimatedNumber value={value} />
        </p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5 font-display">{label}</p>
      </div>
    </motion.div>
  );
}

export function StatsBar() {
  const stats = [
    { icon: <Trophy className="w-5 h-5 neon-text-gold" />, value: 1234, label: 'Total Matches', index: 0 },
    { icon: <Users className="w-5 h-5 neon-text-cyan" />, value: 500, label: 'Players Online', index: 1 },
    { icon: <Coins className="w-5 h-5 neon-text-gold" />, value: 50000, prefix: '€', label: 'Prize Pool', index: 2 },
    { icon: <Zap className="w-5 h-5 neon-text-cyan" />, value: 24, label: 'Active Now', index: 3 },
  ];

  return (
    <div className="hud-panel">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <div key={stat.label} className="relative">
            <StatItem {...stat} />
            {i < stats.length - 1 && (
              <div className="hidden lg:block absolute right-0 top-1/4 bottom-1/4 w-px bg-gradient-to-b from-transparent via-primary/30 to-transparent" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
