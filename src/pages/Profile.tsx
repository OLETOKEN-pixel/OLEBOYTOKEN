import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoadingPage } from '@/components/common/LoadingSpinner';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { ProfileSettingsView, type ProfileSection } from '@/components/profile/ProfileSettingsView';
import { useAuth } from '@/contexts/AuthContext';
import { getCurrentPathWithQueryAndHash } from '@/lib/oauth';
import { cn } from '@/lib/utils';

const PROFILE_TABS: ProfileSection[] = ['account', 'game', 'payments', 'connections'];

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      navigate(`/auth?next=${encodeURIComponent(getCurrentPathWithQueryAndHash())}`, { replace: true });
    }
  }, [loading, navigate, user]);

  const requestedTab = searchParams.get('tab');
  const initialSection = PROFILE_TABS.includes(requestedTab as ProfileSection)
    ? (requestedTab as ProfileSection)
    : 'account';

  return (
    <PublicLayout>
      <section
        className={cn(
          'min-h-screen bg-[radial-gradient(circle_at_top,rgba(118,12,38,0.24),transparent_30%),linear-gradient(180deg,#160406_0%,#090203_100%)] px-4 pb-16 pt-[148px] lg:flex lg:min-h-[calc(100vh-146px)] lg:items-start lg:justify-center lg:overflow-hidden lg:px-6 lg:pb-8 lg:pt-[170px]'
        )}
      >
        {loading || !user ? <LoadingPage /> : <ProfileSettingsView initialSection={initialSection} mode="page" />}
      </section>
    </PublicLayout>
  );
}
