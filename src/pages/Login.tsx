import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, Mail } from "lucide-react";

const InlineError = ({ message }: { message: string }) => (
  <p className="flex items-center gap-1.5 text-xs text-destructive mt-1">
    <AlertTriangle className="h-3 w-3 shrink-0" />
    {message}
  </p>
);

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showUnverified, setShowUnverified] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for resend
  useEffect(() => {
    if (!showUnverified) return;
    if (resendCooldown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showUnverified, resendCooldown]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!email.trim()) e.email = "Email is required";
    if (!password) e.password = "Password is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      // Supabase returns "Email not confirmed" when user hasn't verified
      if (error.message.toLowerCase().includes("email not confirmed")) {
        setShowUnverified(true);
        setResendCooldown(60);
        setCanResend(false);
        return;
      }
      toast.error(error.message);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", data.user.id)
      .single();

    if (profile && !profile.onboarding_complete) {
      navigate("/welcome");
    } else {
      navigate("/dashboard");
    }
  };

  const handleResend = useCallback(async () => {
    if (!canResend) return;
    setCanResend(false);
    setResendCooldown(60);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification email resent!");
    }
  }, [canResend, email]);

  if (showUnverified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md bg-card rounded-lg shadow-lg p-8 text-center">
          <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Please verify your email first</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Check your inbox for the verification link we sent to <span className="font-medium text-foreground">{email}</span>.
          </p>
          <div className="text-sm text-muted-foreground">
            {canResend ? (
              <button
                onClick={handleResend}
                className="text-primary font-medium hover:underline"
              >
                Resend email
              </button>
            ) : (
              <span>Resend available in {resendCooldown}s</span>
            )}
          </div>
          <button
            onClick={() => setShowUnverified(false)}
            className="mt-6 text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md bg-card rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-primary text-center mb-6">Welcome back</h1>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg" placeholder="you@example.com" />
            {errors.email && <InlineError message={errors.email} />}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg" placeholder="••••••••" />
            {errors.password && <InlineError message={errors.password} />}
          </div>
          <Button type="submit" disabled={loading} className="w-full rounded-lg text-base font-semibold hover:bg-accent transition-colors">
            {loading ? "Logging in..." : "Log In"}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
