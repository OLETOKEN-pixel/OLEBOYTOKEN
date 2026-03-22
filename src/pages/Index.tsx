import { useAuth } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { HomeNotRegistered } from '@/components/home/HomeNotRegistered';
import { HomeRegistered } from '@/components/home/HomeRegistered';

export default function Index() {
  const { user, profile } = useAuth();

  // Show new Figma design for non-logged-in users
  if (!user) {
    return (
      <PublicLayout>
        <HomeNotRegistered />
      </PublicLayout>
    );
  }

  // Logged-in home page
  return (
    <PublicLayout>
      <HomeRegistered displayName={profile?.discord_display_name || 'Player'} />
    </PublicLayout>
  );
}
