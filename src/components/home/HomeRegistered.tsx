/**
 * HomeRegistered — Logged-in user home page
 * Sections: LaunchVideo → LiveMatches → Leaderboard → Challenges → Highlights
 * Backend-connected: user data, matches, leaderboard, challenges from Supabase
 */

import { LaunchVideoSection } from './sections/LaunchVideoSection';
import { LiveMatchesSection } from './sections/LiveMatchesSection';
import { LeaderboardSection } from './sections/LeaderboardSection';
import { ChallengesSection } from './sections/ChallengesSection';
import { HighlightsSection } from './sections/HighlightsSection';
import { TeamsSection } from './sections/TeamsSection';
import { ShopSection } from './sections/ShopSection';
import { FooterSection } from './sections/FooterSection';
import { useIsMobile } from '@/hooks/use-mobile';
import { HomeRegisteredMobile } from './HomeRegisteredMobile';
import { FigmaFrame } from '@/components/layout/FigmaFrame';

interface HomeRegisteredProps {
  displayName: string;
}

export function HomeRegistered({ displayName }: HomeRegisteredProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <HomeRegisteredMobile displayName={displayName} />;
  }

  return (
    <div className="bg-[#0f0404] w-full overflow-x-hidden">
      {/* Top neon gradient overlay — fixed at viewport top, span full width regardless of scale */}
      <div className="fixed top-0 left-0 w-screen h-[146px] z-[7] bg-[linear-gradient(180deg,rgba(255,22,84,0.05)_0%,rgba(0,0,0,0)_100%)] pointer-events-none" />

      <FigmaFrame baseWidth={1920} baseHeight={7321}>
        <div className="bg-[#0f0404] w-full h-full flex flex-col">
          <LaunchVideoSection displayName={displayName} />
          <LiveMatchesSection />
          <LeaderboardSection />
          <ChallengesSection />
          <HighlightsSection />
          <TeamsSection />
          <ShopSection />
          <FooterSection />
        </div>
      </FigmaFrame>
    </div>
  );
}
