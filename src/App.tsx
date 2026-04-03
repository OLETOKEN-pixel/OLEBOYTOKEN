import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLoadingGuard } from "@/components/common/AppLoadingGuard";
import { GlobalMatchEventListener } from "@/components/common/GlobalMatchEventListener";
import { getCanonicalRedirectUrl } from "@/lib/oauth";

// Pages
import Index from "./pages/Index";
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
import Profile from "./pages/Profile";
import Wallet from "./pages/Wallet";

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <CanonicalDomainRedirect />
            <AuthenticatedGlobalListeners />
            {/* Fixed bottom neon — always visible on all pages, matches Figma node 205:855 */}
            <img
              aria-hidden="true"
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
                <Route path="/matches" element={<Matches />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppLoadingGuard>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
