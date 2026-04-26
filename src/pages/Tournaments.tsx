import { useState } from 'react';
import { Plus } from 'lucide-react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { CreateTournamentOverlay } from '@/components/tournaments/CreateTournamentOverlay';
import { useTournaments, type TournamentListFilter } from '@/hooks/useTournaments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const FONT_BLACK_OBLIQUE = "'Base Neue Trial', sans-serif";
const FONT_EXPANDED = "'Base Neue Trial', sans-serif";

export default function Tournaments() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<TournamentListFilter>('live');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tournaments, isLoading } = useTournaments(filter);

  return (
    <PublicLayout>
      <div className="relative min-h-screen pb-32 pt-32" style={{ background: '#0f0404' }}>
        <div className="mx-auto max-w-[1532px] px-8">
          {/* Title */}
          <div className="mb-12">
            <h1
              className="text-[80px] leading-none text-white"
              style={{
                fontFamily: FONT_BLACK_OBLIQUE,
                fontStyle: 'italic',
                fontWeight: 900,
                letterSpacing: '-0.02em',
              }}
            >
              TOURNAMENTS
            </h1>
            <div className="mt-2 h-[3px] w-[440px] bg-[#ff1654]" />
          </div>

          {/* Tabs row */}
          <div className="mb-10 flex items-center gap-4">
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
                type="button"
                onClick={() => setCreateOpen(true)}
                className="flex h-[47px] items-center gap-2 rounded-2xl border border-white/50 bg-[#ff1654] px-6 text-[20px] uppercase text-white transition-colors hover:bg-[#ff1654]/90"
                style={{ fontFamily: FONT_EXPANDED }}
              >
                <Plus className="h-5 w-5" />
                Create
              </button>
            )}
          </div>

          {/* Grid */}
          {isLoading ? (
            <p className="text-white/60">Loading tournaments…</p>
          ) : !tournaments || tournaments.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#1a0a0a] p-12 text-center">
              <p className="text-[18px] text-white/60">
                {filter === 'live'
                  ? 'No live tournaments yet. Be the first to create one!'
                  : 'No past tournaments yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
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
        'h-[47px] rounded-2xl border px-6 text-[20px] uppercase transition-colors',
        active
          ? 'border-[#ff1654] bg-[#ff1654]/20 text-white'
          : 'border-white/50 bg-[#3d3d3d] text-white/80 hover:bg-[#3d3d3d]/70'
      )}
      style={{ fontFamily: FONT_EXPANDED }}
    >
      {label}
    </button>
  );
}
