import React, { Suspense, Component, ReactNode, useEffect, useState } from 'react';

interface ErrorBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class Scene3DErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <DefaultFallback />;
    }
    return this.props.children;
  }
}

function DefaultFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background:
          'linear-gradient(135deg, hsl(232 18% 6%) 0%, hsl(230 16% 10%) 50%, hsl(232 18% 6%) 100%)',
        borderRadius: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    />
  );
}

function LoadingShimmer() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background:
          'linear-gradient(135deg, hsl(232 18% 6%) 0%, hsl(230 16% 10%) 50%, hsl(232 18% 6%) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, transparent 0%, rgba(212,165,55,0.04) 50%, transparent 100%)',
          animation: 'scene3d-shimmer 2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes scene3d-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return reduced;
}

function useWebGLAvailable(): boolean {
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setAvailable(false);
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') || canvas.getContext('webgl');
      setAvailable(!!gl);
    } catch {
      setAvailable(false);
    }
  }, []);

  return available;
}

interface Scene3DProps {
  children: ReactNode;
  className?: string;
  fallback?: ReactNode;
}

export default function Scene3D({ children, className, fallback }: Scene3DProps) {
  const reducedMotion = useReducedMotion();
  const webglAvailable = useWebGLAvailable();

  const fallbackElement = fallback || <DefaultFallback />;

  if (typeof window === 'undefined' || !webglAvailable || reducedMotion) {
    return <div className={className}>{fallbackElement}</div>;
  }

  return (
    <Scene3DErrorBoundary fallback={<div className={className}>{fallbackElement}</div>}>
      <Suspense
        fallback={
          <div className={className}><LoadingShimmer /></div>
        }
      >
        <div className={className}>{children}</div>
      </Suspense>
    </Scene3DErrorBoundary>
  );
}
