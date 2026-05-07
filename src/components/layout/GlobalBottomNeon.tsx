import { useLocation } from 'react-router-dom';

function isStandaloneMatchDetailRoute(pathname: string) {
  return /^\/matches\/(?!create(?:\/|$))[^/]+$/.test(pathname);
}

function isShopRoute(pathname: string) {
  return pathname === '/shop' || pathname.startsWith('/shop/');
}

export function shouldRenderGlobalBottomNeon(pathname: string) {
  return !isStandaloneMatchDetailRoute(pathname) && !isShopRoute(pathname);
}

export function GlobalBottomNeon() {
  const { pathname } = useLocation();

  if (!shouldRenderGlobalBottomNeon(pathname)) return null;

  return (
    <img
      aria-hidden="true"
      data-global-neon="true"
      src="/figma-assets/figma-neon.png"
      alt=""
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        width: '100vw',
        height: '146px',
        objectFit: 'cover',
        pointerEvents: 'none',
        zIndex: 7,
        transform: 'scaleY(-1)',
      }}
    />
  );
}
