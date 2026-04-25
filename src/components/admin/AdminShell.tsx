import type { ComponentType, ReactNode } from 'react';
import {
  AlertTriangle,
  CreditCard,
  LayoutDashboard,
  Package,
  ScrollText,
  Swords,
  Trophy,
  Users,
} from 'lucide-react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { NavbarFigmaLoggedIn } from '@/components/layout/NavbarFigmaLoggedIn';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { cn } from '@/lib/utils';

type AdminShellProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
};

type AdminNavItem = {
  href: string;
  label: string;
  matchPrefixes: string[];
  icon: ComponentType<{ className?: string }>;
};

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    matchPrefixes: ['/admin'],
    icon: LayoutDashboard,
  },
  {
    href: '/admin/users',
    label: 'Users',
    matchPrefixes: ['/admin/users'],
    icon: Users,
  },
  {
    href: '/admin/matches',
    label: 'Matches',
    matchPrefixes: ['/admin/matches'],
    icon: Swords,
  },
  {
    href: '/admin/transactions',
    label: 'Transactions',
    matchPrefixes: ['/admin/transactions'],
    icon: ScrollText,
  },
  {
    href: '/admin/withdrawals',
    label: 'Withdrawals',
    matchPrefixes: ['/admin/withdrawals'],
    icon: CreditCard,
  },
  {
    href: '/admin/shop',
    label: 'Shop',
    matchPrefixes: ['/admin/shop'],
    icon: Package,
  },
  {
    href: '/admin/challenges',
    label: 'Challenges',
    matchPrefixes: ['/admin/challenges'],
    icon: Trophy,
  },
];

function isNavItemActive(pathname: string, item: AdminNavItem) {
  if (item.href === '/admin') {
    return pathname === '/admin';
  }

  return item.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function AdminBackdrop() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-0 h-[180px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 22, 84, 0.24) 0%, rgba(255, 22, 84, 0.12) 34%, rgba(255, 22, 84, 0) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 top-[-56px] h-[120px] blur-[52px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 22, 84, 0.4) 0%, rgba(255, 22, 84, 0) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 h-[240px]"
        style={{
          background:
            'linear-gradient(0deg, rgba(255, 22, 84, 0.26) 0%, rgba(255, 22, 84, 0.12) 26%, rgba(255, 22, 84, 0) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-[12%] bottom-[-88px] h-[170px] blur-[78px]"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(255, 22, 84, 0.28) 0%, rgba(255, 22, 84, 0) 72%)',
        }}
      />
    </>
  );
}

export function AdminShell({ title, description, actions, children }: AdminShellProps) {
  const location = useLocation();
  const { user, isAdmin, isLoading } = useAdminStatus();

  if (isLoading) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-[#120405] text-white">
        <AdminBackdrop />
        <NavbarFigmaLoggedIn />
        <div className="relative z-10 mx-auto max-w-[1440px] px-4 pt-[170px] sm:px-6 lg:px-10">
          <LoadingPage />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/auth?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div data-testid="admin-shell" className="relative min-h-screen overflow-hidden bg-[#120405] text-white">
      <AdminBackdrop />
      <NavbarFigmaLoggedIn />

      <main className="relative z-10 mx-auto max-w-[1440px] px-4 pb-16 pt-[170px] sm:px-6 lg:px-10">
        <div className="rounded-[36px] border border-[#ff1654]/20 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-[18px] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#ff8ead]">
                Admin Suite
              </p>
              <h1 className="font-['Base_Neue_Trial:Expanded_Black_Oblique','Base_Neue_Trial','sans-serif'] text-4xl italic text-white sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-[760px] text-sm text-white/64 sm:text-base">{description}</p>
            </div>

            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
        </div>

        <nav
          aria-label="Admin navigation"
          className="mt-6 flex gap-3 overflow-x-auto pb-2"
          data-testid="admin-section-nav"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(location.pathname, item);

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex min-w-fit items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition',
                  active
                    ? 'border-[#ff1654] bg-[#ff1654]/18 text-white shadow-[0_0_28px_rgba(255,22,84,0.18)]'
                    : 'border-white/10 bg-white/5 text-white/68 hover:border-[#ff1654]/40 hover:bg-[#ff1654]/10 hover:text-white',
                )}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 space-y-6">{children}</div>
      </main>

      <footer className="relative z-10 border-t border-white/8 px-4 py-6 text-center text-xs uppercase tracking-[0.2em] text-white/42">
        OLEBOY TOKEN ADMIN
      </footer>
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  className,
  children,
}: {
  title?: string;
  description?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur-[18px]',
        className,
      )}
    >
      {title ? (
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm text-white/56">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function AdminStatCard({
  label,
  value,
  icon: Icon,
  accent = '#ff1654',
}: {
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/44">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
        </div>
        <div
          className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10"
          style={{ backgroundColor: `${accent}18` }}
        >
          <Icon className="h-5 w-5" style={{ color: accent }} />
        </div>
      </div>
    </div>
  );
}

export function AdminEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[24px] border border-dashed border-white/14 bg-black/10 px-5 py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ff1654]/12">
        <AlertTriangle className="h-5 w-5 text-[#ff8ead]" />
      </div>
      <p className="mt-4 text-base font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-[460px] text-sm text-white/54">{description}</p>
    </div>
  );
}
