import { useAuth } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { HomeNotRegistered } from '@/components/home/HomeNotRegistered';
import { MainLayout } from '@/components/layout/MainLayout';

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

  // Coming Soon page for logged-in users
  return (
    <MainLayout>
      <div
        style={{
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '40px 20px',
        }}
      >
        <div
          style={{
            fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
            fontWeight: 900,
            fontSize: 'clamp(48px, 8vw, 96px)',
            lineHeight: 1,
            background: 'linear-gradient(135deg, #ff1654 0%, #ff1654 40%, #ffffff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: '24px',
          }}
        >
          COMING SOON
        </div>
        <p
          style={{
            fontFamily: "'Base Neue Trial', 'Base Neue', sans-serif",
            fontWeight: 400,
            fontSize: '20px',
            color: '#e6e6e6',
            maxWidth: '500px',
            lineHeight: 1.5,
            opacity: 0.7,
          }}
        >
          {profile?.discord_display_name
            ? `Welcome ${profile.discord_display_name}! `
            : ''}
          We're building something amazing. Stay tuned!
        </p>
        <div
          style={{
            marginTop: '48px',
            width: '80px',
            height: '4px',
            borderRadius: '2px',
            background: 'linear-gradient(90deg, #ff1654, #3b28cc)',
          }}
        />
      </div>
    </MainLayout>
  );
}
