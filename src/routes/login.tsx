import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Mail, KeyRound } from "lucide-react";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, signInWithOtp, verifyOtp } = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<"email" | "otp">("email");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    if (user) nav({ to: "/dashboard" });
  }, [user, nav]);

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return toast.error("Enter your email");
    setBusy(true);
    const { error } = await signInWithOtp(email);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("OTP sent to " + email + ". Check your inbox.");
    setStep("otp");
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || otp.length < 6) return toast.error("Enter the 6-digit code");
    setBusy(true);
    const { error } = await verifyOtp(email, otp);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success("Welcome!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary to-accent/40">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground items-center justify-center text-2xl font-bold shadow-lg">
            ✂
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">CutBook</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Complete salon management.
          </p>
        </div>
        <Card className="p-6">
          {step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="text-center mb-2">
                <Mail className="h-8 w-8 mx-auto text-primary mb-2" />
                <h2 className="text-lg font-semibold">Sign in with OTP</h2>
                <p className="text-sm text-muted-foreground">
                  We'll send a 6-digit code to your email
                </p>
              </div>
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Sending OTP…" : "Send OTP"}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                First sign-in creates your account automatically.
                <br />
                The first account becomes <strong>Admin</strong>.
              </p>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="text-center mb-2">
                <KeyRound className="h-8 w-8 mx-auto text-primary mb-2" />
                <h2 className="text-lg font-semibold">Enter OTP</h2>
                <p className="text-sm text-muted-foreground">
                  Code sent to <strong>{email}</strong>
                </p>
              </div>
              <div>
                <Label htmlFor="otp">6-digit code</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  placeholder="000000"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="mt-1 text-center text-2xl tracking-[0.5em] font-mono"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Verifying…" : "Verify & Sign In"}
              </Button>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={() => {
                    setStep("email");
                    setOtp("");
                  }}
                >
                  <ArrowLeft className="h-3 w-3" /> Change email
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    const { error } = await signInWithOtp(email);
                    setBusy(false);
                    if (error) return toast.error(error);
                    toast.success("New code sent!");
                    setOtp("");
                  }}
                >
                  Resend code
                </Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
