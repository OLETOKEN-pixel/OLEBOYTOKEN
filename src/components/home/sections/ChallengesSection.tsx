import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ChallengeDisplay {
  id: string;
  title: string;
  reward: string;
  progress: number; // 0-100
  completed: boolean;
}

const PLACEHOLDER_CHALLENGES: ChallengeDisplay[] = [
  { id: '1', title: 'Play 3 matches', reward: '+300XP', progress: 0, completed: false },
  { id: '2', title: 'Win a game without losing a round', reward: '', progress: 80, completed: false },
  { id: '3', title: 'Post an highlights', reward: '', progress: 100, completed: true },
  { id: '4', title: 'Shop a cosmetic', reward: '+5.000XP', progress: 0, completed: false },
  { id: '5', title: 'Abibi Yallah', reward: '+800XP', progress: 0, completed: false },
];

export const ChallengesSection = () => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeDisplay[]>(PLACEHOLDER_CHALLENGES);

  useEffect(() => {
    if (!user) return;
    const fetchChallenges = async () => {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .limit(5);

      if (!error && data && data.length > 0) {
        setChallenges(data.map((c: any) => ({
          id: c.id,
          title: c.title,
          reward: c.reward_xp > 0 ? `+${c.reward_xp.toLocaleString()}XP` : c.reward_coin > 0 ? `+${c.reward_coin}OBC` : '',
          progress: 0,
          completed: false,
        })));
      }
    };
    fetchChallenges();
  }, [user]);

  return (
    <div id="s-challenges" className="z-[2] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">
        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px]">
          <img className="w-[63.11px] h-[63.11px]" alt="Previous" src="https://c.animaapp.com/cjSO5wtV/img/bw-arrow-3@2x.png" />
          <img className="w-[63.11px] h-[63.11px]" alt="Next" src="https://c.animaapp.com/cjSO5wtV/img/fw-arrow-3@2x.png" />
        </div>

        {/* Right side — star + CTA */}
        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img className="absolute top-[102px] left-[47px] w-[760px] h-[388px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/star-shape-1.svg" />

          <div className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040]">
            <div className="mt-3.5 w-[212px] ml-[34px] flex gap-[11px]">
              <div className="w-[167px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">LEVEL UP</div>
              <img className="mt-[7px] w-8 h-[23px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/arrow--stroke--3.svg" />
            </div>
          </div>

          <p className="absolute top-[217px] left-12 w-[651px] h-[171px] [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-5xl text-right tracking-[0] leading-[normal]">
            Complete the tasks.<br />Get rewarded with<br />XP and OBC!
          </p>
        </div>

        {/* Challenge card */}
        <div className="absolute top-[254px] left-[3px] w-[675px] h-[382px]">
          <div className="absolute -top-px -left-px w-[677px] h-96 bg-[#272727] rounded-2xl border border-solid border-[#ff1654] shadow-[0px_4px_4px_#00000040]" />

          {/* Level badge */}
          <div className="absolute top-[215px] left-20 w-[100px] h-[123px]">
            <div className="absolute top-0 left-0 w-24 h-[123px] bg-[#0000006b] rounded" />
            <p className="absolute top-2 left-[17px] w-[61px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[11px] tracking-[0] leading-[normal]">
              <span className="[font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[11px] tracking-[0]">LVL.</span>
              <span className="text-lg">1000</span>
            </p>
            <div className="top-[42px] left-[26px] w-11 h-11 rounded-[22px] absolute bg-[#ff1654]" />
            <div className="absolute top-[93px] left-[13px] w-[69px] bg-[linear-gradient(90deg,rgba(255,255,255,1)_0%,rgba(255,78,125,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-transparent text-sm text-right tracking-[0] leading-[normal]">
              +20OBC
            </div>
          </div>

          {/* Circle progress graphic */}
          <img className="absolute top-[33px] left-[49px] w-[158px] h-[158px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/circle@2x.png" />

          {/* Challenge rows - bottom two */}
          <div className="absolute top-60 left-[237px] w-[401px] h-[103px]">
            <div className="absolute top-0 left-0 w-[393px] h-[47px] rounded-[7px] bg-[linear-gradient(0deg,rgba(15,4,4,0.32)_0%,rgba(15,4,4,0.32)_100%)]" />
            <div className="absolute top-14 left-0 w-[393px] h-[47px] rounded-[7px] bg-[linear-gradient(0deg,rgba(15,4,4,0.32)_0%,rgba(15,4,4,0.32)_100%)]" />
            <div className="absolute top-2.5 left-3.5 w-7 h-7 bg-[#0000006b] rounded-[3px]" />
            <div className="absolute top-[66px] left-3.5 w-7 h-7 bg-[#0000006b] rounded-[3px]" />
            <div className="absolute top-[15px] left-[57px] w-[129px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">
              {challenges[3]?.title ?? 'Shop a cosmetic'}
            </div>
            <div className="absolute top-[71px] left-[57px] w-[86px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">
              {challenges[4]?.title ?? 'Abibi Yallah'}
            </div>
            <div className="absolute top-[33px] left-[329px] w-[59px] bg-[linear-gradient(90deg,rgba(255,255,255,1)_0%,rgba(255,78,125,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-transparent text-[10px] text-right tracking-[0] leading-[normal] whitespace-nowrap">
              {challenges[3]?.reward || '+5.000XP'}
            </div>
            <div className="absolute top-[89px] left-[340px] w-12 bg-[linear-gradient(90deg,rgba(255,255,255,1)_0%,rgba(255,78,125,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-transparent text-[10px] text-right tracking-[0] leading-[normal] whitespace-nowrap">
              {challenges[4]?.reward || '+800XP'}
            </div>
          </div>

          {/* Completed challenge row */}
          <div className="absolute top-[143px] left-[237px] w-[397px] h-[47px]">
            <div className="absolute top-0 left-0 w-[393px] h-[47px] rounded-[7px] bg-[linear-gradient(0deg,rgba(255,22,84,0.58)_0%,rgba(255,22,84,0.58)_100%)]" />
            <div className="absolute top-2.5 left-3.5 w-7 h-7 rounded-[3px] bg-[linear-gradient(0deg,rgba(255,22,84,1)_0%,rgba(255,22,84,1)_100%)]" />
            <div className="absolute top-[15px] left-[57px] w-[136px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">
              {challenges[2]?.title ?? 'Post an highlights'}
            </div>
            <img className="absolute top-[35px] left-[346px] w-[41px] h-2" alt="" src="https://c.animaapp.com/cjSO5wtV/img/-100----@2x.png" />
            <div className="absolute top-9 left-[381px] w-[7px] h-[7px] bg-[#ff1654] rounded-[3.5px]" />
            <img className="absolute top-3.5 left-[18px] w-5 h-5" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-24.svg" />
          </div>

          {/* In-progress challenge row */}
          <div className="absolute top-[88px] left-[237px] w-[397px] h-[47px]">
            <div className="absolute top-0 left-0 w-[393px] h-[47px] rounded-[7px] bg-[linear-gradient(90deg,rgba(255,22,84,0.58)_100%,rgba(15,4,4,0.58)_100%)]" />
            <div className="absolute top-2.5 left-3.5 w-7 h-7 rounded-[3px] bg-[linear-gradient(0deg,rgba(255,22,84,1)_0%,rgba(255,22,84,1)_100%)]" />
            <p className="absolute top-[15px] left-[57px] w-[266px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">
              {challenges[1]?.title ?? 'Win a game without losing a round'}
            </p>
            <img className="absolute top-[35px] left-[354px] w-[34px] h-2" alt="" src="https://c.animaapp.com/cjSO5wtV/img/-80----@2x.png" />
            <div className="absolute top-9 left-[381px] w-[7px] h-[7px] bg-[#ff1654] rounded-[3.5px]" />
            <img className="absolute top-3.5 left-[18px] w-5 h-5" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-24.svg" />
          </div>

          {/* First challenge row */}
          <div className="absolute top-[33px] left-[237px] w-[397px] h-[47px]">
            <div className="absolute top-0 left-0 w-[393px] h-[47px] rounded-[7px] bg-[linear-gradient(90deg,rgba(255,22,84,0.42)_0%,rgba(15,4,4,0.42)_65%),linear-gradient(0deg,rgba(15,4,4,0.32)_0%,rgba(15,4,4,0.32)_100%)]" />
            <div className="absolute top-2.5 left-3.5 w-7 h-7 bg-[#0000006b] rounded-[3px]" />
            <div className="absolute top-[15px] left-[57px] w-[117px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap">
              {challenges[0]?.title ?? 'Play 3 matches'}
            </div>
            <div className="absolute top-[33px] left-[340px] w-12 bg-[linear-gradient(90deg,rgba(255,255,255,1)_0%,rgba(255,78,125,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-transparent text-[10px] tracking-[0] leading-[normal] whitespace-nowrap">
              {challenges[0]?.reward || '+300XP'}
            </div>
          </div>

          {/* Separator lines */}
          <img className="absolute top-[214px] left-[267px] w-[333px] h-px object-cover" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-23.svg" />
          <img className="absolute top-[248px] left-[90px] w-[75px] h-px object-cover" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-24-1.svg" />
        </div>

        {/* Section title */}
        <img className="left-0 w-[1159px] absolute top-0 h-[207px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/spaccato-title-1.png" />
        <div className="absolute top-[86px] left-[79px] w-[797px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal] whitespace-nowrap">
          CHALLENGES
        </div>
      </div>
    </div>
  );
};
