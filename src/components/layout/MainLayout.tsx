import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from './Header';
import { Footer } from './Footer';
import { BottomNav } from './BottomNav';
import { FigmaFrame } from './FigmaFrame';
import { useSoundNotifications } from '@/hooks/useSoundNotifications';
import { useIsMobile } from '@/hooks/use-mobile';

interface MainLayoutProps {
  children: React.ReactNode;
  showChat?: boolean;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { unlockAudio, audioUnlocked } = useSoundNotifications();
  const hasUnlockedRef = useRef(false);
  const isMobile = useIsMobile();
  const location = useLocation();

  useEffect(() => {
    if (audioUnlocked || hasUnlockedRef.current) return;

    const handleFirstInteraction = () => {
      if (hasUnlockedRef.current) return;
      hasUnlockedRef.current = true;
      unlockAudio();
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };

    document.addEventListener('click', handleFirstInteraction);
    document.addEventListener('keydown', handleFirstInteraction);
    document.addEventListener('touchstart', handleFirstInteraction);

    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('keydown', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, [unlockAudio, audioUnlocked]);

  return (
    <div className="min-h-screen bg-[hsl(var(--bg-0))]">
      <Header />

      <main className="pt-[70px] pb-20 lg:pb-8">
        <FigmaFrame baseWidth={1920}>
          <div className="w-full max-w-[1440px] mx-auto px-4 lg:px-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
        </FigmaFrame>
      </main>

      <Footer />

      {isMobile && <BottomNav />}

    </div>
  );
}
