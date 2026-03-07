import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Check, CreditCard, Info, Coins, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CoinDisplay } from '@/components/common/CoinDisplay';
import { CoinIcon } from '@/components/common/CoinIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { COIN_PACKAGES, type CoinPackage } from '@/types';
import { cn } from '@/lib/utils';

const PROCESSING_FEE = 0.50;
const MIN_COINS = 5;

export default function BuyCoins() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [selectedPackage, setSelectedPackage] = useState<CoinPackage | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  const handleSelectPackage = (pkg: CoinPackage) => {
    setSelectedPackage(pkg);
    setCustomAmount('');
  };

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    setSelectedPackage(null);
  };

  const finalAmount = customAmount ? parseFloat(customAmount) : (selectedPackage?.coins ?? 0);
  const finalPrice = finalAmount + PROCESSING_FEE;
  const isValidAmount = finalAmount >= MIN_COINS;

  const handleCheckout = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!isValidAmount) {
      toast({
        title: 'Importo non valido',
        description: `Il minimo acquisto è di ${MIN_COINS} Coins.`,
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ amount: finalAmount }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Checkout failed');

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Errore',
        description: error.message || 'Impossibile avviare il pagamento. Riprova.',
        variant: 'destructive',
      });
      setProcessing(false);
    }
  };

  const featuredPackages = COIN_PACKAGES.filter(p => [5, 10, 25].includes(p.coins)).length >= 3
    ? COIN_PACKAGES.filter(p => [5, 10, 25].includes(p.coins))
    : COIN_PACKAGES.slice(0, 3);

  return (
    <MainLayout showChat={false}>
      <div className="space-y-8 max-w-3xl mx-auto py-4 lg:py-8">
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            to="/wallet"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors group text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Wallet
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="text-center"
        >
          <h1 className="text-[36px] font-bold tracking-tight uppercase mb-2">
            BUY COINS
          </h1>
          <p className="text-gray-400 text-sm">
            1 Coin = €1 · Instant delivery · Secure payment
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {COIN_PACKAGES.map((pkg, index) => (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05, duration: 0.4 }}
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelectPackage(pkg)}
              className={cn(
                'bg-[#121212] border border-[#1f2937] rounded-[16px] p-6 cursor-pointer text-center relative overflow-hidden',
                selectedPackage?.id === pkg.id && 'border-[#FFC805]/50 glow-gold',
                pkg.popular && !selectedPackage && 'border-[#FFC805]/30'
              )}
            >
              {pkg.popular && (
                <div className="absolute top-3 right-3">
                  <span className="badge-gold text-xs">
                    <Star className="w-3 h-3 mr-1" />
                    Popular
                  </span>
                </div>
              )}
              <div className="mb-4 flex justify-center pt-2">
                <motion.div
                  animate={selectedPackage?.id === pkg.id ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  <CoinIcon size={selectedPackage?.id === pkg.id ? 'xl' : 'lg'} />
                </motion.div>
              </div>
              <p className="font-mono text-3xl font-bold text-[#FFC805] mb-1">
                {pkg.coins}
                {pkg.bonus && (
                  <span className="text-sm text-green-500 ml-2">+{pkg.bonus}</span>
                )}
              </p>
              <p className="text-xs text-gray-400 mb-3">Coins</p>
              <p className="font-mono text-lg font-semibold">€{pkg.price}</p>
              {selectedPackage?.id === pkg.id && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-3 flex items-center justify-center gap-1 text-green-500 text-xs font-semibold"
                >
                  <Check className="w-4 h-4" />
                  Selected
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-[#121212] border border-[#1f2937] rounded-[16px] p-0 overflow-hidden"
        >
          <div className="p-5 lg:p-6 border-b border-[#1f2937]">
            <h3 className="font-semibold text-sm">Custom Amount</h3>
            <p className="text-xs text-gray-400">Enter an amount (minimum €{MIN_COINS})</p>
          </div>
          <div className="p-5 lg:p-6">
            <div className="flex gap-4">
              <div className="flex-1">
                <Label htmlFor="custom" className="text-xs tracking-wide uppercase text-gray-400">Amount in €</Label>
                <Input
                  id="custom"
                  type="number"
                  placeholder={`Min ${MIN_COINS}`}
                  value={customAmount}
                  onChange={(e) => handleCustomAmount(e.target.value)}
                  min={MIN_COINS}
                  step={1}
                  className="font-mono input-premium"
                />
              </div>
              <div className="flex-1">
                <Label className="text-xs tracking-wide uppercase text-gray-400">You'll receive</Label>
                <div className="h-10 flex items-center">
                  <CoinDisplay amount={customAmount ? parseFloat(customAmount) : 0} size="lg" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className={cn(
            "bg-[#121212] border border-[#1f2937] rounded-[16px] p-6 lg:p-8",
            isValidAmount && "border-[#FFC805]/30 glow-gold-soft"
          )}
        >
          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Coins</span>
              <span className="font-mono font-medium">€{finalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400 flex items-center gap-1">
                Fee
                <Info className="w-3 h-3" />
              </span>
              <span className="font-mono">€{PROCESSING_FEE.toFixed(2)}</span>
            </div>
            <div className="h-px bg-[#1f2937]" />
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="font-mono text-[#FFC805]">€{isValidAmount ? finalPrice.toFixed(2) : '0.00'}</span>
            </div>
          </div>

          <div className="text-center mb-6">
            <p className="text-xs text-gray-400 mb-1">You'll receive</p>
            <span className="font-mono text-4xl font-bold text-[#FFC805]">
              {isValidAmount ? finalAmount : 0}
            </span>
            <span className="text-sm ml-2 text-gray-400">Coins</span>
          </div>

          <Button
            size="lg"
            className="w-full btn-premium h-14 text-base"
            onClick={handleCheckout}
            disabled={processing || !isValidAmount}
          >
            {processing ? (
              'Processing...'
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                {user ? 'Pay Now' : 'Sign In to Buy'}
              </>
            )}
          </Button>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <CreditCard className="w-4 h-4" />
            <span>Secure payment via Stripe</span>
          </div>
        </motion.div>
      </div>
    </MainLayout>
  );
}
