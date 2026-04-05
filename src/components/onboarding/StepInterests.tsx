import { useState, type KeyboardEvent, type ChangeEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const SUGGESTIONS = ["Running", "Cycling", "Photography", "Travel", "Chess", "Public Speaking", "Volunteering", "Music"];

interface Props { userId: string; onBack: () => void; onFinish: () => void; }

const StepInterests = ({ userId, onBack, onFinish }: Props) => {
  const [tags, setTags] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !tags.some(t => t.toLowerCase() === tag.toLowerCase())) setTags(prev => [...prev, tag]);
  };

  const removeTag = (idx: number) => setTags(prev => prev.filter((_, i) => i !== idx));

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      input.split(/[,\n]/).forEach(p => addTag(p));
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length > 0) removeTag(tags.length - 1);
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.includes(",") || val.includes("\n")) {
      val.split(/[,\n]/).forEach(p => addTag(p));
      setInput("");
    } else setInput(val);
  };

  const handleFinish = async () => {
    setSaving(true);
    await supabase.from("interests").delete().eq("user_id", userId);
    if (tags.length > 0) {
      const { error } = await supabase.from("interests").insert({ user_id: userId, interests: tags });
      if (error) { setSaving(false); toast.error(error.message); return; }
    }

    // Mark onboarding complete
    const { error: updateError } = await supabase.from("profiles").update({ onboarding_complete: true }).eq("id", userId);
    setSaving(false);
    if (updateError) toast.error(updateError.message); else onFinish();
  };

  const unusedSuggestions = SUGGESTIONS.filter(s => !tags.some(t => t.toLowerCase() === s.toLowerCase()));

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Personal Interests</h1>
      <p className="mt-1 text-muted-foreground">What are you passionate about outside of work? This section is optional.</p>

      <div className="mt-6">
        <div className="rounded-lg border border-input bg-background p-2 flex flex-wrap gap-2 min-h-[80px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-shadow">
          {tags.map((tag, idx) => (
            <span key={idx} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
              {tag}
              <button type="button" onClick={() => removeTag(idx)} className="hover:opacity-80"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <textarea
            value={input}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? "e.g. Distance running, Videography, Padel..." : ""}
            className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground resize-none"
            rows={1}
          />
        </div>

        {unusedSuggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {unusedSuggestions.map(s => (
              <button key={s} type="button" onClick={() => addTag(s)} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                + {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="text-sm font-medium text-muted-foreground hover:text-foreground">← Back</button>
        <button onClick={handleFinish} disabled={saving} className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground hover:bg-accent transition-colors disabled:opacity-50">
          {saving ? "Saving..." : "Finish and go to my dashboard"}
        </button>
      </div>
    </div>
  );
};

export default StepInterests;
