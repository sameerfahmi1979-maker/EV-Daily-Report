import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getCurrentUserProfile, UserProfile } from '../lib/userService';
import { ApprovalStatus, isOperationallyAllowed } from '../lib/rbac';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  approvalStatus: ApprovalStatus;
  isApprovedOperational: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function resolveApprovalStatus(profile: UserProfile | null): ApprovalStatus {
  if (!profile) return 'pending';
  const raw = (profile as UserProfile & { approval_status?: string }).approval_status;
  if (raw === 'pending' || raw === 'approved' || raw === 'disabled' || raw === 'rejected') {
    return raw;
  }
  // Pre-migration compatibility: active profile without approval_status => approved
  return profile.is_active === false ? 'disabled' : 'approved';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async () => {
    try {
      const next = await getCurrentUserProfile();
      setProfile(next);
    } catch (err) {
      console.error('Failed to load user profile', err);
      setProfile(null);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await loadProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile();
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const approvalStatus = resolveApprovalStatus(profile);
  const isApprovedOperational = isOperationallyAllowed(approvalStatus, profile?.is_active ?? true);

  const value: AuthContextType = {
    user,
    session,
    profile,
    approvalStatus,
    isApprovedOperational,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile: loadProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
