import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Zap } from "lucide-react";

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [contactsThisMonth, setContactsThisMonth] = useState<number>(0);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }

      // Estimate credits used this month via contacts created since the 1st
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .gte("created_at", monthStart.toISOString());

      setContactsThisMonth(count ?? 0);
      setLoading(false);
    };
    load();
  }, []);

  // Each contact roughly costs: 1 search call shared across ~6 contacts + 1 profile call per top contact.
  // Estimate: ~2 credits per contact saved.
  const estimatedCredits = contactsThisMonth * 2;

  if (loading) {
    return (
      <div className="-m-8">
        <div className="hiro-page-header">
          <h1 className="hiro-page-title">Settings</h1>
          <p className="hiro-page-subtext">Manage your account and integrations</p>
        </div>
        <div className="hiro-page-content">
          <div className="hiro-page-content-inner animate-pulse space-y-4">
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-m-8">
      <div className="hiro-page-header">
        <h1 className="hiro-page-title">Settings</h1>
        <p className="hiro-page-subtext">Manage your account and integrations</p>
      </div>

      <div className="hiro-page-content">
        <div className="hiro-page-content-inner">
          <div className="hiro-section-card">
            <div className="hiro-section-card-header">
              <div className="hiro-section-card-title-wrap">
                <span className="hiro-section-accent-bar" />
                <h2 className="hiro-section-card-title">LinkedIn Search</h2>
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="hiro-li-status-row">
                <CheckCircle2 className="h-4 w-4" style={{ color: "#15803D" }} />
                <span className="text-sm font-semibold" style={{ color: "#15803D" }}>
                  LinkedIn search active
                </span>
              </div>

              <p className="text-sm text-muted-foreground">
                LinkedIn search is powered by RapidAPI. No login or cookies required — Hiro automatically
                surfaces relevant contacts at your target companies whenever you run a search.
              </p>

              <div
                className="rounded-lg border p-5 flex items-start gap-4"
                style={{ borderColor: "var(--color-border)", background: "#FAFBFC" }}
              >
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: "#FFF5F5" }}
                >
                  <Zap className="h-5 w-5" style={{ color: "#950606" }} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground mb-1">
                    Search credits used this month
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Estimated based on the contacts you've discovered since the 1st of this month.
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-foreground">
                      ~{estimatedCredits}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      credits ({contactsThisMonth} contacts found)
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Credits reset on the 1st of each month. If you hit your limit, searches will pause until
                the next reset or until your RapidAPI plan is upgraded.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
