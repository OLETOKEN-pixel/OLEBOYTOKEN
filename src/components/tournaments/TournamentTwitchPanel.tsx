import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournamentStreamStatus } from '@/hooks/useTournamentStreamStatus';
import { buildTwitchChatUrl, buildTwitchPlayerUrl } from '@/lib/twitchEmbed';
import { FONTS } from './TournamentDesign';

type TournamentTwitchTab = 'live' | 'chat';

interface TournamentTwitchPanelProps {
  twitchUsername: string;
  viewerHasTwitchLink: boolean;
}

export function TournamentTwitchPanel({
  twitchUsername,
  viewerHasTwitchLink,
}: TournamentTwitchPanelProps) {
  const [activeTab, setActiveTab] = useState<TournamentTwitchTab>('live');
  const { data, isLoading } = useTournamentStreamStatus(twitchUsername);

  const playerUrl = useMemo(() => buildTwitchPlayerUrl(twitchUsername), [twitchUsername]);
  const chatUrl = useMemo(() => buildTwitchChatUrl(twitchUsername), [twitchUsername]);

  const channelLabel = data?.displayName || twitchUsername;
  const liveBadgeLabel = isLoading ? 'CHECKING' : data?.isLive ? 'LIVE' : 'OFFLINE';
  const liveBadgeClassName = isLoading
    ? 'bg-[rgba(255,255,255,0.14)] text-white'
    : data?.isLive
      ? 'bg-[#eb0400] text-white'
      : 'bg-[rgba(255,255,255,0.14)] text-white/85';

  return (
    <div
      className="relative h-[295px] w-[524px] overflow-hidden rounded-[16px] bg-[#161616] shadow-[0_18px_40px_rgba(0,0,0,0.38)]"
      data-testid="tournament-twitch-panel"
    >
      <div className="absolute left-[14px] top-[14px] z-20 flex items-center gap-[10px]">
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

      <div className="absolute right-[14px] top-[14px] z-20 flex items-center gap-[8px] rounded-[999px] bg-black/55 p-[4px] backdrop-blur-[4px]">
        <PanelTabButton
          active={activeTab === 'live'}
          onClick={() => setActiveTab('live')}
        >
          LIVE
        </PanelTabButton>
        <PanelTabButton
          active={activeTab === 'chat'}
          onClick={() => setActiveTab('chat')}
        >
          CHAT
        </PanelTabButton>
      </div>

      {activeTab === 'live' ? (
        <iframe
          title={`${channelLabel} Twitch player`}
          src={playerUrl}
          className="absolute inset-0 h-full w-full border-0"
          allowFullScreen
          loading="lazy"
          data-testid="tournament-twitch-live-frame"
        />
      ) : viewerHasTwitchLink ? (
        <iframe
          title={`${channelLabel} Twitch chat`}
          src={chatUrl}
          className="h-full w-full border-0 bg-[#0f0404]"
          loading="lazy"
          data-testid="tournament-twitch-chat-frame"
        />
      ) : (
        <div
          className="flex h-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,22,84,0.16),transparent_34%),linear-gradient(180deg,#211216_0%,#120608_100%)] px-8 text-center"
          data-testid="tournament-twitch-chat-locked"
        >
          <p
            className="text-[26px] leading-none text-white"
            style={{ fontFamily: FONTS.expandedBlack }}
          >
            TWITCH CHAT LOCKED
          </p>
          <p
            className="mt-[12px] max-w-[340px] text-[15px] leading-[1.45] text-white/72"
            style={{ fontFamily: FONTS.expanded }}
          >
            Connect Twitch in your profile settings to jump into the creator chat. The live preview still works as guest.
          </p>
          <Link
            to="/profile?tab=connections"
            className="mt-[22px] inline-flex h-[42px] items-center rounded-[999px] border border-[#ff1654] bg-[rgba(255,22,84,0.18)] px-[18px] text-[14px] text-white transition hover:brightness-110"
            style={{ fontFamily: FONTS.expandedBold }}
          >
            Connect Twitch
          </Link>
        </div>
      )}
    </div>
  );
}

function PanelTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[30px] min-w-[66px] items-center justify-center rounded-[999px] px-[12px] text-[12px] uppercase tracking-[0.08em] transition ${
        active ? 'bg-[#ff1654] text-white' : 'bg-white/6 text-white/74 hover:bg-white/12 hover:text-white'
      }`}
      style={{ fontFamily: FONTS.expandedBold }}
    >
      {children}
    </button>
  );
}
