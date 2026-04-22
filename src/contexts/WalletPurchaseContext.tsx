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
import { VipModal } from '@/components/vip/VipModal';
import { COIN_PACKAGES } from '@/types';
import type { CoinPackage } from '@/types';
import { redirectToCheckout } from '@/lib/checkoutRedirect';

type WalletPurchaseContextValue = {
  openWalletPurchase: () => void;
  closeWalletPurchase: () => void;
};

const FALLBACK_CONTEXT: WalletPurchaseContextValue = {
  openWalletPurchase: () => undefined,
  closeWalletPurchase: () => undefined,
};

const WalletPurchaseContext = createContext<WalletPurchaseContextValue>(FALLBACK_CONTEXT);

const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif";
const FB = "'Base_Neue_Trial-ExpandedBold', 'Base Neue Trial', sans-serif";
const BEST_SELLER_PACKAGE_ID = 'pack-25';
const DEFAULT_PACKAGE_ID = 'pack-5';

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
  const { user, wallet } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'coins' | 'vip'>('coins');
  const [selectedPackageId, setSelectedPackageId] = useState(DEFAULT_PACKAGE_ID);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [vipOpen, setVipOpen] = useState(false);

  const selectedPackage = COIN_PACKAGES.find((pack) => pack.id === selectedPackageId) ?? COIN_PACKAGES[0];

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (open) {
      setActiveTab('coins');
      setSelectedPackageId(DEFAULT_PACKAGE_ID);
      setCheckoutLoading(false);
    }
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
      const message = error instanceof Error ? error.message : 'Unable to start checkout.';
      toast({
        title: 'Checkout error',
        description: message,
        variant: 'destructive',
      });
      setCheckoutLoading(false);
    }
  };

  const openVip = () => {
    setActiveTab('vip');
    setVipOpen(true);
  };

  if (!open || typeof document === 'undefined') {
    return (
      <VipModal
        open={vipOpen}
        onBuyCoins={() => {
          setVipOpen(false);
          setActiveTab('coins');
        }}
        onOpenChange={(nextOpen) => {
          setVipOpen(nextOpen);
          if (!nextOpen) setActiveTab('coins');
        }}
      />
    );
  }

  return (
    <>
      {createPortal(
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
            background: 'rgba(0, 0, 0, 0.72)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
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
              width: 'min(903px, calc(100vw - 34px))',
              height: 'min(800px, calc(100vh - 34px))',
              borderRadius: '18px',
              border: '1px solid #ff1654',
              background: '#282828',
              boxShadow: '0 28px 80px rgba(0,0,0,0.58)',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              aria-label="Close wallet"
              onClick={onClose}
              style={{
                position: 'absolute',
                top: '26px',
                right: '30px',
                width: '34px',
                height: '34px',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: '8px',
                background: 'rgba(15,15,15,0.48)',
                color: '#ffffff',
                cursor: 'pointer',
                fontFamily: FB,
                fontSize: '23px',
                lineHeight: 1,
                outline: 'none',
              }}
            >
              x
            </button>

            <h2
              id="wallet-purchase-title"
              style={{
                margin: '42px 0 0',
                textAlign: 'center',
                fontFamily: FE,
                fontWeight: 900,
                fontStyle: 'oblique',
                fontSize: '58px',
                lineHeight: '66px',
                color: '#ffffff',
                letterSpacing: 0,
              }}
            >
              WALLET
            </h2>

            <div
              style={{
                position: 'absolute',
                top: '151px',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '75px',
                width: '546px',
                maxWidth: 'calc(100% - 60px)',
              }}
            >
              <WalletTab active={activeTab === 'coins'} onClick={() => setActiveTab('coins')}>
                TOKENS COINS
              </WalletTab>
              <WalletTab active={activeTab === 'vip'} onClick={openVip}>
                VIP MEMBERSHIP
              </WalletTab>
            </div>

            <div
              style={{
                position: 'absolute',
                top: '210px',
                left: '30px',
                right: '30px',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '47px 40px',
              }}
            >
              {COIN_PACKAGES.map((pack) => (
                <CoinPackageButton
                  key={pack.id}
                  pack={pack}
                  selected={pack.id === selectedPackage.id}
                  bestSeller={pack.id === BEST_SELLER_PACKAGE_ID}
                  onSelect={() => {
                    setActiveTab('coins');
                    setSelectedPackageId(pack.id);
                  }}
                />
              ))}
            </div>

            <div
              style={{
                position: 'absolute',
                left: '157px',
                right: '157px',
                bottom: '122px',
                height: '1px',
                background: '#d9d9d9',
                opacity: 0.82,
              }}
            />

            <button
              type="button"
              onClick={activeTab === 'vip' ? openVip : startCheckout}
              disabled={checkoutLoading}
              aria-label={`Purchase ${selectedPackage.coins} coins`}
              style={{
                position: 'absolute',
                left: '50%',
                bottom: '34px',
                transform: 'translateX(-50%)',
                width: 'min(385px, calc(100% - 80px))',
                height: '69px',
                borderRadius: '18px',
                border: '1px solid #ff1654',
                background: '#ff1654',
                color: '#ffffff',
                cursor: checkoutLoading ? 'wait' : 'pointer',
                fontFamily: FB,
                fontSize: '29px',
                lineHeight: '33px',
                opacity: checkoutLoading ? 0.72 : 1,
                outline: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {activeTab === 'vip'
                ? 'OPEN VIP'
                : checkoutLoading
                  ? 'OPENING STRIPE'
                  : `PURCHASE ${selectedPackage.coins} COINS`}
            </button>

            <p
              aria-label="Wallet balance"
              style={{
                position: 'absolute',
                right: '36px',
                top: '116px',
                margin: 0,
                color: 'rgba(255,255,255,0.58)',
                fontFamily: FB,
                fontSize: '18px',
              }}
            >
              BALANCE {Number(wallet?.balance ?? 0).toFixed(2)}
            </p>
          </section>
        </div>,
        document.body,
      )}

      <VipModal
        open={vipOpen}
        onBuyCoins={() => {
          setVipOpen(false);
          setActiveTab('coins');
        }}
        onOpenChange={(nextOpen) => {
          setVipOpen(nextOpen);
          if (!nextOpen) setActiveTab('coins');
        }}
      />
    </>
  );
}

function WalletTab({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
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
        fontFamily: active ? FB : F,
        fontWeight: active ? 700 : 400,
        fontSize: '23px',
        lineHeight: '33px',
        padding: '0 0 10px',
        outline: 'none',
        whiteSpace: 'nowrap',
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
        height: '158px',
        borderRadius: '8px',
        border: `1px solid ${selected ? '#ff1654' : 'rgba(255,255,255,0.04)'}`,
        background: selected ? 'rgba(255,22,84,0.38)' : '#141414',
        boxShadow: selected ? 'inset 0 0 0 1px rgba(255,255,255,0.05)' : 'none',
        cursor: 'pointer',
        color: '#ffffff',
        outline: 'none',
      }}
    >
      {bestSeller ? (
        <span
          style={{
            position: 'absolute',
            top: '7px',
            right: '8px',
            height: '28px',
            minWidth: '111px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '8px',
            border: '1px solid #ff1654',
            background: 'rgba(255,22,84,0.42)',
            fontFamily: FB,
            fontSize: '11px',
            color: '#ffffff',
          }}
        >
          BEST SELLER
        </span>
      ) : null}

      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '52px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          background: '#ff1654',
        }}
      />
      <span
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '22px',
          textAlign: 'center',
          fontFamily: FB,
          fontSize: '29px',
          lineHeight: '29px',
          color: '#ffffff',
        }}
      >
        {pack.coins} COINS
      </span>
    </button>
  );
}
