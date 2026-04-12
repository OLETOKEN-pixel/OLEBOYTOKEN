import { ReactNode, useCallback } from 'react';
import { toast } from 'sonner';
import { getCurrentPathWithQueryAndHash, startDiscordAuth } from '@/lib/oauth';

const A_NEON = '/figma-assets/figma-neon.png';
const A_ZAPS = '/figma-assets/figma-zaps.svg';
const A_DS_BTN = '/figma-assets/figma-ds-icon-hero.png';
const A_GUIDE = '/figma-assets/figma-guide.svg';
const A_SPAC_BOTTOM = '/figma-assets/figma-spaccato-bottom.svg';
const A_ANIMATION = '/figma-assets/figma-animation.svg';
const A_STAR_SHAPE = '/figma-assets/figma-star-shape.svg';
const A_SPAC_TITLE_2 = '/figma-assets/figma-spaccato-title-s2.svg';
const A_ANIMATION_S3 = '/figma-assets/figma-animation-s3.svg';
const A_SPAC_BOTTOM_S3 = '/figma-assets/figma-spaccato-bottom-s3.svg';
const A_STAR_S3 = '/figma-assets/figma-star-s3.svg';
const A_VECTOR19 = '/figma-assets/figma-vector19.svg';
const A_SPAC_TITLE_4 = '/figma-assets/figma-spaccato-title-s4.svg';
const A_BW_ARROW = '/figma-assets/figma-bw-arrow.svg';
const A_FW_ARROW = '/figma-assets/figma-fw-arrow.svg';

const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base Neue Expanded', 'Base Neue Trial', 'Base Neue', sans-serif";
const SECTION_BG = 'radial-gradient(ellipse at 50% 35%, #1a0a0a 0%, #0f0404 52%, #080202 100%)';
const IDS = ['s-hero', 's-rank', 's-arena', 's-rewards', 's-footer'];

type MobileSectionProps = {
  id: string;
  title: string;
  copy: ReactNode;
  titleChrome: string;
  star: string;
  animation: string;
  bottomChrome: string;
  prevIndex: number;
  nextIndex: number;
  mirror?: boolean;
};

function MobileNavArrows({ prevIndex, nextIndex, scrollTo }: { prevIndex: number; nextIndex: number; scrollTo: (index: number) => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '28px', position: 'relative', zIndex: 4 }}>
      <button
        aria-label="Previous section"
        onClick={() => scrollTo(prevIndex)}
        style={{
          width: '46px',
          height: '46px',
          border: 'none',
          borderRadius: '8px',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <img src={A_BW_ARROW} alt="" aria-hidden style={{ width: '100%', height: '100%', display: 'block' }} />
      </button>
      <button
        aria-label="Next section"
        onClick={() => scrollTo(nextIndex)}
        style={{
          width: '46px',
          height: '46px',
          border: 'none',
          borderRadius: '8px',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <img src={A_FW_ARROW} alt="" aria-hidden style={{ width: '100%', height: '100%', display: 'block' }} />
      </button>
    </div>
  );
}

function MobileInfoSection({
  id,
  title,
  copy,
  titleChrome,
  star,
  animation,
  bottomChrome,
  prevIndex,
  nextIndex,
  mirror = false,
  scrollTo,
}: MobileSectionProps & { scrollTo: (index: number) => void }) {
  return (
    <section
      id={id}
      data-mobile-section={id}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '100vw',
        minHeight: '100svh',
        overflow: 'hidden',
        padding: '112px 18px 56px',
        background: SECTION_BG,
      }}
    >
      <img
        src={A_GUIDE}
        alt=""
        aria-hidden
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.86 }}
      />
      <img
        src={titleChrome}
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          top: '88px',
          left: mirror ? 'auto' : '-90px',
          right: mirror ? '-110px' : 'auto',
          width: '520px',
          maxWidth: '150%',
          height: '132px',
          objectFit: 'contain',
          opacity: 0.9,
          pointerEvents: 'none',
          transform: mirror ? 'scaleX(-1)' : undefined,
        }}
      />
      <img
        src={star}
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          top: '240px',
          left: mirror ? 'auto' : '-154px',
          right: mirror ? '-154px' : 'auto',
          width: star === A_VECTOR19 ? '300px' : '460px',
          maxWidth: '135%',
          opacity: 0.38,
          transform: mirror ? 'rotate(-9deg)' : 'rotate(-14deg)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ position: 'relative', zIndex: 2, maxWidth: '420px', margin: '0 auto', textAlign: mirror ? 'right' : 'left' }}>
        <h2
          style={{
            margin: 0,
            fontFamily: FE,
            fontWeight: 900,
            fontStyle: 'oblique',
            fontSize: '42px',
            lineHeight: '44px',
            letterSpacing: 0,
            color: '#ffffff',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </h2>
        <div
          aria-hidden="true"
          style={{
            width: '100%',
            height: '6px',
            marginTop: '14px',
            background: 'linear-gradient(90deg, #ff1654 0%, rgba(255, 22, 84, 0) 100%)',
            transform: mirror ? 'scaleX(-1)' : undefined,
          }}
        />
        <div
          style={{
            marginTop: '72px',
            fontFamily: FE,
            fontWeight: 700,
            fontSize: '28px',
            lineHeight: '32px',
            letterSpacing: 0,
            color: '#ffffff',
          }}
        >
          {copy}
        </div>
        <div
          style={{
            position: 'relative',
            marginTop: '34px',
            width: '100%',
            aspectRatio: '408.932 / 230.024',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            background: 'rgba(30, 30, 40, 0.8)',
            overflow: 'hidden',
            boxShadow: '0 18px 46px rgba(0, 0, 0, 0.36)',
            transform: mirror ? 'scaleX(-1)' : undefined,
          }}
        >
          <img src={animation} alt="" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        </div>
        <MobileNavArrows prevIndex={prevIndex} nextIndex={nextIndex} scrollTo={scrollTo} />
      </div>
      <img
        src={bottomChrome}
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          bottom: '46px',
          left: mirror ? '18px' : 'auto',
          right: mirror ? 'auto' : '18px',
          width: '74px',
          height: '112px',
          opacity: 0.84,
          pointerEvents: 'none',
          transform: mirror ? 'scaleX(-1)' : undefined,
        }}
      />
    </section>
  );
}

function FooterColumn({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p
        style={{
          margin: 0,
          fontFamily: F,
          fontWeight: 900,
          fontStyle: 'italic',
          fontSize: '20px',
          lineHeight: '24px',
          color: '#ff1654',
          letterSpacing: 0,
        }}
      >
        {title}
      </p>
      <div style={{ display: 'grid', gap: '9px', marginTop: '13px' }}>{children}</div>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noopener noreferrer' : undefined}
      style={{
        fontFamily: F,
        fontWeight: 400,
        fontSize: '16px',
        lineHeight: '20px',
        color: '#e6e6e6',
        textDecoration: 'underline',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </a>
  );
}

export function HomeNotRegisteredMobile() {
  const handleSignUp = useCallback(async () => {
    try {
      await startDiscordAuth(getCurrentPathWithQueryAndHash());
    } catch (error) {
      console.error('Discord sign-up error:', error);
      toast.error(error instanceof Error ? error.message : 'Unable to start Discord login. Please try again.');
    }
  }, []);

  const scrollTo = useCallback((i: number) => {
    const el = document.getElementById(IDS[Math.max(0, Math.min(i, IDS.length - 1))]);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <div
      data-mobile-home="guest"
      style={{
        width: '100%',
        maxWidth: '100vw',
        overflowX: 'hidden',
        background: '#0f0404',
        color: '#ffffff',
      }}
    >
      <section
        id="s-hero"
        data-mobile-section="hero"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100vw',
          minHeight: '100svh',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '132px 18px 84px',
          background: SECTION_BG,
        }}
      >
        <img
          src={A_NEON}
          alt=""
          aria-hidden
          style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '118px', objectFit: 'cover', zIndex: 2 }}
        />
        <img
          src={A_ZAPS}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            left: '-62%',
            top: '-220px',
            width: '224%',
            height: '900px',
            opacity: 0.72,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
        <img
          src={A_NEON}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            bottom: '-20px',
            width: '100%',
            height: '118px',
            objectFit: 'cover',
            transform: 'scaleY(-1)',
            zIndex: 2,
          }}
        />
        <div style={{ position: 'relative', zIndex: 4, width: '100%', maxWidth: '420px', textAlign: 'center' }}>
          <h1
            style={{
              margin: 0,
              fontFamily: FE,
              fontWeight: 900,
              fontSize: '58px',
              lineHeight: '62px',
              letterSpacing: 0,
              color: '#ffffff',
            }}
          >
            OLEBOY
          </h1>
          <p
            style={{
              margin: '14px 0 0',
              fontFamily: FE,
              fontWeight: 400,
              fontSize: '21px',
              lineHeight: '26px',
              letterSpacing: 0,
              color: '#ffffff',
            }}
          >
            Stake tokens. Win Matches.
            <br />
            Claim your victory.
          </p>
          <button
            onClick={handleSignUp}
            style={{
              width: '190px',
              height: '58px',
              marginTop: '34px',
              background: '#3b28cc',
              border: 'none',
              borderRadius: '8px',
              boxShadow: 'inset 0px 4px 4px 0px rgba(255,255,255,0.15), inset 0px -3px 4px 0px rgba(0,0,0,0.25)',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: 0,
              fontFamily: F,
              fontWeight: 900,
              fontSize: '28px',
              lineHeight: '30px',
              letterSpacing: 0,
            }}
          >
            SIGN UP!
            <img src={A_DS_BTN} alt="" aria-hidden style={{ width: '42px', height: '31px' }} />
          </button>
          <button
            onClick={() => scrollTo(1)}
            style={{
              width: '190px',
              height: '52px',
              marginTop: '92px',
              background: 'rgba(255,22,84,0.23)',
              border: '1px solid #ff1654',
              borderRadius: '8px',
              boxShadow: 'inset 0px -4px 4px 0px rgba(0,0,0,0.25), inset 0px 4px 4px 0px rgba(255,255,255,0.14)',
              color: '#ffffff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: 0,
              fontFamily: F,
              fontWeight: 400,
              fontSize: '21px',
              lineHeight: '24px',
              letterSpacing: 0,
            }}
          >
            <img src="/figma-assets/figma-arrow-stroke.svg" alt="" aria-hidden style={{ width: '13px', height: '17px' }} />
            Know More
            <img src="/figma-assets/figma-arrow-stroke1.svg" alt="" aria-hidden style={{ width: '13px', height: '17px' }} />
          </button>
        </div>
      </section>

      <MobileInfoSection
        id="s-rank"
        title="RANK UP!"
        titleChrome={A_SPAC_TITLE_2}
        star={A_STAR_SHAPE}
        animation={A_ANIMATION}
        bottomChrome={A_SPAC_BOTTOM}
        prevIndex={0}
        nextIndex={2}
        scrollTo={scrollTo}
        copy={
          <>
            <p style={{ margin: 0 }}>Dominate the</p>
            <p style={{ margin: 0 }}>leaderboard and claim your legacy.</p>
          </>
        }
      />

      <MobileInfoSection
        id="s-arena"
        title="JOIN THE ARENA!"
        titleChrome={A_SPAC_TITLE_2}
        star={A_STAR_S3}
        animation={A_ANIMATION_S3}
        bottomChrome={A_SPAC_BOTTOM_S3}
        prevIndex={1}
        nextIndex={3}
        mirror
        scrollTo={scrollTo}
        copy={
          <>
            <p style={{ margin: 0 }}>Build your team,</p>
            <p style={{ margin: 0 }}>complete challenges and get rewarded.</p>
          </>
        }
      />

      <MobileInfoSection
        id="s-rewards"
        title="GET REWARDS!"
        titleChrome={A_SPAC_TITLE_4}
        star={A_VECTOR19}
        animation={A_ANIMATION}
        bottomChrome={A_SPAC_BOTTOM}
        prevIndex={2}
        nextIndex={4}
        scrollTo={scrollTo}
        copy={
          <p style={{ margin: 0 }}>
            Complete tasks and win matches to get OBCoins.
          </p>
        }
      />

      <section
        id="s-footer"
        data-mobile-section="footer"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '100vw',
          overflow: 'hidden',
          minHeight: 'auto',
          padding: '58px 18px 42px',
          background: '#0f0404',
          borderTop: '0.5px solid #ffffff',
        }}
      >
        <p
          aria-hidden="true"
          style={{
            margin: '0 auto 36px',
            width: '100%',
            maxWidth: '420px',
            fontFamily: FE,
            fontWeight: 900,
            fontStyle: 'oblique',
            fontSize: '56px',
            lineHeight: '60px',
            letterSpacing: 0,
            textAlign: 'center',
            backgroundImage: 'linear-gradient(180.075deg, rgb(15, 4, 4) 10.117%, rgb(255, 255, 255) 99.722%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: 'transparent',
          }}
        >
          OLEBOY
        </p>
        <div style={{ display: 'grid', gap: '28px', maxWidth: '420px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
          <FooterColumn title="BTS - Marv">
            <FooterLink href="https://x.com">X/Twitter</FooterLink>
          </FooterColumn>
          <FooterColumn title="BTS - Tom">
            <FooterLink href="https://x.com">X/Twitter</FooterLink>
            <FooterLink href="https://instagram.com">Instagram</FooterLink>
          </FooterColumn>
          <FooterColumn title="SOCIALS">
            <FooterLink href="https://x.com/oleboytokens">X/Twitter</FooterLink>
            <FooterLink href="https://www.tiktok.com/@oleboytokens">TikTok</FooterLink>
            <FooterLink href="https://discord.gg/2XVffNDPAE">Discord</FooterLink>
          </FooterColumn>
          <FooterColumn title="CONTACT US">
            <FooterLink href="mailto:coolowner.2025@gmail.com">coolowner.2025@gmail.com</FooterLink>
            <FooterLink href="mailto:letterio.tomasini@gmail.com">letterio.tomasini@gmail.com</FooterLink>
          </FooterColumn>
          <FooterColumn title="PRIVACY">
            <FooterLink href="/terms">Terms &amp; Privacy</FooterLink>
          </FooterColumn>
          <div
            data-footer-copyright="true"
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '7px',
              fontFamily: F,
              fontWeight: 400,
              fontSize: '18px',
              lineHeight: '24px',
              color: '#e6e6e6',
              marginTop: '6px',
            }}
          >
            <span aria-hidden="true" style={{ position: 'relative', top: '1px', fontSize: '18px', lineHeight: 1 }}>
              {'\u00A9'}
            </span>
            <span>2026 OLEBOY. All Rights Reserved.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
