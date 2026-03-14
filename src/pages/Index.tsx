import { useAuth } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { HomeNotRegistered } from '@/components/home/HomeNotRegistered';
import { MainLayout } from '@/components/layout/MainLayout';
import { HeroCompact } from '@/components/home/HeroCompact';
import { LiveMatchesPanel } from '@/components/home/LiveMatchesPanel';

export default function Index() {
  const { user } = useAuth();

  // Show new Figma design for non-logged-in users
  if (!user) {
    return (
      <PublicLayout>
        <HomeNotRegistered />
      </PublicLayout>
    );
  }

  // Show existing dashboard for logged-in users
  return (
    <MainLayout>
      <div className="flex flex-col">
        <HeroCompact />
        <LiveMatchesPanel />
      </div>
    </MainLayout>
  );
}
