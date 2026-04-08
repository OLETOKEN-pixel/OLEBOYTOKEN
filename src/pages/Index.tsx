import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { HomeNotRegistered } from '@/components/home/HomeNotRegistered';
import { HomeRegistered } from '@/components/home/HomeRegistered';

export default function Index() {
  const { user, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const targetSectionId = (location.state as { scrollTo?: string } | null)?.scrollTo;
    if (!targetSectionId) {
      return;
    }

    let attempts = 0;
    let frameId = 0;

    const clearScrollState = () => {
      navigate(
        {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
        { replace: true, state: null },
      );
    };

    const tryScroll = () => {
      const target = document.getElementById(targetSectionId);

      if (target) {
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.scrollY,
          behavior: 'smooth',
        });
        clearScrollState();
        return;
      }

      if (attempts >= 24) {
        clearScrollState();
        return;
      }

      attempts += 1;
      frameId = window.requestAnimationFrame(tryScroll);
    };

    frameId = window.requestAnimationFrame(tryScroll);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [location.hash, location.pathname, location.search, location.state, navigate]);

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
