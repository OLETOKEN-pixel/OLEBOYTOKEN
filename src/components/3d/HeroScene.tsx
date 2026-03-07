import React, { lazy, Suspense } from 'react';

const Coin3D = lazy(() => import('./Coin3D'));
const ParticleField = lazy(() => import('./ParticleField'));
const Scene3D = lazy(() => import('./Scene3D'));

function HeroFallback() {
  return (
    <div
      className="w-full h-full relative"
      style={{
        minHeight: '300px',
        background:
          'linear-gradient(135deg, hsl(232 18% 6%) 0%, hsl(230 16% 10%) 50%, hsl(232 18% 6%) 100%)',
      }}
    />
  );
}

function HeroSceneContent() {
  return (
    <Suspense fallback={<HeroFallback />}>
      <Scene3D
        className="relative w-full h-full"
        fallback={<HeroFallback />}
      >
        <div
          className="relative w-full overflow-hidden"
          style={{
            height: 'clamp(320px, 45vw, 480px)',
          }}
        >
          <Suspense fallback={null}>
            <ParticleField count={120} />
          </Suspense>

          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ zIndex: 1 }}
          >
            <div style={{ width: 'min(340px, 55vw)', height: 'min(340px, 55vw)' }}>
              <Suspense fallback={null}>
                <Coin3D size={2} autoRotate interactive />
              </Suspense>
            </div>
          </div>
        </div>
      </Scene3D>
    </Suspense>
  );
}

export default HeroSceneContent;
