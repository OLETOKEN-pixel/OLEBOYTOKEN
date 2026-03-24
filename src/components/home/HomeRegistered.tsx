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

interface HomeRegisteredProps {
  displayName: string;
}

export function HomeRegistered({ displayName }: HomeRegisteredProps) {
  return (
    <div className="bg-[#0f0404] w-full min-w-[1920px] min-h-[4775px] flex flex-col">
      <LaunchVideoSection displayName={displayName} />

      {/* Top neon gradient overlay */}
      <div className="fixed top-0 left-0 w-[1920px] h-[146px] z-[7] bg-[linear-gradient(180deg,rgba(255,22,84,0.17)_0%,rgba(0,0,0,0)_100%)] pointer-events-none" />
      {/* Section boundary neon gradient overlay */}
      <div className="fixed top-[825px] left-0 w-[1920px] h-[146px] z-[6] bg-[linear-gradient(180deg,rgba(255,22,84,0.17)_0%,rgba(0,0,0,0)_100%)] pointer-events-none" />

      <LiveMatchesSection />
      <LeaderboardSection />
      <ChallengesSection />
      <HighlightsSection />
    </div>
  );
}
