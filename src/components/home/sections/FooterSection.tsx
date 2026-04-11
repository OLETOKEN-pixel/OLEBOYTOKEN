const F = "'Base Neue Trial', 'Base Neue', sans-serif";
const FE = "'Base Neue Expanded', 'Base Neue Trial', 'Base Neue', sans-serif";

export const FooterSection = () => {
  return (
    <section
      id="s-footer"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: '636.66px',
        background: '#0f0404',
        borderTop: '0.5px solid #ffffff',
        overflow: 'hidden',
      }}
    >
      {/* Giant OLEBOY text — stroke layer (gradient stroke: #FFF → #0F0404) */}
      <p
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'calc(4% + 4.2px)',
          top: '-18px',
          fontFamily: FE,
          fontWeight: 900,
          fontStyle: 'oblique',
          fontSize: '347.059px',
          lineHeight: 'normal',
          whiteSpace: 'nowrap',
          display: 'inline-block',
          paddingRight: '32px',
          margin: 0,
          WebkitTextStroke: '3.48px transparent',
          background: 'linear-gradient(180.075deg, #FFFFFF 0%, #0F0404 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        OLEBOY
      </p>
      {/* Giant OLEBOY text — fill layer (Figma-exact gradient) */}
      <p
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 'calc(4% + 4.2px)',
          top: '-18px',
          fontFamily: FE,
          fontWeight: 900,
          fontStyle: 'oblique',
          fontSize: '347.059px',
          lineHeight: 'normal',
          whiteSpace: 'nowrap',
          display: 'inline-block',
          paddingRight: '32px',
          margin: 0,
          backgroundImage: 'linear-gradient(180.075deg, rgb(15, 4, 4) 10.117%, rgb(255, 255, 255) 99.722%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          color: 'transparent',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        OLEBOY
      </p>

      {/* BTS MARV */}
      <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '395px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>BTS - Marv</p>
      <a href="https://x.com" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '437px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>X/Twitter</a>

      {/* BTS TOM */}
      <p style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '495px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>BTS - Tom</p>
      <a href="https://x.com" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '537px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>X/Twitter</a>
      <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(12% - 6.4px)', top: '569px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>Instagram</a>

      {/* SOCIALS */}
      <p style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '395px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>SOCIALS</p>
      <a href="https://x.com/oleboytokens" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '436.92px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>X/Twitter</a>
      <a href="https://www.tiktok.com/@oleboytokens" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '468.75px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>TikTok</a>
      <a href="https://discord.gg/2XVffNDPAE" target="_blank" rel="noopener noreferrer" style={{ position: 'absolute', left: 'calc(32% + 58.6px)', top: '499.79px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>Discord</a>

      {/* CONTACT US */}
      <p style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '397px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>CONTACT US</p>
      <a href="mailto:coolowner.2025@gmail.com" style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '439px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>coolowner.2025@gmail.com</a>
      <a href="mailto:letterio.tomasini@gmail.com" style={{ position: 'absolute', left: 'calc(56% + 3.8px)', top: '471px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>letterio.tomasini@gmail.com</a>

      {/* PRIVACY */}
      <p style={{ position: 'absolute', left: 'calc(80% + 26px)', top: '397px', fontFamily: F, fontWeight: 900, fontStyle: 'italic', fontSize: '24px', color: '#ff1654', whiteSpace: 'nowrap', margin: 0, zIndex: 2 }}>PRIVACY</p>
      <a href="/terms" style={{ position: 'absolute', left: 'calc(80% + 29px)', top: '439px', fontFamily: F, fontWeight: 400, fontSize: '16px', color: '#e6e6e6', textDecoration: 'underline', zIndex: 2 }}>Terms &amp; Privacy</a>

      {/* COPYRIGHT */}
      <div
        data-footer-copyright="true"
        style={{
          position: 'absolute',
          left: 'calc(76% + 25.8px)',
          top: '584px',
          display: 'flex',
          alignItems: 'baseline',
          gap: '7px',
          fontFamily: F,
          fontWeight: 400,
          fontSize: '24px',
          lineHeight: '30px',
          color: '#e6e6e6',
          whiteSpace: 'nowrap',
          margin: 0,
          zIndex: 2,
        }}
      >
        <span aria-hidden="true" style={{ position: 'relative', top: '2px', fontSize: '23px', lineHeight: 1 }}>{'\u00A9'}</span>
        <span>2026 OLEBOY. All Rights Reserved.</span>
      </div>
    </section>
  );
};
