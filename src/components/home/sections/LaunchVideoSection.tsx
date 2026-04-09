import { ACTIVE_HOME_ASSETS } from './activeHomeAssets';

interface LaunchVideoSectionProps {
  displayName: string;
}

export const LaunchVideoSection = ({ displayName }: LaunchVideoSectionProps) => {
  const dots = [
    { active: true },
    { active: false },
    { active: false },
    { active: false },
  ];

  const scrollToMatches = () => {
    const el = document.getElementById('s-matches');
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
  };

  return (
    <div
      id="s-launch"
      className="z-[5] flex h-[955px] w-[1920px] flex-col bg-[#0f0404]"
      style={{ backgroundImage: `url(${ACTIVE_HOME_ASSETS.launch.background})`, backgroundSize: '100% 100%' }}
    >
      <div className="ml-[191px] w-[876px] h-[99px] relative mt-[174px]">
        <p className="absolute top-[5px] left-8 [font-family:'Base_Neue_Trial-Bold',Helvetica] font-normal text-white text-[50px] text-center tracking-[0] leading-[normal]">
          <span className="font-bold">Welcome</span>
          <span className="font-bold text-[64px]">, </span>
          <span className="[font-family:'Base_Neue_Trial-Black',Helvetica] font-black text-[64px]">
            {displayName}
          </span>
        </p>

        <img
          className="absolute top-[85px] left-[29px] w-[634px] h-3"
          alt=""
          src={ACTIVE_HOME_ASSETS.launch.underline}
        />

        <div className="absolute top-0 left-0 w-[45px] h-[67px]">
          <img className="absolute top-[33px] left-1.5 w-[18px] h-[26px]" alt="" src={ACTIVE_HOME_ASSETS.launch.triangles.largeBottom} />
          <img className="absolute top-[21px] left-[29px] w-3 h-[7px]" alt="" src={ACTIVE_HOME_ASSETS.launch.triangles.smallRight} />
          <img className="absolute top-[19px] left-[27px] w-1 h-[5px]" alt="" src={ACTIVE_HOME_ASSETS.launch.triangles.wireTop} />
          <img className="absolute top-[30px] left-[11px] w-2.5 h-1.5" alt="" src={ACTIVE_HOME_ASSETS.launch.triangles.wireBottom} />
          <img className="absolute top-1.5 left-[5px] w-[18px] h-[21px]" alt="" src={ACTIVE_HOME_ASSETS.launch.triangles.largeTop} />
        </div>
      </div>

      <a
        className="ml-[247px] w-[1427px] h-[475px] relative mt-[21.5px]"
        href="https://x.com/lightvsls/status/1928798617550360876?s=20"
        rel="noopener noreferrer"
        target="_blank"
      >
        <div className="absolute top-0 left-0 w-[1425px] h-[475px] bg-neutral-900 aspect-[3]" />
        <div className="absolute top-[361px] left-[325px] [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-5xl text-center tracking-[0] leading-[normal] whitespace-nowrap">
          Watch the launch video!
        </div>
        <div className="absolute top-[430px] left-[680px] w-[65px] h-[11px] flex gap-[6.7px]">
          {dots.map((dot, index) => (
            <div
              key={index}
              className={`w-[11.17px] h-[11.17px] rounded-[5.59px] ${dot.active ? 'bg-white' : 'bg-[#454545]'}`}
            />
          ))}
        </div>
      </a>

      <div className="ml-[822px] w-[276px] h-[65px] relative mt-[57px]">
        <button
          onClick={scrollToMatches}
          className="absolute top-0 left-0 w-[274px] h-[65px] bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040] cursor-pointer"
        >
          <span className="absolute top-[18px] left-16 [font-family:'Base_Neue_Trial-Regular',Helvetica] font-normal text-white text-2xl text-center tracking-[0] leading-[normal]">
            See sections
          </span>
          <img className="absolute top-[23px] left-5 w-4 h-[21px]" alt="" src={ACTIVE_HOME_ASSETS.launch.buttonArrowLeft} />
          <img className="absolute top-[23px] left-[237px] w-4 h-[21px]" alt="" src={ACTIVE_HOME_ASSETS.launch.buttonArrowRight} />
        </button>
      </div>
    </div>
  );
};
