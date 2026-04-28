import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { CreateTournamentOverlay } from '@/components/tournaments/CreateTournamentOverlay';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import {
  FigmaPillButton,
  FONTS,
  TOURNAMENT_ASSETS,
  TournamentBottomNeon,
  TournamentPageShell,
  TournamentTitle,
} from '@/components/tournaments/TournamentDesign';
import { useAuth } from '@/contexts/AuthContext';
import { useTournaments, type TournamentListFilter } from '@/hooks/useTournaments';

export default function Tournaments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TournamentListFilter>('live');
  const [createOpen, setCreateOpen] = useState(false);
  const { data: tournaments, isLoading } = useTournaments(activeTab);

  return (
    <PublicLayout>
      <TournamentPageShell minHeight={955} contentClassName="pb-[170px] pt-[156px]">
        <TournamentTitle outlineWidth={806}>TOURNAMENTS</TournamentTitle>

        <div className="mt-[26px] flex min-h-[47px] flex-wrap items-center gap-[12px]">
          <FigmaPillButton
            active={activeTab === 'live'}
            className="w-[289px]"
            onClick={() => setActiveTab('live')}
            aria-pressed={activeTab === 'live'}
          >
            Live Tournaments
          </FigmaPillButton>
          <FigmaPillButton
            active={activeTab === 'past'}
            className="w-[293px]"
            onClick={() => setActiveTab('past')}
            aria-pressed={activeTab === 'past'}
          >
            Past Tournamets
          </FigmaPillButton>
          <FigmaPillButton
            pink
            className="ml-auto w-[222px] gap-[16px]"
            onClick={() => {
              if (user) setCreateOpen(true);
              else navigate('/auth?next=/tournaments');
            }}
          >
            <img className="h-[18px] w-[18px]" src={TOURNAMENT_ASSETS.plus} alt="" aria-hidden="true" />
            CREATE
          </FigmaPillButton>
        </div>

        <div
          className="mt-[55px] grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, 300px)', gap: '40px' }}
        >
          {isLoading ? (
            <StatusMessage>Loading tournaments...</StatusMessage>
          ) : !tournaments || tournaments.length === 0 ? (
            <StatusMessage>
              {activeTab === 'live' ? 'No live tournaments yet.' : 'No past tournaments yet.'}
            </StatusMessage>
          ) : (
            tournaments.map((tournament) => (
              <TournamentCard key={tournament.id} tournament={tournament} />
            ))
          )}
        </div>
        <TournamentBottomNeon />
      </TournamentPageShell>
      <CreateTournamentOverlay open={createOpen} onClose={() => setCreateOpen(false)} />
    </PublicLayout>
  );
}

function StatusMessage({ children }: { children: ReactNode }) {
  return (
    <p
      className="col-span-full rounded-[18px] border border-[#ff1654]/35 bg-[#282828] px-6 py-8 text-center text-[22px] text-white/65"
      style={{ fontFamily: FONTS.expanded }}
    >
      {children}
    </p>
  );
}
