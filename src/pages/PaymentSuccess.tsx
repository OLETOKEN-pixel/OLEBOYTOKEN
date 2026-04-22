import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { extractFunctionErrorMessage } from '@/lib/oauth';

const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base_Neue_Trial-ExpandedBlack_Oblique', 'Base Neue Trial', sans-serif";

export default function PaymentSuccess() {
  const { user, refreshWallet } = useAuth();
  const [searchParams] = useSearchParams();
  const provider = searchParams.get('provider') || 'stripe';
  const sessionId = searchParams.get('session_id');
  const [confirmationState, setConfirmationState] = useState<'confirming' | 'credited' | 'pending' | 'error'>(
    provider === 'stripe' && sessionId ? 'confirming' : 'pending',
  );
  const [confirmationMessage, setConfirmationMessage] = useState('');

  const bodyCopy = useMemo(() => {
    if (confirmationState === 'credited') {
      return 'Your coins have been credited. Your wallet is updated.';
    }

    if (confirmationState === 'error') {
      return confirmationMessage || 'Payment received, but the wallet confirmation needs another check.';
    }

    if (confirmationState === 'confirming') {
      return 'Stripe confirmed the payment. We are crediting your coins now.';
    }

    return confirmationMessage || `${provider.toUpperCase()} is confirming your coins. Your wallet will update automatically.`;
  }, [confirmationMessage, confirmationState, provider]);

  useEffect(() => {
    if (provider !== 'stripe' || !sessionId || !user) {
      const refresh = window.setTimeout(() => {
        void refreshWallet();
      }, 1200);

      return () => window.clearTimeout(refresh);
    }

    let cancelled = false;

    const confirmStripeCheckout = async () => {
      setConfirmationState('confirming');

      try {
        const { data, error } = await supabase.functions.invoke('confirm-checkout-session', {
          body: { sessionId },
        });

        if (error) throw error;

        if ((data as { pending?: boolean } | null)?.pending) {
          if (!cancelled) {
            setConfirmationState('pending');
            setConfirmationMessage('Stripe is still processing this payment method. The wallet will update as soon as it is paid.');
          }
          return;
        }

        await refreshWallet();

        if (!cancelled) {
          setConfirmationState('credited');
          setConfirmationMessage('');
        }
      } catch (error) {
        const message = await extractFunctionErrorMessage(error, 'Unable to confirm this payment.');
        if (!cancelled) {
          setConfirmationState('error');
          setConfirmationMessage(message);
        }
      }
    };

    void confirmStripeCheckout();

    return () => {
      cancelled = true;
    };
  }, [provider, refreshWallet, sessionId, user]);

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
            {bodyCopy}
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
