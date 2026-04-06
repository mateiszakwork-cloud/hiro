import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ExternalLink, MapPin, Copy, Check, Trash2, ChevronDown, ChevronUp, FileText, CheckCircle2, XCircle, CalendarIcon, RefreshCw, Lightbulb, History, RotateCcw, Pencil, X as XIcon, AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type BulletItem = { original: string; tailored: string; use_tailored: boolean };
type BulletBlock = { company: string; job_title: string; bullets: BulletItem[] | string[] };

type CvOutput = {
  id: string;
  tailored_summary: string | null;
  selected_bullets: BulletBlock[] | null;
  selected_hard_skills: Record<string, string[]> | null;
  selected_soft_skills: string[];
  tailoring_notes: string[];
  created_at: string;
  updated_at: string;
};

type MatchDetails = {
  hard_skills_match: number | null;
  soft_skills_match: number | null;
  experience_match: number | null;
  language_match: number | null;
  match_summary: string | null;
  missing_skills: string[];
  strengths: string[];
};

type Job = {
  id: string; url: string | null; company_name: string | null; job_title: string | null;
  function: string | null; location: string | null; work_mode: string | null;
  duration: string | null; hard_skills: string[] | null; soft_skills: string[] | null;
  skills_nice_to_have: string[] | null; languages_required: string[] | null;
  languages_nice_to_have: string[] | null; application_deadline: string | null;
  status: string; match_score: number | null; match_details: MatchDetails | null;
  notes: string | null; created_at: string; priority: string; applied_date: string | null;
};

type Contact = {
  id: string; linkedin_url: string | null; name: string | null; headline: string | null;
  current_title: string | null; is_alumni: boolean; connection_note_draft: string | null;
  inmail_draft: string | null; outreach_status: string;
};

const STATUS_OPTIONS = [
  { value: "Saved", color: "bg-gray-200 text-gray-700" },
  { value: "Applied", color: "bg-blue-100 text-blue-700" },
  { value: "Screening", color: "bg-amber-100 text-amber-700" },
  { value: "Interview", color: "bg-orange-100 text-orange-700" },
  { value: "Offer", color: "bg-green-100 text-green-700" },
  { value: "Rejected", color: "bg-red-100 text-red-700" },
];

const OUTREACH_STATUSES = ["Not sent", "Request sent", "Connected", "Replied", "Meeting booked"];

const getStatusColor = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.color || "bg-muted text-muted-foreground";

const getScoreColor = (score: number | null) => {
  if (score === null) return "border-muted text-muted-foreground bg-muted/30";
  if (score >= 70) return "text-green-600 border-green-300 bg-green-50";
  if (score >= 40) return "text-amber-600 border-amber-300 bg-amber-50";
  return "text-red-600 border-red-300 bg-red-50";
};

const FUNCTION_VALUES = ["Strategy", "Finance", "Marketing", "Product", "Operations", "HR", "Consulting", "Other"];
const WORK_MODE_VALUES = ["Onsite", "Hybrid", "Remote"];
const PRIORITY_OPTIONS_EDIT = ["High", "Medium", "Low"];

/* ── Tag list renderer ── */
const TagList = ({ tags, className = "", soft = false }: { tags: string[] | null; className?: string; soft?: boolean }) => {
  if (!tags?.length) return <span className="text-muted-foreground">–</span>;
  const base = soft
    ? "inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200"
    : "inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground";
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t, i) => (
        <span key={i} className={`${base} ${className}`}>{t}</span>
      ))}
    </div>
  );
};

/* ── Editable Tag Input ── */
const TagInput = ({ tags, onChange, placeholder = "Type and press Enter" }: { tags: string[]; onChange: (t: string[]) => void; placeholder?: string }) => {
  const [input, setInput] = useState("");
  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      if (!tags.some(t => t.toLowerCase() === input.trim().toLowerCase())) {
        onChange([...tags, input.trim()]);
      }
      setInput("");
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };
  return (
    <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-background min-h-[38px] items-center">
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={tags.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] text-sm bg-transparent outline-none"
      />
    </div>
  );
};

/* ── Bullet toggle helper ── */
function normalizeBullet(b: any): BulletItem {
  if (typeof b === "string") return { original: b, tailored: b, use_tailored: true };
  return { original: b.original || b.tailored || "", tailored: b.tailored || b.original || "", use_tailored: b.use_tailored !== false };
}

function bulletsAreIdentical(b: BulletItem) {
  return b.original === b.tailored;
}

/* ── Contact Card ── */
const ContactCard = ({ contact, onUpdate, onDelete }: {
  contact: Contact;
  onUpdate: (id: string, patch: Partial<Contact>) => void;
  onDelete: (id: string) => void;
}) => {
  const [connOpen, setConnOpen] = useState(false);
  const [inmailOpen, setInmailOpen] = useState(false);
  const [editingConn, setEditingConn] = useState(false);
  const [editingInmail, setEditingInmail] = useState(false);
  const [connDraft, setConnDraft] = useState(contact.connection_note_draft || "");
  const [inmailDraft, setInmailDraft] = useState(contact.inmail_draft || "");
  const [copiedConn, setCopiedConn] = useState(false);
  const [copiedInmail, setCopiedInmail] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const copyText = async (text: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold text-foreground">{contact.name || "Unknown"}</p>
            {contact.headline && <p className="text-sm text-muted-foreground">{contact.headline}</p>}
            {contact.current_title && <p className="text-xs text-muted-foreground">{contact.current_title}</p>}
            {contact.is_alumni && (
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">Alumni</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={contact.outreach_status} onValueChange={(v) => onUpdate(contact.id, { outreach_status: v })}>
              <SelectTrigger className="h-7 w-auto border-0 gap-1 px-2.5 rounded-full text-xs font-medium bg-muted">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OUTREACH_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={() => setDeleteOpen(true)} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Connection Note */}
        <div className="border rounded-lg">
          <button onClick={() => setConnOpen(!connOpen)} className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            300-char connection note {connOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {connOpen && (
            <div className="px-3 pb-3 space-y-2">
              {editingConn ? (
                <>
                  <Textarea value={connDraft} onChange={(e) => setConnDraft(e.target.value)} rows={3} maxLength={300} className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingConn(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => { onUpdate(contact.id, { connection_note_draft: connDraft }); setEditingConn(false); }}>Save</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{contact.connection_note_draft || <span className="text-muted-foreground italic">No draft yet</span>}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => copyText(contact.connection_note_draft || "", setCopiedConn)}>
                      {copiedConn ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copiedConn ? "Copied" : "Copy"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setConnDraft(contact.connection_note_draft || ""); setEditingConn(true); }}>Edit</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* InMail Draft */}
        <div className="border rounded-lg">
          <button onClick={() => setInmailOpen(!inmailOpen)} className="flex items-center justify-between w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            InMail draft {inmailOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {inmailOpen && (
            <div className="px-3 pb-3 space-y-2">
              {editingInmail ? (
                <>
                  <Textarea value={inmailDraft} onChange={(e) => setInmailDraft(e.target.value)} rows={5} className="text-sm" />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditingInmail(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => { onUpdate(contact.id, { inmail_draft: inmailDraft }); setEditingInmail(false); }}>Save</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{contact.inmail_draft || <span className="text-muted-foreground italic">No draft yet</span>}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => copyText(contact.inmail_draft || "", setCopiedInmail)}>
                      {copiedInmail ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copiedInmail ? "Copied" : "Copy"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setInmailDraft(contact.inmail_draft || ""); setEditingInmail(true); }}>Edit</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove this contact?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { onDelete(contact.id); setDeleteOpen(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

/* ── Main Page ── */
const JobDetail = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "overview";
  const [job, setJob] = useState<Job | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const [matchLoading, setMatchLoading] = useState(false);
  const [jobLoading, setJobLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cvOutput, setCvOutput] = useState<CvOutput | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvFetched, setCvFetched] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<{
    full_name: string | null; email: string | null;
    work_experiences: any[]; education: any[]; languages: any[];
    interests: string[]; awards: any[]; volunteering: any[];
  }>({ full_name: null, email: null, work_experiences: [], education: [], languages: [], interests: [], awards: [], volunteering: [] });
  const [cvHistory, setCvHistory] = useState<any[]>([]);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<any | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "true");
  const [editData, setEditData] = useState<Partial<Job>>({});

  // Bullet toggle state: map of "blockIdx-bulletIdx" -> boolean (true = show tailored)
  const [bulletToggles, setBulletToggles] = useState<Record<string, boolean>>({});

  // Master skills for suggestions
  const [masterHardSkills, setMasterHardSkills] = useState<string[]>([]);
  const [masterSoftSkills, setMasterSoftSkills] = useState<string[]>([]);

  // Skill add animation
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  // Interview prep state
  const [interviewPrep, setInterviewPrep] = useState<any | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [interviewFetched, setInterviewFetched] = useState(false);

  useEffect(() => {
    const init = async () => {
      setJobLoading(true);
      setFetchError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUserId(session.user.id);

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId!)
        .eq("user_id", session.user.id)
        .single();
      if (jobError || !jobData) {
        setFetchError(jobError?.message || "Job not found or access denied.");
        setJobLoading(false);
        return;
      }
      setJob(jobData as any);
      setNotes(jobData.notes || "");

      if (jobData.match_score === null) {
        setMatchLoading(true);
        const pollInterval = setInterval(async () => {
          const { data: updated } = await supabase
            .from("jobs")
            .select("match_score, match_details")
            .eq("id", jobId!)
            .single();
          if (updated?.match_score !== null) {
            setJob(prev => prev ? { ...prev, match_score: updated.match_score, match_details: updated.match_details as any } : prev);
            setMatchLoading(false);
            clearInterval(pollInterval);
          }
        }, 3000);
        setTimeout(() => { clearInterval(pollInterval); setMatchLoading(false); }, 60000);
      }

      const { data: contactData } = await supabase
        .from("contacts")
        .select("*")
        .eq("job_id", jobId!)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });
      if (contactData) setContacts(contactData as any);

      const { data: cvData } = await supabase
        .from("cv_outputs")
        .select("*")
        .eq("job_id", jobId!)
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cvData) setCvOutput(cvData as any);
      setCvFetched(true);

      const { data: histData } = await supabase
        .from("cv_output_history")
        .select("*")
        .eq("job_id", jobId!)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (histData) setCvHistory(histData);

      // Fetch interview prep
      const { data: prepData } = await supabase
        .from("interview_prep")
        .select("*")
        .eq("job_id", jobId!)
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (prepData) setInterviewPrep(prepData);
      setInterviewFetched(true);

      const uid = session.user.id;
      const [profileRes, workRes, eduRes, langRes, interestsRes, awardsRes, volRes, skillsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, email").eq("id", uid).single(),
        supabase.from("work_experiences").select("*").eq("user_id", uid).order("start_year", { ascending: false }),
        supabase.from("education").select("*").eq("user_id", uid).order("start_year", { ascending: false }),
        supabase.from("languages").select("*").eq("user_id", uid),
        supabase.from("interests").select("*").eq("user_id", uid).maybeSingle(),
        supabase.from("awards").select("*").eq("user_id", uid),
        supabase.from("volunteering").select("*").eq("user_id", uid).order("start_year", { ascending: false }),
        supabase.from("skills").select("*").eq("user_id", uid).maybeSingle(),
      ]);
      setUserProfile({
        full_name: profileRes.data?.full_name || null,
        email: profileRes.data?.email || null,
        work_experiences: workRes.data || [],
        education: eduRes.data || [],
        languages: langRes.data || [],
        interests: (interestsRes.data as any)?.interests || [],
        awards: awardsRes.data || [],
        volunteering: volRes.data || [],
      });
      setMasterHardSkills((skillsRes.data as any)?.hard_skills || []);
      setMasterSoftSkills((skillsRes.data as any)?.soft_skills || []);
      setJobLoading(false);
    };
    init();
  }, [jobId, navigate]);

  // Reset bullet toggles when cvOutput changes
  useEffect(() => {
    setBulletToggles({});
  }, [cvOutput?.id, cvOutput?.updated_at]);

  const handleStatusChange = async (newStatus: string) => {
    if (!job) return;
    const updates: any = { status: newStatus };
    if (newStatus === "Applied" && !job.applied_date) {
      updates.applied_date = format(new Date(), "yyyy-MM-dd");
    }
    await supabase.from("jobs").update(updates).eq("id", job.id);
    setJob(prev => prev ? { ...prev, ...updates } : prev);
  };

  const handleAppliedDateChange = async (date: Date | undefined) => {
    if (!job) return;
    const applied_date = date ? format(date, "yyyy-MM-dd") : null;
    await supabase.from("jobs").update({ applied_date }).eq("id", job.id);
    setJob(prev => prev ? { ...prev, applied_date } : prev);
  };

  const handleNotesChange = useCallback((value: string) => {
    setNotes(value);
    setNotesSaved(false);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (jobId) {
        await supabase.from("jobs").update({ notes: value }).eq("id", jobId);
        setNotesSaved(true);
      }
    }, 1000);
  }, [jobId]);

  const addContact = async () => {
    if (!userId || !jobId) return;
    const url = linkedinUrl.trim();
    const { data, error } = await supabase
      .from("contacts")
      .insert({ job_id: jobId, user_id: userId, linkedin_url: url || null, name: url ? "Loading..." : "New Contact" })
      .select("*")
      .single();
    if (!error && data) {
      setContacts(prev => [...prev, data as any]);
      setLinkedinUrl("");
    }
  };

  const updateContact = async (id: string, patch: Partial<Contact>) => {
    await supabase.from("contacts").update(patch).eq("id", id);
    setContacts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const deleteContact = async (id: string) => {
    await supabase.from("contacts").delete().eq("id", id);
    setContacts(prev => prev.filter(c => c.id !== id));
  };

  const handleGenerateCv = async (skipConfirm = false) => {
    if (!jobId || !userId) return;

    if (cvOutput && !skipConfirm) {
      setRegenConfirmOpen(true);
      return;
    }

    setRegenConfirmOpen(false);
    setCvLoading(true);
    setCvError(null);
    try {
      if (cvOutput) {
        const snapshot = {
          tailored_summary: cvOutput.tailored_summary,
          selected_bullets: cvOutput.selected_bullets,
          selected_hard_skills: cvOutput.selected_hard_skills,
          selected_soft_skills: cvOutput.selected_soft_skills,
          tailoring_notes: cvOutput.tailoring_notes,
          updated_at: cvOutput.updated_at,
        };
        await supabase.from("cv_output_history").insert({
          cv_output_id: cvOutput.id,
          job_id: jobId,
          user_id: userId,
          snapshot,
        });

        const { data: allHist } = await supabase
          .from("cv_output_history")
          .select("id, created_at")
          .eq("job_id", jobId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (allHist && allHist.length > 5) {
          const toDelete = allHist.slice(5).map(h => h.id);
          await supabase.from("cv_output_history").delete().in("id", toDelete);
        }
      }

      const { data, error } = await supabase.functions.invoke("tailor-cv", {
        body: { job_id: jobId },
      });
      if (error || !data?.success) {
        const msg = data?.error || error?.message || "CV generation failed. Please try again.";
        setCvError(msg);
        toast.error(msg);
        return;
      }
      setCvOutput(data.data as CvOutput);
      toast.success("Application kit generated!");

      const { data: histData } = await supabase
        .from("cv_output_history")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (histData) setCvHistory(histData);
    } catch (e: any) {
      const msg = e?.message || "CV generation failed. Please try again.";
      setCvError(msg);
      toast.error(msg);
    } finally {
      setCvLoading(false);
    }
  };

  const handleRestoreVersion = async (historyEntry: any) => {
    if (!cvOutput || !jobId || !userId) return;
    const snapshot = historyEntry.snapshot;
    const { error } = await supabase
      .from("cv_outputs")
      .update({
        tailored_summary: snapshot.tailored_summary,
        selected_bullets: snapshot.selected_bullets,
        selected_hard_skills: snapshot.selected_hard_skills,
        selected_soft_skills: snapshot.selected_soft_skills,
        tailoring_notes: snapshot.tailoring_notes,
      })
      .eq("id", cvOutput.id);
    if (error) {
      toast.error("Failed to restore version.");
      return;
    }
    setCvOutput(prev => prev ? { ...prev, ...snapshot, updated_at: new Date().toISOString() } : prev);
    setPreviewVersion(null);
    toast.success("Version restored!");
  };

  const startEdit = () => {
    if (!job) return;
    setEditData({
      job_title: job.job_title, company_name: job.company_name, location: job.location,
      work_mode: job.work_mode, duration: job.duration, function: job.function,
      application_deadline: job.application_deadline, status: job.status, priority: job.priority,
      url: job.url, hard_skills: [...(job.hard_skills || [])], soft_skills: [...(job.soft_skills || [])],
      skills_nice_to_have: [...(job.skills_nice_to_have || [])],
      languages_required: [...(job.languages_required || [])],
      languages_nice_to_have: [...(job.languages_nice_to_have || [])],
    });
    setIsEditing(true);
  };

  const cancelEdit = () => { setIsEditing(false); setEditData({}); };

  const saveEdit = async () => {
    if (!job) return;
    const updates: any = { ...editData };
    const { error } = await supabase.from("jobs").update(updates).eq("id", job.id);
    if (error) { toast.error("Failed to save changes."); return; }
    setJob(prev => prev ? { ...prev, ...updates } : prev);
    setIsEditing(false);
    setEditData({});
    toast.success("Job updated successfully");
  };

  const handleDeadlineInline = async (date: Date | undefined) => {
    if (!job) return;
    const deadline = date ? format(date, "yyyy-MM-dd") : null;
    await supabase.from("jobs").update({ application_deadline: deadline }).eq("id", job.id);
    setJob(prev => prev ? { ...prev, application_deadline: deadline } : prev);
    toast.success("Deadline updated");
  };

  const copyToClipboard = async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const handleCopyAll = async () => {
    if (!job) return;
    const sections = [
      `Company: ${job.company_name || "–"}`,
      `Title: ${job.job_title || "–"}`,
      `Location: ${job.location || "–"}`,
      `Skills: ${[...(job.hard_skills || []), ...(job.soft_skills || [])].join(", ") || "–"}`,
    ].join("\n");
    await navigator.clipboard.writeText(sections);
    toast.success("Copied to clipboard");
  };

  // Toggle a bullet between tailored/original
  const toggleBullet = (blockIdx: number, bulletIdx: number) => {
    const key = `${blockIdx}-${bulletIdx}`;
    setBulletToggles(prev => ({ ...prev, [key]: prev[key] === undefined ? false : !prev[key] }));
  };

  // Get whether a bullet should show tailored version
  const isBulletTailored = (blockIdx: number, bulletIdx: number): boolean => {
    const key = `${blockIdx}-${bulletIdx}`;
    return bulletToggles[key] === undefined ? true : bulletToggles[key];
  };

  // Add a hard skill to the cv_output
  const addHardSkill = async (skill: string) => {
    if (!cvOutput || !jobId) return;
    const current = { ...(cvOutput.selected_hard_skills || {}) };
    // Add to "Other" category or first available
    const categories = Object.keys(current);
    const targetCat = categories.length > 0 ? categories[categories.length - 1] : "Other";
    if (!current[targetCat]) current[targetCat] = [];
    current[targetCat] = [...current[targetCat], skill];

    setCvOutput(prev => prev ? { ...prev, selected_hard_skills: current } : prev);
    setRecentlyAdded(prev => new Set(prev).add(skill));
    setTimeout(() => setRecentlyAdded(prev => { const n = new Set(prev); n.delete(skill); return n; }), 600);

    await supabase.from("cv_outputs").update({ selected_hard_skills: current as any }).eq("id", cvOutput.id);
  };

  // Add a soft skill to the cv_output
  const addSoftSkill = async (skill: string) => {
    if (!cvOutput || !jobId) return;
    const current = [...(cvOutput.selected_soft_skills || []), skill];
    setCvOutput(prev => prev ? { ...prev, selected_soft_skills: current } : prev);
    setRecentlyAdded(prev => new Set(prev).add(skill));
    setTimeout(() => setRecentlyAdded(prev => { const n = new Set(prev); n.delete(skill); return n; }), 600);

    await supabase.from("cv_outputs").update({ selected_soft_skills: current }).eq("id", cvOutput.id);
  };

  // Compute hard skill suggestions
  const getHardSkillSuggestions = () => {
    if (!cvOutput || !job) return { fromJob: [] as string[], fromProfile: [] as string[] };
    const selectedFlat = new Set(
      Object.values(cvOutput.selected_hard_skills || {}).flat().map(s => s.toLowerCase())
    );

    const jobSkills = [...(job.hard_skills || []), ...(job.skills_nice_to_have || [])];
    const fromJob = jobSkills.filter(s => !selectedFlat.has(s.toLowerCase())).slice(0, 8);

    const fromProfile = masterHardSkills
      .filter(s => !selectedFlat.has(s.toLowerCase()) && !fromJob.some(j => j.toLowerCase() === s.toLowerCase()))
      .slice(0, 6);

    return { fromJob, fromProfile };
  };

  // Compute soft skill suggestions
  const getSoftSkillSuggestions = () => {
    if (!cvOutput || !job) return { fromJob: [] as string[], fromProfile: [] as string[] };
    const selectedFlat = new Set((cvOutput.selected_soft_skills || []).map(s => s.toLowerCase()));

    const fromJob = (job.soft_skills || [])
      .filter(s => !selectedFlat.has(s.toLowerCase()))
      .slice(0, 8);

    const fromProfile = masterSoftSkills
      .filter(s => !selectedFlat.has(s.toLowerCase()) && !fromJob.some(j => j.toLowerCase() === s.toLowerCase()))
      .slice(0, 6);

    return { fromJob, fromProfile };
  };

  if (jobLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-56" />
        <div className="grid grid-cols-2 gap-4 mt-8">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <p className="text-destructive font-medium">{fetchError}</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Job Tracker
        </Button>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate("/dashboard")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Job Tracker
        </button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold text-primary">{job.job_title || "Untitled Position"}</h1>
            <p className="text-lg text-muted-foreground">{job.company_name || "Unknown Company"}</p>
          </div>
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-sm", !job.applied_date && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {job.applied_date ? `Applied ${format(new Date(job.applied_date), "MMM d, yyyy")}` : "Set applied date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={job.applied_date ? new Date(job.applied_date) : undefined}
                  onSelect={handleAppliedDateChange}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Select value={job.status} onValueChange={handleStatusChange}>
              <SelectTrigger className={`h-9 w-auto border-0 gap-1.5 px-4 rounded-full text-sm font-medium ${getStatusColor(job.status)}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 h-auto">
          {["overview", "outreach", "cv", "notes"].map(tab => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 capitalize"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex justify-end mb-4">
                {isEditing ? (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={cancelEdit}>Cancel</Button>
                    <Button size="sm" onClick={saveEdit} className="gap-1.5" style={{ backgroundColor: '#950606' }}>
                      <Check className="h-3.5 w-3.5" /> Save
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={startEdit} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Title</p>
                    <Input value={editData.job_title || ""} onChange={(e) => setEditData(d => ({ ...d, job_title: e.target.value }))} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Company</p>
                    <Input value={editData.company_name || ""} onChange={(e) => setEditData(d => ({ ...d, company_name: e.target.value }))} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
                    <Input value={editData.location || ""} onChange={(e) => setEditData(d => ({ ...d, location: e.target.value }))} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Mode</p>
                    <Select value={editData.work_mode || ""} onValueChange={(v) => setEditData(d => ({ ...d, work_mode: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {WORK_MODE_VALUES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</p>
                    <Input value={editData.duration || ""} onChange={(e) => setEditData(d => ({ ...d, duration: e.target.value }))} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Function</p>
                    <Select value={editData.function || ""} onValueChange={(v) => setEditData(d => ({ ...d, function: v }))}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {FUNCTION_VALUES.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Application Deadline</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("w-full justify-start text-left h-9", !editData.application_deadline && "text-muted-foreground")}>
                          <CalendarIcon className="h-3.5 w-3.5 mr-2" />
                          {editData.application_deadline ? format(new Date(editData.application_deadline), "MMM d, yyyy") : "Set deadline"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editData.application_deadline ? new Date(editData.application_deadline) : undefined}
                          onSelect={(d) => setEditData(prev => ({ ...prev, application_deadline: d ? format(d, "yyyy-MM-dd") : null }))}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
                    <Select value={editData.status || ""} onValueChange={(v) => setEditData(d => ({ ...d, status: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Priority</p>
                    <Select value={editData.priority || ""} onValueChange={(v) => setEditData(d => ({ ...d, priority: v }))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS_EDIT.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job URL</p>
                    <Input value={editData.url || ""} onChange={(e) => setEditData(d => ({ ...d, url: e.target.value }))} className="h-9" />
                  </div>
                  <div className="space-y-1 col-span-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Hard Skills</p>
                    <TagInput tags={editData.hard_skills || []} onChange={(t) => setEditData(d => ({ ...d, hard_skills: t }))} placeholder="Add hard skill..." />
                  </div>
                  <div className="space-y-1 col-span-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Soft Skills</p>
                    <TagInput tags={editData.soft_skills || []} onChange={(t) => setEditData(d => ({ ...d, soft_skills: t }))} placeholder="Add soft skill..." />
                  </div>
                  <div className="space-y-1 col-span-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nice-to-Have Skills</p>
                    <TagInput tags={editData.skills_nice_to_have || []} onChange={(t) => setEditData(d => ({ ...d, skills_nice_to_have: t }))} placeholder="Add nice-to-have skill..." />
                  </div>
                  <div className="space-y-1 col-span-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Required Languages</p>
                    <TagInput tags={editData.languages_required || []} onChange={(t) => setEditData(d => ({ ...d, languages_required: t }))} placeholder="Add language..." />
                  </div>
                  <div className="space-y-1 col-span-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nice-to-Have Languages</p>
                    <TagInput tags={editData.languages_nice_to_have || []} onChange={(t) => setEditData(d => ({ ...d, languages_nice_to_have: t }))} placeholder="Add language..." />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Location</p>
                    <p className="text-sm text-foreground flex items-center gap-1.5">
                      {job.location ? <><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{job.location}</> : "–"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Work Mode</p>
                    <p className="text-sm text-foreground">{job.work_mode || "–"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</p>
                    <p className="text-sm text-foreground">{job.duration || "–"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Function</p>
                    <p className="text-sm text-foreground">{job.function || "–"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Application Deadline</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="text-sm text-foreground flex items-center gap-1.5 hover:text-primary transition-colors">
                          {job.application_deadline ? format(new Date(job.application_deadline), "MMM d, yyyy") : "–"}
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={job.application_deadline ? new Date(job.application_deadline) : undefined}
                          onSelect={handleDeadlineInline}
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Match Score</p>
                    <span className={`inline-flex items-center justify-center h-12 w-12 rounded-full border-2 text-lg font-bold ${getScoreColor(job.match_score)}`}>
                      {job.match_score ?? "–"}
                    </span>
                  </div>
                  <div className="space-y-1 col-span-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Required Skills</p>
                    <TagList tags={[...(job.hard_skills || []), ...(job.soft_skills || [])]} />
                  </div>
                  {(job.skills_nice_to_have?.length ?? 0) > 0 && (
                    <div className="space-y-1 col-span-full">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nice-to-Have Skills</p>
                      <TagList tags={job.skills_nice_to_have} soft />
                    </div>
                  )}
                  <div className="space-y-1 col-span-full">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Required Languages</p>
                    <TagList tags={job.languages_required} />
                  </div>
                  {(job.languages_nice_to_have?.length ?? 0) > 0 && (
                    <div className="space-y-1 col-span-full">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Nice-to-Have Languages</p>
                      <TagList tags={job.languages_nice_to_have} soft />
                    </div>
                  )}
                  {job.url && (
                    <div className="space-y-1 col-span-full">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job URL</p>
                      <a href={job.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                        {job.url} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Match Analysis */}
          <Card className="mt-6">
            <CardContent className="p-6">
              <h3 className="font-semibold text-foreground mb-4">Match Analysis</h3>
              {matchLoading ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-16 w-16 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-48" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[1,2,3,4].map(i => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-full rounded-full" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : job.match_score !== null && job.match_details ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-5">
                    <span className={`inline-flex items-center justify-center h-16 w-16 rounded-full border-2 text-2xl font-bold shrink-0 ${getScoreColor(job.match_score)}`}>
                      {job.match_score}
                    </span>
                    {job.match_details.match_summary && (
                      <p className="text-sm text-muted-foreground italic">{job.match_details.match_summary}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      { label: "Hard Skills", value: job.match_details.hard_skills_match },
                      { label: "Soft Skills", value: job.match_details.soft_skills_match },
                      { label: "Experience", value: job.match_details.experience_match },
                      { label: "Languages", value: job.match_details.language_match },
                    ].map(({ label, value }) => (
                      <div key={label} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="font-medium text-muted-foreground">{label}</span>
                          <span className="font-semibold text-foreground">{value ?? "–"}</span>
                        </div>
                        <Progress value={value ?? 0} className="h-2" />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {job.match_details.strengths?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Strengths</p>
                        <ul className="space-y-1.5">
                          {job.match_details.strengths.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {job.match_details.missing_skills?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Missing Skills</p>
                        <ul className="space-y-1.5">
                          {job.match_details.missing_skills.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No match analysis available yet. Complete your profile to enable scoring.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Outreach Tab */}
        <TabsContent value="outreach" className="mt-6 space-y-4">
          <div className="flex gap-3">
            <Input
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="Paste a LinkedIn profile URL"
              className="flex-1"
              onKeyDown={(e) => e.key === "Enter" && addContact()}
            />
            <Button onClick={addContact}>Add Contact</Button>
          </div>
          {contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No contacts added yet. Paste a LinkedIn URL above to add one.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {contacts.map(c => (
                <ContactCard key={c.id} contact={c} onUpdate={updateContact} onDelete={deleteContact} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* CV Tab — Application Kit */}
        <TabsContent value="cv" className="mt-6 space-y-6">
          {/* Generate / Regenerate button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">Application Kit</h3>
              <p className="text-sm text-muted-foreground">AI-tailored components ready to copy into your CV.</p>
              {cvOutput && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last generated {format(new Date(cvOutput.updated_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              )}
            </div>
            <Button
              onClick={() => handleGenerateCv()}
              disabled={cvLoading}
              className="gap-1.5 bg-[#950606] hover:bg-[#7a0505] text-white"
            >
              {cvLoading ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Generating...</>
              ) : cvOutput ? (
                <><RefreshCw className="h-4 w-4" /> Regenerate</>
              ) : (
                <><FileText className="h-4 w-4" /> Generate Tailored CV</>
              )}
            </Button>
          </div>

          {/* Loading state */}
          {cvLoading && (
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="text-center space-y-3">
                  <RefreshCw className="h-8 w-8 text-[#950606] animate-spin mx-auto" />
                  <p className="text-sm font-medium text-foreground">Building your application kit...</p>
                  <p className="text-xs text-muted-foreground">This usually takes 10–15 seconds. Hiro is selecting the best bullets, rewriting your summary, and picking skills.</p>
                </div>
                <div className="space-y-4">
                  {[1,2,3,4].map(i => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-5 w-48" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-5/6" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Error state */}
          {!cvLoading && cvError && !cvOutput && (
            <Card className="border-destructive">
              <CardContent className="p-6 text-center space-y-3">
                <p className="text-sm text-destructive font-medium">{cvError}</p>
                <Button variant="outline" size="sm" onClick={() => { setCvError(null); handleGenerateCv(true); }}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!cvLoading && !cvOutput && cvFetched && !cvError && (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Click "Generate Tailored CV" to create an application kit for this position.</p>
              </CardContent>
            </Card>
          )}

          {/* Application Kit Cards */}
          {!cvLoading && cvOutput && (
            <>
              {/* Card 1: Professional Summary */}
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-foreground">Professional Summary</h4>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#950606]/10 text-[#950606]">
                        Tailored for {job.company_name}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => {
                      const el = document.getElementById("summary-editable");
                      if (el) copyToClipboard(el.innerText, "Summary");
                    }}>
                      <Copy className="h-3 w-3" /> Copy
                    </Button>
                  </div>
                  <div
                    id="summary-editable"
                    contentEditable
                    suppressContentEditableWarning
                    className="text-sm text-foreground leading-relaxed outline-none focus:ring-1 focus:ring-ring rounded p-2 -m-2"
                  >
                    {cvOutput.tailored_summary}
                  </div>
                </CardContent>
              </Card>

              {/* Card 2: Experience Bullet Points */}
              {Array.isArray(cvOutput.selected_bullets) && cvOutput.selected_bullets.length > 0 && (
                <Card>
                  <CardContent className="p-5">
                    <h4 className="font-semibold text-foreground mb-4">Selected Bullet Points</h4>
                    <div className="space-y-5">
                      {(cvOutput.selected_bullets as BulletBlock[]).map((block, blockIdx) => {
                        const normalizedBullets = (block.bullets || []).map(normalizeBullet);
                        return (
                          <div key={blockIdx}>
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="font-semibold text-sm text-foreground">{block.company}</p>
                                <p className="text-xs text-muted-foreground">{block.job_title}</p>
                              </div>
                              <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => {
                                const text = normalizedBullets
                                  .map((b, bulletIdx) => {
                                    const showTailored = isBulletTailored(blockIdx, bulletIdx);
                                    return `• ${showTailored ? b.tailored : b.original}`;
                                  })
                                  .join("\n");
                                copyToClipboard(text, `${block.company} bullets`);
                              }}>
                                <Copy className="h-3 w-3" /> Copy
                              </Button>
                            </div>
                            <ul className="space-y-2.5">
                              {normalizedBullets.map((bullet, bulletIdx) => {
                                const identical = bulletsAreIdentical(bullet);
                                const showTailored = isBulletTailored(blockIdx, bulletIdx);
                                return (
                                  <li key={bulletIdx} className="flex items-start gap-2 group">
                                    <span className="text-muted-foreground mt-1.5 shrink-0">•</span>
                                    <div className="flex-1 min-w-0">
                                      <span
                                        contentEditable
                                        suppressContentEditableWarning
                                        className="text-sm text-foreground outline-none focus:ring-1 focus:ring-ring rounded px-0.5 block"
                                      >
                                        {showTailored ? bullet.tailored : bullet.original}
                                      </span>
                                    </div>
                                    {!identical && (
                                      <button
                                        onClick={() => toggleBullet(blockIdx, bulletIdx)}
                                        className="shrink-0 mt-0.5 flex items-center gap-1"
                                        title={showTailored ? "Showing tailored version" : "Showing original version"}
                                      >
                                        <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${showTailored ? "bg-[#950606]" : "bg-gray-300"}`}>
                                          <div className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${showTailored ? "translate-x-4" : "translate-x-0.5"}`} />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                          {showTailored ? "Tailored" : "Original"}
                                        </span>
                                      </button>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Card 3: Hard Skills */}
              {cvOutput.selected_hard_skills && Object.keys(cvOutput.selected_hard_skills).length > 0 && (
                <>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-foreground">Hard Skills</h4>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => {
                          const parts = Object.entries(cvOutput.selected_hard_skills!).map(
                            ([cat, skills]) => `${cat}: ${(skills as string[]).join(", ")}`
                          );
                          copyToClipboard("Software Skills: " + parts.join("; ") + ".", "Hard skills");
                        }}>
                          <Copy className="h-3 w-3" /> Copy all
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {Object.entries(cvOutput.selected_hard_skills).map(([category, skills]) => (
                          <div key={category}>
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{category}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(skills as string[]).map((skill, i) => (
                                <span
                                  key={i}
                                  className={cn(
                                    "inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground transition-all",
                                    recentlyAdded.has(skill) && "animate-in fade-in-0 zoom-in-95 duration-300 ring-1 ring-green-400"
                                  )}
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Hard Skill Suggestions */}
                  {(() => {
                    const { fromJob, fromProfile } = getHardSkillSuggestions();
                    if (fromJob.length === 0 && fromProfile.length === 0) return null;
                    return (
                      <div className="space-y-2 -mt-3">
                        <p className="text-xs font-medium text-muted-foreground">Also relevant for this role</p>
                        {fromJob.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1.5">From job requirements</p>
                            <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                              {fromJob.map((skill) => (
                                <button
                                  key={skill}
                                  onClick={() => addHardSkill(skill)}
                                  className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-gray-600 border border-gray-200 hover:scale-105 hover:border-gray-300 transition-all cursor-pointer"
                                >
                                  + {skill}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {fromProfile.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1.5">From your profile</p>
                            <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                              {fromProfile.map((skill) => (
                                <button
                                  key={skill}
                                  onClick={() => addHardSkill(skill)}
                                  className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-gray-600 border border-gray-200 hover:scale-105 hover:border-gray-300 transition-all cursor-pointer"
                                >
                                  + {skill}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Card 4: Soft Skills */}
              {cvOutput.selected_soft_skills?.length > 0 && (
                <>
                  <Card>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-foreground">Soft Skills</h4>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs" onClick={() => {
                          copyToClipboard(cvOutput.selected_soft_skills.join(", "), "Soft skills");
                        }}>
                          <Copy className="h-3 w-3" /> Copy all
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {cvOutput.selected_soft_skills.map((skill, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground transition-all",
                              recentlyAdded.has(skill) && "animate-in fade-in-0 zoom-in-95 duration-300 ring-1 ring-green-400"
                            )}
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Soft Skill Suggestions */}
                  {(() => {
                    const { fromJob, fromProfile } = getSoftSkillSuggestions();
                    if (fromJob.length === 0 && fromProfile.length === 0) return null;
                    return (
                      <div className="space-y-2 -mt-3">
                        <p className="text-xs font-medium text-muted-foreground">Also relevant for this role</p>
                        {fromJob.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1.5">From job requirements</p>
                            <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                              {fromJob.map((skill) => (
                                <button
                                  key={skill}
                                  onClick={() => addSoftSkill(skill)}
                                  className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-gray-600 border border-gray-200 hover:scale-105 hover:border-gray-300 transition-all cursor-pointer"
                                >
                                  + {skill}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {fromProfile.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/70 mb-1.5">From your profile</p>
                            <div className="flex flex-wrap gap-1.5 overflow-x-auto">
                              {fromProfile.map((skill) => (
                                <button
                                  key={skill}
                                  onClick={() => addSoftSkill(skill)}
                                  className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#F3F4F6] text-gray-600 border border-gray-200 hover:scale-105 hover:border-gray-300 transition-all cursor-pointer"
                                >
                                  + {skill}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Tailoring Notes */}
              {cvOutput.tailoring_notes?.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <Lightbulb className="h-4 w-4" />
                      Why Hiro chose these
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="p-5">
                        <ul className="space-y-1.5 list-disc list-outside ml-5">
                          {cvOutput.tailoring_notes.map((note, i) => (
                            <li key={i} className="text-sm text-amber-800">{note}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {/* Version History */}
              {cvHistory.length > 0 && (
                <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                      <History className="h-4 w-4" />
                      Previous versions ({cvHistory.length})
                      {historyOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-3">
                    <Card>
                      <CardContent className="p-4 space-y-2">
                        {cvHistory.map((h) => (
                          <button
                            key={h.id}
                            onClick={() => setPreviewVersion(h)}
                            className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors text-left"
                          >
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm text-foreground">
                                {format(new Date(h.created_at), "MMM d, yyyy 'at' h:mm a")}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">View →</span>
                          </button>
                        ))}
                      </CardContent>
                    </Card>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </>
          )}

          {/* Regeneration Confirmation */}
          <AlertDialog open={regenConfirmOpen} onOpenChange={setRegenConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Regenerate CV?</AlertDialogTitle>
                <AlertDialogDescription>The current version will be saved to history.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleGenerateCv(true)} className="bg-[#950606] hover:bg-[#7a0505]">Regenerate</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* History Preview Modal */}
          <Dialog open={!!previewVersion} onOpenChange={(open) => !open && setPreviewVersion(null)}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Version — {previewVersion && format(new Date(previewVersion.created_at), "MMM d, yyyy 'at' h:mm a")}</DialogTitle>
                <DialogDescription>Preview of a previous version.</DialogDescription>
              </DialogHeader>
              {previewVersion?.snapshot && (
                <div className="space-y-4 text-sm">
                  {previewVersion.snapshot.tailored_summary && (
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-widest border-b pb-1 mb-2">Summary</h4>
                      <p>{previewVersion.snapshot.tailored_summary}</p>
                    </div>
                  )}
                  {Array.isArray(previewVersion.snapshot.selected_bullets) && previewVersion.snapshot.selected_bullets.length > 0 && (
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-widest border-b pb-1 mb-2">Bullets</h4>
                      {previewVersion.snapshot.selected_bullets.map((block: any, i: number) => (
                        <div key={i} className="mb-3">
                          <p className="font-semibold">{block.company} — {block.job_title}</p>
                          <ul className="list-disc list-outside ml-4 mt-1 space-y-0.5">
                            {(block.bullets || []).map((b: any, j: number) => (
                              <li key={j}>{typeof b === "string" ? b : b.tailored || b.original}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                  {previewVersion.snapshot.selected_soft_skills?.length > 0 && (
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-widest border-b pb-1 mb-2">Soft Skills</h4>
                      <p>{previewVersion.snapshot.selected_soft_skills.join(", ")}</p>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewVersion(null)}>Close</Button>
                <Button onClick={() => handleRestoreVersion(previewVersion)} className="gap-1.5 bg-[#950606] hover:bg-[#7a0505] text-white">
                  <RotateCcw className="h-3.5 w-3.5" /> Restore this version
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes" className="mt-6">
          <Card>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Notes</h3>
                <span className={`text-xs transition-opacity ${notesSaved ? "text-muted-foreground opacity-100" : "opacity-0"}`}>
                  {notesSaved && notes ? "✓ Saved" : ""}
                </span>
              </div>
              <Textarea
                value={notes}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Write any notes about this application..."
                rows={12}
                className="resize-none"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default JobDetail;
