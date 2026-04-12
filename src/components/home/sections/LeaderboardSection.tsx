import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ACTIVE_HOME_ASSETS } from './activeHomeAssets';

interface PlayerDisplay {
  rank: number;
  username: string;
  avatarUrl: string | null;
  winRate: string;
  roundsWon: string;
  earnings: string;
}

export const LeaderboardSection = () => {
  const [players, setPlayers] = useState<PlayerDisplay[]>([]);

  const handlePrev = useCallback(() => { const el = document.getElementById('s-matches'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }, []);
  const handleNext = useCallback(() => { const el = document.getElementById('s-challenges'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // Try leaderboard_weekly view first
        const { data: lbData, error: lbErr } = await supabase
          .from('leaderboard_weekly')
          .select('*')
          .order('wins', { ascending: false })
          .limit(3);

        if (!lbErr && lbData && lbData.length > 0) {
          // Get Discord avatars from profiles for these users
          const userIds = lbData.map((p: any) => p.user_id).filter(Boolean);
          let avatarMap: Record<string, string | null> = {};

          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, discord_avatar_url, discord_display_name, username')
              .in('user_id', userIds);

            if (profiles) {
              for (const p of profiles) {
                avatarMap[p.user_id] = p.discord_avatar_url || null;
              }
            }
          }

          setPlayers(lbData.map((p: any, i: number) => ({
            rank: i + 1,
            username: p.username || `Player${i + 1}`,
            avatarUrl: avatarMap[p.user_id] || null,
            winRate: p.total_matches > 0 ? `${Math.round((p.wins / p.total_matches) * 100)}%` : '0%',
            roundsWon: String(p.wins ?? 0),
            earnings: p.total_earnings != null ? String(Number(p.total_earnings).toFixed(0)) : '0',
          })));
        } else {
          // Fallback: get top 3 profiles by completed matches
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, username, discord_display_name, discord_avatar_url')
            .order('created_at', { ascending: true })
            .limit(3);

          if (profiles && profiles.length > 0) {
            setPlayers(profiles.map((p, i) => ({
              rank: i + 1,
              username: p.discord_display_name || p.username || `Player${i + 1}`,
              avatarUrl: p.discord_avatar_url || null,
              winRate: '0%',
              roundsWon: '0',
              earnings: '0',
            })));
          }
        }
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
      }
    };
    fetchLeaderboard();
  }, []);

  // Pad to 3 players minimum with empty placeholders
  const first: PlayerDisplay = players[0] ?? { rank: 1, username: '-', avatarUrl: null, winRate: '0%', roundsWon: '0', earnings: '0' };
  const second: PlayerDisplay = players[1] ?? { rank: 2, username: '-', avatarUrl: null, winRate: '0%', roundsWon: '0', earnings: '0' };
  const third: PlayerDisplay = players[2] ?? { rank: 3, username: '-', avatarUrl: null, winRate: '0%', roundsWon: '0', earnings: '0' };

  const Avatar = ({ url, alt, size }: { url: string | null; alt: string; size: string }) => (
    url ? (
      <img className={`${size} object-cover rounded-full`} alt={alt} src={url} />
    ) : (
      <div className={`${size} rounded-full bg-gradient-to-br from-[#3b28cc] to-[#6f5cff]`} />
    )
  );

  return (
    <div id="s-leaderboard" className="z-[3] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">
        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px] z-10">
          <button onClick={handlePrev} className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center">
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Previous" src={ACTIVE_HOME_ASSETS.shared.navPrev} />
          </button>
          <button onClick={handleNext} className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center">
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Next" src={ACTIVE_HOME_ASSETS.shared.navNext} />
          </button>
        </div>

        {/* Right side - star + CTA */}
        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img className="absolute top-[102px] left-[47px] w-[760px] h-[388px]" alt="" src={ACTIVE_HOME_ASSETS.leaderboard.star} />

          <div className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040]">
            <div className="w-[211px] ml-[34px] gap-3 mt-3.5 flex">
              <div className="w-[165px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">RANK UP</div>
              <img className="mt-[7px] w-8 h-[23px]" alt="" src={ACTIVE_HOME_ASSETS.shared.ctaArrow} />
            </div>
          </div>

          <div className="absolute top-[217px] left-[135px] w-[600px] h-[171px] flex flex-col items-center justify-center [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[48px] text-center tracking-[0] leading-[58px]">
            <span>Get on top of the</span>
            <span>leaderboard.</span>
            <span>Weekly rewards!</span>
          </div>
        </div>

        {/* Player cards */}
        <div className="absolute w-[584px] h-[378px] top-[257px] left-[53px]">
          {/* 3rd place - right */}
          <div className="absolute top-[78px] left-[417px] w-[169px] h-[300px]">
            <div className="absolute -top-px -left-px w-[169px] h-[302px] bg-[#272727] rounded-2xl border border-solid border-[#ff1654] shadow-[0px_4px_4px_#00000040]" />
            <div className="absolute top-6 left-[26px]">
              <Avatar url={third.avatarUrl} alt={third.username} size="w-[116px] h-[116px]" />
            </div>
            <div className="absolute top-[150px] left-0 right-0 text-center px-2">
              <div className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[#ff1654] text-[22px] leading-normal">#3</div>
              <div className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[22px] leading-normal truncate">{third.username}</div>
            </div>
          </div>

          {/* 2nd place - left */}
          <div className="absolute top-[78px] left-0 w-[169px] h-[300px]">
            <div className="absolute -top-px -left-px w-[169px] h-[302px] bg-[#272727] rounded-2xl border border-solid border-[#ff1654] shadow-[0px_4px_4px_#00000040]" />
            <div className="absolute top-6 left-[26px]">
              <Avatar url={second.avatarUrl} alt={second.username} size="w-[116px] h-[116px]" />
            </div>
            <div className="absolute top-[150px] left-0 right-0 text-center px-2">
              <div className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[#ff1654] text-[20px] leading-normal">#2</div>
              <div className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[20px] leading-normal truncate">{second.username}</div>
            </div>
          </div>

          {/* 1st place - center, larger */}
          <div className="absolute top-0 left-7 w-[530px] h-[378px]">
            <div className="absolute -top-px left-[158px] w-[212px] h-[380px] bg-[#272727] rounded-2xl border border-solid border-[#ff1654] shadow-[0px_4px_4px_#00000040]" />
            <div className="absolute top-[30px] left-48">
              <Avatar url={first.avatarUrl} alt={first.username} size="w-[146px] h-[146px]" />
            </div>

            {/* 1st place stats */}
            <div className="absolute top-[265px] left-48 w-[147px] flex flex-col gap-[6px]">
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[15px]">Win rate</span>
                <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[15px]">{first.winRate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[15px]">Rounds won</span>
                <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[15px]">{first.roundsWon}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[15px]">Earnings</span>
                <div className="flex items-center gap-1">
                  <div className="w-[11px] h-[11px] bg-[#ff1654] rounded-full flex-shrink-0" />
                  <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[15px]">{first.earnings}</span>
                </div>
              </div>
            </div>

            {/* 2nd place small stats */}
            <div className="left-0 absolute top-[294px] w-[111px] flex flex-col gap-[6.6px]">
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[11.3px]">Win rate</span>
                <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[11.3px]">{second.winRate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[11.3px]">Rounds won</span>
                <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[11.3px]">{second.roundsWon}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[11.3px]">Earnings</span>
                <div className="flex items-center gap-0.5">
                  <div className="w-[8.31px] h-[8.31px] bg-[#ff1654] rounded-full flex-shrink-0" />
                  <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[11.3px]">{second.earnings}</span>
                </div>
              </div>
            </div>

            {/* 3rd place small stats */}
            <div className="left-[417px] absolute top-[294px] w-[111px] flex flex-col gap-[6.6px]">
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[11.3px]">Win rate</span>
                <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[11.3px]">{third.winRate}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[11.3px]">Rounds won</span>
                <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[11.3px]">{third.roundsWon}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="[font-family:'Base_Neue_Trial-Regular',Helvetica] text-white text-[11.3px]">Earnings</span>
                <div className="flex items-center gap-0.5">
                  <div className="w-[8.31px] h-[8.31px] bg-[#ff1654] rounded-full flex-shrink-0" />
                  <span className="[font-family:'Base_Neue_Trial-RegularOblique',Helvetica] text-[#ff1654] text-[11.3px]">{third.earnings}</span>
                </div>
              </div>
            </div>

            <div className="absolute top-[189px] left-[158px] w-[212px] text-center px-2">
              <div className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[#ff1654] text-[22px] leading-normal">#1</div>
              <div className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[21px] leading-normal truncate">{first.username}</div>
            </div>
          </div>
        </div>

        {/* Section title */}
        <img className="left-0 w-[1277px] absolute top-0 h-[207px]" alt="" src={ACTIVE_HOME_ASSETS.leaderboard.title} />
        <div className="absolute top-[65px] left-[79px] w-[890px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal]">
          LEADERBOARD
        </div>
      </div>
    </div>
  );
};
