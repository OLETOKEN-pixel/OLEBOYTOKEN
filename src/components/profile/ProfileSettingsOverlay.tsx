import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ProfileSettingsView, type ProfileSection } from '@/components/profile/ProfileSettingsView';

interface ProfileSettingsOverlayProps {
  open: boolean;
  initialSection?: ProfileSection;
  onClose: () => void;
}

export function ProfileSettingsOverlay({
  open,
  initialSection = 'account',
  onClose,
}: ProfileSettingsOverlayProps) {
  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[130] bg-black/[0.8] backdrop-blur-[10px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,22,84,0.18),transparent_42%)]" />

      <div
        className="absolute left-1/2 top-1/2 h-[min(900px,calc(100vh-28px))] w-[min(1220px,calc(100vw-28px))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[30px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <ProfileSettingsView initialSection={initialSection} onClose={onClose} mode="overlay" />
      </div>
    </div>,
    document.body
  );
}
