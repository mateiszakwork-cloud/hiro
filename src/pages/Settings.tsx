import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const Settings = () => {
  const [cookie, setCookie] = useState("");
  const [jsessionid, setJsessionid] = useState("");
  const [savedCookie, setSavedCookie] = useState<string | null>(null);
  const [savedJsessionid, setSavedJsessionid] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("linkedin_cookie, linkedin_jsessionid")
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
    const { error } = await supabase
      .from("profiles")
      .update({ linkedin_cookie: trimmedCookie || null, linkedin_jsessionid: trimmedSession || null } as any)
      .eq("id", session.user.id);
    setSaving(false);
    if (error) {
      toast("Failed to save. Please try again.");
    } else {
      setSavedCookie(trimmedCookie || null);
      setSavedJsessionid(trimmedSession || null);
      toast("LinkedIn connected");
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Sora, sans-serif" }}>Settings</h1>
      </div>

      <Card className="border-0 shadow-md">
        <CardContent className="p-6 space-y-6">
          {/* Header + status */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground" style={{ fontFamily: "Sora, sans-serif" }}>
                Connect your LinkedIn
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Hiro uses your LinkedIn session to search for contacts at target companies, see your connection degrees, and identify alumni from your own schools.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 mt-1">
              {isFullyConnected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">LinkedIn connected</span>
                </>
              ) : isPartial ? (
                <>
                  <AlertTriangle className="h-4 w-4" style={{ color: "#D97706" }} />
                  <span className="text-sm font-medium" style={{ color: "#D97706" }}>Partially configured</span>
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-muted-foreground">Not connected</span>
                </>
              )}
            </div>
          </div>

          {isPartial && missingField && (
            <div className="flex gap-3 items-start rounded-lg p-3" style={{ backgroundColor: "#FFFBEB" }}>
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#D97706" }} />
              <p className="text-sm" style={{ color: "#92400E" }}>
                Please also add your {missingField} to enable LinkedIn search.
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground mb-3">How to find your LinkedIn session cookies:</p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Open <strong>linkedin.com</strong> in Chrome and make sure you are logged in</li>
              <li>Right click anywhere on the page and click <strong>Inspect</strong> (or press F12)</li>
              <li>In the DevTools panel that opens, click the <strong>Application</strong> tab at the top</li>
              <li>In the left sidebar, click <strong>Cookies</strong>, then click <strong>https://www.linkedin.com</strong></li>
              <li>Find the cookie named <strong>li_at</strong> in the list. Click on it and copy the entire <strong>Value</strong> — it is a long string starting with AQED</li>
              <li>In the same list, find the cookie named <strong>JSESSIONID</strong>. Copy its entire <strong>Value</strong> — it starts with <strong>ajax:</strong> followed by numbers and letters</li>
            </ol>
          </div>

          {/* Tip */}
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              💡 Tip: The cookie list can be long. Use Ctrl+F (or Cmd+F on Mac) to search for 'li_at' and 'JSESSIONID' to find them quickly.
            </p>
          </div>

          {/* li_at Input */}
          <div className="space-y-2">
            <Label htmlFor="li-cookie" className="text-sm font-medium">
              li_at Cookie
            </Label>
            <Textarea
              id="li-cookie"
              rows={4}
              value={cookie}
              onChange={(e) => setCookie(e.target.value)}
              placeholder="Paste your li_at value here — starts with AQED..."
              className="text-sm"
            />
          </div>

          {/* JSESSIONID Input */}
          <div className="space-y-2">
            <Label htmlFor="jsessionid" className="text-sm font-medium">
              JSESSIONID Cookie
            </Label>
            <Input
              id="jsessionid"
              type="text"
              value={jsessionid}
              onChange={(e) => setJsessionid(e.target.value)}
              placeholder="Paste your JSESSIONID value here — starts with ajax:..."
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This is required for LinkedIn to accept Hiro's requests. Without it, searches will fail.
            </p>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || (!cookie.trim() && !jsessionid.trim())}
            className="text-white"
            style={{ backgroundColor: "#950606" }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>

          {/* Warning */}
          <div className="flex gap-3 items-start rounded-lg p-4" style={{ backgroundColor: "#FFFBEB" }}>
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#D97706" }} />
            <p className="text-sm" style={{ color: "#92400E" }}>
              For personal use only. Avoid running more than 50 searches per day to keep your LinkedIn account safe.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Settings;
