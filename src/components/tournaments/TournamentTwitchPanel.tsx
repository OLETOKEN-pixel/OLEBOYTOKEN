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
  const { data, isLoading, error } = useTournamentStreamStatus(twitchUsername);

  const playerUrl = useMemo(() => buildTwitchPlayerUrl(twitchUsername), [twitchUsername]);
  const chatUrl = useMemo(() => buildTwitchChatUrl(twitchUsername), [twitchUsername]);

  const channelLabel = data?.displayName || twitchUsername;
  const previewImageUrl = data?.thumbnailUrl || data?.offlineImageUrl || data?.profileImageUrl || null;
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
        <div className="absolute inset-0">
          {data?.isLive ? (
            <iframe
              title={`${channelLabel} Twitch live`}
              src={playerUrl}
              className="h-full w-full border-0"
              allowFullScreen
              loading="lazy"
              data-testid="tournament-twitch-live-frame"
            />
          ) : (
            <div className="relative h-full w-full overflow-hidden">
              {previewImageUrl ? (
                <img
                  src={previewImageUrl}
                  alt={`${channelLabel} Twitch preview`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(255,22,84,0.28),transparent_38%),linear-gradient(180deg,#2b0c12_0%,#0f0404_100%)]" />
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(9,4,5,0.1)_0%,rgba(9,4,5,0.72)_100%)]" />

              <div className="absolute bottom-[18px] left-[18px] right-[18px] flex items-end justify-between gap-4">
                <div>
                  <p
                    className="text-[22px] leading-none text-white"
                    style={{ fontFamily: FONTS.expandedBold }}
                  >
                    {channelLabel}
                  </p>
                  <p
                    className="mt-[8px] text-[13px] uppercase tracking-[0.1em] text-white/70"
                    style={{ fontFamily: FONTS.expanded }}
                  >
                    {error ? 'Stream status unavailable' : 'Channel currently offline'}
                  </p>
                </div>
                <a
                  href={data?.channelUrl || `https://www.twitch.tv/${encodeURIComponent(twitchUsername)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-[38px] items-center rounded-[999px] border border-white/30 bg-black/40 px-[16px] text-[14px] text-white transition hover:border-[#ff1654] hover:bg-[#ff1654]/18"
                  style={{ fontFamily: FONTS.expandedBold }}
                >
                  Open Twitch
                </a>
              </div>
            </div>
          )}
        </div>
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
