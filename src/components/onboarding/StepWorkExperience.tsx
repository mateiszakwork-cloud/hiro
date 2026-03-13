import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const YEARS = Array.from({ length: 12 }, (_, i) => 2015 + i);

interface WorkBlock {
  companyName: string;
  jobTitle: string;
  startMonth: string;
  startYear: string;
  endMonth: string;
  endYear: string;
  isCurrent: boolean;
  bullets: string[];
}

const emptyBlock = (): WorkBlock => ({
  companyName: "",
  jobTitle: "",
  startMonth: "",
  startYear: "",
  endMonth: "",
  endYear: "",
  isCurrent: false,
  bullets: [""],
});

interface Props {
  userId: string;
  onNext: () => void;
}

const StepWorkExperience = ({ userId, onNext }: Props) => {
  const [blocks, setBlocks] = useState<WorkBlock[]>([emptyBlock()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const updateBlock = (idx: number, patch: Partial<WorkBlock>) => {
    setBlocks((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const addBlock = () => setBlocks((prev) => [...prev, emptyBlock()]);

  const removeBlock = (idx: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== idx));
  };

  const addBullet = (idx: number) => {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === idx && b.bullets.length < 6
          ? { ...b, bullets: [...b.bullets, ""] }
          : b
      )
    );
  };

  const updateBullet = (blockIdx: number, bulletIdx: number, value: string) => {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? { ...b, bullets: b.bullets.map((bp, j) => (j === bulletIdx ? value : bp)) }
          : b
      )
    );
  };

  const removeBullet = (blockIdx: number, bulletIdx: number) => {
    setBlocks((prev) =>
      prev.map((b, i) =>
        i === blockIdx
          ? { ...b, bullets: b.bullets.filter((_, j) => j !== bulletIdx) }
          : b
      )
    );
  };

  const validate = (): boolean => {
    if (blocks.length === 0) {
      setError("Please add at least one work experience.");
      return false;
    }
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (!b.companyName.trim()) {
        setError(`Experience ${i + 1}: Company name is required.`);
        return false;
      }
      if (!b.jobTitle.trim()) {
        setError(`Experience ${i + 1}: Job title is required.`);
        return false;
      }
      if (!b.startMonth || !b.startYear) {
        setError(`Experience ${i + 1}: Start date is required.`);
        return false;
      }
      if (!b.isCurrent && (!b.endMonth || !b.endYear)) {
        setError(`Experience ${i + 1}: End date is required (or check "I currently work here").`);
        return false;
      }
      const nonEmpty = b.bullets.filter((bp) => bp.trim().length > 0);
      if (nonEmpty.length === 0) {
        setError(`Experience ${i + 1}: At least one bullet point is required.`);
        return false;
      }
    }
    setError(null);
    return true;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setSaving(true);

    // Delete existing entries for this user then re-insert
    await supabase.from("work_experiences").delete().eq("user_id", userId);

    const rows = blocks.map((b) => ({
      user_id: userId,
      company_name: b.companyName.trim(),
      job_title: b.jobTitle.trim(),
      start_month: MONTHS.indexOf(b.startMonth) + 1,
      start_year: parseInt(b.startYear),
      end_month: b.isCurrent ? null : MONTHS.indexOf(b.endMonth) + 1,
      end_year: b.isCurrent ? null : parseInt(b.endYear),
      is_current: b.isCurrent,
      bullet_points: b.bullets.filter((bp) => bp.trim().length > 0),
    }));

    const { error: insertError } = await supabase.from("work_experiences").insert(rows);

    setSaving(false);
    if (insertError) {
      toast.error(insertError.message);
    } else {
      onNext();
    }
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Tell us about your experience</h1>
      <p className="mt-1 text-muted-foreground">
        Add your work history. Be detailed with your bullet points, as the AI will use them to tailor your CV.
      </p>

      <div className="mt-6 space-y-6">
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
            {/* Company & Job Title */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Company Name *</Label>
                <Input
                  value={block.companyName}
                  onChange={(e) => updateBlock(idx, { companyName: e.target.value })}
                  placeholder="Acme Inc."
                  className="rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Job Title *</Label>
                <Input
                  value={block.jobTitle}
                  onChange={(e) => updateBlock(idx, { jobTitle: e.target.value })}
                  placeholder="Marketing Intern"
                  className="rounded-lg"
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <Label>Start Date *</Label>
              <div className="mt-1.5 grid grid-cols-2 gap-3">
                <Select value={block.startMonth} onValueChange={(v) => updateBlock(idx, { startMonth: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Month" /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={block.startYear} onValueChange={(v) => updateBlock(idx, { startYear: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* End Date */}
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Label>End Date</Label>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Checkbox
                    checked={block.isCurrent}
                    onCheckedChange={(v) => updateBlock(idx, { isCurrent: !!v })}
                    id={`current-${idx}`}
                  />
                  <label htmlFor={`current-${idx}`} className="text-sm text-muted-foreground cursor-pointer select-none">
                    I currently work here
                  </label>
                </div>
              </div>
              {!block.isCurrent && (
                <div className="grid grid-cols-2 gap-3">
                  <Select value={block.endMonth} onValueChange={(v) => updateBlock(idx, { endMonth: v })}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Month" /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={block.endYear} onValueChange={(v) => updateBlock(idx, { endYear: v })}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Bullet Points */}
            <div className="space-y-2">
              <Label>Key Responsibilities / Achievements *</Label>
              {block.bullets.map((bp, bIdx) => (
                <div key={bIdx} className="flex items-center gap-2">
                  <Input
                    value={bp}
                    onChange={(e) => updateBullet(idx, bIdx, e.target.value)}
                    placeholder="Describe a key responsibility or achievement..."
                    className="rounded-lg"
                  />
                  {bIdx > 0 && (
                    <button
                      type="button"
                      onClick={() => removeBullet(idx, bIdx)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              {block.bullets.length < 6 && (
                <button
                  type="button"
                  onClick={() => addBullet(idx)}
                  className="text-sm font-medium"
                  style={{ color: "#1a2744" }}
                >
                  + Add bullet
                </button>
              )}
            </div>

            {/* Remove experience */}
            {blocks.length > 0 && (
              <button
                type="button"
                onClick={() => removeBlock(idx)}
                className="text-sm font-medium text-destructive hover:underline"
              >
                Remove experience
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Add another */}
      <button
        type="button"
        onClick={addBlock}
        className="mt-4 w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
      >
        + Add another experience
      </button>

      {/* Error */}
      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      {/* Navigation */}
      <div className="mt-8 flex justify-end">
        <button
          onClick={handleNext}
          disabled={saving}
          className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-50"
        >
          {saving ? "Saving..." : "Next →"}
        </button>
      </div>
    </div>
  );
};

export default StepWorkExperience;
