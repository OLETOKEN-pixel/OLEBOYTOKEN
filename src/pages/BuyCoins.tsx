import { useEffect } from 'react';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useWalletPurchase } from '@/contexts/WalletPurchaseContext';

export default function BuyCoins() {
  const { openWalletPurchase } = useWalletPurchase();

  useEffect(() => {
    openWalletPurchase();
  }, [openWalletPurchase]);

  return (
    <PublicLayout>
      <div
        style={{
          minHeight: '100vh',
          background: '#0f0404',
        }}
      />
    </PublicLayout>
  );
}
