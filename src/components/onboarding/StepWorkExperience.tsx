import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
// 1970 → 2035 so future / planned roles are selectable; dropdown opens at 2026
const CURRENT_YEAR = 2026;
const YEARS_MAIN = Array.from({ length: CURRENT_YEAR - 1970 + 1 }, (_, i) => CURRENT_YEAR - i);
const YEARS_FUTURE = Array.from({ length: 2035 - CURRENT_YEAR }, (_, i) => 2035 - i);

interface WorkBlock {
  companyName: string;
  jobTitle: string;
  location: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  isCurrent: boolean;
  bullets: string[];
}

const emptyBlock = (): WorkBlock => ({
  companyName: "", jobTitle: "", location: "",
  startMonth: "", startYear: "", endMonth: "", endYear: "",
  isCurrent: false, bullets: ["", "", ""],
});

interface Props { userId: string; onNext: () => void; initialData?: import("@/types/cv").ParsedWorkExperience[]; }

const StepWorkExperience = ({ userId, onNext, initialData }: Props) => {
  const [blocks, setBlocks] = useState<WorkBlock[]>(() => {
    if (initialData && initialData.length > 0) {
      return initialData.map(d => ({
        companyName: d.company_name || "",
        jobTitle: d.job_title || "",
        location: d.location || "",
        startMonth: d.start_month || "",
        startYear: d.start_year ? String(d.start_year) : "",
        endMonth: d.end_month || "",
        endYear: d.end_year ? String(d.end_year) : "",
        isCurrent: d.is_current || false,
        bullets: d.bullet_points?.length ? d.bullet_points : ["", "", ""],
      }));
    }
    return [emptyBlock()];
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removeIdx, setRemoveIdx] = useState<number | null>(null);

  const updateBlock = (idx: number, patch: Partial<WorkBlock>) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const addBlock = () => setBlocks((prev) => [...prev, emptyBlock()]);
  const confirmRemove = () => { if (removeIdx !== null) { setBlocks((prev) => prev.filter((_, i) => i !== removeIdx)); setRemoveIdx(null); } };

  const addBullet = (idx: number) => {
    setBlocks((prev) => prev.map((b, i) => i === idx && b.bullets.length < 10 ? { ...b, bullets: [...b.bullets, ""] } : b));
  };

  const updateBullet = (blockIdx: number, bulletIdx: number, value: string) => {
    setBlocks((prev) => prev.map((b, i) => i === blockIdx ? { ...b, bullets: b.bullets.map((bp, j) => j === bulletIdx ? value : bp) } : b));
  };

  const removeBullet = (blockIdx: number, bulletIdx: number) => {
    setBlocks((prev) => prev.map((b, i) => i === blockIdx ? { ...b, bullets: b.bullets.filter((_, j) => j !== bulletIdx) } : b));
  };

  const validate = (): boolean => {
    if (blocks.length === 0) { setError("Please add at least one work experience."); return false; }
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b.companyName.trim()) { setError(`Experience ${i+1}: Company name is required.`); return false; }
      if (!b.jobTitle.trim()) { setError(`Experience ${i+1}: Job title is required.`); return false; }
      if (!b.startMonth || !b.startYear) { setError(`Experience ${i+1}: Start date is required.`); return false; }
      if (!b.isCurrent && (!b.endMonth || !b.endYear)) { setError(`Experience ${i+1}: End date is required (or check "I currently work here").`); return false; }
      if (b.bullets.filter(bp => bp.trim()).length === 0) { setError(`Experience ${i+1}: At least one bullet point is required.`); return false; }
    }
    setError(null); return true;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setSaving(true);
    await supabase.from("work_experiences").delete().eq("user_id", userId);
    const rows = blocks.map((b) => ({
      user_id: userId, company_name: b.companyName.trim(), job_title: b.jobTitle.trim(),
      location: b.location.trim() || null,
      start_month: MONTHS.indexOf(b.startMonth) + 1, start_year: parseInt(b.startYear),
      end_month: b.isCurrent ? null : MONTHS.indexOf(b.endMonth) + 1,
      end_year: b.isCurrent ? null : parseInt(b.endYear),
      is_current: b.isCurrent, bullet_points: b.bullets.filter(bp => bp.trim()),
    }));
    const { error: insertError } = await supabase.from("work_experiences").insert(rows);
    setSaving(false);
    if (insertError) toast.error(insertError.message); else onNext();
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Build your experience bank</h1>
      <p className="mt-1 text-muted-foreground">
        Add every role you might want to draw from. For each application, Hiro will pick the most relevant experience, bullets, and skills — so the more concrete you are here, the sharper your tailored CVs will be.
      </p>

      <div className="mt-6 space-y-6">
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Company Name *</Label>
                <Input value={block.companyName} onChange={(e) => updateBlock(idx, { companyName: e.target.value })} placeholder="Acme Inc." className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label>Job Title *</Label>
                <Input value={block.jobTitle} onChange={(e) => updateBlock(idx, { jobTitle: e.target.value })} placeholder="Marketing Intern" className="rounded-lg" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={block.location} onChange={(e) => updateBlock(idx, { location: e.target.value })} placeholder="e.g. Amsterdam, Netherlands" className="rounded-lg" />
            </div>

            <div>
              <Label>Start Date *</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <Select value={block.startMonth} onValueChange={(v) => updateBlock(idx, { startMonth: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Month" /></SelectTrigger>
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
                <div className="flex items-center gap-1.5 ml-auto">
                  <Checkbox checked={block.isCurrent} onCheckedChange={(v) => updateBlock(idx, { isCurrent: !!v })} id={`current-${idx}`} />
                  <label htmlFor={`current-${idx}`} className="text-sm text-muted-foreground cursor-pointer select-none">I currently work here</label>
                </div>
              </div>
              {!block.isCurrent && (
                <div className="grid grid-cols-2 gap-3">
                  <Select value={block.endMonth} onValueChange={(v) => updateBlock(idx, { endMonth: v })}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Month" /></SelectTrigger>
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

            <div className="space-y-2">
              <Label>Key Responsibilities / Achievements *</Label>
              <p className="text-xs text-muted-foreground">Strong, specific bullets work best — include numbers, tools, and outcomes. These become the building blocks for every future tailored CV.</p>
              {block.bullets.map((bp, bIdx) => (
                <div key={bIdx} className="flex items-start gap-2">
                  <Textarea
                    value={bp}
                    onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                    placeholder="e.g. Led a 4-person team to launch X, increasing Y by 30% in 6 months"
                    className="rounded-lg min-h-[56px]"
                    rows={2}
                  />
                  {bIdx > 0 && (
                    <button type="button" onClick={() => removeBullet(idx, bIdx)} className="shrink-0 mt-2 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {block.bullets.length < 10 && (
                <button type="button" onClick={() => addBullet(idx)} className="text-sm font-medium text-primary">+ Add bullet</button>
              )}
            </div>

            {blocks.length > 0 && (
              <button type="button" onClick={() => setRemoveIdx(idx)} className="text-sm font-medium text-destructive hover:underline">Remove experience</button>
            )}
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlock} className="mt-4 w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add another experience</button>

      {error && <p className="mt-4 flex items-center gap-1.5 text-sm text-destructive"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />{error}</p>}

      <div className="mt-8 flex justify-end">
        <button onClick={handleNext} disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Next →"}
        </button>
      </div>

      <AlertDialog open={removeIdx !== null} onOpenChange={(open) => !open && setRemoveIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this experience?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirm Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StepWorkExperience;
