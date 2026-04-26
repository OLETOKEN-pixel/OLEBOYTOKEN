import { useState } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { CreateTournamentOverlay } from '@/components/tournaments/CreateTournamentOverlay';
import { useTournaments, type TournamentListFilter } from '@/hooks/useTournaments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const FONT_HEAD =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_BOLD =
  "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', 'Base Neue', sans-serif";
const FONT_REGULAR =
  "'Base_Neue_Trial:Regular', 'Base Neue Trial', 'Base Neue', sans-serif";

export default function Tournaments() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<TournamentListFilter>('live');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tournaments, isLoading } = useTournaments(filter);

  return (
    <PublicLayout>
      <div
        className="relative min-h-screen pb-32 pt-28"
        style={{ background: '#0f0404' }}
      >
        <div className="mx-auto max-w-[1532px] px-8">
          {/* ── Title section ── */}
          <div className="relative mb-8 flex items-end gap-0">
            {/* Triangle decoration — reuse the same SVG used by Matches page */}
            <img
              src="/figma-assets/matches-title-triangles.svg"
              alt=""
              aria-hidden="true"
              className="mr-3 mb-1 h-[72px] w-auto flex-shrink-0 select-none"
            />
            <div>
              <h1
                className="text-[72px] leading-none text-white"
                style={{
                  fontFamily: FONT_HEAD,
                  fontStyle: 'italic',
                  fontWeight: 900,
                  letterSpacing: '-0.01em',
                }}
              >
                TOURNAMENTS
              </h1>
              {/* Red underline */}
              <div className="mt-1 h-[4px] w-full bg-[#ff1654]" />
            </div>
          </div>

          {/* ── Filter tabs + Create button ── */}
          <div className="mb-10 flex items-center gap-3">
            <FilterTab
              label="Live Tournaments"
              active={filter === 'live'}
              onClick={() => setFilter('live')}
            />
            <FilterTab
              label="Past Tournaments"
              active={filter === 'past'}
              onClick={() => setFilter('past')}
            />
            <div className="flex-1" />
            {user && (
              <button
                id="create-tournament-btn"
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex h-[42px] items-center gap-2 rounded-full bg-[#ff1654] px-6 text-[16px] uppercase text-white transition-all hover:bg-[#ff1654]/85 hover:shadow-[0_0_20px_rgba(255,22,84,0.4)]"
                style={{ fontFamily: FONT_BOLD }}
              >
                <span className="text-[20px] leading-none">+</span>
                <span>CREATE</span>
              </button>
            )}
          </div>

          {/* ── Tournament grid ── */}
          {isLoading ? (
            <div className="flex items-center gap-3 text-white/50">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-[#ff1654]" />
              <span style={{ fontFamily: FONT_REGULAR }}>Loading tournaments…</span>
            </div>
          ) : !tournaments || tournaments.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#1a0a0a] p-12 text-center">
              <p
                className="text-[18px] text-white/50"
                style={{ fontFamily: FONT_REGULAR }}
              >
                {filter === 'live'
                  ? 'No live tournaments yet. Be the first to create one!'
                  : 'No past tournaments yet.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-5">
              {tournaments.map((t) => (
                <TournamentCard key={t.id} tournament={t} />
              ))}
            </div>
          )}
        </div>
      </div>

      <CreateTournamentOverlay open={createOpen} onClose={() => setCreateOpen(false)} />
    </PublicLayout>
  );
}

function FilterTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-[38px] rounded-full border px-5 text-[15px] transition-all',
        active
          ? 'border-[#ff1654]/60 bg-[#ff1654]/15 text-white'
          : 'border-white/25 bg-[#1e1010] text-white/60 hover:border-white/40 hover:text-white/80'
      )}
      style={{ fontFamily: FONT_BOLD }}
    >
      {label}
    </button>
  );
}
