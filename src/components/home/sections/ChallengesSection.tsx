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

export const ChallengesSection = () => {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeDisplay[]>([]);
  const [userXp, setUserXp] = useState(0);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Fetch active challenges (max 5)
      const { data: challengeRows } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .order('created_at')
        .limit(5);

      if (!challengeRows || challengeRows.length === 0) return;

      // Build period keys for today (daily) and this week (weekly)
      const now = new Date();
      const dailyKey = now.toISOString().split('T')[0];
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      const weeklyKey = mon.toISOString().split('T')[0];

      // Fetch this user's progress for these challenges in current period
      const { data: progressRows } = await supabase
        .from('user_challenge_progress')
        .select('*')
        .eq('user_id', user.id)
        .in('challenge_id', challengeRows.map((c: any) => c.id))
        .in('period_key', [dailyKey, weeklyKey]);

      const progressMap = new Map<string, any>();
      (progressRows || []).forEach((p: any) => progressMap.set(p.challenge_id, p));

      setChallenges(
        challengeRows.map((c: any) => {
          const p = progressMap.get(c.id);
          const pct = p
            ? Math.min(100, Math.round((p.progress_value / c.target_value) * 100))
            : 0;
          const rewardText =
            c.reward_xp > 0
              ? `+${c.reward_xp}XP`
              : Number(c.reward_coin) > 0
                ? `+${c.reward_coin}OBC`
                : '';
          return {
            id: c.id,
            title: c.title,
            reward: rewardText,
            progress: pct,
            completed: p?.is_completed ?? false,
          };
        }),
      );

      // Fetch user XP for level badge
      const { data: xpRow } = await supabase
        .from('user_xp')
        .select('total_xp')
        .eq('user_id', user.id)
        .single();

      if (xpRow) setUserXp(xpRow.total_xp);
    };

    fetchData();
  }, [user]);

  /* ---- helpers for per-row styling ---- */
  const checkBg = (c: ChallengeDisplay) =>
    c.completed ? 'bg-[#ff1654]' : 'bg-[rgba(0,0,0,0.42)]';

  const level = Math.floor(userXp / 100);
  const xpInLevel = userXp % 100;
  const xpToNext = xpInLevel === 0 ? 100 : 100 - xpInLevel;
  const RING_R = 70;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringOffset = RING_CIRC * (1 - xpInLevel / 100);

  /* Row y-offsets inside the card (5 fixed positions matching the Anima layout) */
  const ROW_Y = [33, 88, 143, 240, 296];

  return (
    <div id="s-challenges" className="z-[2] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">
        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px] z-10">
          <button className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center" onClick={() => { const el = document.getElementById('s-leaderboard'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }}>
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Previous" src="https://c.animaapp.com/cjSO5wtV/img/bw-arrow-3@2x.png" />
          </button>
          <button className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center" onClick={() => { const el = document.getElementById('s-highlights'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }}>
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Next" src="https://c.animaapp.com/cjSO5wtV/img/fw-arrow-3@2x.png" />
          </button>
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

          <div className="absolute top-[217px] left-12 w-[651px] h-[171px] flex flex-col items-center justify-center [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[48px] text-center tracking-[0] leading-[58px]">
            <span>Complete the tasks.</span>
            <span>Get rewarded with</span>
            <span>XP and OBC!</span>
          </div>
        </div>

        {/* Challenge card */}
        <div className="absolute top-[254px] left-[3px] w-[675px] h-[382px]">
          <div className="absolute -top-px -left-px w-[677px] h-96 bg-[#272727] rounded-2xl border border-solid border-[#ff1654] shadow-[0px_4px_4px_#00000040]" />

          {/* Level badge */}
          <div className="absolute top-[215px] left-20 w-[100px] h-[123px]">
            <div className="absolute top-0 left-0 w-24 h-[123px] bg-[#0000006b] rounded" />
            <p className="absolute top-2 left-[17px] w-[61px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[11px] tracking-[0] leading-[normal]">
              <span className="[font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[11px] tracking-[0]">LVL.</span>
              <span className="text-lg">{level}</span>
            </p>
            <div className="top-[42px] left-[26px] w-11 h-11 rounded-[22px] absolute bg-[#ff1654]" />
            <div className="absolute top-[93px] left-[13px] w-[69px] bg-[linear-gradient(90deg,rgba(255,255,255,1)_0%,rgba(255,78,125,1)_100%)] [-webkit-background-clip:text] bg-clip-text [-webkit-text-fill-color:transparent] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-transparent text-sm text-right tracking-[0] leading-[normal]">
              +20OBC
            </div>
          </div>

          {/* Circle progress — dynamic SVG ring */}
          <div className="absolute top-[33px] left-[49px] w-[158px] h-[158px]">
            <svg width="158" height="158" viewBox="0 0 158 158">
              <circle cx="79" cy="79" r={RING_R} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="14" />
              <circle
                cx="79" cy="79" r={RING_R} fill="none"
                stroke="#ff1654" strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 79 79)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
              <span className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-[32px] leading-none">
                {userXp}
              </span>
              <span className="[font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[11px] leading-normal">
                {xpToNext}XP left
              </span>
            </div>
          </div>

          {/* Challenge rows — dynamically rendered from DB */}
          {challenges.map((c, i) => {
            if (i >= 5) return null;
            const y = ROW_Y[i];
            return (
              <div key={c.id} className="absolute left-[237px] w-[393px] h-[47px]" style={{ top: `${y}px` }}>
                {/* Row background */}
                <div
                  className={`absolute top-0 left-0 w-[393px] h-[47px] rounded-[7px] ${c.completed ? 'bg-[rgba(255,22,84,0.58)]' : ''}`}
                  style={!c.completed ? {
                    backgroundImage:
                      'linear-gradient(90deg, rgba(255,22,84,0.42) 0%, rgba(15,4,4,0.42) 64.904%), linear-gradient(90deg, rgba(15,4,4,0.32) 0%, rgba(15,4,4,0.32) 100%)',
                  } : undefined}
                />
                {/* Checkbox */}
                <div className={`absolute top-2.5 left-3.5 w-7 h-7 rounded-[3px] ${checkBg(c)}`} />
                {/* Checkmark icon (only if completed) */}
                {c.completed && (
                  <img className="absolute top-3.5 left-[18px] w-5 h-5" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-24.svg" />
                )}
                {/* Title */}
                <div className="absolute top-[15px] left-[57px] w-[230px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap overflow-hidden text-ellipsis">
                  {c.title}
                </div>
                {/* Reward + dot (dot only if completed) */}
                {c.reward && (
                  <div className="absolute top-[15px] right-[6px] flex items-center gap-[4px]">
                    {c.completed && (
                      <div className="w-[7px] h-[7px] bg-[#ff1654] rounded-full flex-shrink-0" />
                    )}
                    <div
                      className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[10px] text-right leading-normal whitespace-nowrap"
                      style={{
                        background: 'linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,78,125,1) 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}
                    >
                      {c.reward}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Separator lines */}
          <img className="absolute top-[214px] left-[267px] w-[333px] h-px object-cover" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-23.svg" />
          <img className="absolute top-[248px] left-[90px] w-[75px] h-px object-cover" alt="" src="https://c.animaapp.com/cjSO5wtV/img/vector-24-1.svg" />
        </div>

        {/* Section title */}
        <img className="left-0 w-[1159px] absolute top-0 h-[207px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/spaccato-title-1.png" />
        <div className="absolute top-[65px] left-[79px] w-[797px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal] whitespace-nowrap">
          CHALLENGES
        </div>
      </div>
    </div>
  );
};
