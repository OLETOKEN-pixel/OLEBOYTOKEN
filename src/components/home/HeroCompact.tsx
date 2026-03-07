import { Link } from 'react-router-dom';
import mascotOleboy from '@/assets/mascot-oleboy.png';

function GamepadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="12" x2="10" y2="12" /><line x1="8" y1="10" x2="8" y2="14" />
      <circle cx="15" cy="13" r="1" /><circle cx="18" cy="11" r="1" />
      <path d="M2 16.1A5 5 0 0 1 5.9 20M2 12.05A9 9 0 0 1 9.95 20M2 8V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-6" />
    </svg>
  );
}

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M13 2L3 14h9l-1 10 10-12h-9l1-10z" />
    </svg>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}

export function HeroCompact() {
  return (
    <section className="relative w-full min-h-[600px] flex items-center overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'radial-gradient(ellipse 60% 50% at 30% 50%, rgba(59,130,246,0.15), transparent 70%)',
        }}
      />

      <div className="relative z-10 w-full max-w-[1140px] mx-auto px-6 md:px-16 py-10 md:py-16 flex flex-col md:flex-row items-center gap-10 md:gap-12">
        <div className="flex-1 min-w-0">
          <h1
            className="font-teko font-bold text-[64px] md:text-[96px] text-white uppercase leading-[64px] md:leading-[96px]"
            style={{ letterSpacing: '-4.8px' }}
          >
            PLAY TO
          </h1>
          <h1
            className="font-teko font-bold text-[64px] md:text-[96px] text-[#FFC805] uppercase leading-[64px] md:leading-[96px]"
            style={{ letterSpacing: '-4.8px', textShadow: '0px 0px 20px rgba(255,200,5,0.3)' }}
          >
            EARN
          </h1>

          <p className="text-[16px] md:text-[18px] text-[#9CA3AF] leading-[26px] md:leading-[29.25px] max-w-[448px] mt-4">
            Join the ultimate competitive arena. Stake tokens, win matches, and claim your victory in Fortnite's premier battleground.
          </p>

          <div className="flex flex-col gap-4 mt-8 max-w-[448px]">
            <Link
              to="/matches"
              className="flex items-center justify-between h-[80px] rounded-[12px] px-6 no-underline transition-all duration-200 hover:brightness-110"
              style={{
                backgroundColor: '#2ecc71',
                boxShadow: '0px 4px 20px 0px rgba(46,204,113,0.3)',
              }}
            >
              <div className="flex items-center gap-4">
                <GamepadIcon className="w-7 h-7 text-white" />
                <div>
                  <span className="font-teko font-bold text-[30px] text-white leading-[30px] block">START MATCHES</span>
                  <span className="font-semibold text-[12px] text-[#dcfce7] uppercase tracking-[1.2px]">Find a Lobby</span>
                </div>
              </div>
              <LightningIcon className="w-7 h-7 text-white/60 rotate-12" />
            </Link>

            <Link
              to="/challenges"
              className="flex items-center justify-between h-[80px] rounded-[12px] px-6 no-underline transition-all duration-200 hover:brightness-110"
              style={{
                backgroundColor: '#3b82f6',
                boxShadow: '0px 4px 20px 0px rgba(59,130,246,0.3)',
              }}
            >
              <div className="flex items-center gap-4">
                <TrophyIcon className="w-7 h-7 text-white" />
                <div>
                  <span className="font-teko font-bold text-[30px] text-white leading-[30px] block">VIEW CHALLENGES</span>
                  <span className="font-semibold text-[12px] text-[#dbeafe] uppercase tracking-[1.2px]">Daily & Weekly</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        <div className="flex-1 max-w-[350px] md:max-w-[550px] relative flex items-center justify-center">
          <div
            className="absolute w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full"
            style={{
              backgroundColor: 'rgba(59,130,246,0.2)',
              filter: 'blur(50px)',
            }}
          />
          <img
            src={mascotOleboy}
            alt="OLEBOY Mascot"
            className="relative z-10 w-full h-auto object-contain"
            style={{ filter: 'drop-shadow(0px 25px 25px rgba(0,0,0,0.15))' }}
          />
        </div>
      </div>
    </section>
  );
}
