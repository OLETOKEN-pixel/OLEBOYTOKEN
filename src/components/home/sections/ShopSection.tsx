import { useNavigate } from 'react-router-dom';

const imgStarShape = '/figma-assets/figma-star-shape.svg';
const imgArrowStroke = '/figma-assets/figma-arrow-stroke.svg';
const imgBwArrow = '/figma-assets/figma-bw-arrow.svg';
const imgFwArrow = '/figma-assets/figma-fw-arrow.svg';
const imgSpaccatoTitle = '/figma-assets/figma-spaccato-title1.svg';
interface ShopItem {
  type: 'cosmetic' | 'vip';
  image: string;
  price: string;
  label?: string;
  sublabel?: string;
}

const shopItems: ShopItem[] = [
  { type: 'cosmetic', image: '/showreel/shop-item-1.png', price: '500' },
  { type: 'cosmetic', image: '/showreel/shop-item-2.png', price: '300' },
  { type: 'cosmetic', image: '/showreel/shop-item-3.png', price: '999' },
  { type: 'vip', image: '/showreel/vip-icon.svg', price: '€9,99', label: 'VIP', sublabel: '1 MONTH' },
];

const CARD_WIDTH = 227;
const CARD_GAP = 60;

export const ShopSection = () => {
  const navigate = useNavigate();

  return (
    <div id="s-shop" className="z-[1] w-[1920px] h-[955px] flex bg-[#0f0404]">
      <div className="mt-[143px] w-[1573.42px] h-[746.11px] ml-[226px] relative">

        {/* Nav arrows */}
        <div className="absolute w-[146px] h-[63px] top-[683px] left-[661px] flex gap-[19.9px] z-10">
          <button className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center" onClick={() => { const el = document.getElementById('s-teams'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }}>
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Previous" src={imgBwArrow} />
          </button>
          <button className="cursor-pointer bg-transparent border-none p-0 w-[63px] h-[63px] flex items-center justify-center" onClick={() => { const el = document.getElementById('s-footer'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' }); }}>
            <img className="w-[63.11px] h-[63.11px] pointer-events-none" alt="Next" src={imgFwArrow} />
          </button>
        </div>

        {/* Right side — star + CTA */}
        <div className="absolute top-[126px] left-[705px] w-[868px] h-[596px]">
          <img
            className="absolute top-[98px] left-[39px] w-[788px] h-[401px] rotate-[-15.44deg]"
            alt=""
            src={imgStarShape}
          />

          <button
            onClick={() => navigate('/buy')}
            className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex items-center justify-center bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040] cursor-pointer"
          >
            <div className="flex items-center gap-[11px]">
              <span className="w-[167px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">
                SHOP
              </span>
              <img className="mt-[7px] w-8 h-[23px] rotate-[-90deg]" alt="" src={imgArrowStroke} />
            </div>
          </button>

          <div className="absolute top-[242px] right-[169px] flex flex-col items-end [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[48px] text-right tracking-[0] leading-[normal]">
            <span className="whitespace-nowrap">Cosmetics, coins, VIP.</span>
            <span className="whitespace-nowrap">Everything you need</span>
            <span className="whitespace-nowrap">to set you up!</span>
          </div>
        </div>

        {/* Shop item carousel (Infinite Marquee) */}
        <div className="absolute top-[311px] left-0 w-[623px] h-[272px] overflow-hidden group">
          <div
            className="flex h-[272px] w-max animate-marquee group-hover:[animation-play-state:paused]"
            style={{ animationDuration: '12s', willChange: 'transform' }}
          >
            {[...shopItems, ...shopItems].map((item, index) => (
              <div
                key={index}
                className="flex-shrink-0 relative bg-[#3a0000] rounded-[17px] overflow-hidden"
                style={{ width: `${CARD_WIDTH}px`, height: '272px', marginRight: `${CARD_GAP}px` }}
              >
                {item.type === 'cosmetic' ? (
                  <>
                    <img
                      src={item.image}
                      alt="Cosmetic"
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    {/* Bottom fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-[154px] bg-gradient-to-t from-[#3a0000] to-transparent" />
                    {/* Price */}
                    <div className="absolute bottom-[14px] left-[14px] flex items-center gap-2">
                      <img src="/showreel/coin-icon.svg" alt="coin" className="w-[24px] h-[24px]" />
                      <span className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[31px] leading-[normal]">
                        {item.price}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* VIP card */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <img src={item.image} alt="VIP" className="w-[76px] h-[63px] mb-3" />
                      <span
                        className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[31px] leading-[normal]"
                        style={{
                          background: 'linear-gradient(to bottom, #ff1654, #3a0000)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[14px] mt-1"
                        style={{
                          background: 'linear-gradient(to bottom, white, #0f0404)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {item.sublabel}
                      </span>
                    </div>
                    {/* Price */}
                    <div className="absolute bottom-[14px] left-[14px]">
                      <span className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[31px] leading-[normal]">
                        {item.price}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Carousel gradient overlays */}
        <div className="absolute top-[311px] left-[338px] w-[285px] h-[272px] bg-[linear-gradient(270deg,rgba(15,4,4,1)_0%,rgba(15,4,4,0)_100%)] pointer-events-none" />
        <div className="absolute top-[311px] left-0 w-[249px] h-[272px] bg-[linear-gradient(270deg,rgba(15,4,4,0)_0%,rgba(15,4,4,1)_100%)] pointer-events-none" />

        {/* Section title */}
        <img className="left-0 w-[553px] absolute top-0 h-[207px]" alt="" src={imgSpaccatoTitle} />
        <div className="absolute top-[65px] left-[79px] w-[797px] [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-white text-8xl tracking-[0] leading-[normal] whitespace-nowrap">
          SHOP
        </div>
      </div>
    </div>
  );
};
