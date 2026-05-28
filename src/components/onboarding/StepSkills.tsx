import { useState, type KeyboardEvent, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const HARD_SUGGESTIONS = [
  "Excel", "PowerPoint", "Word", "Google Sheets", "Google Slides",
  "SQL", "Python", "R", "JavaScript", "TypeScript", "Java",
  "Tableau", "Power BI", "Looker", "Google Analytics", "Mixpanel", "Amplitude",
  "Salesforce", "HubSpot", "SAP", "NetSuite", "Workday",
  "Jira", "Confluence", "Notion", "Asana", "Trello", "Linear", "Monday",
  "Figma", "Sketch", "Adobe XD", "Photoshop", "Illustrator", "InDesign",
  "AWS", "GCP", "Azure", "Docker", "Git",
  "Financial modelling", "DCF valuation", "PESTEL analysis", "Porter's Five Forces",
  "Market research", "A/B testing", "SEO", "SEM", "Email marketing",
];
const SOFT_SUGGESTIONS = [
  "Stakeholder management", "Cross-functional collaboration", "Project management",
  "Analytical thinking", "Problem solving", "Strategic thinking", "Critical thinking",
  "Communication", "Written communication", "Public speaking", "Active listening",
  "Leadership", "Coaching", "Mentoring", "Negotiation", "Conflict resolution",
  "Attention to detail", "Time management", "Prioritisation", "Ownership",
  "Adaptability", "Resilience", "Curiosity", "Creativity",
  "Client management", "Presentation skills", "Storytelling with data",
];

interface Props {
  userId: string;
  onNext: () => void;
  onBack: () => void;
  initialHardSkills?: string[];
  initialSoftSkills?: string[];
  cvSuggestedHardSkills?: string[];
  cvSuggestedSoftSkills?: string[];
}

const SkillTagInput = ({
  tags, onAdd, onRemove, placeholder, pillClass, suggestions,
}: {
  tags: string[]; onAdd: (tag: string) => void; onRemove: (i: number) => void;
  placeholder: string; pillClass: string; suggestions: string[];
}) => {
  const [input, setInput] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !tags.some(t => t.toLowerCase() === tag.toLowerCase())) onAdd(tag);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      input.split(/[,\n]/).forEach(p => addTag(p));
      setInput("");
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    // Auto-convert on comma or newline
    if (val.includes(",") || val.includes("\n")) {
      val.split(/[,\n]/).forEach(p => addTag(p));
      setInput("");
    } else {
      setInput(val);
    }
  };

  const unusedSuggestions = suggestions.filter(s => !tags.some(t => t.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <div className="rounded-lg border border-input bg-background p-2 flex flex-wrap gap-2 min-h-[80px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-shadow">
        {tags.map((tag, idx) => (
          <span key={idx} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${pillClass}`}>
            {tag}
            <button type="button" onClick={() => onRemove(idx)} className="hover:opacity-80"><X className="h-3 w-3" /></button>
          </span>
        ))}
        <textarea
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground resize-none"
          rows={1}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1">Tap a suggestion or paste a list — separate with commas or new lines.</p>
      {unusedSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {unusedSuggestions.map(s => (
            <button key={s} type="button" onClick={() => addTag(s)} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const StepSkills = ({ userId, onNext, onBack, initialHardSkills, initialSoftSkills, cvSuggestedHardSkills, cvSuggestedSoftSkills }: Props) => {
  const [hardSkills, setHardSkills] = useState<string[]>(initialHardSkills || []);
  const [softSkills, setSoftSkills] = useState<string[]>(initialSoftSkills || []);

  // Merge CV-extracted tools first (more relevant), then the static fallback list, deduped case-insensitively.
  const mergeSuggestions = (cv: string[] | undefined, fallback: string[]) => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of [...(cv || []), ...fallback]) {
      const k = s.trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(s.trim());
    }
    return out;
  };
  const hardSuggestions = mergeSuggestions(cvSuggestedHardSkills, HARD_SUGGESTIONS);
  const softSuggestions = mergeSuggestions(cvSuggestedSoftSkills, SOFT_SUGGESTIONS);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    if (hardSkills.length < 3) { setError("Please add at least 3 hard skills."); return false; }
    if (softSkills.length < 2) { setError("Please add at least 2 soft skills."); return false; }
    setError(null); return true;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setSaving(true);
    await supabase.from("skills").delete().eq("user_id", userId);
    const { error: insertError } = await supabase.from("skills").insert({ user_id: userId, hard_skills: hardSkills, soft_skills: softSkills });
    setSaving(false);
    if (insertError) toast.error(insertError.message); else onNext();
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Your skill bank</h1>
      <p className="mt-1 text-muted-foreground">
        Add more than you think you need. This is the pool Hiro draws from when tailoring your CV for each role — tools, software, methods, and professional strengths all count.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Hard Skills</h2>
          <p className="text-sm text-muted-foreground">Tools, software, methods, programming languages.</p>
          <SkillTagInput
            tags={hardSkills}
            onAdd={(t) => setHardSkills(prev => [...prev, t])}
            onRemove={(i) => setHardSkills(prev => prev.filter((_, idx) => idx !== i))}
            placeholder="Type a skill and press Enter..."
            pillClass="bg-primary text-primary-foreground"
            suggestions={hardSuggestions}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Soft Skills</h2>
          <p className="text-sm text-muted-foreground">Interpersonal and professional strengths.</p>
          <SkillTagInput
            tags={softSkills}
            onAdd={(t) => setSoftSkills(prev => [...prev, t])}
            onRemove={(i) => setSoftSkills(prev => prev.filter((_, idx) => idx !== i))}
            placeholder="Type a skill and press Enter..."
            pillClass="bg-muted text-muted-foreground"
            suggestions={softSuggestions}
          />
        </div>
      </div>

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

export default StepSkills;
