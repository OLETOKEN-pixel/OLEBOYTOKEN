import { MainLayout } from '@/components/layout/MainLayout';
import { HeroCompact } from '@/components/home/HeroCompact';
import { LiveMatchesPanel } from '@/components/home/LiveMatchesPanel';

export default function Index() {
  return (
    <MainLayout>
      <div className="flex flex-col">
        <HeroCompact />
        <LiveMatchesPanel />
      </div>
    </MainLayout>
  );
}
