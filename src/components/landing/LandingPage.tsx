import { Link } from 'react-router-dom';
import oleboyLogo from '@/assets/logo-oleboy.png';
import olebyCoin from '@/assets/oleboy-coin.png';

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
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

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

const testimonials = [
  {
    name: 'MarvelKid',
    text: '"OleBoy Token changed the way I compete. The matches are fair, fast, and the rewards are real."',
    rating: 5,
  },
  {
    name: 'TomShadow',
    text: '"Best platform for FN wagers. The leaderboard keeps me grinding every day."',
    rating: 5,
  },
  {
    name: 'DripQueen',
    text: '"Love the community! Started as a rookie and now I\'m in the top 50. Let\'s go!"',
    rating: 5,
  },
];

const leaderboardData = [
  { rank: 1, name: 'xDripLord', wins: 142, earnings: '€2,450' },
  { rank: 2, name: 'MarvelKid', wins: 128, earnings: '€1,980' },
  { rank: 3, name: 'TomShadow', wins: 115, earnings: '€1,720' },
  { rank: 4, name: 'NightOwl99', wins: 98, earnings: '€1,340' },
  { rank: 5, name: 'AceViper', wins: 87, earnings: '€1,100' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#04080f] text-white font-sans">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full">
        <div className="max-w-[1532px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between h-[70px] rounded-full bg-[#f5fffa] px-6 sm:px-10 shadow-lg">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <img
                src={oleboyLogo}
                alt="OleBoy logo"
                className="w-[50px] h-[50px] object-cover"
                loading="lazy"
              />
              <span className="font-bold text-[20px] text-black hidden sm:block">OleBoy</span>
            </Link>

            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-6 text-gray-500 text-sm font-medium">
              <span className="text-[#dc143c] font-bold text-base uppercase tracking-wide">MEET OBT</span>
              <Link to="/" className="hover:text-black transition-colors">home</Link>
              <Link to="/matches" className="hover:text-black transition-colors">Play</Link>
              <Link to="/leaderboard" className="hover:text-black transition-colors">Leaderboard</Link>
              <Link to="/challenges" className="hover:text-black transition-colors">Challenges</Link>
            </div>

            {/* Right Side */}
            <div className="flex items-center gap-4">
              <a
                href="https://discord.gg/oleboy"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-[65px] h-[55px] rounded-[15px] bg-[#5865F2] bg-cover bg-no-repeat hover:brightness-110 transition-all"
              >
                <DiscordIcon className="w-9 h-9 text-white" />
              </a>
              <Link
                to="/auth"
                className="hidden sm:flex items-center gap-2 bg-[#dc143c] text-white font-bold text-sm uppercase tracking-wider px-6 py-3 rounded-full hover:brightness-110 transition-all"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative w-full overflow-hidden pt-8 pb-16 lg:pt-16 lg:pb-24">
        <div className="max-w-[1532px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
            {/* Left: Text */}
            <div className="flex-1 text-center lg:text-left">
              <h1
                className="text-[64px] sm:text-[80px] lg:text-[96px] font-black leading-[0.95] tracking-tight"
                style={{ fontFamily: "'Inter', 'Teko', sans-serif" }}
              >
                <span className="text-white block">COMPETE.</span>
                <span className="text-[#FFC805] block" style={{ textShadow: '0 0 30px rgba(255,200,5,0.3)' }}>
                  WIN.
                </span>
                <span className="text-[#dc143c] block">DOMINATE.</span>
              </h1>

              <p className="text-[#9CA3AF] text-lg sm:text-xl max-w-[500px] mt-6 mx-auto lg:mx-0 leading-relaxed">
                Join the ultimate Fortnite competitive arena. Stake tokens, win matches, and climb the leaderboard to claim your legacy.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 justify-center lg:justify-start">
                <Link
                  to="/auth"
                  className="flex items-center gap-3 bg-[#2ecc71] text-white font-bold text-lg uppercase tracking-wider px-8 py-4 rounded-xl hover:brightness-110 transition-all shadow-[0_4px_20px_rgba(46,204,113,0.3)]"
                >
                  <DiscordIcon className="w-6 h-6" />
                  Start Playing
                </Link>
                <Link
                  to="/matches"
                  className="flex items-center gap-2 border border-white/20 text-white font-medium text-lg px-8 py-4 rounded-xl hover:bg-white/5 transition-all"
                >
                  Browse Matches
                  <ArrowIcon className="w-5 h-5" />
                </Link>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-8 mt-10 justify-center lg:justify-start">
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#FFC805]">1,200+</p>
                  <p className="text-sm text-gray-500">Matches Played</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#2ecc71]">500+</p>
                  <p className="text-sm text-gray-500">Active Players</p>
                </div>
                <div className="w-px h-10 bg-white/10" />
                <div className="text-center">
                  <p className="text-3xl font-bold text-[#dc143c]">$50K+</p>
                  <p className="text-sm text-gray-500">Prizes Won</p>
                </div>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="flex-1 max-w-[500px] relative flex items-center justify-center">
              <div className="absolute w-[350px] h-[350px] rounded-full bg-[#FFC805]/10 blur-[80px]" />
              <div className="absolute w-[250px] h-[250px] rounded-full bg-[#dc143c]/10 blur-[60px] translate-x-20 translate-y-10" />
              <div className="relative z-10 w-full aspect-square flex items-center justify-center">
                <img
                  src={olebyCoin}
                  alt="OleBoy Token"
                  className="w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] object-contain animate-float drop-shadow-[0_25px_50px_rgba(255,200,5,0.2)]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 lg:py-24 bg-[#0a0e14]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-4xl sm:text-5xl font-bold text-white mb-4 font-teko uppercase tracking-wide">
            How It Works
          </h2>
          <p className="text-center text-gray-400 text-lg mb-12 max-w-[600px] mx-auto">
            Three simple steps to start competing and earning
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Sign Up',
                desc: 'Connect with Discord and link your Epic Games account in seconds.',
                color: '#5865F2',
              },
              {
                step: '02',
                title: 'Find a Match',
                desc: 'Browse open matches or create your own. Set your wager and rules.',
                color: '#2ecc71',
              },
              {
                step: '03',
                title: 'Win & Earn',
                desc: 'Compete, submit results, and collect your OleBoy Coins instantly.',
                color: '#FFC805',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative p-8 rounded-2xl bg-[#111620] border border-white/5 hover:border-white/10 transition-all group"
              >
                <span
                  className="text-[72px] font-black opacity-10 absolute top-4 right-6 leading-none"
                  style={{ color: item.color }}
                >
                  {item.step}
                </span>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ backgroundColor: `${item.color}20` }}
                >
                  <span className="text-2xl font-bold" style={{ color: item.color }}>
                    {item.step}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2 font-teko uppercase tracking-wide text-2xl">
                  {item.title}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-16 lg:py-24">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-4xl sm:text-5xl font-bold text-white mb-4 font-teko uppercase tracking-wide">
            What Players Say
          </h2>
          <p className="text-center text-gray-400 text-lg mb-12">
            Join thousands of satisfied competitive gamers
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="p-6 rounded-2xl bg-[#111620] border border-white/5 hover:border-[#FFC805]/20 transition-all"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <StarIcon key={i} className="w-5 h-5 text-[#FFC805]" />
                  ))}
                </div>
                <p className="text-gray-300 text-sm leading-relaxed mb-4">{t.text}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFC805] to-[#dc143c] flex items-center justify-center">
                    <span className="text-sm font-bold text-black">{t.name.charAt(0)}</span>
                  </div>
                  <span className="font-semibold text-white">{t.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Rank Up CTA */}
      <section className="py-16 lg:py-24 bg-[#0a0e14]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#dc143c]/20 via-[#04080f] to-[#FFC805]/20 border border-white/5 p-10 sm:p-16 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(220,20,60,0.1),transparent_70%)]" />
            <div className="relative z-10">
              <TrophyIcon className="w-16 h-16 text-[#FFC805] mx-auto mb-6" />
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 font-teko uppercase tracking-wide">
                Ready to Rank Up?
              </h2>
              <p className="text-gray-400 text-lg max-w-[500px] mx-auto mb-8">
                Join the arena today. Compete against the best players, win prizes, and become a legend.
              </p>
              <Link
                to="/auth"
                className="inline-flex items-center gap-3 bg-[#FFC805] text-black font-bold text-lg uppercase tracking-wider px-10 py-4 rounded-xl hover:brightness-110 transition-all shadow-[0_4px_30px_rgba(255,200,5,0.3)]"
              >
                <DiscordIcon className="w-6 h-6" />
                Join Now - It's Free
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Leaderboard Preview */}
      <section className="py-16 lg:py-24" id="leaderboard-heading">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-4xl sm:text-5xl font-bold text-white mb-2 font-teko uppercase tracking-wide">
            Dominate the Leaderboard
          </h2>
          <p className="text-center text-gray-400 text-lg mb-12">
            and claim your legacy.
          </p>

          <div className="rounded-2xl bg-[#111620] border border-white/5 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-4 px-6 py-4 text-sm font-semibold text-gray-500 uppercase tracking-wider border-b border-white/5">
              <span>Rank</span>
              <span>Player</span>
              <span className="text-center">Wins</span>
              <span className="text-right">Earnings</span>
            </div>

            {/* Table Rows */}
            {leaderboardData.map((player) => (
              <div
                key={player.rank}
                className="grid grid-cols-4 px-6 py-4 items-center hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-b-0"
              >
                <span className={`font-bold text-lg ${
                  player.rank === 1 ? 'text-[#FFC805]' :
                  player.rank === 2 ? 'text-gray-300' :
                  player.rank === 3 ? 'text-[#cd7f32]' :
                  'text-gray-500'
                }`}>
                  #{player.rank}
                </span>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FFC805]/30 to-[#dc143c]/30 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{player.name.charAt(0)}</span>
                  </div>
                  <span className="font-semibold text-white">{player.name}</span>
                </div>
                <span className="text-center text-gray-300">{player.wins}</span>
                <span className="text-right font-semibold text-[#2ecc71]">{player.earnings}</span>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/leaderboard"
              className="inline-flex items-center gap-2 text-[#FFC805] font-semibold hover:underline"
            >
              View Full Leaderboard
              <ArrowIcon className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={oleboyLogo} alt="OleBoy" className="w-8 h-8 object-contain" />
              <span className="font-bold text-white">OleBoy Token</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link to="/rules" className="hover:text-white transition-colors">Rules</Link>
            </div>
            <p className="text-sm text-gray-600">
              &copy; {new Date().getFullYear()} OleBoy Token. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
