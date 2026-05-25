import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
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

const DEFAULT_PRESETS = ["Screening call", "Round 1", "Round 2", "Final round"];
const OUTCOMES = ["Pending", "Passed", "Rejected", "Cancelled"];

const newRound = (name = "Round"): InterviewRound => ({
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

export default function InterviewRounds({ jobId, initial }: { jobId: string; initial: InterviewRound[] }) {
  const [rounds, setRounds] = useState<InterviewRound[]>(initial || []);
  const [activeId, setActiveId] = useState<string | null>(initial?.[0]?.id || null);

  useEffect(() => {
    if (!activeId && rounds.length) setActiveId(rounds[0].id);
  }, [rounds, activeId]);

  const persist = async (next: InterviewRound[]) => {
    setRounds(next);
    await supabase.from("jobs").update({ interview_rounds: next as any } as any).eq("id", jobId);
  };

  const addRound = (preset?: string) => {
    const name = preset || `Round ${rounds.length + 1}`;
    const next = [...rounds, newRound(name)];
    setActiveId(next[next.length - 1].id);
    persist(next);
  };

  const updateRound = (id: string, patch: Partial<InterviewRound>) => {
    persist(rounds.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const deleteRound = (id: string) => {
    const next = rounds.filter(r => r.id !== id);
    if (activeId === id) setActiveId(next[0]?.id || null);
    persist(next);
  };

  const active = rounds.find(r => r.id === activeId);

  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-foreground">Interview rounds</h3>
            <p className="text-xs text-muted-foreground">Track each stage separately — screening, rounds, final. Shared prep stays below.</p>
          </div>
        </div>

        {rounds.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {DEFAULT_PRESETS.map(p => (
              <Button key={p} variant="outline" size="sm" onClick={() => addRound(p)}>
                <Plus className="h-3 w-3 mr-1" /> {p}
              </Button>
            ))}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mb-4 border-b pb-2">
              {rounds.map(r => (
                <button
                  key={r.id}
                  onClick={() => setActiveId(r.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    activeId === r.id
                      ? "bg-[#950606] text-white border-[#950606]"
                      : "bg-muted text-muted-foreground border-border hover:text-foreground"
                  }`}
                >
                  {r.name}
                  {r.outcome && r.outcome !== "Pending" && (
                    <span className="ml-1.5 opacity-80">· {r.outcome}</span>
                  )}
                </button>
              ))}
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => addRound()}>
                <Plus className="h-3 w-3 mr-1" /> Add round
              </Button>
            </div>

            {active && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] text-muted-foreground">Name</label>
                    <Input value={active.name} onChange={(e) => updateRound(active.id, { name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Date</label>
                    <Input type="date" value={active.date || ""} onChange={(e) => updateRound(active.id, { date: e.target.value || null })} />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Format</label>
                    <Input placeholder="Video, Onsite, Case…" value={active.format || ""} onChange={(e) => updateRound(active.id, { format: e.target.value || null })} />
                  </div>
                  <div>
                    <label className="text-[11px] text-muted-foreground">Outcome</label>
                    <select
                      value={active.outcome || "Pending"}
                      onChange={(e) => updateRound(active.id, { outcome: e.target.value })}
                      className="w-full h-9 px-2 rounded-md border border-border bg-background text-sm"
                    >
                      {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>

                <FieldArea label="Prep notes for this round" value={active.prep_notes} onChange={(v) => updateRound(active.id, { prep_notes: v })} />
                <FieldArea label="Likely questions" value={active.likely_questions} onChange={(v) => updateRound(active.id, { likely_questions: v })} />
                <FieldArea label="Questions to ask them" value={active.questions_to_ask} onChange={(v) => updateRound(active.id, { questions_to_ask: v })} />
                <FieldArea label="Post-round notes" value={active.post_notes} onChange={(v) => updateRound(active.id, { post_notes: v })} />

                <div className="flex justify-between items-center pt-1">
                  {active.date && (
                    <span className="text-[11px] text-muted-foreground">Scheduled {format(new Date(active.date), "MMM d, yyyy")}</span>
                  )}
                  <Button variant="ghost" size="sm" className="text-xs text-destructive hover:text-destructive ml-auto" onClick={() => deleteRound(active.id)}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete round
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
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