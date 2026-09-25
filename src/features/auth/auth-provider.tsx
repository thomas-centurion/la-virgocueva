import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextValue = {
  session: Session | null;
  isLoading: boolean;
  signOut: () => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let receivedAuthEvent = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      setSession(nextSession);
      setIsLoading(false);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('No se pudo restaurar la sesión de Supabase:', error);
      if (!receivedAuthEvent) setSession(data.session);
      setIsLoading(false);
    }).catch((error: unknown) => {
      console.error('No se pudo restaurar la sesión de Supabase:', error);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    isLoading,
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      if (!error) setSession(null);
      return { error };
    },
  }), [session, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return value;
}
