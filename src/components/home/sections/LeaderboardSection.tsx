import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlayerDisplay {
  rank: number;
  username: string;
  avatarUrl: string;
  winRate: string;
  roundsWon: string;
  earnings: string;
}

const PLACEHOLDER_PLAYERS: PlayerDisplay[] = [
  { rank: 1, username: 'LIGHTVSLS', avatarUrl: 'https://c.animaapp.com/cjSO5wtV/img/marv-2@2x.png', winRate: '70%', roundsWon: '253', earnings: '2.000' },
  { rank: 2, username: 'MarvFN', avatarUrl: 'https://c.animaapp.com/cjSO5wtV/img/marv-1@2x.png', winRate: '59%', roundsWon: '189', earnings: '1.543' },
  { rank: 3, username: 'TomTom', avatarUrl: 'https://c.animaapp.com/cjSO5wtV/img/marv@2x.png', winRate: '23%', roundsWon: '107', earnings: '874' },
];

export const LeaderboardSection = () => {
  const [players, setPlayers] = useState<PlayerDisplay[]>(PLACEHOLDER_PLAYERS);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from('leaderboard_weekly')
        .select('*')
        .order('wins', { ascending: false })
        .limit(3);

      if (!error && data && data.length >= 3) {
        setPlayers(data.map((p: any, i: number) => ({
          rank: i + 1,
          username: p.username || `Player${i + 1}`,
          avatarUrl: p.avatar_url || PLACEHOLDER_PLAYERS[i].avatarUrl,
          winRate: p.total_matches > 0 ? `${Math.round((p.wins / p.total_matches) * 100)}%` : '0%',
          roundsWon: String(p.wins ?? 0),
          earnings: String(p.total_earnings?.toFixed(0) ?? 0),
        })));
      }
    };
    fetchLeaderboard();
  }, []);

  const first = players[0];
  const second = players[1];
  const third = players[2];

  return (
    <div id="s-leaderboard" className="z-[3] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">
        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px]">
          <img className="w-[63.11px] h-[63.11px]" alt="Previous" src="https://c.animaapp.com/cjSO5wtV/img/bw-arrow-3@2x.png" />
          <img className="w-[63.11px] h-[63.11px]" alt="Next" src="https://c.animaapp.com/cjSO5wtV/img/fw-arrow-3@2x.png" />
        </div>

        {/* Right side — star + CTA */}
        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img className="absolute top-[102px] left-[47px] w-[760px] h-[388px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/star-shape-2.svg" />

          <div className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040]">
            <div className="w-[211px] ml-[34px] gap-3 mt-3.5 flex">
              <div className="w-[165px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">RANK UP</div>
              <img className="mt-[7px] w-8 h-[23px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/arrow--stroke--3.svg" />
            </div>
          </div>

          <p className="absolute top-[217px] left-[135px] h-[171px] [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-5xl text-right tracking-[0] leading-[normal]">
            Get on top of the<br />leaderboard.<br />Weekly rewards!
          </p>
        </div>

        {/* Player cards */}
        <div className="absolute w-[584px] h-[378px] top-[257px] left-[53px]">
          {/* 3rd place — right */}
          <div className="absolute top-[78px] left-[417px] w-[169px] h-[300px]">
            <div className="absolute -top-px -left-px w-[169px] h-[302px] bg-[#272727] rounded-2xl border border-solid border-[#ff1654] shadow-[0px_4px_4px_#00000040]" />
            <img className="absolute top-6 left-[26px] w-[116px] h-[116px] object-cover" alt={third.username} src={third.avatarUrl} />
            <p className="absolute top-[150px] left-[23px] [font-family:'Base_Neue_Trial-Black',Helvetica] font-normal text-transparent text-[22px] text-center leading-[normal]">
              <span className="tracking-[0.63px] font-black text-[#ff1654]">3</span>
              <span className="font-black text-[#ff1654] text-2xl tracking-[0]">°</span>
              <span className="[font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white tracking-[0]"> {third.username}</span>
            </p>
          </div>

          {/* 2nd place — left */}
          <div className="absolute top-[78px] left-0 w-[169px] h-[300px]">
            <div className="absolute -top-px -left-px w-[169px] h-[302px] bg-[#272727] rounded-2xl border border-solid border-[#ff1654] shadow-[0px_4px_4px_#00000040]" />
            <img className="absolute top-6 left-[26px] w-[116px] h-[116px] object-cover" alt={second.username} src={second.avatarUrl} />
            <p className="absolute top-[150px] left-[33px] [font-family:'Base_Neue_Trial-Black',Helvetica] font-normal text-transparent text-xl text-center leading-[normal]">
              <span className="tracking-[0.52px] font-black text-[#ff1654]">2</span>
              <span className="font-black text-[#ff1654] text-[22px] tracking-[0]">°</span>
              <span className="[font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white tracking-[0]"> {second.username}</span>
            </p>
          </div>

          {/* 1st place — center, larger */}
          <div className="absolute top-0 left-7 w-[530px] h-[378px]">
            <div className="absolute -top-px left-[158px] w-[212px] h-[380px] bg-[#272727] rounded-2xl border border-solid border-[#ff1654] shadow-[0px_4px_4px_#00000040]" />
            <img className="absolute top-[30px] left-48 w-[146px] h-[146px] object-cover" alt={first.username} src={first.avatarUrl} />

            {/* 1st place stats */}
            <div className="absolute top-[265px] left-48 w-[147px] h-[70px] flex">
              <div className="w-[89px] h-[70px] flex flex-col gap-2">
                <div className="w-[61px] h-[18px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">Win rate</div>
                <div className="w-[83px] h-[18px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">Rounds won</div>
                <div className="w-[61px] h-[18px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">Earnings</div>
              </div>
              <div className="mt-[55px] w-[11px] h-[11px] ml-[9px] bg-[#ff1654] rounded-[5.5px]" />
              <div className="w-[39px] h-[70px] ml-[5px] flex flex-col gap-2">
                <div className="ml-[5px] w-[27px] h-[18px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">{first.winRate}</div>
                <div className="ml-[9px] w-[23px] h-[18px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[15px] text-right tracking-[0] leading-[normal] whitespace-nowrap">{first.roundsWon}</div>
                <div className="w-[33px] h-[18px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[15px] text-right tracking-[0] leading-[normal] whitespace-nowrap">{first.earnings}</div>
              </div>
            </div>

            {/* 2nd place small stats (left) */}
            <div className="left-0 flex absolute top-[294px] w-[111px] h-[52px]">
              <div className="w-[69px] h-[52.27px] flex flex-col gap-[6.6px]">
                <div className="w-[46px] h-[13px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[11.3px] tracking-[0] leading-[normal] whitespace-nowrap">Win rate</div>
                <div className="w-[63px] h-[13px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[11.3px] tracking-[0] leading-[normal] whitespace-nowrap">Rounds won</div>
                <div className="w-[46px] h-[13px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[11.3px] tracking-[0] leading-[normal] whitespace-nowrap">Earnings</div>
              </div>
              <div className="mt-[41.5px] w-[8.31px] h-[8.31px] ml-[5px] bg-[#ff1654] rounded-[4.15px]" />
              <div className="mt-0 w-[31px] h-[52.27px] ml-[3.8px] flex flex-col gap-[6.6px]">
                <div className="ml-[3.8px] w-[21px] h-[13px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[11.3px] text-right tracking-[0] leading-[normal] whitespace-nowrap">{second.winRate}</div>
                <div className="ml-[7.8px] w-[17px] h-[13px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[11.3px] text-right tracking-[0] leading-[normal] whitespace-nowrap">{second.roundsWon}</div>
                <div className="ml-0 w-[25px] h-[13px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[11.3px] text-right tracking-[0] leading-[normal] whitespace-nowrap">{second.earnings}</div>
              </div>
            </div>

            {/* 3rd place small stats (right) */}
            <div className="left-[417px] absolute top-[294px] w-[111px] h-[52px]">
              <div className="absolute top-[42px] left-[82px] w-2 h-2 bg-[#ff1654] rounded-[4.15px]" />
              <div className="absolute top-0 left-[90px] w-[27px] h-[52px] flex flex-col gap-[6.6px]">
                <div className="w-[21px] h-[13px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[11.3px] text-right tracking-[0] leading-[normal] whitespace-nowrap">{third.winRate}</div>
                <div className="ml-[4px] w-[17px] h-[13px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[11.3px] text-right tracking-[0] leading-[normal] whitespace-nowrap">{third.roundsWon}</div>
                <div className="ml-[4.2px] w-[17px] h-[13px] [font-family:'Base_Neue_Trial-RegularOblique',Helvetica] font-normal text-[#ff1654] text-[11.3px] text-right tracking-[0] leading-[normal] whitespace-nowrap">{third.earnings}</div>
              </div>
              <div className="absolute top-0 left-0 w-[69px] h-[52px] flex flex-col gap-[6.6px]">
                <div className="w-[46px] h-[13px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[11.3px] tracking-[0] leading-[normal] whitespace-nowrap">Win rate</div>
                <div className="w-[63px] h-[13px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[11.3px] tracking-[0] leading-[normal] whitespace-nowrap">Rounds won</div>
                <div className="w-[46px] h-[13px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[11.3px] tracking-[0] leading-[normal] whitespace-nowrap">Earnings</div>
              </div>
            </div>

            <p className="absolute top-[189px] left-48 w-[146px] [font-family:'Base_Neue_Trial-Black',Helvetica] font-normal text-transparent text-[22px] text-center leading-[normal]">
              <span className="tracking-[0.63px] font-black text-[#ff1654]">1</span>
              <span className="font-black text-[#ff1654] text-2xl tracking-[0]">°</span>
              <span className="[font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[21px] tracking-[0]"> {first.username}</span>
            </p>
          </div>
        </div>

        {/* Section title */}
        <img className="left-0 w-[1277px] absolute top-0 h-[207px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/spaccato-title-2.png" />
        <div className="absolute top-[86px] left-[79px] w-[890px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal]">
          LEADERBOARD
        </div>
      </div>
    </div>
  );
};
