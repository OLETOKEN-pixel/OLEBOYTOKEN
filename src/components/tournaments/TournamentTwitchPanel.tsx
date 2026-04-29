import { useMemo } from 'react';
import { useTournamentStreamStatus } from '@/hooks/useTournamentStreamStatus';
import { buildTwitchPlayerUrl } from '@/lib/twitchEmbed';

interface TournamentTwitchPanelProps {
  twitchUsername: string;
}

export function TournamentTwitchPanel({
  twitchUsername,
}: TournamentTwitchPanelProps) {
  const { data } = useTournamentStreamStatus(twitchUsername);

  const playerUrl = useMemo(() => buildTwitchPlayerUrl(twitchUsername), [twitchUsername]);

  const channelLabel = data?.displayName || twitchUsername;

  return (
    <div
      className="flex w-[895px] max-w-full justify-center"
      data-testid="tournament-twitch-panel"
    >
      <section
        className="overflow-hidden rounded-[16px] border border-[#ff1654]/70 bg-[#161616] shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
        data-testid="tournament-twitch-live-shell"
      >
        <iframe
          title={`${channelLabel} Twitch player`}
          src={playerUrl}
          className="block h-[236px] w-[min(560px,calc(100vw-120px))] border-0 bg-black md:h-[308px]"
          allowFullScreen
          loading="lazy"
          data-testid="tournament-twitch-live-frame"
        />
      </section>
    </div>
  );
}
