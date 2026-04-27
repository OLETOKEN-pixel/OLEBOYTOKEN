import { useState } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { CreateTournamentOverlay } from '@/components/tournaments/CreateTournamentOverlay';
import { useTournaments, type TournamentListFilter } from '@/hooks/useTournaments';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const FONT_EXPANDED =
  "'Base_Neue_Trial:Expanded', 'Base Neue Trial-Expanded', 'Base Neue Trial', sans-serif";
const FONT_EXPANDED_BLACK =
  "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial-ExpandedBlack Oblique', 'Base Neue Trial', sans-serif";

export default function Tournaments() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TournamentListFilter>('live');
  const [createOpen, setCreateOpen] = useState(false);

  const { data: tournaments, isLoading } = useTournaments(activeTab);

  return (
    <PublicLayout>
      <section className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_bottom,rgba(118,12,38,0.24),transparent_28%),linear-gradient(180deg,#160406_0%,#090203_100%)] text-white">
        <img
          className="pointer-events-none absolute left-1/2 top-0 h-[146px] w-screen -translate-x-1/2 object-cover"
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
        />

        <div
          className="relative mx-auto flex flex-col box-border"
          style={{
            width: 'min(1532px, calc(100% - 100px))',
            paddingTop: '180px',
            paddingBottom: '160px',
          }}
        >
          <div className="relative h-[187px] w-[1060px] max-w-full overflow-visible">
            <img
              className="absolute left-0 top-0 h-[186px] w-[124px] object-contain"
              src="/figma-assets/tournaments/triangles.svg"
              alt=""
              aria-hidden="true"
            />
            <h1
              className="absolute left-[71px] top-[83px] whitespace-nowrap leading-none text-white"
              style={{ fontFamily: FONT_EXPANDED_BLACK, fontSize: '80px' }}
            >
              TOURNAMENTS
            </h1>
            <img
              className="absolute left-[59px] top-[168px] h-[18px] w-[806px] max-w-none object-fill"
              src="/figma-assets/tournaments/outline.svg"
              alt=""
              aria-hidden="true"
            />
          </div>

          <div className="relative z-30 mt-[26px] h-[47px] w-full">
            <button
              type="button"
              onClick={() => setActiveTab('live')}
              className={cn(
                'absolute left-[16px] top-0 flex h-[47px] w-[289px] items-center justify-center rounded-[16px] border border-white/50 bg-[#3d3d3d] text-white transition hover:brightness-110',
                activeTab === 'live' && 'border-[#ff1654] bg-[rgba(255,22,84,0.2)]',
              )}
              style={{ fontFamily: FONT_EXPANDED, fontSize: '24px', lineHeight: 1 }}
              aria-pressed={activeTab === 'live'}
            >
              Live Tournaments
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('past')}
              className={cn(
                'absolute left-[325px] top-0 flex h-[47px] w-[293px] items-center justify-center rounded-[16px] border border-white/50 bg-[#3d3d3d] text-white transition hover:brightness-110',
                activeTab === 'past' && 'border-[#ff1654] bg-[rgba(255,22,84,0.2)]',
              )}
              style={{ fontFamily: FONT_EXPANDED, fontSize: '24px', lineHeight: 1 }}
              aria-pressed={activeTab === 'past'}
            >
              Past Tournamets
            </button>

            {user && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="absolute right-0 top-0 flex h-[47px] w-[222px] items-center justify-center gap-[18px] rounded-[16px] border border-white/50 bg-[#ff1654] text-white shadow-[inset_0px_4px_4px_rgba(255,255,255,0.16),inset_0px_-4px_4px_rgba(0,0,0,0.22)] transition hover:brightness-110"
              >
                <img
                  className="h-[18px] w-[18px]"
                  src="/figma-assets/tournaments/plus-icon.svg"
                  alt=""
                  aria-hidden="true"
                />
                <span style={{ fontFamily: FONT_EXPANDED, fontSize: '24px', lineHeight: 1 }}>CREATE</span>
              </button>
            )}
          </div>

          <div
            className="mt-[55px] grid"
            style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)', columnGap: '40px', rowGap: '40px' }}
          >
            {isLoading ? (
              <p className="col-span-full text-center text-white/60" style={{ fontFamily: FONT_EXPANDED, fontSize: '20px' }}>
                Loading tournaments…
              </p>
            ) : !tournaments || tournaments.length === 0 ? (
              <p className="col-span-full text-center text-white/60" style={{ fontFamily: FONT_EXPANDED, fontSize: '20px' }}>
                {activeTab === 'live'
                  ? 'No live tournaments yet. Be the first to create one!'
                  : 'No past tournaments yet.'}
              </p>
            ) : (
              tournaments.map((t) => <TournamentCard key={t.id} tournament={t} />)
            )}
          </div>
        </div>

        <CreateTournamentOverlay open={createOpen} onClose={() => setCreateOpen(false)} />
      </section>
    </PublicLayout>
  );
}
