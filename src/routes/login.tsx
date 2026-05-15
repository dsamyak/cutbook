import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, Loader2 } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

// ─── Simple client-side rate limiter ──────────────────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_ATTEMPTS = 5;

function useRateLimiter() {
  const attemptsRef = useRef<number[]>([]);

  return {
    canProceed() {
      const now = Date.now();
      attemptsRef.current = attemptsRef.current.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS,
      );
      return attemptsRef.current.length < MAX_ATTEMPTS;
    },
    record() {
      attemptsRef.current.push(Date.now());
    },
    remaining() {
      const now = Date.now();
      attemptsRef.current = attemptsRef.current.filter(
        (t) => now - t < RATE_LIMIT_WINDOW_MS,
      );
      return MAX_ATTEMPTS - attemptsRef.current.length;
    },
  };
}

// ─── Password strength checker ────────────────────────────────────────────────
function getPasswordStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-destructive" };
  if (score <= 2) return { score, label: "Fair", color: "bg-warning" };
  if (score <= 3) return { score, label: "Good", color: "bg-chart-2" };
  return { score, label: "Strong", color: "bg-success" };
}

function LoginPage() {
  const { user, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const rateLimiter = useRateLimiter();

  useEffect(() => {
    if (user) nav({ to: "/dashboard" });
  }, [user, nav]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return toast.error("Fill in all fields");

    if (!rateLimiter.canProceed()) {
      return toast.error(
        "Too many attempts. Please wait a minute before trying again.",
      );
    }

    setBusy(true);
    rateLimiter.record();
    const { error } = await signIn(email, password);
    setBusy(false);

    if (error) {
      // Sanitize error messages to prevent information leakage
      if (error.includes("Invalid login")) {
        return toast.error("Invalid email or password");
      }
      return toast.error(error);
    }
    toast.success("Welcome back!");
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return toast.error("Fill in all fields");

    if (password.length < 8) {
      return toast.error("Password must be at least 8 characters");
    }
    if (password !== confirmPassword) {
      return toast.error("Passwords do not match");
    }

    if (!rateLimiter.canProceed()) {
      return toast.error(
        "Too many attempts. Please wait a minute before trying again.",
      );
    }

    setBusy(true);
    rateLimiter.record();
    const { error } = await signUp(email, password, fullName);
    setBusy(false);

    if (error) {
      if (error.includes("already registered")) {
        return toast.error("This email is already registered. Please sign in.");
      }
      return toast.error(error);
    }
    toast.success("Account created! You are now signed in.");
  }

  function switchMode(target: "signin" | "signup") {
    setMode(target);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  }

  const pwStrength = getPasswordStrength(password);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary to-accent/40">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground items-center justify-center text-2xl font-bold shadow-lg">
            ✂
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">CutBook</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete salon management.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="flex rounded-lg bg-muted p-1 mb-4">
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              mode === "signin"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LogIn className="h-4 w-4" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-all ${
              mode === "signup"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Sign Up
          </button>
        </div>

        <Card className="p-6">
          {mode === "signin" ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="text-center mb-2">
                <Mail className="h-8 w-8 mx-auto text-primary mb-2" />
                <h2 className="text-lg font-semibold">Welcome back</h2>
                <p className="text-sm text-muted-foreground">
                  Sign in to your CutBook account
                </p>
              </div>

              <div>
                <Label htmlFor="signin-email">Email address</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signin-password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signin-password"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signup")}
                  className="text-primary hover:underline font-medium"
                >
                  Create one
                </button>
              </p>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="text-center mb-2">
                <UserPlus className="h-8 w-8 mx-auto text-primary mb-2" />
                <h2 className="text-lg font-semibold">Create account</h2>
                <p className="text-sm text-muted-foreground">
                  First account becomes <strong>Admin</strong> automatically
                </p>
              </div>

              <div>
                <Label htmlFor="signup-name">Full name</Label>
                <div className="relative mt-1">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    autoComplete="name"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signup-email">Email address</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {/* Password strength meter */}
                {password.length > 0 && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= pwStrength.score
                              ? pwStrength.color
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <p
                      className={`text-xs mt-1 ${
                        pwStrength.score <= 1
                          ? "text-destructive"
                          : pwStrength.score <= 2
                            ? "text-warning-foreground"
                            : "text-success"
                      }`}
                    >
                      {pwStrength.label}
                      {pwStrength.score <= 2 &&
                        " — Use 8+ chars, uppercase, numbers & symbols"}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="signup-confirm">Confirm password</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-confirm"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="new-password"
                  />
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <p className="text-xs text-destructive mt-1">
                    Passwords do not match
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("signin")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>
            </form>
          )}
        </Card>

        {/* Security note */}
        <p className="text-[10px] text-muted-foreground text-center mt-4 opacity-60">
          Secured with Supabase Auth. Your password is hashed and never stored
          in plain text.
        </p>
      </div>
    </div>
  );
}
