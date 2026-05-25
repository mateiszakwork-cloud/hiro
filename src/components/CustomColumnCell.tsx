import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Pencil } from "lucide-react";

interface Props {
  value: string;
  onSave: (next: string) => void | Promise<void>;
}

const CustomColumnCell = ({ value, onSave }: Props) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value, open]);

  const commit = () => {
    if (draft !== value) onSave(draft);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { if (!o) commit(); else setOpen(true); }}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-1 max-w-full text-sm text-foreground hover:text-primary transition-colors group/cc"
          title={value || "Click to edit"}
        >
          <span className="truncate">
            {value ? value : <span className="text-muted-foreground">–</span>}
          </span>
          <Pencil className="h-3 w-3 opacity-0 group-hover/cc:opacity-50 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <Input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(value); setOpen(false); }
          }}
          placeholder="Type a value..."
          autoFocus
          className="h-8 text-sm"
        />
      </PopoverContent>
    </Popover>
  );
};

export default CustomColumnCell;