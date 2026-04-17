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

const Register = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showVerification, setShowVerification] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!showVerification) return;
    if (resendCooldown <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showVerification, resendCooldown]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Full name is required";
    if (!email.trim()) e.email = "Email is required";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Password must be at least 6 characters";
    if (!confirmPassword) e.confirmPassword = "Please confirm your password";
    else if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: fullName.trim() },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.user) {
      await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", data.user.id);
    }
    setShowVerification(true);
    setResendCooldown(60);
    setCanResend(false);
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

  if (showVerification) {
    return (
      <div className="hiro-auth">
        <AuthLeftPanel />
        <div className="hiro-auth-right">
          <div className="hiro-auth-verify">
            <div className="hiro-auth-verify-icon">
              <Mail className="h-6 w-6" />
            </div>
            <h1 className="hiro-auth-heading">Check your email.</h1>
            <p className="hiro-auth-sub">
              We sent a verification link to <span className="font-medium" style={{ color: "var(--color-text-primary)" }}>{email}</span>. Click it to activate your account.
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
            <p className="hiro-auth-switch">
              Already verified? <Link to="/login">Log in</Link>
            </p>
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
          <h1 className="hiro-auth-heading">Create your account.</h1>
          <p className="hiro-auth-sub">Start your free account. No credit card needed.</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className="hiro-auth-field">
              <label htmlFor="fullName" className="hiro-auth-label">Full Name</label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="hiro-auth-input"
                placeholder="John Doe"
              />
              {errors.fullName && <InlineError message={errors.fullName} />}
            </div>
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
            <div className="hiro-auth-field">
              <label htmlFor="confirmPassword" className="hiro-auth-label">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="hiro-auth-input"
                placeholder="••••••••"
              />
              {errors.confirmPassword && <InlineError message={errors.confirmPassword} />}
            </div>
            <button type="submit" disabled={loading} className="hiro-auth-submit">
              {loading ? "Creating..." : "Create my account"}
            </button>
          </form>
          <p className="hiro-auth-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
