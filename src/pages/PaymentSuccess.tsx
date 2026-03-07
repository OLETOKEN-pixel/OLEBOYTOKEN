import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { CoinIcon } from '@/components/common/CoinIcon';
import { useAuth } from '@/contexts/AuthContext';

type Status = 'loading' | 'success' | 'error';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshWallet } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [coins, setCoins] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handlePayment = async () => {
      const success = searchParams.get('success');
      const coinsParam = searchParams.get('coins');
      const canceled = searchParams.get('canceled');

      console.log('[PaymentSuccess] Page loaded', {
        success,
        coins: coinsParam,
        canceled,
        fullUrl: window.location.href,
      });

      if (canceled === 'true') {
        setErrorMessage('Pagamento annullato');
        setStatus('error');
        return;
      }

      if (success === 'true') {
        setCoins(parseFloat(coinsParam || '0'));
        setStatus('success');
        await refreshWallet();
        return;
      }

      setStatus('success');
    };

    if (user) {
      handlePayment();
    } else {
      navigate('/auth');
    }
  }, [searchParams, user, navigate, refreshWallet]);

  if (status === 'loading') {
    return (
      <MainLayout showChat={false}>
        <div className="max-w-md mx-auto flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 animate-spin text-[#FFC805] mb-4" />
          <p className="text-gray-400">Elaborazione del pagamento...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout showChat={false}>
      <div className="max-w-md mx-auto py-8">
        <div className="bg-[#121212] border border-[#1f2937] rounded-[16px] text-center p-8">
          {status === 'success' ? (
            <>
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <CoinIcon size="hero" className="animate-bounce" />
                  <CheckCircle className="absolute -bottom-1 -right-1 w-8 h-8 text-green-500 bg-[#121212] rounded-full" />
                </div>
              </div>
              <h1 className="text-[36px] font-bold uppercase mb-2 text-green-500">
                Pagamento Riuscito!
              </h1>
              {coins > 0 && (
                <p className="text-gray-400 mb-4">
                  Hai ricevuto <CoinDisplay amount={coins} size="lg" className="inline-flex" />
                </p>
              )}
              <p className="text-sm text-gray-400 mb-6">
                I tuoi coins sono stati aggiunti al wallet.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="w-full btn-premium h-12">
                  <Link to="/wallet">Vai al Wallet</Link>
                </Button>
                <Button asChild className="w-full btn-premium-secondary h-12">
                  <Link to="/matches">Sfoglia Match</Link>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex justify-center">
                <XCircle className="w-16 h-16 text-red-500" />
              </div>
              <h1 className="text-[36px] font-bold uppercase mb-2 text-red-500">
                Pagamento Fallito
              </h1>
              <p className="text-gray-400 mb-6">
                {errorMessage || 'Si è verificato un errore con il pagamento.'}
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild className="w-full btn-premium h-12">
                  <Link to="/buy">Riprova</Link>
                </Button>
                <Button asChild className="w-full btn-premium-secondary h-12">
                  <Link to="/">Torna alla Home</Link>
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
