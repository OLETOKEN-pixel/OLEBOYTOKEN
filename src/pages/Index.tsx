import { MainLayout } from '@/components/layout/MainLayout';
import { HeroCompact } from '@/components/home/HeroCompact';
import { LiveMatchesPanel } from '@/components/home/LiveMatchesPanel';
import { LandingPage } from '@/components/landing/LandingPage';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user } = useAuth();

  if (!user) {
    return <LandingPage />;
  }

  return (
    <MainLayout>
      <div className="flex flex-col">
        <HeroCompact />
        <LiveMatchesPanel />
      </div>
    </MainLayout>
  );
}
