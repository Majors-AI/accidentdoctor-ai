import { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext(undefined);

// Adapt a Supabase `profiles` row to the shape the base44 journey/shells expect.
// NO schema change — this mapping lives only in the context layer so that
// journey/stages.ts roleCategory() keeps working unchanged:
//   role:     built-in platform field → 'admin' for platform admins, else 'user'
//   app_role: the practice role        → drives practice-staff routing
function adaptProfile(p) {
  if (!p) return null;
  return {
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    practice_id: p.practice_id,
    role: p.is_platform_admin ? 'admin' : 'user',
    app_role: p.role,
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, practice_id, is_platform_admin')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('AuthContext: failed to load profile —', error.message);
      setUser(null);
      return;
    }
    setUser(adaptProfile(data));
  }, []);

  useEffect(() => {
    let active = true;

    // Initial session check on mount.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return;
      if (session?.user) await loadProfile(session.user.id);
      if (active) setLoading(false);
    });

    // React to future auth changes (sign-in, sign-out, token refresh).
    // Supabase holds an internal lock while this callback runs; defer any
    // further supabase calls to a macrotask to avoid a getSession deadlock.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session?.user) {
        setTimeout(async () => {
          if (!active) return;
          await loadProfile(session.user.id);
          if (active) setLoading(false);
        }, 0);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  // Internal login navigation — NO external base44 redirect and NO growing
  // from_url (that pair caused the previous 431 redirect loop).
  const navigateToLogin = useCallback(() => {
    if (window.location.pathname !== '/login') window.location.assign('/login');
  }, []);

  const value = {
    // Primary surface (Phase 1 Supabase auth).
    user,
    loading,
    logout,
    // Back-compat aliases for existing base44 consumers so shells / JourneyBar
    // / ProtectedRoute / App keep working without edits.
    isLoadingAuth: loading,
    isLoadingPublicSettings: false,
    isAuthenticated: !!user,
    authChecked: !loading,
    authError: null,
    navigateToLogin,
    checkUserAuth: () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
