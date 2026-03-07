import { Link } from 'react-router-dom';
import { Swords, Wallet, Users, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const features = [
  { icon: Swords, title: 'Challenges', href: '/challenges', neonClass: 'neon-text-cyan' },
  { icon: Trophy, title: 'Highlights', href: '/highlights', neonClass: 'neon-text-gold' },
  { icon: Users, title: 'Teams', href: '/teams', neonClass: 'neon-text-cyan' },
  { icon: Wallet, title: 'Wallet', href: '/wallet', neonClass: 'neon-text-gold' },
];

export function FeatureCardsMini() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {features.map(({ icon: Icon, title, href, neonClass }, index) => (
        <motion.div
          key={title}
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: index * 0.08 }}
          whileHover={{ y: -3 }}
        >
          <Link
            to={href}
            className={cn(
              "flex items-center gap-3 p-4 hud-panel group cursor-pointer no-underline",
              "hover:border-primary/30 transition-all duration-300"
            )}
          >
            <div className="p-2.5 bg-white/[0.04] group-hover:bg-primary/10 transition-all duration-300">
              <Icon className={cn("w-5 h-5", neonClass)} />
            </div>
            <span className="text-sm font-display font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
              {title}
            </span>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
