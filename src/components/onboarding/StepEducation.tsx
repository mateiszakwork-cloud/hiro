import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
// 1970 → 2035 so future expected graduation years are selectable; dropdown opens at 2026
const CURRENT_YEAR = 2026;
const YEARS_MAIN = Array.from({ length: CURRENT_YEAR - 1970 + 1 }, (_, i) => CURRENT_YEAR - i);
const YEARS_FUTURE = Array.from({ length: 2035 - CURRENT_YEAR }, (_, i) => 2035 - i);
const LEVELS = ["High school", "Bachelor's", "Master's", "MBA", "PhD", "Exchange", "Certificate", "Other"];

interface EduBlock {
  institution: string; degree: string; levelOfStudy: string;
  startMonth: string; startYear: string;
  endMonth: string; endYear: string; isExpected: boolean;
  grade: string; description: string;
}

const emptyBlock = (): EduBlock => ({
  institution: "", degree: "", levelOfStudy: "",
  startMonth: "", startYear: "",
  endMonth: "", endYear: "", isExpected: false,
  grade: "", description: "",
});

interface Props { userId: string; onNext: () => void; onBack: () => void; initialData?: import("@/types/cv").ParsedEducation[]; }

const StepEducation = ({ userId, onNext, onBack, initialData }: Props) => {
  const [blocks, setBlocks] = useState<EduBlock[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map(d => ({
        institution: d.institution || "",
        degree: d.degree || "",
        levelOfStudy: "",
        startMonth: "",
        startYear: d.start_year ? String(d.start_year) : "",
        endMonth: "",
        endYear: d.end_year ? String(d.end_year) : "",
        isExpected: false,
        grade: d.grade || "",
        description: d.description || "",
      }));
    }
    return [emptyBlock()];
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateBlock = (idx: number, patch: Partial<EduBlock>) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const addBlock = () => setBlocks((prev) => [...prev, emptyBlock()]);
  const removeBlock = (idx: number) => setBlocks((prev) => prev.filter((_, i) => i !== idx));

  const validate = (): boolean => {
    if (blocks.length === 0) { setError("Please add at least one education entry."); return false; }
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b.institution.trim()) { setError(`Education ${i+1}: Institution name is required.`); return false; }
      if (!b.degree.trim()) { setError(`Education ${i+1}: Degree is required.`); return false; }
      if (!b.levelOfStudy) { setError(`Education ${i+1}: Level of study is required.`); return false; }
      if (!b.startYear) { setError(`Education ${i+1}: Start year is required.`); return false; }
    }
    setError(null); return true;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setSaving(true);
    await supabase.from("education").delete().eq("user_id", userId);
    const rows = blocks.map((b) => ({
      user_id: userId,
      institution: b.institution.trim(),
      degree: b.degree.trim(),
      level_of_study: b.levelOfStudy,
      start_month: b.startMonth ? MONTHS.indexOf(b.startMonth) + 1 : null,
      start_year: parseInt(b.startYear),
      end_month: b.isExpected || !b.endMonth ? null : MONTHS.indexOf(b.endMonth) + 1,
      end_year: b.isExpected || !b.endYear ? null : parseInt(b.endYear),
      is_expected: b.isExpected,
      grade: b.grade.trim() || null,
      description: b.description.trim() || null,
    } as any));
    const { error: insertError } = await supabase.from("education").insert(rows);
    setSaving(false);
    if (insertError) toast.error(insertError.message); else onNext();
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Your education</h1>
      <p className="mt-1 text-muted-foreground">Add the schools and degrees Hiro should mention when tailoring your CV.</p>

      <div className="mt-6 space-y-6">
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Institution Name *</Label>
              <Input value={block.institution} onChange={(e) => updateBlock(idx, { institution: e.target.value })} placeholder="e.g. Rotterdam School of Management" className="rounded-lg" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Level of study *</Label>
                <Select value={block.levelOfStudy} onValueChange={(v) => updateBlock(idx, { levelOfStudy: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Degree / programme *</Label>
                <Input value={block.degree} onChange={(e) => updateBlock(idx, { degree: e.target.value })} placeholder="e.g. MSc International Management" className="rounded-lg" />
              </div>
            </div>

            <div>
              <Label>Start Date *</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <Select value={block.startMonth} onValueChange={(v) => updateBlock(idx, { startMonth: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Month (optional)" /></SelectTrigger>
                  <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={block.startYear} onValueChange={(v) => updateBlock(idx, { startYear: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    {YEARS_MAIN.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Future</SelectLabel>
                      {YEARS_FUTURE.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Label>End Date</Label>
                <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer select-none">
                  <input type="checkbox" checked={block.isExpected} onChange={(e) => updateBlock(idx, { isExpected: e.target.checked })} />
                  Ongoing
                </label>
              </div>
              {!block.isExpected && (
                <div className="grid grid-cols-2 gap-3">
                  <Select value={block.endMonth} onValueChange={(v) => updateBlock(idx, { endMonth: v })}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Month (optional)" /></SelectTrigger>
                    <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={block.endYear} onValueChange={(v) => updateBlock(idx, { endYear: v })}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent>
                      {YEARS_MAIN.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Future</SelectLabel>
                        {YEARS_FUTURE.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Grade / GPA</Label>
              <Input value={block.grade} onChange={(e) => updateBlock(idx, { grade: e.target.value })} placeholder="e.g. 3.8 / 4.0" className="rounded-lg" />
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={block.description} onChange={(e) => updateBlock(idx, { description: e.target.value })} placeholder="Optional: thesis topic, relevant coursework, or notable achievements" className="rounded-lg" rows={3} />
            </div>

            {blocks.length > 0 && (
              <button type="button" onClick={() => removeBlock(idx)} className="text-sm font-medium text-destructive hover:underline">Remove education</button>
            )}
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlock} className="mt-4 w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add another education</button>

      {error && <p className="mt-4 flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}</p>}

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back</button>
        <button onClick={handleNext} disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Next →"}
        </button>
      </div>
    </div>
  );
};

export default StepEducation;
