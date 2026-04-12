import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo-oleboy.png';

interface AppLoadingGuardProps {
  children: React.ReactNode;
}

export function AppLoadingGuard({ children }: AppLoadingGuardProps) {
  const { loading, profile } = useAuth();

  // Preload Discord profile avatar for instant display.
  useEffect(() => {
    if (profile?.discord_avatar_url) {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = profile.discord_avatar_url;
      document.head.appendChild(link);
      
      // Also preload into browser cache
      const img = new Image();
      img.src = profile.discord_avatar_url;
    }
  }, [profile?.discord_avatar_url]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img 
            src={logo} 
            className="w-20 h-20 animate-pulse mx-auto mb-4 object-contain" 
            alt="Loading..."
          />
          <p className="text-muted-foreground animate-pulse">Caricamento...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
