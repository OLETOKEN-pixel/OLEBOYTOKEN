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

interface HomeRegisteredProps {
  displayName: string;
}

export function HomeRegistered({ displayName }: HomeRegisteredProps) {
  return (
    <div className="bg-[#0f0404] w-full min-w-[1920px] min-h-[7321px] flex flex-col">
      <LaunchVideoSection displayName={displayName} />

      {/* Top neon gradient overlay — very subtle, matches Figma */}
      <div className="fixed top-0 left-0 w-[1920px] h-[146px] z-[7] bg-[linear-gradient(180deg,rgba(255,22,84,0.05)_0%,rgba(0,0,0,0)_100%)] pointer-events-none" />

      <LiveMatchesSection />
      <LeaderboardSection />
      <ChallengesSection />
      <HighlightsSection />
      <TeamsSection />
      <ShopSection />
      <FooterSection />
    </div>
  );
}
