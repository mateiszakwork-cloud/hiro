import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const START_YEARS = Array.from({ length: 17 }, (_, i) => 2010 + i);
const END_YEARS = Array.from({ length: 21 }, (_, i) => 2010 + i);

interface EduBlock {
  institution: string; degree: string; fieldOfStudy: string;
  startYear: string; endYear: string;
  grade: string; activities: string; description: string;
}

const emptyBlock = (): EduBlock => ({
  institution: "", degree: "", fieldOfStudy: "",
  startYear: "", endYear: "",
  grade: "", activities: "", description: "",
});

interface Props { userId: string; onNext: () => void; onBack: () => void; }

const StepEducation = ({ userId, onNext, onBack }: Props) => {
  const [blocks, setBlocks] = useState<EduBlock[]>([emptyBlock()]);
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
      if (!b.fieldOfStudy.trim()) { setError(`Education ${i+1}: Field of study is required.`); return false; }
    }
    setError(null); return true;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setSaving(true);
    await supabase.from("education").delete().eq("user_id", userId);
    const rows = blocks.map((b) => ({
      user_id: userId, institution: b.institution.trim(), degree: b.degree.trim(),
      field_of_study: b.fieldOfStudy.trim(),
      start_year: b.startYear ? parseInt(b.startYear) : new Date().getFullYear(),
      end_year: b.endYear === "expected" || !b.endYear ? null : parseInt(b.endYear),
      is_expected: b.endYear === "expected",
      grade: b.grade.trim() || null,
      activities: b.activities.trim() || null,
      description: b.description.trim() || null,
    }));
    const { error: insertError } = await supabase.from("education").insert(rows);
    setSaving(false);
    if (insertError) toast.error(insertError.message); else onNext();
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Your educational background</h1>
      <p className="mt-1 text-muted-foreground">Add your degrees and institutions.</p>

      <div className="mt-6 space-y-6">
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
            <div className="space-y-1.5">
              <Label>Institution Name *</Label>
              <Input value={block.institution} onChange={(e) => updateBlock(idx, { institution: e.target.value })} placeholder="e.g. Rotterdam School of Management" className="rounded-lg" />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Degree *</Label>
                <Input value={block.degree} onChange={(e) => updateBlock(idx, { degree: e.target.value })} placeholder="e.g. Master of Science" className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label>Field of Study *</Label>
                <Input value={block.fieldOfStudy} onChange={(e) => updateBlock(idx, { fieldOfStudy: e.target.value })} placeholder="e.g. Management in International Context" className="rounded-lg" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Start Year</Label>
                <Select value={block.startYear} onValueChange={(v) => updateBlock(idx, { startYear: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>{START_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>End Year</Label>
                <Select value={block.endYear} onValueChange={(v) => updateBlock(idx, { endYear: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>{END_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}<SelectItem value="expected">Expected</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Grade / GPA</Label>
                <Input value={block.grade} onChange={(e) => updateBlock(idx, { grade: e.target.value })} placeholder="e.g. 3.8 / 4.0" className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label>Activities and Societies</Label>
                <Input value={block.activities} onChange={(e) => updateBlock(idx, { activities: e.target.value })} placeholder="e.g. CEMS Club, Student Council" className="rounded-lg" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={block.description} onChange={(e) => updateBlock(idx, { description: e.target.value })} placeholder="Additional context about your studies, thesis, or achievements" className="rounded-lg" rows={3} />
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
