import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useShopCatalog } from '@/hooks/useShopCatalog';
import { useToast } from '@/hooks/use-toast';
import { redirectToCheckout } from '@/lib/checkoutRedirect';
import { extractFunctionErrorMessage } from '@/lib/oauth';
import { createShopCheckout } from '@/lib/shopCheckout';
import type { ShopCatalogItem } from '@/lib/shopCatalog';

type WalletPurchaseContextValue = {
  openWalletPurchase: (initialTab?: WalletTabKey) => void;
  closeWalletPurchase: () => void;
};

type WalletTabKey = 'coins' | 'vip';

const FALLBACK_CONTEXT: WalletPurchaseContextValue = {
  openWalletPurchase: () => undefined,
  closeWalletPurchase: () => undefined,
};

const WalletPurchaseContext = createContext<WalletPurchaseContextValue>(FALLBACK_CONTEXT);

const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FR = "'Base_Neue_Trial:Regular', 'Base Neue Trial-Regular', 'Base Neue Trial', sans-serif";
const FE = "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif";
const FB = "'Base_Neue_Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const FBO = "'Base_Neue_Trial:Bold_Oblique', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FBD = "'Base_Neue_Trial:Bold', 'Base Neue Trial-Bold', 'Base Neue Trial', sans-serif";
const FWB = "'Base_Neue_Trial:Wide_Black', 'Base Neue Trial-WideBlack', 'Base Neue Trial', sans-serif";

const BEST_SELLER_COIN_AMOUNT = 25;
const DEFAULT_COIN_AMOUNT = 5;
const FALLBACK_VIP_BENEFITS = ['Real rewards', 'Giveaways', 'Less levels, more prizes'];

function resolveWalletTab(value: unknown): WalletTabKey {
  return value === 'vip' ? 'vip' : 'coins';
}

export function useWalletPurchase() {
  return useContext(WalletPurchaseContext);
}

export function WalletPurchaseProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [requestedTab, setRequestedTab] = useState<WalletTabKey>('coins');

  const openWalletPurchase = useCallback((initialTab?: WalletTabKey) => {
    setRequestedTab(resolveWalletTab(initialTab));
    setOpen(true);
  }, []);
  const closeWalletPurchase = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ openWalletPurchase, closeWalletPurchase }),
    [closeWalletPurchase, openWalletPurchase],
  );

  return (
    <WalletPurchaseContext.Provider value={value}>
      {children}
      <WalletPurchaseOverlay open={open} initialTab={requestedTab} onClose={closeWalletPurchase} />
    </WalletPurchaseContext.Provider>
  );
}

function WalletPurchaseOverlay({
  open,
  initialTab,
  onClose,
}: {
  open: boolean;
  initialTab: WalletTabKey;
  onClose: () => void;
}) {
  const { user, refreshWallet } = useAuth();
  const { coinPacks, vipOffer, catalog } = useShopCatalog();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<WalletTabKey>('coins');
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [vipLoading, setVipLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const selectedPackage = useMemo(
    () =>
      coinPacks.find((pack) => pack.id === selectedPackageId)
      ?? coinPacks.find((pack) => pack.coinAmount === DEFAULT_COIN_AMOUNT)
      ?? coinPacks[0]
      ?? null,
    [coinPacks, selectedPackageId],
  );
  const vipBenefits = useMemo(() => {
    const raw = vipOffer?.metadata?.benefits;
    return Array.isArray(raw) && raw.every((entry) => typeof entry === 'string')
      ? (raw as string[])
      : FALLBACK_VIP_BENEFITS;
  }, [vipOffer]);
  const vipPriceLabel = vipOffer?.effectivePrice?.label ?? '5 COINS';
  const actionLoading = activeTab === 'coins' ? checkoutLoading : vipLoading;
  const actionDisabled = actionLoading || !acceptedTerms;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    setActiveTab(initialTab);
    setSelectedPackageId(coinPacks.find((pack) => pack.coinAmount === DEFAULT_COIN_AMOUNT)?.id ?? coinPacks[0]?.id ?? '');
    setAcceptedTerms(true);
    setCheckoutLoading(false);
    setVipLoading(false);
  }, [coinPacks, initialTab, open]);

  const startCheckout = async () => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Sign in before buying coins.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedPackage) {
      toast({
        title: 'No package available',
        description: 'No coin pack is currently available in the live catalog.',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutLoading(true);

    try {
      const checkoutUrl = await createShopCheckout(selectedPackage.id);
      redirectToCheckout(checkoutUrl);
    } catch (error) {
      const message = await extractFunctionErrorMessage(error, 'Unable to start checkout.');
      toast({
        title: 'Checkout error',
        description: message,
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  const startVipPurchase = async () => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Sign in before getting VIP.',
        variant: 'destructive',
      });
      return;
    }

    if (!vipOffer) {
      toast({
        title: 'VIP unavailable',
        description: 'No VIP offer is currently available in the live catalog.',
        variant: 'destructive',
      });
      return;
    }

    setVipLoading(true);

    try {
      const { data, error } = await supabase.rpc('purchase_shop_wallet_item', {
        p_item_id: vipOffer.id,
      });
      if (error) throw error;

      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error ?? 'Unable to activate VIP.');
      }

      await refreshWallet();
      toast({
        title: catalog.viewer.isVip ? 'VIP renewed' : 'VIP activated',
        description: 'Your VIP membership is now active for 30 days.',
      });
      onClose();
    } catch (error) {
      const message = await extractFunctionErrorMessage(error, 'Unable to activate VIP.');
      toast({
        title: 'VIP error',
        description: message,
        variant: 'destructive',
      });
      setVipLoading(false);
    }
  };

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(15, 4, 4, 0.7)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        padding: '12px',
        fontFamily: F,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-purchase-title"
        data-testid="wallet-purchase-overlay"
        style={{
          position: 'relative',
          width: 'min(903px, calc(100vw - 24px))',
          height: 'min(800px, calc(100vh - 24px))',
          borderRadius: '18px',
          border: '1.462px solid #ff1654',
          background: '#282828',
          boxShadow: '0 4px 4px rgba(0,0,0,0.25), 0 16px 16px rgba(0,0,0,0.35)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: '100%',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '31px 24px 28px',
            boxSizing: 'border-box',
          }}
        >
          <h2
            id="wallet-purchase-title"
            style={{
              margin: 0,
              color: '#ffffff',
              fontFamily: FB,
              fontSize: 'clamp(44px, 7vw, 64px)',
              lineHeight: 1,
              letterSpacing: 0,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            WALLET
          </h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'max-content max-content',
              justifyContent: 'center',
              alignItems: 'end',
              columnGap: 'clamp(28px, 5vw, 56px)',
              marginTop: '51px',
              width: 'min(100%, 520px)',
            }}
          >
            <WalletTabButton active={activeTab === 'coins'} onClick={() => setActiveTab('coins')}>
              TOKENS COINS
            </WalletTabButton>
            <WalletTabButton active={activeTab === 'vip'} onClick={() => setActiveTab('vip')}>
              VIP MEMBERSHIP
            </WalletTabButton>
          </div>

          {activeTab === 'coins' ? (
            <>
              <div
                style={{
                  display: 'grid',
                  width: 'min(608px, calc(100% - 32px))',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(178px, 178px))',
                  justifyContent: 'center',
                  columnGap: '37px',
                  rowGap: '27px',
                  marginTop: '46px',
                }}
              >
                {coinPacks.map((pack) => (
                  <CoinPackageButton
                    key={pack.id}
                    pack={pack}
                    selected={pack.id === selectedPackage?.id}
                    bestSeller={pack.coinAmount === BEST_SELLER_COIN_AMOUNT}
                    onSelect={() => setSelectedPackageId(pack.id)}
                  />
                ))}
              </div>

              <TermsRow
                accepted={acceptedTerms}
                onToggle={() => setAcceptedTerms((current) => !current)}
                marginTop="43px"
              />

              <div
                aria-hidden="true"
                style={{
                  width: 'min(589px, calc(100% - 64px))',
                  height: '1px',
                  marginTop: '22px',
                  background: 'rgba(217, 217, 217, 0.82)',
                }}
              />

              <PrimaryActionButton
                label={checkoutLoading ? 'OPENING STRIPE' : `PURCHASE ${selectedPackage?.coinAmount ?? 0} COINS`}
                ariaLabel={`Purchase ${selectedPackage?.coinAmount ?? 0} coins`}
                width="min(385px, calc(100% - 80px))"
                disabled={actionDisabled || !selectedPackage}
                onClick={startCheckout}
                marginTop="18px"
              />
            </>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  width: 'min(640px, calc(100% - 32px))',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: '34px',
                  marginTop: '61px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  style={{
                    flex: '0 1 320px',
                    minWidth: '280px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '11px',
                    }}
                  >
                    <img
                      src="/figma-assets/wallet-overlay/benefits-flare.svg"
                      alt=""
                      aria-hidden
                      style={{ width: '29.87px', height: '44.81px', flexShrink: 0 }}
                    />
                    <span
                      style={{
                        color: '#ffffff',
                        fontFamily: FE,
                        fontSize: '32px',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      BENEFITS:
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gap: '15px',
                      marginTop: '38px',
                    }}
                  >
                    {vipBenefits.map((benefit) => (
                      <div
                        key={benefit}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: '31px',
                            height: '31px',
                            borderRadius: '5.588px',
                            background: '#ff1654',
                            display: 'grid',
                            placeItems: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src="/figma-assets/wallet-overlay/benefit-check.svg"
                            alt=""
                            aria-hidden
                            style={{ width: '17px', height: '13px' }}
                          />
                        </span>
                        <span
                          style={{
                            color: '#ffffff',
                            fontFamily: FB,
                            fontSize: '24px',
                            lineHeight: 1,
                          }}
                        >
                          {benefit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    paddingTop: '26px',
                    flex: '0 0 180px',
                  }}
                >
                  <img
                    src="/figma-assets/wallet-overlay/vip-crown.svg"
                    alt=""
                    aria-hidden
                    style={{
                      width: '180px',
                      height: '137px',
                      display: 'block',
                    }}
                  />
                  <span
                    style={{
                      marginTop: '6px',
                      background: 'linear-gradient(180deg, #ffffff 0%, #ff1654 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text',
                      color: 'transparent',
                      fontFamily: FE,
                      fontSize: '32px',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    x{vipOffer?.vipDurationDays ?? 30} DAYS
                  </span>
                </div>
              </div>

              <div
                style={{
                  width: '100%',
                  marginTop: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  paddingTop: '18px',
                }}
              >
                <TermsRow
                  accepted={acceptedTerms}
                  onToggle={() => setAcceptedTerms((current) => !current)}
                  marginTop="0"
                />

                <div
                  aria-hidden="true"
                  style={{
                    width: 'min(589px, calc(100% - 64px))',
                    height: '1px',
                    marginTop: '36px',
                    background: 'rgba(217, 217, 217, 0.82)',
                  }}
                />

                <PrimaryActionButton
                  label={vipLoading ? 'ACTIVATING VIP' : `${catalog.viewer.isVip ? 'RENEW VIP' : 'GET VIP'} for ${vipPriceLabel}`}
                  ariaLabel={`${catalog.viewer.isVip ? 'Renew VIP' : 'Get VIP'} for ${vipPriceLabel}`}
                  width="min(523px, calc(100% - 48px))"
                  disabled={actionDisabled || !vipOffer}
                  onClick={startVipPurchase}
                  marginTop="17px"
                  useVipAsset
                />
              </div>
            </>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

function WalletTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      style={{
        position: 'relative',
        border: 'none',
        background: 'transparent',
        color: '#ffffff',
        cursor: 'pointer',
        fontFamily: active ? FBD : FR,
        fontSize: 'clamp(20px, 2.4vw, 32px)',
        lineHeight: 1,
        padding: '0 0 11px',
        outline: 'none',
        whiteSpace: 'nowrap',
        opacity: active ? 1 : 0.82,
      }}
    >
      {children}
      {active ? (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 0,
            width: '150px',
            height: '2px',
            transform: 'translateX(-50%)',
            background: '#ff1654',
          }}
        />
      ) : null}
    </button>
  );
}

function CoinPackageButton({
  pack,
  selected,
  bestSeller,
  onSelect,
}: {
  pack: ShopCatalogItem;
  selected: boolean;
  bestSeller: boolean;
  onSelect: () => void;
}) {
  const priceLabel = pack.effectivePrice?.label ?? '';
  const badgeLabel = typeof pack.metadata.badge === 'string'
    ? (pack.metadata.badge as string)
    : `x${pack.coinAmount ?? 0}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      style={{
        position: 'relative',
        width: '178px',
        height: '158px',
        borderRadius: '18px',
        border: selected ? '1px solid #ff1654' : '1px solid transparent',
        background: selected
          ? 'linear-gradient(0deg, rgba(255,22,84,0.2), rgba(255,22,84,0.2)), rgba(0,0,0,0.5)'
          : 'rgba(0,0,0,0.5)',
        color: '#ffffff',
        cursor: 'pointer',
        outline: 'none',
        padding: 0,
      }}
    >
      {bestSeller ? (
        <>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-2px',
              left: '109px',
              width: '97px',
              height: '24px',
              borderRadius: '9px',
              border: '1px solid #ff1654',
              background: 'rgba(255,22,84,0.2)',
              boxSizing: 'border-box',
              zIndex: 2,
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: '4px',
              left: '121px',
              color: '#ffffff',
              fontFamily: FBO,
              fontSize: '12px',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              zIndex: 3,
            }}
          >
            BEST SELLER
          </span>
        </>
      ) : null}

      <img
        src="/coin.png"
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          left: '30px',
          top: '0px',
          width: '100px',
          height: '100px',
          objectFit: 'contain',
        }}
      />

      <span
        style={{
          position: 'absolute',
          left: '128px',
          top: '60px',
          transform: 'translateX(-100%)',
          display: 'inline-block',
          minWidth: '42px',
          paddingRight: '4px',
          textAlign: 'right',
          overflow: 'visible',
          background: 'linear-gradient(180deg, #ffffff 0%, #ff1654 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          fontFamily: FBO,
          fontSize: '28px',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {badgeLabel}
      </span>

      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: '106px',
          transform: 'translateX(-50%)',
          color: '#ffffff',
          fontFamily: FB,
          fontSize: '28px',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {priceLabel}
      </span>
    </button>
  );
}

function TermsRow({
  accepted,
  onToggle,
  marginTop,
}: {
  accepted: boolean;
  onToggle: () => void;
  marginTop: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '22px',
        marginTop,
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        aria-pressed={accepted}
        aria-label={accepted ? 'Accepted terms and conditions' : 'Accept terms and conditions'}
        onClick={onToggle}
        style={{
          width: '44px',
          height: '44px',
          border: accepted ? '1px solid #ff1654' : '1px solid rgba(255,22,84,0.65)',
          borderRadius: '8px',
          background: accepted ? '#ff1654' : 'transparent',
          display: 'grid',
          placeItems: 'center',
          padding: 0,
          cursor: 'pointer',
          outline: 'none',
          flexShrink: 0,
        }}
      >
        {accepted ? (
          <img
            src="/figma-assets/wallet-overlay/terms-check.svg"
            alt=""
            aria-hidden
            style={{ width: '32px', height: '32px' }}
          />
        ) : null}
      </button>

      <p
        style={{
          margin: 0,
          color: '#ffffff',
          fontFamily: F,
          fontSize: '20px',
          lineHeight: 1,
          textAlign: 'center',
        }}
      >
        Accept our{' '}
        <a
          href="/terms"
          style={{
            color: '#ffffff',
            textDecoration: 'underline',
            textDecorationSkipInk: 'none',
          }}
        >
          Terms & Conditions
        </a>
      </p>
    </div>
  );
}

function PrimaryActionButton({
  label,
  ariaLabel,
  width,
  disabled,
  onClick,
  marginTop,
  useVipAsset = false,
}: {
  label: string;
  ariaLabel: string;
  width: string;
  disabled: boolean;
  onClick: () => void;
  marginTop: string;
  useVipAsset?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      style={{
        position: 'relative',
        width,
        height: '69px',
        marginTop,
        border: 'none',
        borderRadius: '23px',
        background: useVipAsset ? 'transparent' : '#ff1654',
        color: '#ffffff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        outline: 'none',
        padding: 0,
      }}
    >
      {useVipAsset ? (
        <img
          src="/figma-assets/wallet-overlay/vip-cta.svg"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      ) : null}
      <span
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          placeItems: 'center',
          width: '100%',
          height: '100%',
          fontFamily: FWB,
          fontSize: useVipAsset ? '32px' : '28px',
          lineHeight: 1,
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100% - 20px)',
          margin: '0 auto',
        }}
      >
        {label}
      </span>
    </button>
  );
}
