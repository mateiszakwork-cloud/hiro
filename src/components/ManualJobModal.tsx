import { useState, useRef, KeyboardEvent } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const FUNCTIONS = ["Strategy", "Finance", "Marketing", "Product", "Operations", "HR", "Consulting", "Other"];
const WORK_MODES = ["Onsite", "Hybrid", "Remote"];

type ManualJobData = {
  job_title: string;
  company_name: string;
  url: string;
  function: string;
  location: string;
  work_mode: string;
  duration: string;
  hard_skills: string[];
  soft_skills: string[];
  languages_required: string[];
  application_deadline: string | null;
  job_description: string;
};

const TagInput = ({ tags, onChange, placeholder }: { tags: string[]; onChange: (t: string[]) => void; placeholder: string }) => {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const newTags = pasted.split(/[,;\n]+/).map(t => t.trim()).filter(t => t && !tags.includes(t));
    if (newTags.length) onChange([...tags, ...newTags]);
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[40px] rounded-md border border-input bg-background px-3 py-2 text-sm cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-foreground text-xs font-medium">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((_, idx) => idx !== i))} className="hover:text-destructive">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => input.trim() && addTag(input)}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
      />
    </div>
  );
};

interface ManualJobModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillUrl?: string;
  onSave: (data: ManualJobData) => Promise<void>;
}

const ManualJobModal = ({ open, onOpenChange, prefillUrl = "", onSave }: ManualJobModalProps) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ManualJobData>({
    job_title: "", company_name: "", url: prefillUrl, function: "", location: "",
    work_mode: "", duration: "", hard_skills: [], soft_skills: [], languages_required: [],
    application_deadline: null, job_description: "",
  });
  const [errors, setErrors] = useState<{ job_title?: string; company_name?: string }>({});

  // Reset form when modal opens with new prefillUrl
  const lastPrefill = useRef(prefillUrl);
  if (open && prefillUrl !== lastPrefill.current) {
    lastPrefill.current = prefillUrl;
    setForm(prev => ({ ...prev, url: prefillUrl }));
  }

  const handleSave = async () => {
    const newErrors: typeof errors = {};
    if (!form.job_title.trim()) newErrors.job_title = "Job title is required";
    if (!form.company_name.trim()) newErrors.company_name = "Company name is required";
    if (Object.keys(newErrors).length) { setErrors(newErrors); return; }
    setErrors({});
    setSaving(true);
    try {
      await onSave(form);
      // Reset form
      setForm({
        job_title: "", company_name: "", url: "", function: "", location: "",
        work_mode: "", duration: "", hard_skills: [], soft_skills: [], languages_required: [],
        application_deadline: null, job_description: "",
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const deadlineDate = form.application_deadline ? new Date(form.application_deadline) : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Job Manually</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Row 1: Title + Company */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Job Title <span className="text-destructive">*</span></Label>
              <Input value={form.job_title} onChange={(e) => { setForm(p => ({ ...p, job_title: e.target.value })); if (errors.job_title) setErrors(p => ({ ...p, job_title: undefined })); }} placeholder="e.g. Strategy Analyst" className={errors.job_title ? "border-destructive" : ""} />
              {errors.job_title && <p className="text-destructive text-xs">{errors.job_title}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Company Name <span className="text-destructive">*</span></Label>
              <Input value={form.company_name} onChange={(e) => { setForm(p => ({ ...p, company_name: e.target.value })); if (errors.company_name) setErrors(p => ({ ...p, company_name: undefined })); }} placeholder="e.g. McKinsey" className={errors.company_name ? "border-destructive" : ""} />
              {errors.company_name && <p className="text-destructive text-xs">{errors.company_name}</p>}
            </div>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label>Job URL <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Input value={form.url} onChange={(e) => setForm(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
          </div>

          {/* Row 2: Function + Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Function</Label>
              <Select value={form.function} onValueChange={(v) => setForm(p => ({ ...p, function: v }))}>
                <SelectTrigger><SelectValue placeholder="Select function" /></SelectTrigger>
                <SelectContent>{FUNCTIONS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Location</Label>
              <Input value={form.location} onChange={(e) => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Paris, France" />
            </div>
          </div>

          {/* Row 3: Work Mode + Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Work Mode</Label>
              <Select value={form.work_mode} onValueChange={(v) => setForm(p => ({ ...p, work_mode: v }))}>
                <SelectTrigger><SelectValue placeholder="Select work mode" /></SelectTrigger>
                <SelectContent>{WORK_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Input value={form.duration} onChange={(e) => setForm(p => ({ ...p, duration: e.target.value }))} placeholder="6 months" />
            </div>
          </div>

          {/* Row 4: Deadline */}
          <div className="space-y-1.5">
            <Label>Application Deadline</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !deadlineDate && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {deadlineDate ? format(deadlineDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={deadlineDate}
                  onSelect={(d) => setForm(p => ({ ...p, application_deadline: d ? format(d, "yyyy-MM-dd") : null }))}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Skills */}
          <div className="space-y-1.5">
            <Label>Hard Skills</Label>
            <TagInput tags={form.hard_skills} onChange={(t) => setForm(p => ({ ...p, hard_skills: t }))} placeholder="Type a skill and press Enter" />
          </div>
          <div className="space-y-1.5">
            <Label>Soft Skills</Label>
            <TagInput tags={form.soft_skills} onChange={(t) => setForm(p => ({ ...p, soft_skills: t }))} placeholder="Type a skill and press Enter" />
          </div>
          <div className="space-y-1.5">
            <Label>Languages Required</Label>
            <TagInput tags={form.languages_required} onChange={(t) => setForm(p => ({ ...p, languages_required: t }))} placeholder="e.g. English, French" />
          </div>

          {/* Job Description */}
          <div className="space-y-1.5">
            <Label>Job Description <span className="text-muted-foreground text-xs font-normal">(optional)</span></Label>
            <Textarea
              value={form.job_description}
              onChange={(e) => setForm(p => ({ ...p, job_description: e.target.value }))}
              placeholder="Paste the full job description here for better CV tailoring and match scoring"
              rows={5}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</> : "Save Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ManualJobModal;
