# OLEBOY TOKEN - Competitive Gaming Platform

Piattaforma competitiva Fortnite dove gli utenti creano partite private, competono per Coins e scalano la classifica.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **UI**: shadcn/ui + Radix UI + Tailwind CSS + Framer Motion
- **3D**: React Three Fiber
- **Backend**: Supabase (Auth, Database, Realtime)
- **Payments**: Stripe (via Vercel Serverless Functions)
- **Hosting**: Vercel
- **State**: TanStack React Query
- **Routing**: React Router DOM v6

## Setup

```bash
# Install dependencies
npm install

# Copy env file and fill in your values
cp .env.example .env

# Start dev server
npm run dev
```

## Environment Variables

See `.env.example` for all required variables:
- `VITE_SUPABASE_URL` - Supabase project URL (frontend)
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon key (frontend)
- `SUPABASE_URL` - Supabase URL (serverless functions)
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (serverless functions)
- `STRIPE_SECRET_KEY` - Stripe secret key (serverless functions)
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook secret (serverless functions)

## Deployment (Vercel)

1. Connect this repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy - Vercel auto-detects Vite and builds correctly
4. Set up Stripe webhook pointing to `https://your-domain.vercel.app/api/stripe-webhook`

## Project Structure

```
src/
  components/     # React components
    3d/           # Three.js 3D components
    admin/        # Admin panel
    common/       # Shared components
    home/         # Homepage sections
    layout/       # Header, Footer, BottomNav
    matches/      # Match-related components
    ui/           # shadcn/ui primitives
  contexts/       # React contexts (Auth)
  hooks/          # Custom hooks
  integrations/   # Supabase client & types
  pages/          # Route pages
  assets/         # Static assets
api/              # Vercel serverless functions
  create-checkout.js   # Stripe checkout session
  stripe-webhook.js    # Stripe webhook handler
```
