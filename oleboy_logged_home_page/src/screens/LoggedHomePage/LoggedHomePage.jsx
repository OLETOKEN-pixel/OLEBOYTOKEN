import { ChallengesSection } from "./sections/ChallengesSection";
import { HighlightsSection } from "./sections/HighlightsSection";
import { LaunchVideoSection } from "./sections/LaunchVideoSection";
import { LeaderboardSection } from "./sections/LeaderboardSection";
import { LiveMatchesSection } from "./sections/LiveMatchesSection";
import { NavigationBarSection } from "./sections/NavigationBarSection";

export const LoggedHomePage = () => {
  return (
    <div
      className="bg-white w-full min-w-[1920px] min-h-[4775px] flex flex-col"
      data-model-id="127:391"
    >
      <LaunchVideoSection />
      <div className="fixed top-0 left-0 w-[1920px] h-[146px] z-[7] bg-[linear-gradient(180deg,rgba(255,22,84,0.17)_0%,rgba(0,0,0,0)_100%)]" />

      <NavigationBarSection />
      <div className="fixed top-[825px] left-0 w-[1920px] h-[146px] z-[6] bg-[linear-gradient(180deg,rgba(255,22,84,0.17)_0%,rgba(0,0,0,0)_100%)]" />

      <LiveMatchesSection />
      <LeaderboardSection />
      <ChallengesSection />
      <HighlightsSection />
    </div>
  );
};
