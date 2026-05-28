import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

// 1970 → 2035; dropdown opens at 2026
const CURRENT_YEAR = 2026;
const YEARS_MAIN = Array.from({ length: CURRENT_YEAR - 1970 + 1 }, (_, i) => CURRENT_YEAR - i);
const YEARS_FUTURE = Array.from({ length: 2035 - CURRENT_YEAR }, (_, i) => 2035 - i);

interface VolBlock { organization: string; role: string; startYear: string; endYear: string; isOngoing: boolean; description: string; }
const emptyBlock = (): VolBlock => ({ organization: "", role: "", startYear: "", endYear: "", isOngoing: false, description: "" });

interface Props { userId: string; onNext: () => void; onBack: () => void; }

const StepVolunteering = ({ userId, onNext, onBack }: Props) => {
  const [blocks, setBlocks] = useState<VolBlock[]>([]);
  const [saving, setSaving] = useState(false);

  const updateBlock = (idx: number, patch: Partial<VolBlock>) => setBlocks(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  const addBlock = () => setBlocks(prev => [...prev, emptyBlock()]);
  const removeBlock = (idx: number) => setBlocks(prev => prev.filter((_, i) => i !== idx));

  const handleNext = async () => {
    setSaving(true);
    await supabase.from("volunteering").delete().eq("user_id", userId);
    if (blocks.length > 0) {
      const rows = blocks.filter(b => b.organization.trim()).map(b => ({
        user_id: userId, organization: b.organization.trim(),
        role: b.role.trim() || null,
        start_year: b.startYear ? parseInt(b.startYear) : null,
        end_year: b.isOngoing || !b.endYear ? null : parseInt(b.endYear),
        is_ongoing: b.isOngoing,
        description: b.description.trim() || null,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("volunteering").insert(rows);
        if (error) { setSaving(false); toast.error(error.message); return; }
      }
    }
    setSaving(false);
    onNext();
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Volunteering</h1>
      <p className="mt-1 text-muted-foreground">Add any volunteering experience. This section is optional.</p>

      <div className="mt-6 space-y-6">
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Organization *</Label>
                <Input value={block.organization} onChange={e => updateBlock(idx, { organization: e.target.value })} placeholder="e.g. Red Cross" className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Input value={block.role} onChange={e => updateBlock(idx, { role: e.target.value })} placeholder="e.g. Event Coordinator" className="rounded-lg" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <Label>Duration</Label>
                <div className="flex items-center gap-1.5 ml-auto">
                  <Checkbox checked={block.isOngoing} onCheckedChange={v => updateBlock(idx, { isOngoing: !!v })} id={`ongoing-${idx}`} />
                  <label htmlFor={`ongoing-${idx}`} className="text-sm text-muted-foreground cursor-pointer select-none">Ongoing</label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Select value={block.startYear} onValueChange={v => updateBlock(idx, { startYear: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Start Year" /></SelectTrigger>
                  <SelectContent>
                    {YEARS_MAIN.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel>Future</SelectLabel>
                      {YEARS_FUTURE.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {!block.isOngoing && (
                  <Select value={block.endYear} onValueChange={v => updateBlock(idx, { endYear: v })}>
                    <SelectTrigger className="rounded-lg"><SelectValue placeholder="End Year" /></SelectTrigger>
                    <SelectContent>
                      {YEARS_MAIN.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      <SelectSeparator />
                      <SelectGroup>
                        <SelectLabel>Future</SelectLabel>
                        {YEARS_FUTURE.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={block.description} onChange={e => updateBlock(idx, { description: e.target.value })} placeholder="What did you do?" className="rounded-lg" rows={2} />
            </div>
            <button type="button" onClick={() => removeBlock(idx)} className="text-sm font-medium text-destructive hover:underline flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlock} className="mt-4 w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add volunteering</button>

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back</button>
        <button onClick={handleNext} disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Next →"}
        </button>
      </div>
    </div>
  );
};

export default StepVolunteering;
