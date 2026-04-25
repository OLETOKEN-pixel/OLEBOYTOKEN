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
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { NavbarFigmaLoggedIn } from '@/components/layout/NavbarFigmaLoggedIn';
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
        className="pointer-events-none fixed inset-x-0 top-0 h-[150px]"
        style={{
          background:
            'linear-gradient(180deg, rgba(255, 22, 84, 0.28) 0%, rgba(255, 22, 84, 0.12) 42%, rgba(255, 22, 84, 0) 100%)',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-0 bottom-0 h-[210px]"
        style={{
          background:
            'linear-gradient(0deg, rgba(255, 22, 84, 0.24) 0%, rgba(255, 22, 84, 0.1) 32%, rgba(255, 22, 84, 0) 100%)',
        }}
      />
    </>
  );
}

function AdminRail({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden min-h-0 lg:flex">
      <div className="flex min-h-0 w-full flex-col rounded-[32px] border border-white/10 bg-[#15080b]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-[18px]">
        <div className="shrink-0 border-b border-white/8 px-2 pb-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#ff8ead]">
            Admin Suite
          </p>
          <p className="mt-2 font-['Base_Neue_Trial:Expanded_Black_Oblique','Base_Neue_Trial','sans-serif'] text-[32px] italic leading-none text-white">
            CONTROL
          </p>
          <p className="mt-2 text-xs leading-5 text-white/48">
            Full-screen workspace for moderation, finance, shop rewards, and challenges.
          </p>
        </div>

        <nav
          aria-label="Admin navigation"
          className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1"
          data-testid="admin-section-nav"
        >
          {ADMIN_NAV_ITEMS.map((item) => {
            const active = isNavItemActive(pathname, item);

            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? 'page' : undefined}
                data-active={active ? 'true' : 'false'}
                className={cn(
                  'group flex items-center gap-3 rounded-[22px] border px-4 py-4 text-sm font-semibold transition',
                  active
                    ? 'border-[#ff1654] bg-[#ff1654]/14 text-white shadow-[0_0_26px_rgba(255,22,84,0.16)]'
                    : 'border-white/8 bg-white/[0.03] text-white/62 hover:border-[#ff1654]/26 hover:bg-white/[0.06] hover:text-white',
                )}
              >
                <div
                  className={cn(
                    'grid h-10 w-10 shrink-0 place-items-center rounded-[16px] border transition',
                    active
                      ? 'border-[#ff1654]/40 bg-[#ff1654]/18 text-[#ff8ead]'
                      : 'border-white/8 bg-black/20 text-white/44 group-hover:text-white/72',
                  )}
                >
                  <item.icon className="h-[18px] w-[18px]" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[15px] leading-none">{item.label}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.26em] text-white/34">
                    {item.href === '/admin' ? 'Overview' : 'Workspace'}
                  </p>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

function AdminMobileNav({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Admin navigation"
      className="flex gap-2 overflow-x-auto pb-1 lg:hidden"
      data-testid="admin-section-nav-mobile"
    >
      {ADMIN_NAV_ITEMS.map((item) => {
        const active = isNavItemActive(pathname, item);

        return (
          <Link
            key={item.href}
            to={item.href}
            aria-current={active ? 'page' : undefined}
            data-active={active ? 'true' : 'false'}
            className={cn(
              'flex min-w-fit items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition',
              active
                ? 'border-[#ff1654] bg-[#ff1654]/14 text-white'
                : 'border-white/10 bg-white/[0.04] text-white/64',
            )}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({ title, description, actions, children }: AdminShellProps) {
  const location = useLocation();
  const { user, isAdmin, isLoading } = useAdminStatus();

  if (isLoading) {
    return (
      <div className="relative h-screen overflow-hidden bg-[#120405] text-white">
        <AdminBackdrop />
        <NavbarFigmaLoggedIn />
        <div className="relative z-10 mx-auto flex h-full max-w-[1680px] flex-col px-4 pb-5 pt-[170px] sm:px-6 lg:px-8">
          <div className="grid min-h-0 flex-1 place-items-center rounded-[32px] border border-white/10 bg-[#15080b]/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-[18px]">
            <LoadingPage />
          </div>
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
    <div data-testid="admin-shell" className="relative h-screen overflow-hidden bg-[#120405] text-white">
      <AdminBackdrop />
      <NavbarFigmaLoggedIn />

      <main className="relative z-10 mx-auto flex h-full max-w-[1680px] flex-col px-4 pb-5 pt-[170px] sm:px-6 lg:px-8">
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
          <AdminRail pathname={location.pathname} />

          <div className="flex min-h-0 flex-col gap-4">
            <AdminMobileNav pathname={location.pathname} />

            <header className="shrink-0 rounded-[32px] border border-[#ff1654]/18 bg-[#1a090d]/92 px-6 py-5 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-[18px]">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[#ff8ead]">
                    Admin Suite
                  </p>
                  <h1 className="mt-2 font-['Base_Neue_Trial:Expanded_Black_Oblique','Base_Neue_Trial','sans-serif'] text-[42px] italic leading-none text-white sm:text-[54px]">
                    {title}
                  </h1>
                  <p className="mt-3 max-w-[780px] text-sm leading-6 text-white/64 sm:text-base">
                    {description}
                  </p>
                </div>

                {actions ? (
                  <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                    {actions}
                  </div>
                ) : null}
              </div>
            </header>

            <section className="min-h-0 flex-1">{children}</section>
          </div>
        </div>
      </main>
    </div>
  );
}

export function AdminPanel({
  title,
  description,
  actions,
  className,
  headerClassName,
  contentClassName,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const showHeader = title || description || actions;

  return (
    <section
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-[30px] border border-white/10 bg-[#16080c]/94 shadow-[0_20px_60px_rgba(0,0,0,0.24)] backdrop-blur-[18px]',
        className,
      )}
    >
      {showHeader ? (
        <div
          className={cn(
            'flex shrink-0 flex-col gap-3 border-b border-white/8 px-5 py-4 lg:flex-row lg:items-start lg:justify-between',
            headerClassName,
          )}
        >
          <div className="min-w-0">
            {title ? <h2 className="text-lg font-semibold text-white">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-white/54">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}

      <div className={cn('min-h-0 flex-1 px-5 py-4', contentClassName)}>{children}</div>
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
    <div className="flex h-full min-h-[116px] flex-col justify-between rounded-[24px] border border-white/10 bg-[#13070a]/92 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-white/44">{label}</p>
          <p className="mt-4 text-4xl font-semibold leading-none text-white">{value}</p>
        </div>

        <div
          className="grid h-12 w-12 place-items-center rounded-[18px] border border-white/10"
          style={{ backgroundColor: `${accent}16` }}
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
    <div className="grid h-full min-h-[220px] place-items-center rounded-[24px] border border-dashed border-white/14 bg-black/10 px-5 py-10 text-center">
      <div>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ff1654]/12">
          <AlertTriangle className="h-5 w-5 text-[#ff8ead]" />
        </div>
        <p className="mt-4 text-base font-semibold text-white">{title}</p>
        <p className="mx-auto mt-2 max-w-[460px] text-sm leading-6 text-white/54">{description}</p>
      </div>
    </div>
  );
}
