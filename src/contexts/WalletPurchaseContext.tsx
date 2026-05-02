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
import { useToast } from '@/hooks/use-toast';
import { COIN_PACKAGES } from '@/types';
import type { CoinPackage } from '@/types';
import { redirectToCheckout } from '@/lib/checkoutRedirect';
import { extractFunctionErrorMessage } from '@/lib/oauth';

type WalletPurchaseContextValue = {
  openWalletPurchase: () => void;
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

const BEST_SELLER_PACKAGE_ID = 'pack-25';
const DEFAULT_PACKAGE_ID = 'pack-5';
const EURO = '\u20AC';
const VIP_PRICE_LABEL = `${EURO}9,99`;
const VIP_BENEFITS = ['Real rewards', 'Giveaways', 'Less levels, more prizes'];

function formatEuroLabel(amount: number) {
  return `${EURO} ${amount.toFixed(2).replace('.', ',')}`;
}

export function useWalletPurchase() {
  return useContext(WalletPurchaseContext);
}

export function WalletPurchaseProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openWalletPurchase = useCallback(() => setOpen(true), []);
  const closeWalletPurchase = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ openWalletPurchase, closeWalletPurchase }),
    [closeWalletPurchase, openWalletPurchase],
  );

  return (
    <WalletPurchaseContext.Provider value={value}>
      {children}
      <WalletPurchaseOverlay open={open} onClose={closeWalletPurchase} />
    </WalletPurchaseContext.Provider>
  );
}

function WalletPurchaseOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, refreshWallet } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<WalletTabKey>('coins');
  const [selectedPackageId, setSelectedPackageId] = useState(DEFAULT_PACKAGE_ID);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [vipLoading, setVipLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(true);

  const selectedPackage = COIN_PACKAGES.find((pack) => pack.id === selectedPackageId) ?? COIN_PACKAGES[0];
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

    setActiveTab('coins');
    setSelectedPackageId(DEFAULT_PACKAGE_ID);
    setAcceptedTerms(true);
    setCheckoutLoading(false);
    setVipLoading(false);
  }, [open]);

  const startCheckout = async () => {
    if (!user) {
      toast({
        title: 'Login required',
        description: 'Sign in before buying coins.',
        variant: 'destructive',
      });
      return;
    }

    setCheckoutLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { packageId: selectedPackage.id },
      });

      if (error) throw error;

      const checkoutUrl = (data as { url?: string } | null)?.url;
      if (!checkoutUrl) throw new Error('Stripe checkout URL missing.');

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

    setVipLoading(true);

    try {
      const { data, error } = await supabase.rpc('purchase_vip');
      if (error) throw error;

      const result = data as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error ?? 'Unable to activate VIP.');
      }

      await refreshWallet();
      toast({
        title: 'VIP activated',
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
                {COIN_PACKAGES.map((pack) => (
                  <CoinPackageButton
                    key={pack.id}
                    pack={pack}
                    selected={pack.id === selectedPackageId}
                    bestSeller={pack.id === BEST_SELLER_PACKAGE_ID}
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
                label={checkoutLoading ? 'OPENING STRIPE' : `PURCHASE ${selectedPackage.coins} COINS`}
                ariaLabel={`Purchase ${selectedPackage.coins} coins`}
                width="min(385px, calc(100% - 80px))"
                disabled={actionDisabled}
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
                    {VIP_BENEFITS.map((benefit) => (
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
                    x1 MONTH
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
                  label={vipLoading ? 'ACTIVATING VIP' : `GET VIP for ${VIP_PRICE_LABEL}`}
                  ariaLabel={`Get VIP for ${VIP_PRICE_LABEL}`}
                  width="min(523px, calc(100% - 48px))"
                  disabled={actionDisabled}
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
  pack: CoinPackage;
  selected: boolean;
  bestSeller: boolean;
  onSelect: () => void;
}) {
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
        src="/figma-assets/wallet-overlay/coin-badge.svg"
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          left: '49px',
          top: '19px',
          width: '63px',
          height: '63px',
        }}
      />

      <span
        style={{
          position: 'absolute',
          left: '128px',
          top: '60px',
          transform: 'translateX(-100%)',
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
        x{pack.coins}
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
        {formatEuroLabel(pack.price)}
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
