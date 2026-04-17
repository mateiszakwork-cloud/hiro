import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const formatUpdatedAt = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  let hour = d.getHours();
  const ampm = hour >= 12 ? "pm" : "am";
  hour = hour % 12 || 12;
  const min = d.getMinutes();
  const time = min === 0 ? `${hour}${ampm}` : `${hour}:${min.toString().padStart(2, "0")}${ampm}`;
  return `${date} at ${time}`;
};

const Settings = () => {
  const [cookie, setCookie] = useState("");
  const [jsessionid, setJsessionid] = useState("");
  const [savedCookie, setSavedCookie] = useState<string | null>(null);
  const [savedJsessionid, setSavedJsessionid] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("linkedin_cookie, linkedin_jsessionid, linkedin_updated_at")
        .eq("id", session.user.id)
        .single();
      if (data?.linkedin_cookie) {
        setCookie(data.linkedin_cookie);
        setSavedCookie(data.linkedin_cookie);
      }
      if ((data as any)?.linkedin_jsessionid) {
        setJsessionid((data as any).linkedin_jsessionid);
        setSavedJsessionid((data as any).linkedin_jsessionid);
      }
      if ((data as any)?.linkedin_updated_at) {
        setUpdatedAt((data as any).linkedin_updated_at);
      }
      setLoading(false);
    };
    load();
  }, []);

  const isLiAtValid = (v: string) => v.trim().length >= 50;
  const isJsessionValid = (v: string) => v.trim().startsWith("ajax:");

  const handleSave = async () => {
    const trimmedCookie = cookie.trim();
    const trimmedSession = jsessionid.trim();

    if (trimmedCookie && !isLiAtValid(trimmedCookie)) {
      toast("The li_at cookie looks too short. Make sure you copied the full value.");
      return;
    }
    if (trimmedSession && !isJsessionValid(trimmedSession)) {
      toast("The JSESSIONID should start with 'ajax:'. Please check the value.");
      return;
    }
    if (!trimmedCookie && !trimmedSession) {
      toast("Please paste at least one cookie value.");
      return;
    }

    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("profiles")
      .update({
        linkedin_cookie: trimmedCookie || null,
        linkedin_jsessionid: trimmedSession || null,
        linkedin_updated_at: now,
      } as any)
      .eq("id", session.user.id);
    setSaving(false);
    if (error) {
      toast("Failed to save. Please try again.");
    } else {
      setSavedCookie(trimmedCookie || null);
      setSavedJsessionid(trimmedSession || null);
      setUpdatedAt(now);
      setTestResult(null);
      toast("LinkedIn connected");
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session) { setTesting(false); return; }
      const { data, error } = await supabase.functions.invoke("test-linkedin-connection", {
        body: { user_id: session.user.id },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error || !data?.success) {
        setTestResult({ ok: false, message: "Connection failed - please refresh your cookies" });
      } else {
        setTestResult({ ok: true, message: "Connection working" });
      }
    } catch {
      setTestResult({ ok: false, message: "Connection failed - please refresh your cookies" });
    } finally {
      setTesting(false);
    }
  };

  const cookieValid = !!savedCookie && isLiAtValid(savedCookie);
  const sessionValid = !!savedJsessionid && isJsessionValid(savedJsessionid);
  const isFullyConnected = cookieValid && sessionValid;
  const isPartial = (cookieValid && !sessionValid) || (!cookieValid && sessionValid);

  const missingField = cookieValid && !sessionValid
    ? "JSESSIONID"
    : !cookieValid && sessionValid
      ? "li_at cookie"
      : null;

  if (loading) {
    return (
      <div className="-m-8">
        <div className="hiro-page-header">
          <h1 className="hiro-page-title">Settings</h1>
          <p className="hiro-page-subtext">Manage your LinkedIn connection and account preferences</p>
        </div>
        <div className="hiro-page-content">
          <div className="hiro-page-content-inner animate-pulse space-y-4">
            <div className="h-64 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-8">
      {/* Page Header */}
      <div className="hiro-page-header">
        <h1 className="hiro-page-title">Settings</h1>
        <p className="hiro-page-subtext">Manage your LinkedIn connection and account preferences</p>
      </div>

      <div className="hiro-page-content">
        <div className="hiro-page-content-inner">
          <div className="hiro-section-card">
            <div className="hiro-section-card-header">
              <div className="hiro-section-card-title-wrap">
                <span className="hiro-section-accent-bar" />
                <h2 className="hiro-section-card-title">LinkedIn Connection</h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Status row */}
              <div className="hiro-li-status-row">
                {isFullyConnected ? (
                  <>
                    <span className="hiro-li-dot-connected" />
                    <span className="text-sm font-semibold" style={{ color: "#15803D" }}>LinkedIn connected</span>
                    {updatedAt && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        Last updated: {formatUpdatedAt(updatedAt)}
                      </span>
                    )}
                  </>
                ) : isPartial ? (
                  <>
                    <AlertTriangle className="h-4 w-4" style={{ color: "#D97706" }} />
                    <span className="text-sm font-medium" style={{ color: "#D97706" }}>Partially configured</span>
                  </>
                ) : (
                  <>
                    <span className="hiro-li-dot-disconnected" />
                    <span className="text-sm font-medium text-muted-foreground">Not connected</span>
                  </>
                )}
              </div>

              <p className="text-sm text-muted-foreground -mt-2">
                Hiro uses your LinkedIn session to search for contacts at target companies, see your connection degrees, and identify alumni from your own schools.
              </p>

              {isPartial && missingField && (
                <div className="hiro-warning-card">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                  <p>Please also add your {missingField} to enable LinkedIn search.</p>
                </div>
              )}

              {/* Instructions */}
              <div className="hiro-instructions-panel">
                <p className="hiro-instructions-heading">
                  How to find your LinkedIn session cookies
                </p>
                <ol className="hiro-instructions-list">
                  <li><span className="hiro-step-num">1</span><span>Open <code>linkedin.com</code> in Chrome and make sure you are logged in</span></li>
                  <li><span className="hiro-step-num">2</span><span>Right click anywhere on the page and click <strong>Inspect</strong> (or press F12)</span></li>
                  <li><span className="hiro-step-num">3</span><span>In the DevTools panel that opens, click the <strong>Application</strong> tab at the top</span></li>
                  <li><span className="hiro-step-num">4</span><span>In the left sidebar, click <strong>Cookies</strong>, then click <code>https://www.linkedin.com</code></span></li>
                  <li><span className="hiro-step-num">5</span><span>Find the cookie named <code>li_at</code>. Click on it and copy the entire <strong>Value</strong> — a long string starting with <code>AQED</code></span></li>
                  <li><span className="hiro-step-num">6</span><span>In the same list, find the cookie named <code>JSESSIONID</code>. Copy its entire <strong>Value</strong> — it starts with <code>ajax:</code></span></li>
                </ol>
                <div className="hiro-warning-card mt-1">
                  <span>💡</span>
                  <p>Tip: Use Ctrl+F (or Cmd+F on Mac) to search for 'li_at' and 'JSESSIONID' to find them quickly.</p>
                </div>
              </div>

              {/* li_at Input */}
              <div>
                <label htmlFor="li-cookie" className="hiro-field-label" style={{ marginBottom: 8 }}>
                  li_at Cookie
                </label>
                <textarea
                  id="li-cookie"
                  rows={4}
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                  placeholder="Paste your li_at value here — starts with AQED..."
                  className="hiro-cookie-textarea"
                />
              </div>

              {/* JSESSIONID Input */}
              <div>
                <label htmlFor="jsessionid" className="hiro-field-label" style={{ marginBottom: 8 }}>
                  JSESSIONID Cookie
                </label>
                <textarea
                  id="jsessionid"
                  rows={2}
                  value={jsessionid}
                  onChange={(e) => setJsessionid(e.target.value)}
                  placeholder="Paste your JSESSIONID value here — starts with ajax:..."
                  className="hiro-cookie-textarea"
                  style={{ minHeight: 56 }}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  This is required for LinkedIn to accept Hiro's requests. Without it, searches will fail.
                </p>
              </div>

              {/* Save / Test row */}
              <div className="flex items-center gap-2.5 flex-wrap pt-5 border-t" style={{ borderColor: "var(--color-border)" }}>
                <button
                  onClick={handleSave}
                  disabled={saving || (!cookie.trim() && !jsessionid.trim())}
                  className="hiro-next-btn"
                  style={{ padding: "10px 28px" }}
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing || !isFullyConnected}
                  className="hiro-test-btn"
                >
                  {testing ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Testing…</>
                  ) : (
                    "Test LinkedIn Connection"
                  )}
                </button>
                {testResult && (
                  <span className={`flex items-center gap-1.5 text-sm font-medium ml-auto ${testResult.ok ? "" : ""}`} style={{ color: testResult.ok ? "#15803D" : "#991B1B" }}>
                    {testResult.ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.message}
                  </span>
                )}
              </div>

              {/* Warning */}
              <div className="hiro-warning-card">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#D97706" }} />
                <p>For personal use only. Avoid running more than 50 searches per day to keep your LinkedIn account safe.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
