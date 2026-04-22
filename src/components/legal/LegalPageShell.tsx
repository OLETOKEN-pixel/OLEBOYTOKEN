import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FooterSection } from '@/components/home/sections/FooterSection';
import { PublicLayout } from '@/components/layout/PublicLayout';

export type LegalPageKey = 'terms' | 'privacy' | 'rules';

const FONT_REGULAR = "'Base_Neue_Trial:Regular', 'Base Neue Trial', sans-serif";
const FONT_BOLD = "'Base_Neue_Trial:Expanded_Bold', 'Base Neue Trial', sans-serif";
const FONT_HEAD = "'Base_Neue_Trial:Expanded_Black_Oblique', 'Base Neue Trial', sans-serif";

const NAV_ITEMS: Array<{ key: LegalPageKey; label: string; href: string }> = [
  { key: 'terms', label: 'TERMS', href: '/terms' },
  { key: 'privacy', label: 'PRIVACY', href: '/privacy' },
  { key: 'rules', label: 'RULES', href: '/rules' },
];

interface LegalPageShellProps {
  title: string;
  active: LegalPageKey;
  lastUpdated?: string;
  description?: string;
  children: ReactNode;
}

export function LegalPageShell({
  title,
  active,
  lastUpdated,
  description,
  children,
}: LegalPageShellProps) {
  return (
    <PublicLayout>
      <section
        data-testid="legal-page-shell"
        style={{
          position: 'relative',
          minHeight: '100vh',
          overflowX: 'hidden',
          background:
            'radial-gradient(circle at bottom, rgba(255,22,84,0.24), transparent 33%), linear-gradient(180deg, #160406 0%, #090203 100%)',
          color: '#fff',
          fontFamily: FONT_REGULAR,
        }}
      >
        <style>
          {`
            .legal-shell-main {
              position: relative;
              z-index: 2;
              width: min(1448px, calc(100vw - 96px));
              margin: 0 auto;
              padding: 156px 0 74px;
            }

            .legal-title-block {
              position: relative;
              min-height: 186px;
              margin-left: -71px;
              margin-bottom: 34px;
            }

            .legal-title-triangles {
              position: absolute;
              left: 0;
              top: 0;
              width: 124px;
              height: 186px;
              object-fit: contain;
              pointer-events: none;
            }

            .legal-title-wordmark {
              position: absolute;
              left: 71px;
              top: 77px;
              display: inline-block;
              max-width: calc(100vw - 180px);
            }

            .legal-title-wordmark h1 {
              margin: 0;
              font-family: ${FONT_HEAD};
              font-size: clamp(46px, 6vw, 80px);
              line-height: 0.96;
              font-weight: 900;
              font-style: oblique;
              white-space: nowrap;
              letter-spacing: 0;
              color: #fff;
            }

            .legal-title-underline {
              width: 100%;
              height: 9px;
              margin-top: 8px;
              background: #ff1654;
            }

            .legal-page-tools {
              display: flex;
              align-items: flex-end;
              justify-content: space-between;
              gap: 24px;
              margin: 0 0 31px;
            }

            .legal-meta {
              min-width: 0;
              color: rgba(255, 255, 255, 0.68);
              font-family: ${FONT_REGULAR};
              font-size: 18px;
              line-height: 1.45;
            }

            .legal-meta strong {
              color: #fff;
              font-family: ${FONT_BOLD};
              font-size: 20px;
            }

            .legal-nav {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              justify-content: flex-end;
            }

            .legal-nav a {
              height: 47px;
              min-width: 132px;
              padding: 0 22px;
              border: 1px solid #ff1654;
              border-radius: 8px;
              background: rgba(255, 22, 84, 0.16);
              color: #fff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              text-decoration: none;
              font-family: ${FONT_BOLD};
              font-size: 21px;
              line-height: 1;
              outline: none;
              box-shadow: none;
              -webkit-tap-highlight-color: transparent;
            }

            .legal-nav a[data-active="true"] {
              background: #ff1654;
              border-color: #ff1654;
            }

            .legal-panel {
              border: 1px solid rgba(255, 22, 84, 0.78);
              border-radius: 8px;
              background: #282828;
              padding: 42px 48px;
              box-shadow: 0 30px 100px rgba(0, 0, 0, 0.45);
            }

            .legal-content {
              color: rgba(255, 255, 255, 0.78);
              font-family: ${FONT_REGULAR};
              font-size: 18px;
              line-height: 1.55;
            }

            .legal-content h2,
            .legal-content h3 {
              color: #fff;
              font-family: ${FONT_HEAD};
              font-weight: 900;
              font-style: oblique;
              letter-spacing: 0;
              text-transform: uppercase;
            }

            .legal-content h2 {
              margin: 44px 0 18px;
              padding-bottom: 12px;
              border-bottom: 1px solid rgba(255, 22, 84, 0.72);
              font-size: clamp(28px, 3vw, 42px);
              line-height: 0.95;
            }

            .legal-content h2:first-child,
            .legal-content p:first-child + h2 {
              margin-top: 0;
            }

            .legal-content h3 {
              margin: 30px 0 13px;
              font-size: 25px;
              line-height: 1;
            }

            .legal-content p {
              margin: 0 0 18px;
            }

            .legal-content ul {
              list-style: none;
              margin: 0 0 22px;
              padding: 0;
              display: grid;
              gap: 12px;
            }

            .legal-content li {
              position: relative;
              padding-left: 24px;
            }

            .legal-content li::before {
              content: '';
              position: absolute;
              left: 2px;
              top: 0.72em;
              width: 6px;
              height: 6px;
              border-radius: 999px;
              background: #ff1654;
              box-shadow: 0 0 10px rgba(255, 22, 84, 0.65);
            }

            .legal-content li ul {
              margin-top: 12px;
            }

            .legal-content strong {
              color: #fff;
              font-family: ${FONT_BOLD};
            }

            .legal-content a {
              color: #ff1654;
              text-decoration: underline;
              text-underline-offset: 3px;
            }

            .legal-rules-grid {
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 20px;
            }

            .legal-rule-card {
              border: 1px solid rgba(255, 22, 84, 0.34);
              border-radius: 8px;
              background: rgba(15, 4, 4, 0.45);
              padding: 24px;
            }

            .legal-map-pill {
              display: inline-flex;
              align-items: baseline;
              gap: 8px;
              min-height: 42px;
              margin: 3px 0 8px;
              padding: 0 16px;
              border: 1px solid #ff1654;
              border-radius: 8px;
              background: rgba(255, 22, 84, 0.13);
              color: #fff;
              font-family: ${FONT_BOLD};
            }

            .legal-map-pill span {
              color: #ff1654;
            }

            @media (max-width: 900px) {
              .legal-shell-main {
                width: min(100% - 32px, 680px);
                padding-top: 108px;
              }

              .legal-title-block {
                min-height: 136px;
                margin-left: -18px;
                margin-bottom: 18px;
              }

              .legal-title-triangles {
                width: 76px;
                height: 114px;
              }

              .legal-title-wordmark {
                left: 45px;
                top: 45px;
                max-width: calc(100vw - 76px);
              }

              .legal-title-wordmark h1 {
                font-size: clamp(34px, 11vw, 48px);
              }

              .legal-title-underline {
                height: 6px;
                margin-top: 6px;
              }

              .legal-page-tools {
                align-items: flex-start;
                flex-direction: column;
              }

              .legal-nav {
                width: 100%;
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 8px;
              }

              .legal-nav a {
                min-width: 0;
                height: 43px;
                padding: 0 8px;
                font-size: 16px;
              }

              .legal-panel {
                padding: 28px 20px;
              }

              .legal-content {
                font-size: 16px;
              }

              .legal-rules-grid {
                grid-template-columns: 1fr;
              }
            }
          `}
        </style>
        <img
          src="/figma-assets/figma-neon.png"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            left: '50%',
            top: 0,
            width: '100vw',
            height: 146,
            transform: 'translateX(-50%)',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
        <main className="legal-shell-main">
          <div className="legal-title-block">
            <img
              className="legal-title-triangles"
              src="/figma-assets/matches-title-triangles.svg"
              alt=""
              aria-hidden="true"
            />
            <div className="legal-title-wordmark">
              <h1>{title}</h1>
              <div className="legal-title-underline" aria-hidden="true" />
            </div>
          </div>

          <div className="legal-page-tools">
            <div className="legal-meta">
              {lastUpdated && (
                <p>
                  <strong>Last updated:</strong> {lastUpdated}
                </p>
              )}
              {description && <p>{description}</p>}
            </div>
            <nav className="legal-nav" aria-label="Legal pages">
              {NAV_ITEMS.map((item) => (
                <Link key={item.key} to={item.href} data-active={item.key === active}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>

          <article className="legal-panel">
            <div className="legal-content">{children}</div>
          </article>
        </main>
        <FooterSection />
      </section>
    </PublicLayout>
  );
}
