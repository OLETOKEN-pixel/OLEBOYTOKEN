import { useAuth } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { HomeNotRegistered } from '@/components/home/HomeNotRegistered';
import { HomeRegistered } from '@/components/home/HomeRegistered';

export default function Index() {
  const { user, profile } = useAuth();

  if (!user) {
    return (
      <PublicLayout>
        <HomeNotRegistered />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <HomeRegistered displayName={profile?.discord_display_name || 'Player'} />
    </PublicLayout>
  );
}
