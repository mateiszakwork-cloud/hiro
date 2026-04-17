import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Mail, Check } from "lucide-react";

const InlineError = ({ message }: { message: string }) => (
  <p className="hiro-auth-error">
    <AlertTriangle className="h-3 w-3 shrink-0" />
    {message}
  </p>
);

const AuthLeftPanel = () => (
  <div className="hiro-auth-left">
    <span className="hiro-auth-wordmark">Hiro</span>
    <h2 className="hiro-auth-tagline">Your complete application, built in seconds.</h2>
    <p className="hiro-auth-subtext">
      Paste a job URL. Get a tailored CV, the right contacts, and personalised outreach. All in one place.
    </p>
    <div className="hiro-auth-pills">
      <span className="hiro-auth-pill"><Check /> Tailored CV in seconds</span>
      <span className="hiro-auth-pill"><Check /> LinkedIn contact finder</span>
      <span className="hiro-auth-pill"><Check /> Interview prep kit</span>
    </div>
  </div>
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
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification email resent!");
    }
  }, [canResend, email]);

  if (showUnverified) {
    return (
      <div className="hiro-auth">
        <AuthLeftPanel />
        <div className="hiro-auth-right">
          <div className="hiro-auth-verify">
            <div className="hiro-auth-verify-icon">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="hiro-auth-heading">Verify your email first.</h1>
            <p className="hiro-auth-sub">
              Check your inbox for the verification link we sent to{" "}
              <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>{email}</span>.
            </p>
            <div style={{ fontSize: 14, color: "var(--color-text-muted)" }}>
              {canResend ? (
                <button onClick={handleResend} style={{ color: "var(--color-primary)", fontWeight: 600 }} className="hover:underline">
                  Resend email
                </button>
              ) : (
                <span>Resend available in {resendCooldown}s</span>
              )}
            </div>
            <button
              onClick={() => setShowUnverified(false)}
              className="hiro-auth-switch hover:underline"
              style={{ background: "none", border: "none", cursor: "pointer", marginTop: 24 }}
            >
              ← Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hiro-auth">
      <AuthLeftPanel />
      <div className="hiro-auth-right">
        <div className="hiro-auth-card">
          <div className="hiro-auth-logo">Hiro</div>
          <h1 className="hiro-auth-heading">Welcome back.</h1>
          <p className="hiro-auth-sub">Sign in to your Hiro workspace.</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="hiro-auth-field">
              <label htmlFor="email" className="hiro-auth-label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="hiro-auth-input"
                placeholder="you@example.com"
              />
              {errors.email && <InlineError message={errors.email} />}
            </div>
            <div className="hiro-auth-field">
              <label htmlFor="password" className="hiro-auth-label">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="hiro-auth-input"
                placeholder="••••••••"
              />
              {errors.password && <InlineError message={errors.password} />}
            </div>
            <button type="submit" disabled={loading} className="hiro-auth-submit">
              {loading ? "Signing in..." : "Sign in to Hiro"}
            </button>
          </form>
          <p className="hiro-auth-switch">
            Don't have an account?{" "}
            <Link to="/register">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
