import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Role = "admin" | "owner" | "barber";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: Role[];
  isAdmin: boolean;
  isOwner: boolean;
  isBarber: boolean;
  /** admin OR owner — can access most management features */
  canManage: boolean;
  loading: boolean;
  /** Sign up with email + password. First user becomes admin automatically. */
  signUp: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error?: string }>;
  /** Sign in with email + password */
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error?: string }>;
  /** Sign out and clear local state */
  signOut: () => Promise<void>;
  /** Reload roles from the database */
  refreshRoles: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_CACHE_TTL_MS = 30_000; // re-fetch roles at most every 30s
const SESSION_CHECK_INTERVAL_MS = 60_000; // heartbeat every 60s

// ─── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  // Cache timestamp so we don't hammer the DB on every render / auth event
  const rolesCacheRef = useRef<{
    userId: string;
    roles: Role[];
    fetchedAt: number;
  } | null>(null);

  // ── Role loader with caching ──────────────────────────────────────────────
  const loadRoles = useCallback(
    async (userId: string, force = false) => {
      const now = Date.now();
      const cache = rolesCacheRef.current;
      if (
        !force &&
        cache &&
        cache.userId === userId &&
        now - cache.fetchedAt < ROLE_CACHE_TTL_MS
      ) {
        // Serve from cache
        setRoles(cache.roles);
        return;
      }

      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (error) {
          console.error("[Auth] Failed to load roles:", error.message);
          return;
        }

        const freshRoles = (data ?? []).map((r) => r.role as Role);
        rolesCacheRef.current = {
          userId,
          roles: freshRoles,
          fetchedAt: Date.now(),
        };
        setRoles(freshRoles);
      } catch (err) {
        console.error("[Auth] Unexpected error loading roles:", err);
      }
    },
    [],
  );

  // ── Bootstrap: listen for auth state changes + initial session ────────────
  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user) {
        // Use setTimeout(0) to avoid Supabase deadlock when calling
        // supabase methods inside onAuthStateChange synchronously
        setTimeout(() => {
          if (mounted) loadRoles(newSession.user.id, true);
        }, 0);
      } else {
        setRoles([]);
        rolesCacheRef.current = null;
      }
    });

    // Get the initial session
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          loadRoles(data.session.user.id);
        }
      })
      .catch((err) => {
        console.error("[Auth] Failed to get session:", err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadRoles]);

  // ── Periodic session heartbeat ────────────────────────────────────────────
  // Ensures the token stays fresh and detects revoked sessions quickly.
  useEffect(() => {
    if (!session) return;

    const iv = setInterval(async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          // Session expired or was revoked server-side
          setSession(null);
          setRoles([]);
          rolesCacheRef.current = null;
        }
      } catch {
        // Network error — ignore, will retry next interval
      }
    }, SESSION_CHECK_INTERVAL_MS);

    return () => clearInterval(iv);
  }, [session]);

  // ── Derived booleans ──────────────────────────────────────────────────────
  const isAdmin = roles.includes("admin");
  const isOwner = roles.includes("owner");
  const isBarber = roles.includes("barber");

  // ── Auth actions ──────────────────────────────────────────────────────────
  const signUp = useCallback(
    async (email: string, password: string, fullName?: string) => {
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || email.split("@")[0] },
          },
        });
        if (error) return { error: error.message };
        return {};
      } catch (err: any) {
        return { error: err?.message ?? "Sign-up failed" };
      }
    },
    [],
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) return { error: error.message };
        return {};
      } catch (err: any) {
        return { error: err?.message ?? "Sign-in failed" };
      }
    },
    [],
  );

  const signOutFn = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore — session will be cleared by onAuthStateChange
    }
    setSession(null);
    setRoles([]);
    rolesCacheRef.current = null;
  }, []);

  const refreshRoles = useCallback(async () => {
    const uid = session?.user?.id;
    if (uid) await loadRoles(uid, true);
  }, [session?.user?.id, loadRoles]);

  // ── Context value (memoised to avoid needless re-renders) ─────────────────
  const value: AuthCtx = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      roles,
      isAdmin,
      isOwner,
      isBarber,
      canManage: isAdmin || isOwner,
      loading,
      signUp,
      signIn,
      signOut: signOutFn,
      refreshRoles,
    }),
    [
      session,
      roles,
      isAdmin,
      isOwner,
      isBarber,
      loading,
      signUp,
      signIn,
      signOutFn,
      refreshRoles,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

// ─── Utility ──────────────────────────────────────────────────────────────────
export const fmtMoney = (n: number | string | null | undefined) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
