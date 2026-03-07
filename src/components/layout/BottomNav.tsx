import { Link, useLocation } from 'react-router-dom';
import { Gamepad2, Swords, Plus, Medal, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
  href: string;
  requiresAuth?: boolean;
  isCenter?: boolean;
}

const navItems: NavItem[] = [
  { icon: Gamepad2, label: 'Play', href: '/' },
  { icon: Swords, label: 'Matches', href: '/matches' },
  { icon: Plus, label: 'Create', href: '/matches/create', requiresAuth: true, isCenter: true },
  { icon: Medal, label: 'Leaderboard', href: '/leaderboard' },
  { icon: User, label: 'Profile', href: '/profile', requiresAuth: true },
];

export function BottomNav() {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="h-[60px] bg-[hsl(var(--bg-1))] border-t border-[hsl(var(--border-soft))]" />
      <div className="absolute inset-0 flex items-center justify-around px-2 safe-area-bottom">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(item.href);
          const isLocked = item.requiresAuth && !user;
          const Icon = item.icon;
          const href = isLocked ? `/auth?next=${encodeURIComponent(item.href)}` : item.href;

          if (item.isCenter) {
            return (
              <Link
                key={item.href}
                to={href}
                className="relative flex flex-col items-center justify-center -mt-3"
              >
                <div
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center',
                    'bg-[#FFC805] shadow-md shadow-[#FFC805]/20',
                    'active:scale-95 transition-transform duration-150'
                  )}
                >
                  <Icon className="w-5 h-5 text-black" strokeWidth={2} />
                </div>
                <span className="text-[10px] font-medium mt-1 text-[hsl(var(--text-tertiary))]">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              to={href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[56px] transition-colors duration-200',
                isActive
                  ? 'text-[#FFC805]'
                  : isLocked
                    ? 'text-[hsl(var(--text-tertiary))]/40'
                    : 'text-[hsl(var(--text-tertiary))] hover:text-[hsl(var(--text-secondary))]'
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={1.5} />
              <span className={cn(
                'text-[10px] font-medium',
                isActive && 'font-semibold'
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>

      <style>{`
        .safe-area-bottom {
          padding-bottom: max(8px, env(safe-area-inset-bottom));
        }
      `}</style>
    </nav>
  );
}
