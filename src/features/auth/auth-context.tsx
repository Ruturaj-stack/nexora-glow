import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { getMe, recordSession, type MePayload } from "@/lib/users.functions";
import { toApiMessage } from "@/lib/api-response";

interface AuthResult {
  success: boolean;
  message: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: MePayload["profile"] | null;
  settings: MePayload["settings"] | null;
  initializing: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (name: string, email: string, password: string) => Promise<AuthResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<AuthResult>;
  resetPassword: (password: string) => Promise<AuthResult>;
  changePassword: (currentPassword: string, password: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setInitializing(false);
      if (!nextSession) queryClient.removeQueries({ queryKey: ["me"] });
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const { data: me } = useQuery({
    queryKey: ["me", session?.user.id],
    enabled: Boolean(session),
    staleTime: 60_000,
    queryFn: async () => {
      const response = await getMe();
      return response.data;
    },
  });

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    void recordSession().catch(() => undefined);
    return { success: true, message: "Signed in" };
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string): Promise<AuthResult> => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { name },
        },
      });
      if (error) return { success: false, message: error.message };
      return { success: true, message: "Account created" };
    },
    [],
  );

  const signInWithGoogle = useCallback(async (): Promise<AuthResult> => {
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if ("error" in result && result.error) {
        return { success: false, message: toApiMessage(result.error, "Google sign-in failed") };
      }
      return { success: true, message: "Signed in with Google" };
    } catch (error) {
      return { success: false, message: toApiMessage(error, "Google sign-in failed") };
    }
  }, []);

  const signOut = useCallback(async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  }, [queryClient]);

  const requestPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Reset link sent" };
  }, []);

  const resetPassword = useCallback(async (password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { success: false, message: error.message };
    return { success: true, message: "Password updated" };
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, password: string): Promise<AuthResult> => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) return { success: false, message: "No active session" };

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) return { success: false, message: "Current password is incorrect" };

      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { success: false, message: error.message };
      return { success: true, message: "Password changed" };
    },
    [],
  );

  const refreshProfile = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile: me?.profile ?? null,
      settings: me?.settings ?? null,
      initializing,
      isAuthenticated: Boolean(session),
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      requestPasswordReset,
      resetPassword,
      changePassword,
      refreshProfile,
    }),
    [
      session,
      me,
      initializing,
      signIn,
      signUp,
      signInWithGoogle,
      signOut,
      requestPasswordReset,
      resetPassword,
      changePassword,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
