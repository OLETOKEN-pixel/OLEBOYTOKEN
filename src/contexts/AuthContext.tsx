import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { Profile, Wallet } from '@/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  wallet: Wallet | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshWallet: () => Promise<void>;
  isProfileComplete: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Clean up legacy localStorage keys from old auth methods
const cleanupLegacyStorage = () => {
  const legacyKeys = [
    'sb-auth-token',
    'supabase.auth.token',
    'auth_redirect',
    'legacy_auth_version',
  ];
  legacyKeys.forEach(key => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore storage errors
    }
  });
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile is complete if Epic username is set
  const isProfileComplete = Boolean(profile?.epic_username);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  const fetchWallet = async (userId: string) => {
    const { data, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching wallet:', error);
      return null;
    }
    return data as Wallet | null;
  };

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user]);

  const refreshWallet = useCallback(async () => {
    if (user) {
      const walletData = await fetchWallet(user.id);
      setWallet(walletData);
    }
  }, [user]);

  // Separate state to trigger initialization
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Effect 1: Auth state listener (SYNC ONLY - no async operations)
  useEffect(() => {
    // Clean up legacy storage on mount
    cleanupLegacyStorage();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // SYNC state updates only - never await here
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Trigger initialization via state change
          setPendingUserId(session.user.id);
        } else {
          // Logout: clear everything immediately
          setPendingUserId(null);
          setProfile(null);
          setWallet(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session and validate it
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Try to refresh the session to ensure it's still valid
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshData.session) {
          // Session is invalid, force sign out
          console.log('Invalid session detected, signing out');
          await supabase.auth.signOut();
          cleanupLegacyStorage();
          setSession(null);
          setUser(null);
          setProfile(null);
          setWallet(null);
          setLoading(false);
          return;
        }

        const { data: profileCheck } = await supabase
          .from('profiles')
          .select('id, username')
          .eq('user_id', refreshData.session.user.id)
          .maybeSingle();

        if (!profileCheck) {
          const meta = refreshData.session.user.user_metadata || {};
          const providerName = meta.full_name || meta.name || meta.preferred_username || meta.user_name || '';
          const cleanName = providerName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user' + Date.now().toString().slice(-6);
          const discordAvatar = meta.avatar_url || null;

          const { error: insertError } = await supabase
            .from('profiles')
            .insert({
              user_id: refreshData.session.user.id,
              username: cleanName,
              email: refreshData.session.user.email || '',
              discord_user_id: meta.provider_id || meta.sub || null,
              discord_username: meta.preferred_username || meta.user_name || null,
              discord_display_name: meta.full_name || meta.name || null,
              discord_avatar_url: discordAvatar,
              discord_linked_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error('Error creating profile for new user:', insertError);
          }
        }

        // Session is valid AND profile exists
        setSession(refreshData.session);
        setUser(refreshData.session.user);
        setPendingUserId(refreshData.session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Effect 2: Initialize user data when pendingUserId changes
  useEffect(() => {
    if (!pendingUserId) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      // Safety timeout: 10 seconds max
      if (!cancelled) {
        console.error('Auth initialization timeout');
        setLoading(false);
      }
    }, 10000);

    const initializeUserData = async () => {
      try {
        const profileData = await fetchProfile(pendingUserId);
        
        if (!cancelled) {
          setProfile(profileData);
          const walletData = await fetchWallet(pendingUserId);
          if (!cancelled) {
            setWallet(walletData);
          }
        }
      } catch (error) {
        console.error('Error initializing user data:', error);
      } finally {
        clearTimeout(timeoutId);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    initializeUserData();

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [pendingUserId]);

  // Real-time subscription for wallet updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`wallet-${user.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'wallets', 
          filter: `user_id=eq.${user.id}` 
        },
        () => {
          refreshWallet();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, refreshWallet]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setWallet(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        wallet,
        loading,
        signOut,
        refreshProfile,
        refreshWallet,
        isProfileComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
