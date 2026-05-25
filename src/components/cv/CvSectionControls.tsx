import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Check } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CvSectionConfig, CvSectionMeta, DEFAULT_SECTION_LABELS } from "@/lib/cvLayout";

interface Props {
  config: CvSectionConfig;
  onChange: (next: CvSectionConfig) => void;
}

export default function CvSectionControls({ config, onChange }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const update = (next: CvSectionMeta[]) => onChange({ sections: next });
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= config.sections.length) return;
    const arr = config.sections.slice();
    [arr[i], arr[j]] = [arr[j], arr[i]];
    update(arr);
  };
  const toggle = (i: number) => {
    const arr = config.sections.slice();
    arr[i] = { ...arr[i], visible: !arr[i].visible };
    update(arr);
  };
  const rename = (i: number, label: string) => {
    const arr = config.sections.slice();
    arr[i] = { ...arr[i], label: label.trim() || DEFAULT_SECTION_LABELS[arr[i].id] };
    update(arr);
  };

  return (
    <div className="space-y-1.5">
      {config.sections.map((s, i) => (
        <div key={s.id} className="flex items-center gap-2 p-2 rounded-md border border-border bg-card">
          <div className="flex flex-col">
            <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="p-0.5 disabled:opacity-30 hover:text-foreground text-muted-foreground">
              <ArrowUp className="h-3 w-3" />
            </button>
            <button type="button" onClick={() => move(i, 1)} disabled={i === config.sections.length - 1} className="p-0.5 disabled:opacity-30 hover:text-foreground text-muted-foreground">
              <ArrowDown className="h-3 w-3" />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            {editing === s.id ? (
              <div className="flex items-center gap-1.5">
                <Input value={draft} onChange={e => setDraft(e.target.value)} className="h-7 text-xs" autoFocus
                  onKeyDown={e => { if (e.key === "Enter") { rename(i, draft); setEditing(null); } }} />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { rename(i, draft); setEditing(null); }}>
                  <Check className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className={`text-sm ${s.visible ? "text-foreground" : "text-muted-foreground line-through"}`}>{s.label}</span>
                <button type="button" onClick={() => { setEditing(s.id); setDraft(s.label); }} className="text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={() => toggle(i)} className="text-muted-foreground hover:text-foreground p-1" aria-label={s.visible ? "Hide section" : "Show section"}>
            {s.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        </div>
      ))}
    </div>
  );
}