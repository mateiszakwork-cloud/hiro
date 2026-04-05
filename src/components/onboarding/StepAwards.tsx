import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const YEARS = Array.from({ length: 37 }, (_, i) => 1990 + i);

interface AwardBlock { awardName: string; issuingOrg: string; year: string; description: string; }
const emptyBlock = (): AwardBlock => ({ awardName: "", issuingOrg: "", year: "", description: "" });

interface Props { userId: string; onNext: () => void; onBack: () => void; }

const StepAwards = ({ userId, onNext, onBack }: Props) => {
  const [blocks, setBlocks] = useState<AwardBlock[]>([]);
  const [saving, setSaving] = useState(false);

  const updateBlock = (idx: number, patch: Partial<AwardBlock>) => setBlocks(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  const addBlock = () => setBlocks(prev => [...prev, emptyBlock()]);
  const removeBlock = (idx: number) => setBlocks(prev => prev.filter((_, i) => i !== idx));

  const handleNext = async () => {
    setSaving(true);
    await supabase.from("awards").delete().eq("user_id", userId);
    if (blocks.length > 0) {
      const rows = blocks.filter(b => b.awardName.trim()).map(b => ({
        user_id: userId, award_name: b.awardName.trim(),
        issuing_organization: b.issuingOrg.trim() || null,
        year: b.year ? parseInt(b.year) : null,
        description: b.description.trim() || null,
      }));
      if (rows.length > 0) {
        const { error } = await supabase.from("awards").insert(rows);
        if (error) { setSaving(false); toast.error(error.message); return; }
      }
    }
    setSaving(false);
    onNext();
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Awards & Achievements</h1>
      <p className="mt-1 text-muted-foreground">Add any awards, scholarships, or notable achievements. This section is optional.</p>

      <div className="mt-6 space-y-6">
        {blocks.map((block, idx) => (
          <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Award Name *</Label>
                <Input value={block.awardName} onChange={e => updateBlock(idx, { awardName: e.target.value })} placeholder="e.g. Dean's List" className="rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Label>Issuing Organization</Label>
                <Input value={block.issuingOrg} onChange={e => updateBlock(idx, { issuingOrg: e.target.value })} placeholder="e.g. University of Amsterdam" className="rounded-lg" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select value={block.year} onValueChange={v => updateBlock(idx, { year: v })}>
                  <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                  <SelectContent>{YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={block.description} onChange={e => updateBlock(idx, { description: e.target.value })} placeholder="Brief description of the award..." className="rounded-lg" rows={2} />
            </div>
            <button type="button" onClick={() => removeBlock(idx)} className="text-sm font-medium text-destructive hover:underline flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Remove</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addBlock} className="mt-4 w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add an award</button>

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back</button>
        <button onClick={handleNext} disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Next →"}
        </button>
      </div>
    </div>
  );
};

export default StepAwards;
