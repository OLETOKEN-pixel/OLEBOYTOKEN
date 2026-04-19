import { useEffect } from 'react';
import { useChallenges } from '@/hooks/useChallenges';
import { getLevel, getXpInLevel, getXpToNext, getLevelXpRequired } from '@/lib/xp';
import { ACTIVE_HOME_ASSETS } from './activeHomeAssets';

interface ChallengeDisplay {
  id: string;
  title: string;
  reward: string;
  progress: number; // 0-100
  progressValue: number;
  targetValue: number;
  completed: boolean;
}

export const ChallengesSection = () => {
  const { challenges, userXp, claimChallenge } = useChallenges();

  // Auto-claim any completed-but-unclaimed challenges
  useEffect(() => {
    challenges
      .filter(c => c.is_completed && !c.is_claimed)
      .forEach(c => { claimChallenge(c.id, c.period_key).catch(() => {}); });
  }, [challenges, claimChallenge]);

  const displayChallenges: ChallengeDisplay[] = challenges.slice(0, 5).map(c => ({
    id: c.id,
    title: c.title,
    reward: c.reward_xp > 0
      ? `+${c.reward_xp}XP`
      : Number(c.reward_coin) > 0 ? `+${Number(c.reward_coin)}OBC` : '',
    progress: c.target_value > 0
      ? Math.min(100, Math.round((c.progress_value / c.target_value) * 100))
      : 0,
    progressValue: c.progress_value,
    targetValue: c.target_value,
    completed: c.is_completed || c.is_claimed,
  }));

  /* ---- helpers for per-row styling ---- */
  const checkBg = (c: ChallengeDisplay) =>
    c.completed ? 'bg-[#ff1654]' : 'bg-[rgba(0,0,0,0.42)]';

  const level = getLevel(userXp);
  const xpInLevel = getXpInLevel(userXp);
  const xpToNext = getXpToNext(userXp);
  const xpRequired = getLevelXpRequired(level);
  const RING_R = 70;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const ringOffset = RING_CIRC * (1 - xpInLevel / xpRequired);

  /* Row y-offsets inside the card (5 fixed positions matching the Anima layout) */
  const ROW_Y = [33, 88, 143, 240, 296];

  return (
    <div id="s-challenges" className="z-[2] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">
        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px] z-10">
          <button className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center" onClick={() => { const el = document.getElementById('s-leaderboard'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }}>
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Previous" src={ACTIVE_HOME_ASSETS.shared.navPrev} />
          </button>
          <button className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center" onClick={() => { const el = document.getElementById('s-highlights'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }}>
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Next" src={ACTIVE_HOME_ASSETS.shared.navNext} />
          </button>
        </div>

        {/* Right side — star + CTA */}
        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img className="absolute top-[102px] left-[47px] w-[760px] h-[388px]" alt="" src={ACTIVE_HOME_ASSETS.challenges.star} />

          <div className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040]">
            <div className="mt-3.5 w-[212px] ml-[34px] flex gap-[11px]">
              <div className="w-[167px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">LEVEL UP</div>
              <img className="mt-[7px] w-8 h-[23px]" alt="" src={ACTIVE_HOME_ASSETS.shared.ctaArrow} />
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
          {displayChallenges.map((c, i) => {
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
                  <img className="absolute top-3.5 left-[18px] w-5 h-5" alt="" src={ACTIVE_HOME_ASSETS.challenges.checkmark} />
                )}
                {/* Title */}
                <div className="absolute top-[15px] left-[57px] w-[200px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[15px] tracking-[0] leading-[normal] whitespace-nowrap overflow-hidden text-ellipsis">
                  {c.title}
                </div>
                {/* Progress counter for multi-step challenges */}
                {!c.completed && c.targetValue > 1 && (
                  <div className="absolute top-[15px] left-[260px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-[#ff1654] text-[12px] leading-normal whitespace-nowrap">
                    {c.progressValue}/{c.targetValue}
                  </div>
                )}
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
          <img className="absolute top-[214px] left-[267px] w-[333px] h-px object-cover" alt="" src={ACTIVE_HOME_ASSETS.challenges.separatorMain} />
          <img className="absolute top-[248px] left-[90px] w-[75px] h-px object-cover" alt="" src={ACTIVE_HOME_ASSETS.challenges.separatorSecondary} />
        </div>

        {/* Section title */}
        <img className="left-0 w-[1159px] absolute top-0 h-[207px]" alt="" src={ACTIVE_HOME_ASSETS.challenges.title} />
        <div className="absolute top-[65px] left-[79px] w-[797px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal] whitespace-nowrap">
          CHALLENGES
        </div>
      </div>
    </div>
  );
};
