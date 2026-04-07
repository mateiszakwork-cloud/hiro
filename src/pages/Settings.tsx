import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Eye, EyeOff, AlertTriangle, CheckCircle2, Circle } from "lucide-react";

const Settings = () => {
  const [cookie, setCookie] = useState("");
  const [savedCookie, setSavedCookie] = useState<string | null>(null);
  const [showCookie, setShowCookie] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .select("linkedin_cookie")
        .eq("id", session.user.id)
        .single();
      if (data?.linkedin_cookie) {
        setCookie(data.linkedin_cookie);
        setSavedCookie(data.linkedin_cookie);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSaving(false); return; }
    const { error } = await supabase
      .from("profiles")
      .update({ linkedin_cookie: cookie.trim() || null } as any)
      .eq("id", session.user.id);
    setSaving(false);
    if (error) {
      toast("Failed to save. Please try again.");
    } else {
      setSavedCookie(cookie.trim() || null);
      toast("LinkedIn connected");
    }
  };

  const isConnected = !!savedCookie;

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
              {isConnected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">LinkedIn connected</span>
                </>
              ) : (
                <>
                  <Circle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-muted-foreground">Not connected</span>
                </>
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium text-foreground mb-3">How to find your LinkedIn session cookie:</p>
            <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
              <li>Open <strong>linkedin.com</strong> in Chrome and make sure you're logged in</li>
              <li>Right-click anywhere on the page and click <strong>Inspect</strong></li>
              <li>Go to the <strong>Application</strong> tab in DevTools</li>
              <li>In the left sidebar, expand <strong>Cookies → https://www.linkedin.com</strong></li>
              <li>Find the cookie named <strong>li_at</strong> and copy its <strong>Value</strong></li>
            </ol>
          </div>

          {/* Input */}
          <div className="space-y-2">
            <Label htmlFor="li-cookie" className="text-sm font-medium">
              LinkedIn Session Cookie (li_at)
            </Label>
            <div className="relative">
              <Input
                id="li-cookie"
                type={showCookie ? "text" : "password"}
                value={cookie}
                onChange={(e) => setCookie(e.target.value)}
                placeholder="Paste your li_at cookie value here"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCookie(!showCookie)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCookie ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !cookie.trim()}
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
