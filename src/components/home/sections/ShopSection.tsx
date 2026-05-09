import { useNavigate } from 'react-router-dom';
import { ShopCardRail } from '@/components/shop/ShopCardRail';
import { useShopCatalog } from '@/hooks/useShopCatalog';
import { useShopLevelRewards } from '@/hooks/useShopLevelRewards';
import type { ShopCardViewModel } from '@/lib/shopCatalog';

const imgStarShape = '/figma-assets/figma-star-shape.svg';
const imgArrowStroke = '/figma-assets/figma-arrow-stroke.svg';
const imgBwArrow = '/figma-assets/figma-bw-arrow.svg';
const imgFwArrow = '/figma-assets/figma-fw-arrow.svg';
const imgSpaccatoTitle = '/figma-assets/shop-spaccato-title.svg';

export const ShopSection = () => {
  const navigate = useNavigate();
  const { rewards } = useShopLevelRewards();
  const { vipOffer } = useShopCatalog();

  const cards: ShopCardViewModel[] = [
    ...rewards.map((reward, index) => ({
      id: reward.id,
      slotId: `home-reward-${reward.id}`,
      surfaceKey: 'shop.unlock_cards' as const,
      sortOrder: index,
      cardVariant: 'reward' as const,
      templateKey: 'unlock-card' as const,
      themeKey: 'default',
      title: reward.name,
      subtitle: 'LEVEL REWARD',
      description: reward.description,
      supportingText: reward.description,
      image: reward.image,
      primaryImage: reward.image,
      secondaryImage: '',
      kind: 'physical_reward' as const,
      ctaLabel: 'CLAIM',
      actionKey: null,
      coinAmount: null,
      vipDurationDays: null,
      priceLabel: null,
      priceCurrency: null,
      unlockLabel: `LVL ${reward.levelRequired}`,
      levelRequired: reward.levelRequired,
      challengeId: null,
      isLocked: true,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: 'UNLOCK',
      showBadge: true,
      showSubtitle: true,
      showSupportingText: true,
      showSecondaryImage: false,
      metadata: {},
      searchText: `${reward.name} level reward lvl ${reward.levelRequired}`.toLowerCase(),
    })),
    {
      id: vipOffer?.id ?? 'home-vip-fallback',
      slotId: 'home-vip-offer',
      surfaceKey: 'shop.featured_cards',
      sortOrder: 9_999,
      cardVariant: 'coins',
      templateKey: 'featured-card',
      themeKey: 'default',
      title: vipOffer?.title ?? 'VIP',
      subtitle: vipOffer?.subtitle || '1 MONTH',
      description: vipOffer?.description ?? 'VIP membership',
      supportingText: '',
      image: vipOffer?.imagePath ?? '/showreel/vip-icon.svg',
      primaryImage: vipOffer?.imagePath ?? '/showreel/vip-icon.svg',
      secondaryImage: '',
      kind: 'vip_membership',
      ctaLabel: vipOffer?.ctaLabel ?? 'GET VIP',
      actionKey: null,
      coinAmount: null,
      vipDurationDays: vipOffer?.vipDurationDays ?? 30,
      priceLabel: vipOffer?.effectivePrice?.label ?? '5 COINS',
      priceCurrency: vipOffer?.effectivePrice?.currency ?? 'coins',
      unlockLabel: null,
      levelRequired: null,
      challengeId: null,
      isLocked: false,
      isClaimed: false,
      claimStatus: null,
      badgeLabel: 'VIP',
      showBadge: true,
      showSubtitle: true,
      showSupportingText: false,
      showSecondaryImage: false,
      metadata: {},
      searchText: `${vipOffer?.title ?? 'VIP'} ${vipOffer?.effectivePrice?.label ?? '5 COINS'}`.toLowerCase(),
    },
  ];

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

        <div className="absolute left-0 top-[311px] h-[272px] w-[623px] overflow-hidden">
          <ShopCardRail cards={cards} onAction={() => navigate('/shop')} forceMarquee />
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
