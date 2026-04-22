import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuth } from '@/contexts/AuthContext';

const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif";

export default function PaymentSuccess() {
  const { refreshWallet } = useAuth();
  const [searchParams] = useSearchParams();
  const provider = searchParams.get('provider') || 'stripe';

  useEffect(() => {
    const refresh = window.setTimeout(() => {
      void refreshWallet();
    }, 1200);

    return () => window.clearTimeout(refresh);
  }, [refreshWallet]);

  return (
    <PublicLayout>
      <main
        style={{
          minHeight: '100vh',
          background: '#0f0404',
          color: '#ffffff',
          display: 'grid',
          placeItems: 'center',
          padding: '180px 24px 90px',
          boxSizing: 'border-box',
          fontFamily: F,
        }}
      >
        <section
          style={{
            width: 'min(760px, 100%)',
            border: '1px solid #ff1654',
            borderRadius: '18px',
            background: '#282828',
            padding: '54px 46px',
            textAlign: 'center',
            boxShadow: '0 28px 80px rgba(0,0,0,0.48)',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: FE,
              fontWeight: 900,
              fontStyle: 'oblique',
              fontSize: 'clamp(42px, 7vw, 72px)',
              lineHeight: 1,
              color: '#ffffff',
            }}
          >
            PAYMENT RECEIVED
          </h1>
          <div style={{ height: '2px', background: '#ffffff', opacity: 0.82, margin: '24px auto 34px', width: '72%' }} />
          <p style={{ margin: 0, fontSize: '24px', color: 'rgba(255,255,255,0.76)' }}>
            {provider.toUpperCase()} is confirming your coins. Your wallet will update automatically.
          </p>
          <Link
            to="/"
            style={{
              display: 'inline-grid',
              placeItems: 'center',
              marginTop: '38px',
              width: '260px',
              height: '58px',
              border: '1px solid #ff1654',
              borderRadius: '18px',
              background: '#ff1654',
              color: '#ffffff',
              textDecoration: 'none',
              fontFamily: FE,
              fontSize: '24px',
            }}
          >
            BACK HOME
          </Link>
        </section>
      </main>
    </PublicLayout>
  );
}
