import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useVipStatus } from '@/hooks/useVipStatus';
import { useIsDesktop } from '@/hooks/use-mobile';
import { useNotifications } from '@/hooks/useNotifications';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import { VipModal } from '@/components/vip/VipModal';
import { TipModal } from '@/components/vip/TipModal';
import { getDiscordAvatarUrl } from '@/lib/avatar';
import oleboyLogo from '@/assets/logo-oleboy.png';
import olebyCoin from '@/assets/oleboy-coin.png';

export function Header() {
  const { user, profile, wallet, signOut } = useAuth();
  const { isVip } = useVipStatus();
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();
  const [showVipModal, setShowVipModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const avatarUrl = getDiscordAvatarUrl(profile);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 h-[70px] bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="h-full max-w-[1440px] mx-auto px-4 lg:px-8 flex items-center">
          <Link to="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setMobileMenuOpen(false)}>
            <div className="w-10 h-10 rounded-lg bg-[#141414] border border-white/[0.08] flex items-center justify-center overflow-hidden">
              <img src={olebyCoin} alt="OLEBOY" className="w-9 h-9 object-contain" />
            </div>
            <span className="font-teko font-bold text-[24px] tracking-[1.2px] text-white uppercase hidden sm:block">
              OLEBOY
            </span>
          </Link>

          <div className="flex items-center gap-4 ml-auto">
            <button
              onClick={() => setShowVipModal(true)}
              className="hidden sm:flex items-center justify-center bg-[#ffc805] rounded-full px-[20px] py-[4px] shadow-[0_0_16px_rgba(255,200,5,0.4)] hover:shadow-[0_0_24px_rgba(255,200,5,0.6)] transition-all duration-200 cursor-pointer"
            >
              <span className="font-teko font-bold text-[18px] text-black uppercase leading-none pt-[2px]">VIP</span>
            </button>

            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-1.5 bg-[#1e1e1e] border border-[#374151] rounded-full px-[13px] py-[7px]">
                  <img src={olebyCoin} alt="coins" className="w-5 h-5 object-contain" />
                  <span className="font-bold text-[14px] text-[#ededed] tabular-nums" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
                    {wallet?.balance?.toFixed(2) ?? '0.00'}
                  </span>
                </div>

                <div className="relative">
                  <NotificationsDropdown />
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="relative rounded-full outline-none focus-visible:ring-1 focus-visible:ring-[#FFC805]/50">
                      <div className="p-[2px] rounded-full bg-gradient-to-br from-blue-500 to-cyan-400">
                        <Avatar className="h-[36px] w-[36px] border-2 border-[#0a0a0a]">
                          <AvatarImage
                            src={avatarUrl ?? undefined}
                            alt={profile?.username}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-[#1e1e1e] text-white font-medium text-sm">
                            {profile?.username?.charAt(0).toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 p-1.5 bg-[#0f0f0f] border-[#374151]">
                    <div className="flex items-center gap-3 px-2 py-2 mb-1">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={avatarUrl ?? undefined} />
                        <AvatarFallback className="bg-[#1e1e1e] text-white text-xs font-medium">
                          {profile?.username?.charAt(0).toUpperCase() ?? 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-white">{profile?.username}</span>
                        <span className="text-xs text-gray-400 truncate max-w-[140px]">{profile?.email}</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator className="bg-[#374151]" />
                    {isAdmin && (
                      <>
                        <DropdownMenuItem asChild className="rounded-lg cursor-pointer text-gray-300 hover:text-white">
                          <Link to="/admin">
                            <Shield className="w-4 h-4 mr-2" />
                            Admin Panel
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#374151]" />
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={handleSignOut}
                      className="text-destructive focus:text-destructive cursor-pointer rounded-lg"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Link
                to="/auth"
                className="font-teko font-medium text-[18px] text-[#ededed]/70 hover:text-white uppercase tracking-[0.45px] transition-colors duration-200"
              >
                Sign in
              </Link>
            )}

            {!isDesktop && (
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-[#ededed]/70 hover:text-white transition-colors duration-200"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {mobileMenuOpen && !isDesktop && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed top-[70px] left-0 right-0 z-40 lg:hidden bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/[0.06] shadow-xl shadow-black/30"
          >
            <div className="max-w-lg mx-auto px-4 py-3">
              {user && (
                <div className="flex items-center gap-3 px-3 py-3 mb-2 rounded-xl bg-white/[0.04]">
                  <div className="p-[2px] rounded-full bg-gradient-to-br from-blue-500 to-cyan-400">
                    <Avatar className="h-10 w-10 border-2 border-[#0a0a0a]">
                      <AvatarImage src={avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-[#1e1e1e] text-white text-sm font-medium">
                        {profile?.username?.charAt(0).toUpperCase() ?? 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{profile?.username}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <img src={olebyCoin} alt="coins" className="w-4 h-4 object-contain" />
                      <span className="text-sm font-semibold text-[#FFC805] tabular-nums">
                        {wallet?.balance?.toFixed(2) ?? '0.00'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {user && isAdmin && (
                <nav className="flex flex-col gap-0.5">
                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors duration-200"
                  >
                    <Shield className="w-5 h-5" />
                    Admin Panel
                  </Link>
                </nav>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <VipModal open={showVipModal} onOpenChange={setShowVipModal} />
      <TipModal open={showTipModal} onOpenChange={setShowTipModal} recipientId="" recipientUsername="" />
    </>
  );
}
