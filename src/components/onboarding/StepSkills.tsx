import { useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
  onNext: () => void;
  onBack: () => void;
}

const TagInput = ({
  tags,
  onAdd,
  onRemove,
  placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (idx: number) => void;
  placeholder: string;
}) => {
  const [input, setInput] = useState("");

  const addTag = (raw: string) => {
    const tag = raw.trim();
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      onAdd(tag);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
      setInput("");
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  };

  const handleChange = (val: string) => {
    if (val.includes(",")) {
      const parts = val.split(",");
      parts.forEach((p) => addTag(p));
      setInput("");
    } else {
      setInput(val);
    }
  };

  return (
    <div className="rounded-lg border border-input bg-background p-2 flex flex-wrap gap-2 min-h-[80px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-shadow">
      {tags.map((tag, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
        >
          {tag}
          <button type="button" onClick={() => onRemove(idx)} className="hover:opacity-80">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
};

const StepSkills = ({ userId, onNext, onBack }: Props) => {
  const [hardSkills, setHardSkills] = useState<string[]>([]);
  const [softSkills, setSoftSkills] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    if (hardSkills.length < 3) {
      setError("Please add at least 3 hard skills.");
      return false;
    }
    if (softSkills.length < 2) {
      setError("Please add at least 2 soft skills.");
      return false;
    }
    setError(null);
    return true;
  };

  const handleNext = async () => {
    if (!validate()) return;
    setSaving(true);

    await supabase.from("skills").delete().eq("user_id", userId);

    const { error: insertError } = await supabase.from("skills").insert({
      user_id: userId,
      hard_skills: hardSkills,
      soft_skills: softSkills,
    });

    setSaving(false);
    if (insertError) {
      toast.error(insertError.message);
    } else {
      onNext();
    }
  };

  return (
    <div className="rounded-lg bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-foreground">Your skills</h1>
      <p className="mt-1 text-muted-foreground">
        Add your hard and soft skills. The more specific you are, the better the AI will tailor your applications.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Hard Skills */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Hard Skills</h2>
          <p className="text-sm text-muted-foreground">
            Tools, software, methodologies, languages (e.g. Excel, Python, Salesforce, SQL, PESTEL analysis)
          </p>
          <TagInput
            tags={hardSkills}
            onAdd={(t) => setHardSkills((prev) => [...prev, t])}
            onRemove={(i) => setHardSkills((prev) => prev.filter((_, idx) => idx !== i))}
            placeholder="Type a skill and press Enter..."
          />
        </div>

        {/* Soft Skills */}
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Soft Skills</h2>
          <p className="text-sm text-muted-foreground">
            Interpersonal and professional abilities (e.g. Stakeholder management, Cross-functional collaboration, Analytical thinking)
          </p>
          <TagInput
            tags={softSkills}
            onAdd={(t) => setSoftSkills((prev) => [...prev, t])}
            onRemove={(i) => setSoftSkills((prev) => prev.filter((_, idx) => idx !== i))}
            placeholder="Type a skill and press Enter..."
          />
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <div className="mt-8 flex justify-between">
        <button onClick={onBack} className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Back
        </button>
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

export default StepSkills;
