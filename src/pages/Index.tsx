import { MainLayout } from '@/components/layout/MainLayout';
import { HeroCompact } from '@/components/home/HeroCompact';
import { LiveMatchesPanel } from '@/components/home/LiveMatchesPanel';
import Frame1 from '@/components/Frame1';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user } = useAuth();

  if (!user) {
    return <Frame1 />;
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
