export const NavigationBarSection = () => {
  const navItems = [
    { label: "matches", width: "w-[136px]" },
    { label: "leaderboard", width: "w-48", shadow: true },
    { label: "challenges", width: "w-[161px]" },
    { label: "hls", width: "w-[43px]" },
    { label: "teams", width: "w-[99px]" },
    { label: "shop", width: "w-[75px]" },
  ];

  return (
    <div className="fixed top-[55px] left-[194px] w-[1532px] h-[91px] z-[8] flex shadow-drop-shadow-500 bg-[url(https://c.animaapp.com/cjSO5wtV/img/bar.svg)] bg-[100%_100%]">
      <div className="mt-[13.1px] w-[55px] h-[65px] ml-[47.1px] flex rotate-[89.78deg]">
        <img
          className="mt-[4.9px] w-[65.21px] h-[55.24px] ml-[-5.1px] rotate-[-89.78deg]"
          alt="Group"
          src="https://c.animaapp.com/cjSO5wtV/img/group-3@2x.png"
        />
      </div>

      <div className="mt-[31px] w-[848px] ml-[76.9px] flex gap-[26px]">
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`${item.width} h-[29px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-normal text-white text-2xl text-center tracking-[0] leading-[normal]${item.shadow ? " [text-shadow:0px_-1.65px_3.3px_#00000040]" : ""}`}
          >
            {item.label}
          </div>
        ))}
      </div>

      <div className="mt-5 w-[397.54px] ml-[61.0px] flex aspect-[7.95]">
        <div className="w-[397.54px] h-[50px] relative shadow-[inset_0px_4px_4px_#ffffff40,inset_0px_-3px_4px_#00000040]">
          <div className="absolute top-0 left-0 w-[394px] h-[50px] bg-[#ff165433] rounded-[23px] backdrop-blur-[2.0px] backdrop-brightness-[100.0%] backdrop-saturate-[100.0%] [-webkit-backdrop-filter:blur(2.0px)_brightness(100.0%)_saturate(100.0%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.40),inset_1px_0_0_rgba(255,255,255,0.32),inset_0_-1px_1px_rgba(0,0,0,0.13),inset_-1px_0_1px_rgba(0,0,0,0.11)]" />

          <img
            className="absolute top-0 left-[348px] w-[50px] h-[50px] object-cover"
            alt="Pfp"
            src="https://c.animaapp.com/cjSO5wtV/img/pfp@2x.png"
          />

          <img
            className="absolute top-[11px] left-[228px] w-px h-[30px]"
            alt="Sep"
            src="https://c.animaapp.com/cjSO5wtV/img/sep.svg"
          />

          <div className="absolute top-[11px] left-[245px] w-[92px] h-[29px] flex">
            <p className="w-[90px] h-[29px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-[15px] text-center tracking-[0] leading-[normal]">
              <span className="font-bold">LVL</span>
              <span className="font-bold text-[24.8px]">.</span>
              <span className="font-bold text-[24.8px]">999</span>
            </p>
          </div>

          <div className="absolute top-[17px] left-[190px] w-[18px] h-[19px]">
            <div className="absolute top-px left-0 w-4 h-4 bg-[#ff165480] rounded-lg border border-solid border-[#ff1654]" />
            <div className="absolute top-0 left-[3px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-normal text-base text-center whitespace-nowrap text-white tracking-[0] leading-[normal]">
              +
            </div>
          </div>

          <div className="absolute top-[11px] left-[23px] w-[162px] h-[30px] flex gap-3">
            <div className="w-[29px] h-[29px] bg-[#ff1654] rounded-[14.5px]" />
            <div className="mt-px w-[119px] h-[29px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-[24.8px] text-center whitespace-nowrap text-white tracking-[0] leading-[normal]">
              999.999
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
