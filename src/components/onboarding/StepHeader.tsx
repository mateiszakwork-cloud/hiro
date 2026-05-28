import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  email: string;
  onNext: () => void;
}

const StepHeader = ({ userId, email, onNext }: Props) => {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [defaultLocation, setDefaultLocation] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, linkedin_url, default_location")
        .eq("id", userId)
        .single();
      if (cancelled) return;
      if (data) {
        setFullName(data.full_name || "");
        setPhone((data as any).phone || "");
        setLinkedinUrl((data as any).linkedin_url || "");
        setDefaultLocation((data as any).default_location || "");
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleNext = async () => {
    if (!fullName.trim()) { setError("Full name is required."); return; }
    setError(null);
    setSaving(true);
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
        default_location: defaultLocation.trim() || null,
      } as any)
      .eq("id", userId);
    setSaving(false);
    if (updateError) { toast.error(updateError.message); return; }
    onNext();
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Your CV header</h1>
      <p className="mt-1 text-muted-foreground">
        These appear at the top of every CV you export from Hiro. You can edit them later in your profile.
      </p>

      {loading ? (
        <div className="mt-6 h-40 animate-pulse rounded-md bg-muted" />
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Full name *</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Doe" className="rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={email} disabled className="rounded-lg bg-muted/40 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+44 7700 900123" className="rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label>LinkedIn URL</Label>
            <Input value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="linkedin.com/in/your-handle" className="rounded-lg" />
          </div>
          <div className="space-y-1.5">
            <Label>Default location</Label>
            <Input value={defaultLocation} onChange={(e) => setDefaultLocation(e.target.value)} placeholder="London, UK" className="rounded-lg" />
          </div>
        </div>
      )}

      {error && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}
        </p>
      )}

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleNext}
          disabled={saving || loading}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Continue →"}
        </button>
      </div>
    </div>
  );
};

export default StepHeader;