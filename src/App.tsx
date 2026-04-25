import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLoadingGuard } from "@/components/common/AppLoadingGuard";
import { GlobalMatchEventListener } from "@/components/common/GlobalMatchEventListener";
import { getCanonicalRedirectUrl } from "@/lib/oauth";
import { WalletPurchaseProvider } from "@/contexts/WalletPurchaseContext";

// Pages
import Index from "./pages/Index";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import EpicCallback from "./pages/EpicCallback";
import TwitterCallback from "./pages/TwitterCallback";
import TwitchCallback from "./pages/TwitchCallback";
import DiscordCallback from "./pages/DiscordCallback";
import Admin from "./pages/Admin";
import AdminMatchDetail from "./pages/AdminMatchDetail";
import AdminUserDetail from "./pages/AdminUserDetail";
import Rules from "./pages/Rules";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Matches from "./pages/Matches";
import MatchDetail from "./pages/MatchDetail";
import MyMatches from "./pages/MyMatches";
import Profile from "./pages/Profile";
import Wallet from "./pages/Wallet";
import Highlights from "./pages/Highlights";
import Teams from "./pages/Teams";
import Challenges from "./pages/Challenges";
import BuyCoins from "./pages/BuyCoins";
import PaymentSuccess from "./pages/PaymentSuccess";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Component that renders GlobalMatchEventListener when user is authenticated
function AuthenticatedGlobalListeners() {
  const { user } = useAuth();

  if (!user) return null;

  return <GlobalMatchEventListener userId={user.id} />;
}

function CanonicalDomainRedirect() {
  useEffect(() => {
    const canonicalRedirectUrl = getCanonicalRedirectUrl();

    if (canonicalRedirectUrl && window.location.href !== canonicalRedirectUrl) {
      window.location.replace(canonicalRedirectUrl);
    }
  }, []);

  return null;
}

/**
 * Resets scroll to top on every route change, EXCEPT when the caller passed
 * a `scrollTo` state (handled by Index.tsx to scroll to a section instead).
 */
function ScrollToTopOnRouteChange() {
  const { pathname, state } = useLocation();
  useEffect(() => {
    if ((state as { scrollTo?: string } | null)?.scrollTo) return;
    window.scrollTo(0, 0);
  }, [pathname, state]);
  return null;
}

function GlobalBottomNeon() {
  const { pathname } = useLocation();
  const isMatchDetail = /^\/matches\/(?!create(?:\/|$))[^/]+$/.test(pathname);

  if (isMatchDetail) return null;

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CanonicalDomainRedirect />
            <ScrollToTopOnRouteChange />
            <AuthenticatedGlobalListeners />
            {/* Match detail uses its own Figma neon layer. */}
            <GlobalBottomNeon />
            <WalletPurchaseProvider>
              <AppLoadingGuard>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/epic/callback" element={<EpicCallback />} />
                  <Route path="/auth/twitter/callback" element={<TwitterCallback />} />
                  <Route path="/auth/twitch/callback" element={<TwitchCallback />} />
                  <Route path="/auth/discord/callback" element={<DiscordCallback />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/admin/matches/:id" element={<AdminMatchDetail />} />
                  <Route path="/admin/users/:id" element={<AdminUserDetail />} />
                  <Route path="/rules" element={<Rules />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/matches/create" element={<Matches />} />
                  <Route path="/matches/:id" element={<MatchDetail />} />
                  <Route path="/matches" element={<Matches />} />
                  <Route path="/highlights" element={<Highlights />} />
                  <Route path="/highlights/week" element={<Highlights />} />
                  <Route path="/highlights/month" element={<Highlights />} />
                  <Route path="/challenges" element={<Challenges />} />
                  <Route path="/teams" element={<Teams />} />
                  <Route path="/my-matches" element={<MyMatches />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/wallet" element={<Wallet />} />
                  <Route path="/buy" element={<BuyCoins />} />
                  <Route path="/payment/success" element={<PaymentSuccess />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/comingsoon" element={<ComingSoon />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLoadingGuard>
            </WalletPurchaseProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
