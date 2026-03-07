import { FunctionComponent } from 'react';

/**
 * Frame1 - Main landing page component for OleBoy Token
 * Sections: Navbar, Hero, Testimonials, Rank Up CTA, Leaderboard
 */
const Frame1: FunctionComponent = () => {
  return (
    <div className="w-full relative flex items-start">
      <main
        className="flex-1 bg-gray overflow-hidden flex flex-col items-center pt-[55px] px-0 pb-0 gap-[17px] text-left text-[96px] text-white font-base-neue-trial"
        role="main"
      >

        {/* ── Navigation Bar ── */}
        <nav
          className="w-full h-[91px] relative rounded-[45.5px] bg-mintcream max-w-[1532px] shrink-0 text-left text-[64px] text-black font-base-neue-trial"
          aria-label="Main navigation"
        >
          {/* Logo */}
          <div className="absolute top-[13px] left-[47px] shadow-[0px_4px_4px_rgba(0,0,0,0.25)] w-[148px] flex items-center gap-[0.1px]">
            <img
              className="w-[55px] relative max-h-full object-cover shrink-0"
              loading="lazy"
              alt="OleBoy logo"
              src="/oleboy1-1@2x.png"
            />
            <h3 className="m-0 flex-1 relative text-[20px] leading-[90%] font-black font-[inherit] shrink-0">
              OleBoy
            </h3>
          </div>

          {/* Discord icon */}
          <div className="absolute top-[13px] left-[1344px] w-[65px] flex items-center justify-center pt-[15px] px-0 pb-3.5 box-border bg-[url('/Frame@3x.png')] bg-cover bg-no-repeat bg-[top]">
            <img
              className="cursor-pointer border-none p-0 bg-transparent w-9 relative max-h-full"
              alt="Discord"
              src="/DS-Icon.svg"
            />
          </div>

          {/* Profile avatar */}
          <img
            className="absolute top-[13px] left-[1421px] rounded-[50%] w-[65px] h-[65px] object-cover"
            loading="lazy"
            alt="User profile"
            src="/PFP@2x.png"
          />

          {/* Nav links */}
          <div className="absolute top-[27px] left-[411px] w-[921px] flex items-center gap-[5.9px] text-[24px] text-gray">
            {/* Brand link */}
            <h2 className="m-0 flex-1 relative text-[32px] font-normal font-[inherit] text-crimson shrink-0">
              MEET OBT
            </h2>

            <a href="#home" className="m-0 flex-1 relative text-[24px] font-black font-[inherit] inline-block max-w-[133px] shrink-0 no-underline text-gray">
              home
            </a>

            {/* Play dropdown trigger */}
            <div className="flex items-center gap-1 shrink-0">
              <a href="#play" className="m-0 relative text-[24px] font-black font-[inherit] no-underline text-gray">
                play
              </a>
              <img className="h-1.5 w-3.5 relative shrink-0" loading="lazy" alt="" src="/Vector-6.svg" />
            </div>

            {/* Community dropdown trigger */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="relative text-[24px] font-black shrink-0">community</span>
              <img className="h-1.5 w-3.5 relative shrink-0" loading="lazy" alt="" src="/Vector-6.svg" />
            </div>

            {/* Token counter */}
            <h3 className="m-0 flex-1 relative text-[24px] font-black font-[inherit] text-white shrink-0">
              237,455
            </h3>
          </div>
        </nav>

        {/* ── Hero Section ── */}
        <section
          className="self-stretch flex flex-col items-center pt-[206px] px-[30px] pb-[141px] shrink-0 text-left text-[115px] text-white font-base-neue-trial"
          aria-labelledby="hero-heading"
        >
          {/* Hero title */}
          <div className="w-full flex items-start justify-end min-w-[696px] max-w-[531px]">
            <h1
              id="hero-heading"
              className="m-0 flex-1 relative text-[115px] font-black font-[inherit] inline-block min-w-[531px] max-w-[365px] shrink-0"
            >
              OleBoy
            </h1>
          </div>

          {/* Hero tagline */}
          <div className="w-full flex items-start pt-0 px-0 pb-[30px] box-border max-w-[690px] text-center text-[32px]">
            <p className="flex-1 relative tracking-[0.16em] shrink-0 m-0">
              Stake tokens. Win matches.<br />Claim your victory.
            </p>
          </div>

          {/* Sign-up CTA button */}
          <button
            className="cursor-pointer border-none pt-[11px] px-0 pb-[11px] bg-mediumblue w-full rounded-[27px] flex items-center justify-center box-border gap-[31px] max-w-[277px] hover:opacity-90 transition-opacity"
            type="button"
            aria-label="Sign up for OleBoy Token"
          >
            <span className="flex-1 font-black font-base-neue-trial text-mintcream text-center inline-block max-w-[142px]">
              <span className="text-[32px]">SIGN UP</span>
              <span className="text-[36px]">!</span>
            </span>
            <img className="w-12 relative max-h-full" alt="" src="/DS-Icon1.svg" />
          </button>

          {/* Know More scroll hint */}
          <div className="w-full flex items-center justify-center pt-[160px] px-[30px] pb-0 box-border max-w-[690px] text-center text-[24px] text-white font-base-neue-trial">
            <div className="flex-1 flex items-center gap-1 max-w-[228px]">
              <img className="w-3.5 relative max-h-full" loading="lazy" alt="" src="/ARROW.svg" />
              <a href="#testimonials" className="flex-1 relative font-normal no-underline text-white">
                Know More
              </a>
              <img className="w-3.5 relative max-h-full" loading="lazy" alt="" src="/ARROW.svg" />
            </div>
          </div>
        </section>

        {/* ── Testimonials / Players Section ── */}
        <section
          id="testimonials"
          className="self-stretch flex items-start pt-0 px-0 pb-[110px] shrink-0 text-left text-[48px] text-white font-base-neue-trial"
          aria-labelledby="testimonials-heading"
        >
          <div className="flex-1 flex flex-col items-center justify-center pt-[189px] px-[30px] pb-[184px] gap-[43px] bg-[url('/Frame1@3x.png')] bg-cover bg-no-repeat bg-[top] shrink-0">
            <h2
              id="testimonials-heading"
              className="m-0 w-full relative font-black font-[inherit] inline-block max-w-[1532px]"
            >
              From the players...
            </h2>

            {/* Player avatars */}
            <div className="self-stretch flex items-start justify-center flex-wrap content-start pt-0 px-0 pb-1.5 gap-[42px]" role="list" aria-label="Player testimonials">
              {/* Player 1 — MARV */}
              <div
                className="h-[217px] flex-1 relative shadow-[10px_14px_0px_rgba(0,0,0,0.25)] rounded-[50%] max-w-[217px] min-w-[173px] flex items-center justify-center"
                role="listitem"
              >
                <img
                  className="h-full flex-1 shadow-[10px_14px_0px_rgba(0,0,0,0.25)] overflow-hidden object-contain absolute left-[5px] top-[7px] w-full [transform:scale(1.046)]"
                  loading="lazy"
                  alt="Player MARV"
                  src="/MARV-PFP@2x.png"
                />
              </div>

              {/* Player 2 — TOM */}
              <div
                className="h-[217px] w-[217px] relative shadow-[10px_14px_0px_rgba(0,0,0,0.25)] rounded-[50%] flex items-center justify-center"
                role="listitem"
              >
                <img
                  className="h-full w-full shadow-[10px_14px_0px_rgba(0,0,0,0.25)] object-contain absolute left-[5px] top-[7px] [transform:scale(1.046)]"
                  loading="lazy"
                  alt="Player TOM"
                  src="/TOM-PFP@2x.png"
                />
              </div>
            </div>

            <h2 className="m-0 w-full relative font-black font-[inherit] inline-block max-w-[1532px]">
              ...for the players
            </h2>
          </div>
        </section>

        {/* ── Rank Up Heading ── */}
        <div className="w-full relative leading-[90%] font-black inline-block max-w-[562px] shrink-0">
          <span>Rank Up</span>
          <span className="text-[110px]">!</span>
        </div>

        {/* ── Leaderboard / Legacy Section ── */}
        <section
          className="self-stretch flex items-start justify-center pt-[227px] px-[30px] pb-[219px] bg-[url('/Frame2@3x.png')] bg-cover bg-no-repeat bg-[top] shrink-0 text-right text-[48px] text-white font-base-neue-trial"
          aria-labelledby="leaderboard-heading"
        >
          <div className="flex-1 flex items-start justify-between flex-wrap content-start gap-x-0 gap-y-[30px] max-w-[1532px]">
            {/* Leaderboard image / animation placeholder */}
            <div className="flex-1 flex items-start pt-[80px] px-0 pb-0 box-border min-w-[310px] max-w-[562px] text-center text-[24px] text-black font-base-neue-trial">
              <div className="flex-1 bg-gainsboro flex items-center justify-center pt-[77px] px-[30px] pb-[76px] shrink-0">
                <div className="flex-1 flex items-center justify-end max-w-[364px]">
                  {/* TODO: Replace with actual leaderboard image or animation */}
                  <p className="flex-1 relative inline-block max-w-[344px] m-0">
                    Leaderboard image or animation
                  </p>
                </div>
              </div>
            </div>

            {/* Legacy copy */}
            <h2
              id="leaderboard-heading"
              className="flex-1 relative font-black inline-block min-w-[310px] max-w-[593px] m-0"
            >
              Dominate the<br />leaderboard and<br />claim your legacy.
            </h2>
          </div>
        </section>

      </main>
    </div>
  );
};

export default Frame1;
