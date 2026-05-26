import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PROFICIENCIES = ["Basic", "Conversational", "Professional Working", "Fluent", "Native"];

interface LangRow { name: string; proficiency: string; }
const emptyRow = (): LangRow => ({ name: "", proficiency: "" });

interface Props { userId: string; onBack: () => void; onNext: () => void; initialData?: import("@/types/cv").ParsedLanguage[]; }

const StepLanguages = ({ userId, onBack, onNext, initialData }: Props) => {
  const [rows, setRows] = useState<LangRow[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map(d => ({ name: d.name || "", proficiency: d.proficiency || "" }));
    }
    return [emptyRow()];
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateRow = (idx: number, patch: Partial<LangRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows(prev => [...prev, emptyRow()]);
  const removeRow = (idx: number) => setRows(prev => prev.filter((_, i) => i !== idx));

  const validate = (): boolean => {
    if (rows.length === 0) { setError("Please add at least one language."); return false; }
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].name.trim()) { setError(`Language ${i+1}: Name is required.`); return false; }
      if (!rows[i].proficiency) { setError(`Language ${i+1}: Proficiency level is required.`); return false; }
    }
    setError(null); return true;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setSaving(true);
    await supabase.from("languages").delete().eq("user_id", userId);
    const langRows = rows.map(r => ({ user_id: userId, language_name: r.name.trim(), proficiency: r.proficiency }));
    const { error: insertError } = await supabase.from("languages").insert(langRows);
    if (insertError) { setSaving(false); toast.error(insertError.message); return; }
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ onboarding_complete: true })
      .eq("id", userId);
    if (profileError) { setSaving(false); toast.error(profileError.message); return; }
    setSaving(false);
    onNext();
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Languages you speak</h1>
      <p className="mt-1 text-muted-foreground">Include every language you could work in — Hiro uses this when a role asks for specific language requirements.</p>

      <div className="mt-6 space-y-4">
        {rows.map((row, idx) => (
          <div key={idx} className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              {idx === 0 && <Label>Language</Label>}
              <Input value={row.name} onChange={(e) => updateRow(idx, { name: e.target.value })} placeholder="e.g. English" className="rounded-lg" />
            </div>
            <div className="flex-1 space-y-1.5">
              {idx === 0 && <Label>Proficiency</Label>}
              <Select value={row.proficiency} onValueChange={(v) => updateRow(idx, { proficiency: v })}>
                <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select level" /></SelectTrigger>
                <SelectContent>{PROFICIENCIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <button type="button" onClick={() => removeRow(idx)} className="mb-1 shrink-0 text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addRow} className="mt-4 text-sm font-medium text-primary hover:underline">+ Add language</button>

      {error && <p className="mt-4 flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}</p>}

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back</button>
        <button onClick={handleNext} disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Finish setup →"}
        </button>
      </div>
    </div>
  );
};

export default StepLanguages;
