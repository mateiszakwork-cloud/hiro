import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

export type InterviewRound = {
  id: string;
  name: string;          // e.g. "Screening call", "Round 1", "Final round"
  date: string | null;   // ISO date
  format: string | null; // e.g. "Video", "Onsite", "Case study"
  prep_notes: string | null;
  likely_questions: string | null;
  questions_to_ask: string | null;
  post_notes: string | null;
  outcome: string | null; // "Pending" | "Passed" | "Rejected" | "Cancelled"
};

export const DEFAULT_ROUND_PRESETS = ["Screening call", "Round 1", "Round 2", "Final round"];
export const ROUND_OUTCOMES = ["Pending", "Passed", "Rejected", "Cancelled"];

export const newRound = (name = "Round"): InterviewRound => ({
  id: crypto.randomUUID(),
  name,
  date: null,
  format: null,
  prep_notes: null,
  likely_questions: null,
  questions_to_ask: null,
  post_notes: null,
  outcome: "Pending",
});

/* ── Round details panel: fields for a single round (used inside a collapsible) ── */
export function RoundDetailsPanel({
  round,
  onChange,
  onDelete,
}: {
  round: InterviewRound;
  onChange: (patch: Partial<InterviewRound>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] text-muted-foreground">Name</label>
          <Input value={round.name} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Date</label>
          <Input type="date" value={round.date || ""} onChange={(e) => onChange({ date: e.target.value || null })} />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Format</label>
          <Input placeholder="Video, Onsite, Case…" value={round.format || ""} onChange={(e) => onChange({ format: e.target.value || null })} />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground">Outcome</label>
          <select
            value={round.outcome || "Pending"}
            onChange={(e) => onChange({ outcome: e.target.value })}
            className="w-full h-9 px-2 rounded-md border border-border bg-background text-sm"
          >
            {ROUND_OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>

      <FieldArea label="Prep notes for this round" value={round.prep_notes} onChange={(v) => onChange({ prep_notes: v })} />
      <FieldArea label="Post-round notes" value={round.post_notes} onChange={(v) => onChange({ post_notes: v })} />

      <div className="flex justify-between items-center pt-1">
        {round.date && (
          <span className="text-[11px] text-muted-foreground">Scheduled {format(new Date(round.date), "MMM d, yyyy")}</span>
        )}
        <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive ml-auto" onClick={onDelete}>
          <Trash2 className="h-3 w-3 mr-1" /> Delete round
        </Button>
      </div>
    </div>
  );
}

function FieldArea({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <label className="text-[11px] text-muted-foreground">{label}</label>
      <textarea
        value={value || ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full min-h-[70px] p-2 text-sm rounded-md border border-border bg-background outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}