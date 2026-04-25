import { useWalletPurchase } from '@/contexts/WalletPurchaseContext';
import { LEVEL_REWARDS } from '@/lib/levelRewards';

const imgStarShape = '/figma-assets/figma-star-shape.svg';
const imgArrowStroke = '/figma-assets/figma-arrow-stroke.svg';
const imgBwArrow = '/figma-assets/figma-bw-arrow.svg';
const imgFwArrow = '/figma-assets/figma-fw-arrow.svg';
const imgSpaccatoTitle = '/figma-assets/shop-spaccato-title.svg';

type ShopItem =
  | { type: 'level'; image: string; name: string; levelRequired: number }
  | { type: 'vip';   image: string; price: string; label: string; sublabel: string };

const shopItems: ShopItem[] = [
  ...LEVEL_REWARDS.map((reward) => ({
    type: 'level' as const,
    image: reward.image,
    name: reward.name,
    levelRequired: reward.levelRequired,
  })),
  { type: 'vip',   image: '/showreel/vip-icon.svg', price: '€9,99', label: 'VIP', sublabel: '1 MONTH' },
];

const CARD_WIDTH = 227;
const CARD_GAP = 60;

export const ShopSection = () => {
  const { openWalletPurchase } = useWalletPurchase();

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
            onClick={openWalletPurchase}
            className="absolute top-[406px] left-[294px] w-[278px] h-[65px] flex items-center justify-center bg-[#ff16543b] rounded-[50px] border border-solid border-[#ff1654] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040] cursor-pointer"
          >
            <div className="flex items-center gap-[11px]">
              <span className="w-[167px] h-[38px] [font-family:'Base_Neue_Trial-WideBlack',Helvetica] font-black text-white text-[32px] text-center tracking-[0] leading-[normal] whitespace-nowrap">
                SHOP
              </span>
              <img className="mt-[7px] w-8 h-[23px] rotate-[-90deg]" alt="" src={imgArrowStroke} />
            </div>
          </button>

          <div className="absolute top-[186px] left-[118px] flex h-[184px] w-[620px] flex-col items-center justify-center [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-[48px] leading-[58px] text-white text-center tracking-[0]">
            <span className="whitespace-nowrap">Reach levels.</span>
            <span className="whitespace-nowrap">Unlock real</span>
            <span className="whitespace-nowrap">rewards!</span>
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
                {item.type === 'level' ? (
                  <>
                    <img
                      src={item.image}
                      alt={item.name}
                      className="absolute inset-0 w-full h-full object-contain p-4"
                    />
                    {/* Bottom fade */}
                    <div className="absolute bottom-0 left-0 right-0 h-[120px] bg-gradient-to-t from-[#3a0000] to-transparent" />
                    {/* Level + FREE label */}
                    <div className="absolute bottom-[14px] left-[14px] flex items-center gap-[6px]">
                      <span className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[18px] leading-normal whitespace-nowrap">
                        Lvl {item.levelRequired}
                      </span>
                      <span className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] font-bold text-white text-[18px] leading-normal">
                        -
                      </span>
                      <span
                        className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] font-black text-[18px] leading-normal whitespace-nowrap"
                        style={{
                          background: 'linear-gradient(90deg, rgba(255,255,255,1) 0%, rgba(255,78,125,1) 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        FREE
                      </span>
                    </div>
                  </>
                ) : (
                  <>
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
