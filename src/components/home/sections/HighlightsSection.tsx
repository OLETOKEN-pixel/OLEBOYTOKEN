const videoItems = [
  { href: 'https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5', src: '/showreel/highlight-video-1.png', alt: 'Piz montage 1' },
  { href: 'https://youtu.be/SDIys2MtwnA?si=Tba7ZE_Uda0qphNI', src: '/showreel/highlight-video-2.png', alt: 'Maxresdefault' },
  { href: 'https://youtu.be/YcUuHL9i_7c?si=rHCyzj47PmRRa_ph', src: '/showreel/highlight-video-3.png', alt: 'Piz montage 2' },
];

export const HighlightsSection = () => {

  return (
    <div id="s-highlights" className="z-[1] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">
        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px]">
          <button className="cursor-pointer bg-transparent border-none p-0" onClick={() => document.getElementById('s-challenges')?.scrollIntoView({ behavior: 'smooth' })}>
            <img className="w-[63.11px] h-[63.11px]" alt="Previous" src="https://c.animaapp.com/cjSO5wtV/img/bw-arrow-3@2x.png" />
          </button>
          <button className="cursor-pointer bg-transparent border-none p-0" onClick={() => document.getElementById('s-teams')?.scrollIntoView({ behavior: 'smooth' })}>
            <img className="w-[63.11px] h-[63.11px]" alt="Next" src="https://c.animaapp.com/cjSO5wtV/img/fw-arrow-3@2x.png" />
          </button>
        </div>

        {/* Right side — star + CTA */}
        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img className="absolute top-[102px] left-[47px] w-[760px] h-[388px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/star-shape.svg" />

          <div className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040]">
            <div className="mt-3.5 w-[212px] ml-[34px] flex gap-[11px]">
              <div className="w-[167px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">
                WATCH
              </div>
              <img className="mt-[7px] w-8 h-[23px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/arrow--stroke--3.svg" />
            </div>
          </div>

          <div className="absolute top-[216px] left-[118px] w-[600px] h-[167px] flex flex-col items-center justify-center [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[48px] text-center tracking-[0] leading-[58px]">
            <span>Publish and vote.</span>
            <span>The most liked will</span>
            <span>get extra OBC!</span>
          </div>
        </div>

        {/* Video carousel */}
        <div className="absolute top-[311px] left-0 w-[675px] h-[229px] overflow-hidden group">
          <div
            className="flex h-[229px] w-max animate-marquee group-hover:[animation-play-state:paused]"
            style={{ animationDuration: '8s', willChange: 'transform' }}
          >
            {[...videoItems, ...videoItems].map((item, index) => (
              <a key={index} href={item.href} rel="noopener noreferrer" target="_blank" className="flex-shrink-0 block w-[408px] h-[229px] mr-[52px] rounded-[11px] overflow-hidden">
                <img className="w-full h-full object-cover" alt={item.alt} src={item.src} />
              </a>
            ))}
          </div>
        </div>

        {/* Gradient overlays for carousel edges */}
        <div className="absolute top-[311px] left-[395px] w-[285px] h-[229px] bg-[linear-gradient(270deg,rgba(15,4,4,1)_0%,rgba(15,4,4,0)_100%)]" />
        <div className="absolute top-[311px] left-0 w-[375px] h-[229px] bg-[linear-gradient(270deg,rgba(15,4,4,0)_0%,rgba(15,4,4,1)_100%)]" />

        {/* Section title */}
        <img className="left-px w-[1044px] absolute top-0 h-[207px]" alt="" src="https://c.animaapp.com/cjSO5wtV/img/spaccato-title.png" />
        <div className="absolute top-[65px] left-[79px] w-[797px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal] whitespace-nowrap">
          HIGHLIGHTS
        </div>
      </div>
    </div>
  );
};
