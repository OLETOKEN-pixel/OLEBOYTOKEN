import { useMemo } from 'react';
import { useTournamentStreamStatus } from '@/hooks/useTournamentStreamStatus';
import { buildTwitchChatUrl, buildTwitchPlayerUrl } from '@/lib/twitchEmbed';
import { FONTS } from './TournamentDesign';

interface TournamentTwitchPanelProps {
  twitchUsername: string;
}

export function TournamentTwitchPanel({
  twitchUsername,
}: TournamentTwitchPanelProps) {
  const { data, isLoading } = useTournamentStreamStatus(twitchUsername);

  const playerUrl = useMemo(() => buildTwitchPlayerUrl(twitchUsername), [twitchUsername]);
  const chatUrl = useMemo(() => buildTwitchChatUrl(twitchUsername), [twitchUsername]);

  const channelLabel = data?.displayName || twitchUsername;
  const channelUrl = data?.channelUrl || `https://www.twitch.tv/${encodeURIComponent(twitchUsername)}`;
  const liveBadgeLabel = isLoading ? 'CHECKING' : data?.isLive ? 'LIVE' : 'OFFLINE';
  const liveBadgeClassName = isLoading
    ? 'bg-[rgba(255,255,255,0.14)] text-white'
    : data?.isLive
      ? 'bg-[#eb0400] text-white'
      : 'bg-[rgba(255,255,255,0.14)] text-white/85';

  return (
    <div
      className="grid w-[871px] grid-cols-1 gap-[20px] md:grid-cols-[541px_310px]"
      data-testid="tournament-twitch-panel"
    >
      <section
        className="overflow-hidden rounded-[16px] border border-[#ff1654]/70 bg-[#161616] shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
        data-testid="tournament-twitch-live-shell"
      >
        <div className="flex h-[46px] items-center justify-between border-b border-white/10 bg-black/45 px-[14px]">
          <div className="flex items-center gap-[10px]">
            <span
              className={`inline-flex h-[28px] items-center rounded-[6px] px-[8px] text-[15px] uppercase tracking-[0.04em] ${liveBadgeClassName}`}
              style={{ fontFamily: FONTS.expandedBold }}
            >
              {liveBadgeLabel}
            </span>
            {data?.isLive && data.viewerCount !== null ? (
              <span
                className="inline-flex h-[28px] items-center rounded-[6px] bg-black/55 px-[10px] text-[13px] text-white"
                style={{ fontFamily: FONTS.expanded }}
              >
                {data.viewerCount} viewers
              </span>
            ) : null}
          </div>
          <a
            href={channelUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[28px] items-center rounded-[999px] border border-white/20 bg-white/6 px-[12px] text-[12px] uppercase tracking-[0.08em] text-white transition hover:border-[#ff1654] hover:bg-[#ff1654]/18"
            style={{ fontFamily: FONTS.expandedBold }}
          >
            Open Twitch
          </a>
        </div>
        <iframe
          title={`${channelLabel} Twitch player`}
          src={playerUrl}
          className="block h-[318px] w-full border-0 bg-black md:h-[340px]"
          allowFullScreen
          loading="lazy"
          data-testid="tournament-twitch-live-frame"
        />
      </section>

      <section
        className="overflow-hidden rounded-[16px] border border-white/12 bg-[#161616] shadow-[0_18px_40px_rgba(0,0,0,0.32)]"
        data-testid="tournament-twitch-chat-shell"
      >
        <div className="flex h-[46px] items-center border-b border-white/10 bg-black/45 px-[14px]">
          <span
            className="text-[14px] uppercase tracking-[0.1em] text-white/76"
            style={{ fontFamily: FONTS.expandedBold }}
          >
            Twitch Chat
          </span>
        </div>
        <iframe
          title={`${channelLabel} Twitch chat`}
          src={chatUrl}
          className="block h-[318px] w-full border-0 bg-[#0f0404] md:h-[340px]"
          loading="lazy"
          data-testid="tournament-twitch-chat-frame"
        />
      </section>
    </div>
  );
}
