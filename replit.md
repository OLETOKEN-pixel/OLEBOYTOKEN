# OLEBOY TOKEN - Competitive Gaming Platform

## Overview
OLEBOY TOKEN is a competitive Fortnite gaming platform where users can create matches, compete for coins, and climb the leaderboard. Built with React, Vite, TypeScript, and Supabase.

## Recent Changes
- 2026-02-15: Initial setup, DB migration, Discord OAuth, fixes
- 2026-02-15: "Dark Ultra Clean Premium" redesign (SECOND - now superseded)
- 2026-02-18: COMPLETE Figma-based redesign (THIRD redesign) - PLATFORM-WIDE:
  - Typography: Teko (headings/nav, Bold/Medium), Inter (body text) - applied globally
  - Gold accent: #FFC805 everywhere (fully replaced #D4A537)
  - CSS tokens: Updated --gold, --border-soft, --border-hover, btn-premium, font imports
  - Home: Header 70px, Hero "PLAY TO EARN", mascot, Live Matches grid, Footer
  - ALL 26+ pages restyled: Matches, MyMatches, CreateMatch, Leaderboard, Wallet, BuyCoins, Profile, Challenges, Highlights, Auth, NotFound, Teams, TeamDetails, MatchDetails, Privacy, Terms, Rules, Notifications, Admin, PaymentSuccess, PaymentCancel
  - Components updated: MatchCard (mode badge, status badges), BottomNav, Header, 3D components, HighlightsCarousel, HighlightCard
  - Cards: bg-[#121212] border-[#1f2937] rounded-[16px] throughout
  - All match/wallet data from Supabase (no placeholder data)

## Authentication
- Discord OAuth via Supabase built-in provider (requires Discord provider enabled in Supabase Dashboard)
- New users get auto-created profiles with Discord metadata (username, avatar)
- Profile trigger `handle_new_profile` auto-creates wallet on profile INSERT
- Supabase redirect URL: `https://cqpazuydpoxpcayerwxi.supabase.co/auth/v1/callback`

## Backend Server (server/index.js)
- Express server handles Stripe API endpoints locally (no Edge Functions needed)
- `/api/create-checkout` - Creates Stripe checkout session
- `/api/stripe-webhook` - Handles Stripe webhook events (deposit, refund)
- In dev: runs on port 3001 with Vite proxy; in production: runs on port 5000 serving static files
- Requires `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` secrets

## Database Connection
- Supabase Project Ref: cqpazuydpoxpcayerwxi
- Pooler Host: aws-1-eu-central-1.pooler.supabase.com
- Session mode port: 5432, Transaction mode port: 6543

## Project Architecture
- **Frontend**: React 18 + Vite 5 + TypeScript
- **UI**: shadcn/ui + Radix UI + Tailwind CSS + framer-motion
- **3D**: React Three Fiber (@react-three/fiber@8.17.10, @react-three/drei@9.117.0, three)
- **Backend**: Supabase (auth, database, realtime)
- **State Management**: TanStack React Query
- **Routing**: React Router DOM v6

## Design System (Figma-based, THIRD redesign)
- **Direction**: Bold competitive gaming with clean dark UI
- **Typography**: Teko (headings, nav, buttons - Bold/Medium), Inter (body text, labels)
- **Palette**: Dark blacks (#0a0a0a bg, #121212 cards, #1e1e1e elevated), gold #FFC805, gray borders #1f2937/#374151
- **Layout**: 70px header with backdrop-blur, NO sidebar, max-w-[1140px] content, mobile bottom nav
- **Header**: Logo + OLEBOY text, Teko nav links, VIP pill (gold), social icons (X/TikTok), coin balance pill, avatar
- **Hero**: "PLAY TO EARN" (Teko 96px), mascot image, green START MATCHES + blue VIEW CHALLENGES CTA buttons (80px height)
- **Match Cards**: bg-[#121212], border-[#1f2937], rounded-[16px], mode badge, entry fee, status badges (LIVE red, STARTING blue)
- **Featured Cards**: gold border, gold glow shadow, gold mode badge
- **Buttons**: Green (#2ecc71) for matches, Blue (#3b82f6) for challenges, Gold (#FFC805) for join/VIP
- **Footer**: Minimal centered - logo, copyright, policy links on dark #080808

## Project Structure
- `src/` - Source code
  - `components/3d/` - 3D components (Coin3D, ParticleField, Scene3D, HeroScene, FloatingCoin, Logo3D, Mascot3D)
  - `components/ui/` - UI primitives (glass-card/PremiumCard, premium-badge, motion wrappers, skeleton-premium, animated-counter)
  - `components/admin/` - Admin panel components
  - `components/home/` - Home page sections (HeroCompact, LiveMatchesPanel, HighlightsCarousel, StatsBar)
  - `components/layout/` - Layout (MainLayout, Header, BottomNav, Footer - NO sidebar)
  - `components/matches/` - Match-related components (MatchCard, MyMatchCard)
  - `components/icons/` - 15 original SVG game icons (GameIcons.tsx)
  - `contexts/` - React contexts (AuthContext)
  - `hooks/` - Custom hooks
  - `integrations/supabase/` - Supabase client and types
  - `pages/` - Page components (13 pages)
  - `assets/` - Static assets (mascot-oleboy.png, logo-oleboy.png, avatars)
- `server/` - Express backend (Stripe endpoints)
- `supabase/migrations/` - Database migration files

## Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/public key

## Development
- Dev server: `npm run dev` (runs on port 5000)
- Build: `npm run build`
- Navigation: Play (home), Matches, Leaderboard, Challenges, Shop

## User Preferences
- Language: Italian
