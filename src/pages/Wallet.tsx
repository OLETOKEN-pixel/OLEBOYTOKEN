import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ProfileSettingsView } from '@/components/profile/ProfileSettingsView';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export default function Wallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate(`/auth?next=${encodeURIComponent('/wallet')}`, { replace: true });
    }
  }, [loading, navigate, user]);

  useEffect(() => {
    const stripeOnboarding = searchParams.get('stripe_onboarding');
    const stripeRefresh = searchParams.get('stripe_refresh');

    if (stripeOnboarding === 'complete') {
      toast({
        title: 'Stripe connected',
        description: 'Your bank payout setup is complete.',
      });
      navigate('/wallet', { replace: true });
    } else if (stripeRefresh === 'true') {
      toast({
        title: 'Stripe setup incomplete',
        description: 'Finish the Stripe onboarding flow to enable withdrawals.',
        variant: 'destructive',
      });
      navigate('/wallet', { replace: true });
    }
  }, [navigate, searchParams, toast]);

  return (
    <PublicLayout>
      <section className="min-h-screen bg-[#0f0404] px-4 pb-24 pt-[148px] lg:px-8 lg:pt-[168px]">
        {loading || !user ? <LoadingPage /> : <ProfileSettingsView initialSection="payments" mode="page" />}
      </section>
    </PublicLayout>
  );
}
