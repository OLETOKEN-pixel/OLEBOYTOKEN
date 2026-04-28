import { useMemo } from 'react';
import { useTournamentStreamStatus } from '@/hooks/useTournamentStreamStatus';
import { buildTwitchChatUrl, buildTwitchPlayerUrl } from '@/lib/twitchEmbed';

interface TournamentTwitchPanelProps {
  twitchUsername: string;
}

export function TournamentTwitchPanel({
  twitchUsername,
}: TournamentTwitchPanelProps) {
  const { data } = useTournamentStreamStatus(twitchUsername);

  const playerUrl = useMemo(() => buildTwitchPlayerUrl(twitchUsername), [twitchUsername]);
  const chatUrl = useMemo(() => buildTwitchChatUrl(twitchUsername), [twitchUsername]);

  const channelLabel = data?.displayName || twitchUsername;

  return (
    <div
      className="grid w-[871px] max-w-full grid-cols-1 gap-[16px] md:grid-cols-[554px_301px]"
      data-testid="tournament-twitch-panel"
    >
      <section
        className="overflow-hidden rounded-[16px] border border-[#ff1654]/70 bg-[#161616] shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
        data-testid="tournament-twitch-live-shell"
      >
        <iframe
          title={`${channelLabel} Twitch player`}
          src={playerUrl}
          className="block h-[220px] w-full border-0 bg-black md:h-[246px]"
          allowFullScreen
          loading="lazy"
          data-testid="tournament-twitch-live-frame"
        />
      </section>

      <section
        className="overflow-hidden rounded-[16px] border border-white/12 bg-[#161616] shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
        data-testid="tournament-twitch-chat-shell"
      >
        <iframe
          title={`${channelLabel} Twitch chat`}
          src={chatUrl}
          className="block h-[220px] w-full border-0 bg-[#0f0404] md:h-[246px]"
          loading="lazy"
          data-testid="tournament-twitch-chat-frame"
        />
      </section>
    </div>
  );
}
