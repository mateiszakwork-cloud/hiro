import { useState, type KeyboardEvent, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const HARD_SUGGESTIONS = ["Excel", "PowerPoint", "SQL", "Python", "Salesforce", "Tableau", "Google Analytics", "Jira", "Figma", "SAP"];
const SOFT_SUGGESTIONS = ["Stakeholder management", "Analytical thinking", "Cross-functional collaboration", "Project management", "Communication", "Problem solving", "Leadership", "Attention to detail"];

interface Props { userId: string; onNext: () => void; onBack: () => void; }

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
      <p className="text-xs text-muted-foreground mt-1">💡 Paste from your CV — separate with commas or new lines</p>
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

const StepSkills = ({ userId, onNext, onBack }: Props) => {
  const [hardSkills, setHardSkills] = useState<string[]>([]);
  const [softSkills, setSoftSkills] = useState<string[]>([]);
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
      <h1 className="text-2xl font-bold text-foreground">Your skills</h1>
      <p className="mt-1 text-muted-foreground">Add your hard and soft skills. The more specific you are, the better the AI will tailor your applications.</p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Hard Skills</h2>
          <p className="text-sm text-muted-foreground">Tools, software, methodologies, languages (e.g. Excel, Python, Salesforce, SQL, PESTEL analysis)</p>
          <SkillTagInput
            tags={hardSkills}
            onAdd={(t) => setHardSkills(prev => [...prev, t])}
            onRemove={(i) => setHardSkills(prev => prev.filter((_, idx) => idx !== i))}
            placeholder="Type a skill and press Enter..."
            pillClass="bg-primary text-primary-foreground"
            suggestions={HARD_SUGGESTIONS}
          />
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Soft Skills</h2>
          <p className="text-sm text-muted-foreground">Interpersonal and professional abilities (e.g. Stakeholder management, Cross-functional collaboration)</p>
          <SkillTagInput
            tags={softSkills}
            onAdd={(t) => setSoftSkills(prev => [...prev, t])}
            onRemove={(i) => setSoftSkills(prev => prev.filter((_, idx) => idx !== i))}
            placeholder="Type a skill and press Enter..."
            pillClass="bg-muted text-muted-foreground"
            suggestions={SOFT_SUGGESTIONS}
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
