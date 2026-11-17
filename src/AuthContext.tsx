import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, openedFromPasswordRecovery } from './supabase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  /** true quando o usuário chegou pelo link de redefinição de senha */
  passwordRecovery: boolean;
  finishPasswordRecovery: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null, loading: true, passwordRecovery: false, finishPasswordRecovery: () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(openedFromPasswordRecovery);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const finishPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  return (
    <AuthContext.Provider value={{ user, loading, passwordRecovery, finishPasswordRecovery }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
