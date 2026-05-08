import { useNavigate } from 'react-router-dom';
import { useShopCatalog } from '@/hooks/useShopCatalog';
import { useShopLevelRewards } from '@/hooks/useShopLevelRewards';

const imgStarShape = '/figma-assets/figma-star-shape.svg';
const imgArrowStroke = '/figma-assets/figma-arrow-stroke.svg';
const imgBwArrow = '/figma-assets/figma-bw-arrow.svg';
const imgFwArrow = '/figma-assets/figma-fw-arrow.svg';
const imgSpaccatoTitle = '/figma-assets/shop-spaccato-title.svg';

type ShopItem =
  | { type: 'level'; image: string; name: string; levelRequired: number }
  | { type: 'vip'; image: string; price: string; label: string; sublabel: string };

const shopItems: ShopItem[] = [
  { type: 'vip', image: '/showreel/vip-icon.svg', price: '5 COINS', label: 'VIP', sublabel: '1 MONTH' },
];

const CARD_WIDTH = 227;
const CARD_GAP = 60;

export const ShopSection = () => {
  const navigate = useNavigate();
  const { rewards } = useShopLevelRewards();
  const { vipOffer } = useShopCatalog();

  const levelRewardItems: ShopItem[] = rewards.map((reward) => ({
    type: 'level',
    image: reward.image,
    name: reward.name,
    levelRequired: reward.levelRequired,
  }));

  const vipItems: ShopItem[] = vipOffer
    ? [
        {
          type: 'vip',
          image: vipOffer.imagePath,
          price: vipOffer.effectivePrice?.label ?? '5 COINS',
          label: vipOffer.title,
          sublabel: vipOffer.subtitle || '1 MONTH',
        },
      ]
    : shopItems;

  const carouselItems = [...levelRewardItems, ...vipItems];

  return (
    <div id="s-shop" className="z-[1] h-[955px] w-[1920px] flex bg-[#0f0404]">
      <div className="relative ml-[226px] mt-[143px] h-[746.11px] w-[1573.42px]">
        <div className="absolute left-[661px] top-[683px] z-10 flex h-[63px] w-[146px] gap-[19.9px]">
          <button
            className="flex h-[63px] w-[63px] cursor-pointer items-center justify-center border-none bg-transparent p-0"
            onClick={() => {
              const el = document.getElementById('s-teams');
              if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
            }}
          >
            <img className="pointer-events-none h-[63.11px] w-[63.11px]" alt="Previous" src={imgBwArrow} />
          </button>
          <button
            className="flex h-[63px] w-[63px] cursor-pointer items-center justify-center border-none bg-transparent p-0"
            onClick={() => {
              const el = document.getElementById('s-footer');
              if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
            }}
          >
            <img className="pointer-events-none h-[63.11px] w-[63.11px]" alt="Next" src={imgFwArrow} />
          </button>
        </div>

        <div className="absolute left-[705px] top-[126px] h-[596px] w-[868px]">
          <img
            className="absolute left-[39px] top-[98px] h-[401px] w-[788px] rotate-[-15.44deg]"
            alt=""
            src={imgStarShape}
          />

          <button
            onClick={() => navigate('/shop')}
            className="absolute left-[294px] top-[406px] flex h-[65px] w-[278px] cursor-pointer items-center justify-center rounded-[50px] border border-solid border-[#ff1654] bg-[#ff16543b] shadow-[inset_0px_4px_4px_#ffffff24,inset_0px_-4px_4px_#00000040]"
          >
            <div className="flex items-center gap-[11px]">
              <span className="h-[38px] w-[167px] whitespace-nowrap text-center [font-family:'Base_Neue_Trial-WideBlack',Helvetica] text-[32px] font-black leading-[normal] tracking-[0] text-white">
                SHOP
              </span>
              <img className="mt-[7px] h-[23px] w-8 rotate-[-90deg]" alt="" src={imgArrowStroke} />
            </div>
          </button>

          <div className="absolute left-[118px] top-[186px] flex h-[184px] w-[620px] flex-col items-center justify-center text-center [font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] text-[48px] font-bold leading-[58px] tracking-[0] text-white">
            <span className="whitespace-nowrap">Reach levels.</span>
            <span className="whitespace-nowrap">Unlock real</span>
            <span className="whitespace-nowrap">rewards!</span>
          </div>
        </div>

        <div className="group absolute left-0 top-[311px] h-[272px] w-[623px] overflow-hidden">
          <div
            className="flex h-[272px] w-max animate-marquee group-hover:[animation-play-state:paused]"
            style={{ animationDuration: '12s', willChange: 'transform' }}
          >
            {[...carouselItems, ...carouselItems].map((item, index) => (
              <div
                key={index}
                className="relative flex-shrink-0 overflow-hidden rounded-[17px] bg-[#3a0000]"
                style={{ width: `${CARD_WIDTH}px`, height: '272px', marginRight: `${CARD_GAP}px` }}
              >
                {item.type === 'level' ? (
                  <>
                    <img
                      src={item.image}
                      alt={item.name}
                      className="absolute inset-0 h-full w-full object-contain p-4"
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-[120px] bg-gradient-to-t from-[#3a0000] to-transparent" />
                    <div className="absolute bottom-[14px] left-[14px] flex items-center gap-[6px]">
                      <span className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] text-[18px] font-bold leading-normal whitespace-nowrap text-white">
                        Lvl {item.levelRequired}
                      </span>
                      <span className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] text-[18px] font-bold leading-normal text-white">
                        -
                      </span>
                      <span
                        className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] text-[18px] font-black leading-normal whitespace-nowrap"
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
                      <img src={item.image} alt="VIP" className="mb-3 h-[63px] w-[76px]" />
                      <span
                        className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] text-[31px] font-black leading-[normal]"
                        style={{
                          background: 'linear-gradient(to bottom, #ff1654, #3a0000)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {item.label}
                      </span>
                      <span
                        className="[font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] mt-1 text-[14px] font-black"
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
                      <span className="[font-family:'Base_Neue_Trial-ExpandedBold',Helvetica] text-[31px] font-bold leading-[normal] text-white">
                        {item.price}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="pointer-events-none absolute left-[338px] top-[311px] h-[272px] w-[285px] bg-[linear-gradient(270deg,rgba(15,4,4,1)_0%,rgba(15,4,4,0)_100%)]" />
        <div className="pointer-events-none absolute left-0 top-[311px] h-[272px] w-[249px] bg-[linear-gradient(270deg,rgba(15,4,4,0)_0%,rgba(15,4,4,1)_100%)]" />

        <img className="absolute left-0 top-0 h-[207px] w-[553px]" alt="" src={imgSpaccatoTitle} />
        <div className="absolute left-[79px] top-[65px] w-[797px] whitespace-nowrap [font-family:'Base_Neue_Trial-ExpandedBlack_Oblique',Helvetica] text-8xl font-black leading-[normal] tracking-[0] text-white">
          SHOP
        </div>
      </div>
    </div>
  );
};
