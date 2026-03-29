import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Match } from '@/types';

interface MatchDisplay {
  id: string;
  title: string;
  firstTo: string;
  platform: string;
  entryFee: string;
  prize: string;
  expiresIn: string;
}

function formatTimeLeft(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return '00:00';
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function matchToDisplay(m: Match): MatchDisplay {
  const fee = m.entry_fee ?? 0;
  const prize = fee * 2 * 0.95; // 5% platform fee
  return {
    id: m.id,
    title: m.mode === 'Box Fight' ? 'BUILD FIGHT' : m.mode === 'Realistic' ? 'REALISTIC 1V1' : 'ZONE WARS',
    firstTo: `${m.first_to}+2`,
    platform: m.platform === 'Console' ? 'PS5' : m.platform,
    entryFee: fee.toFixed(2),
    prize: prize.toFixed(2),
    expiresIn: formatTimeLeft(m.expires_at),
  };
}

const PLACEHOLDER_MATCHES: MatchDisplay[] = [
  { id: '1', title: 'BUILD FIGHT', firstTo: '5+2', platform: 'PS5', entryFee: '0.75', prize: '1.40', expiresIn: '23:00' },
  { id: '2', title: 'REALISTIC 1V1', firstTo: '5+2', platform: 'PC', entryFee: '2.20', prize: '4.00', expiresIn: '00:13' },
];

export const LiveMatchesSection = () => {
  const [matches, setMatches] = useState<MatchDisplay[]>(PLACEHOLDER_MATCHES);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(2);

      if (!error && data && data.length > 0) {
        setMatches(data.map(matchToDisplay));
      }
    };
    fetchMatches();
  }, []);

  const main = matches[0] ?? PLACEHOLDER_MATCHES[0];
  const secondary = matches[1] ?? PLACEHOLDER_MATCHES[1];

  return (
    <div id="s-matches" className="z-[4] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">
        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px]">
          <button className="cursor-pointer bg-transparent border-none p-0" onClick={() => document.getElementById('s-launch')?.scrollIntoView({ behavior: 'smooth' })}>
            <img className="w-[63.11px] h-[63.11px]" alt="Previous" src="https://c.animaapp.com/cjSO5wtV/img/bw-arrow-3@2x.png" />
          </button>
          <button className="cursor-pointer bg-transparent border-none p-0" onClick={() => document.getElementById('s-leaderboard')?.scrollIntoView({ behavior: 'smooth' })}>
            <img className="w-[63.11px] h-[63.11px]" alt="Next" src="https://c.animaapp.com/cjSO5wtV/img/fw-arrow-3@2x.png" />
          </button>
        </div>

        {/* Right side — star shape + CTA */}
        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img className="absolute top-[102px] left-[47px] w-[760px] h-[388px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/star-shape-3.svg" />

          <div className="absolute top-[406px] left-[311px] w-[214px] h-[65px] flex bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040]">
            <div className="w-[145px] ml-[35px] gap-[18px] mt-3.5 flex">
              <div className="w-[93px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">
                PLAY
              </div>
              <img className="mt-[7px] w-8 h-[23px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/arrow--stroke--3.svg" />
            </div>
          </div>

          <div className="absolute top-[215px] left-[136px] w-[600px] h-[171px] flex flex-col items-center justify-center [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[48px] text-center tracking-[0] leading-[58px]">
            <span>Find an opponent.</span>
            <span>Let&apos;s see who&apos;s</span>
            <span>built different!</span>
          </div>
        </div>

        {/* Match cards */}
        <div className="absolute w-[625px] h-[400px] top-56 left-[3px] flex gap-[92px]">
          {/* Main match card */}
          <div className="w-[300px] h-[400px] relative bg-[#272727] rounded-xl border border-solid border-[#ff1654]">
            <div className="absolute top-[335px] left-[26px] w-[249px] h-11">
              <div className="absolute top-0 left-0 w-[247px] h-11 bg-[#ff1654] rounded-lg" />
              <div className="absolute top-2.5 left-10 [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-xl text-right tracking-[0] leading-[normal] whitespace-nowrap">
                Accept token
              </div>
            </div>

            <div className="absolute top-[261px] left-[38px] w-[104px] h-[55px]">
              <div className="absolute top-0 left-0 [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">Expires in</div>
              <img className="absolute top-[31px] left-0 w-[19px] h-[19px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/ellipse-6-1.svg" />
              <div className="absolute top-[26px] left-6 [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-2xl text-white tracking-[0] leading-[normal]">
                {main.expiresIn}
              </div>
            </div>

            <div className="absolute top-[187px] left-[38px] w-[232px] h-[55px]">
              <div className="absolute top-0 left-0 [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">Entry fee</div>
              <div className="absolute top-0 left-[132px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">Prize</div>
              <div className="top-[31px] left-0 w-[19px] h-[19px] rounded-[9.5px] absolute bg-[#ff1654]" />
              <div className="absolute top-[26px] left-6 [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-2xl text-white tracking-[0] leading-[normal]">{main.entryFee}</div>
              <img className="absolute top-[35px] left-[100px] w-4 h-[11px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/arrow--stroke--5.svg" />
              <div className="absolute top-[26px] left-[166px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-2xl text-white tracking-[0] leading-[normal]">{main.prize}</div>
              <img className="absolute top-[31px] left-[132px] w-[23px] h-[19px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-23-2.svg" />
            </div>

            <div className="absolute top-[107px] left-[170px] w-[86px] h-14 flex flex-col gap-[3px]">
              <div className="w-[82px] h-6 [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-xl text-center tracking-[0] leading-[normal] whitespace-nowrap">Platform</div>
              <div className="w-[45px] h-[29px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-2xl tracking-[0] leading-[normal]">{main.platform}</div>
            </div>

            <div className="absolute top-[107px] left-[38px] w-[79px] h-[60px]">
              <div className="absolute top-0 left-0 [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-xl tracking-[0] leading-[normal] whitespace-nowrap">First to</div>
              <div className="absolute top-6 left-[22px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-3xl whitespace-nowrap text-white tracking-[0] leading-[normal]">{main.firstTo}</div>
              <div className="absolute top-7 left-0 w-[19px] h-7">
                <img className="absolute top-3.5 left-[3px] w-2 h-[11px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/polygon-6-1.svg" />
                <img className="absolute top-[9px] left-3 w-[5px] h-[3px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/polygon-7-1.svg" />
                <img className="top-2 left-[11px] w-0.5 absolute h-0.5" alt="" src="https://c.animaapp.com/cjSO5wtV/img/polygon-8-1.svg" />
                <img className="top-[13px] left-1 w-1 absolute h-0.5" alt="" src="https://c.animaapp.com/cjSO5wtV/img/polygon-9-1.svg" />
                <img className="top-[3px] w-2 h-[9px] absolute left-0.5" alt="" src="https://c.animaapp.com/cjSO5wtV/img/polygon-10-1.svg" />
              </div>
            </div>

            <div className="absolute top-[25px] left-5 w-[261px] h-[53px] flex flex-col gap-[14.5px]">
              <div className="ml-[22px] w-[216px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] tracking-[0] leading-[normal] whitespace-nowrap">
                {main.title}
              </div>
              <img className="w-[259px] h-px object-cover" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-22-1.svg" />
            </div>
          </div>

          {/* Secondary match card (blurred) */}
          <div className="mt-[89px] w-[233.48px] h-[311.3px] relative bg-[#272727] rounded-[9.34px] border-[0.78px] border-solid border-[#ff1654] shadow-[inset_0px_-319px_4px_#00000040] blur-[1.35px]">
            <div className="absolute top-[261px] left-5 w-[194px] h-[34px]">
              <div className="absolute top-px left-0 w-48 h-[34px] bg-[#ff1654] rounded-[6.23px]" />
              <div className="absolute top-2 left-[31px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[15.6px] text-right tracking-[0] leading-[normal]">Accept token</div>
            </div>

            <div className="absolute top-[203px] left-[30px] w-[82px] h-[42px]">
              <div className="absolute top-0 left-px [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[15.6px] tracking-[0] leading-[normal]">Expires in</div>
              <div className="absolute top-5 left-[19px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-[18.7px] whitespace-nowrap text-white tracking-[0] leading-[normal]">{secondary.expiresIn}</div>
            </div>

            <div className="absolute top-[146px] left-[30px] w-[182px] h-[42px]">
              <div className="absolute top-px left-px [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[15.6px] tracking-[0] leading-[normal]">Entry fee</div>
              <div className="absolute top-px left-[103px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[15.6px] tracking-[0] leading-[normal]">Prize</div>
              <div className="top-6 left-px w-[15px] h-[15px] rounded-[7.39px] absolute bg-[#ff1654]" />
              <div className="absolute top-5 left-[19px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-[18.7px] whitespace-nowrap text-white tracking-[0] leading-[normal]">{secondary.entryFee}</div>
              <img className="absolute top-[27px] left-[78px] w-3 h-[9px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/arrow--stroke--4.svg" />
              <div className="absolute top-5 left-[129px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-[18.7px] whitespace-nowrap text-white tracking-[0] leading-[normal]">{secondary.prize}</div>
              <img className="absolute top-6 left-[103px] w-[18px] h-[15px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-23-1.svg" />
            </div>

            <div className="absolute top-[83px] left-[132px] w-[68px] h-[43px] flex flex-col gap-0.5">
              <div className="w-16 h-[19px] [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[15.6px] text-center tracking-[0] leading-[normal]">Platform</div>
              <div className="w-6 h-[22px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[18.7px] tracking-[0] leading-[normal] whitespace-nowrap">{secondary.platform}</div>
            </div>

            <div className="absolute top-[83px] left-[30px] w-[62px] h-[47px]">
              <div className="absolute top-0 left-px [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-[15.6px] tracking-[0] leading-[normal]">First to</div>
              <div className="absolute top-[19px] left-[17px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-[23.3px] whitespace-nowrap text-white tracking-[0] leading-[normal]">{secondary.firstTo}</div>
            </div>

            <div className="absolute top-[18px] left-[13px] w-[209px] h-[43px] flex flex-col gap-[12.3px]">
              <div className="w-[207px] h-[30px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[24.9px] tracking-[0] leading-[normal]">{secondary.title}</div>
              <img className="ml-[2.6px] w-[201.57px] h-px" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-22.svg" />
            </div>
          </div>
        </div>

        {/* Section title */}
        <img className="absolute top-0 left-0 w-[1263px] h-[207px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/spaccato-title-3.png" />
        <div className="absolute top-[65px] left-[79px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal] whitespace-nowrap">
          LIVE MATCHES
        </div>
      </div>
    </div>
  );
};
