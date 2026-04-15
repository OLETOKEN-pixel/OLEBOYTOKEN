import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const Spline = lazy(() => import('@splinetool/react-spline'));

const SCENE_URL = 'https://prod.spline.design/VT7zq-V4nXfk4PVH/scene.splinecode';

function shouldLoadSpline(): boolean {
  if (typeof window === 'undefined') return false;

  const isMobile = window.innerWidth < 768;
  const isLowEnd = navigator.hardwareConcurrency <= 2;

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
  const noWebGL = !gl;

  return !isMobile && !isLowEnd && !noWebGL;
}

export default function ComingSoon() {
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [splineFailed, setSplineFailed] = useState(false);
  const [canLoad, setCanLoad] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();

  useEffect(() => {
    setCanLoad(shouldLoadSpline());
  }, []);

  useEffect(() => {
    if (!canLoad) return;

    timeoutRef.current = setTimeout(() => {
      if (!splineLoaded) setSplineFailed(true);
    }, 8000);

    return () => clearTimeout(timeoutRef.current);
  }, [canLoad, splineLoaded]);

  // Hide the global neon overlay on this page
  useEffect(() => {
    const neon = document.querySelector('[data-global-neon]') as HTMLElement | null;
    if (neon) neon.style.display = 'none';
    return () => {
      if (neon) neon.style.display = '';
    };
  }, [location.pathname]);

  function onLoad() {
    clearTimeout(timeoutRef.current);
    setSplineLoaded(true);
  }

  const showFallback = !canLoad || splineFailed;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: '#0a0a0a',
        zIndex: 50,
      }}
    >
      {/* Fallback background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          background: '#0a0a0a',
          opacity: splineLoaded && !showFallback ? 0 : 1,
          transition: 'opacity 0.6s ease',
        }}
      />

      {/* Spline scene */}
      {canLoad && !splineFailed && (
        <Suspense fallback={null}>
          <Spline
            scene={SCENE_URL}
            onLoad={onLoad}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 1,
              opacity: splineLoaded ? 1 : 0,
              transition: 'opacity 0.6s ease',
              pointerEvents: 'all',
            }}
          />
        </Suspense>
      )}

      {/* Fallback content for unsupported devices */}
      {showFallback && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: '#FFC805', fontFamily: 'sans-serif', fontSize: '1.5rem', letterSpacing: '0.2em' }}>
            COMING SOON
          </p>
        </div>
      )}
    </div>
  );
}
