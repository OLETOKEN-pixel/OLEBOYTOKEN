import { useState } from "react";

const videoItems = [
  {
    href: "https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5",
    src: "https://c.animaapp.com/cjSO5wtV/img/piz-montage-1-1@2x.png",
    alt: "Piz montage",
    width: "w-[408px]",
  },
  {
    href: "https://youtu.be/SDIys2MtwnA?si=Tba7ZE_Uda0qphNI",
    src: "https://c.animaapp.com/cjSO5wtV/img/maxresdefault-1@2x.png",
    alt: "Maxresdefault",
    width: "w-[215px]",
  },
  {
    href: "https://youtu.be/YcUuHL9i_7c?si=rHCyzj47PmRRa_ph",
    src: "https://c.animaapp.com/cjSO5wtV/img/piz-montage-2-3@2x.png",
    alt: "Piz montage",
    width: "w-[408px]",
  },
  {
    href: "https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5",
    src: "https://c.animaapp.com/cjSO5wtV/img/piz-montage-2-3@2x.png",
    alt: "Piz montage",
    width: "w-[408px]",
  },
  {
    href: "https://youtu.be/SDIys2MtwnA?si=Tba7ZE_Uda0qphNI",
    src: "https://c.animaapp.com/cjSO5wtV/img/piz-montage-2-3@2x.png",
    alt: "Maxresdefault",
    width: "w-[408px]",
  },
  {
    href: "https://youtu.be/YcUuHL9i_7c?si=rHCyzj47PmRRa_ph",
    src: "https://c.animaapp.com/cjSO5wtV/img/piz-montage-2-3@2x.png",
    alt: "Piz montage",
    width: "w-[408px]",
  },
  {
    href: "https://youtu.be/HxRTrHyWB0Y?si=VdsoQIswI9eOlHG5",
    src: "https://c.animaapp.com/cjSO5wtV/img/piz-montage-2-3@2x.png",
    alt: "Piz montage",
    width: "w-[408px]",
  },
  {
    href: "https://youtu.be/SDIys2MtwnA?si=Tba7ZE_Uda0qphNI",
    src: "https://c.animaapp.com/cjSO5wtV/img/piz-montage-2-3@2x.png",
    alt: "Maxresdefault",
    width: "w-[408px]",
  },
  {
    href: "https://youtu.be/YcUuHL9i_7c?si=rHCyzj47PmRRa_ph",
    src: "https://c.animaapp.com/cjSO5wtV/img/piz-montage-2-3@2x.png",
    alt: "Piz montage",
    width: "w-[408px]",
  },
];

export const HighlightsSection = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrev = () => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => Math.min(prev + 1, videoItems.length - 1));
  };

  return (
    <div className="z-[1] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143.0px] w-[1573.42px] h-[746.11px] ml-[226px] relative">
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px]">
          <button
            onClick={handlePrev}
            className="all-[unset] cursor-pointer"
            aria-label="Previous"
          >
            <img
              className="w-[63.11px] h-[63.11px] aspect-[1]"
              alt="Bw ARROW"
              src="https://c.animaapp.com/cjSO5wtV/img/bw-arrow-3@2x.png"
            />
          </button>

          <button
            onClick={handleNext}
            className="all-[unset] cursor-pointer"
            aria-label="Next"
          >
            <img
              className="w-[63.11px] h-[63.11px] aspect-[1]"
              alt="Fw ARROW"
              src="https://c.animaapp.com/cjSO5wtV/img/fw-arrow-3@2x.png"
            />
          </button>
        </div>

        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img
            className="absolute top-[102px] left-[47px] w-[760px] h-[388px]"
            alt="Star shape"
            src="https://c.animaapp.com/cjSO5wtV/img/star-shape.svg"
          />

          <div className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040]">
            <div className="mt-3.5 w-[212px] ml-[34px] flex gap-[11px]">
              <div className="w-[167px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">
                WATCH
              </div>

              <img
                className="mt-[7px] w-8 h-[23px]"
                alt="Arrow stroke"
                src="https://c.animaapp.com/cjSO5wtV/img/arrow--stroke--3.svg"
              />
            </div>
          </div>

          <p className="absolute top-[216px] left-[118px] h-[167px] [font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-5xl text-right tracking-[0] leading-[48px]">
            <span className="[font-family:'Base_Neue_Trial-Bold',Helvetica] font-bold text-white text-5xl tracking-[0]">
              Publish and vote. The most liked will
              <br />
            </span>

            <span className="leading-[50.4px]">get extra OBC</span>

            <span className="text-[52px] leading-[54.6px]">!</span>
          </p>
        </div>

        <div className="absolute top-[311px] left-0 w-[675px] h-[229px] overflow-hidden">
          <div
            className="flex h-[229px] gap-[52px] transition-transform duration-500 ease-in-out"
            style={{
              transform: `translateX(calc(-${currentIndex} * (408px + 52px)))`,
            }}
          >
            {videoItems.map((item, index) => (
              <a
                key={index}
                href={item.href}
                rel="noopener noreferrer"
                target="_blank"
                className="flex-shrink-0"
              >
                <img
                  className={`${item.width} h-[229px] aspect-[1.78] object-cover block`}
                  alt={item.alt}
                  src={item.src}
                />
              </a>
            ))}
          </div>
        </div>

        <div className="absolute top-[311px] left-[395px] w-[285px] h-[229px] bg-[linear-gradient(270deg,rgba(15,4,4,1)_0%,rgba(15,4,4,0)_100%)]" />

        <div className="absolute top-[311px] left-0 w-[375px] h-[229px] bg-[linear-gradient(270deg,rgba(15,4,4,0)_0%,rgba(15,4,4,1)_100%)]" />

        <img
          className="left-px w-[1044px] absolute top-0 h-[207px]"
          alt="Spaccato title"
          src="https://c.animaapp.com/cjSO5wtV/img/spaccato-title.png"
        />

        <div className="absolute top-[86px] left-[79px] w-[797px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal] whitespace-nowrap">
          HIGHLIGHTS
        </div>
      </div>
    </div>
  );
};
