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
import { ArrowLeft, ExternalLink, MapPin, Copy, Check, Trash2, ChevronDown, ChevronUp, FileText, Download, CheckCircle2, XCircle, CalendarIcon, RefreshCw, Lightbulb, History, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type CvOutput = {
  id: string;
  profile_headline: string | null;
  selected_experiences: any[];
  selected_hard_skills: string[];
  selected_soft_skills: string[];
  selected_education: any[];
  selected_languages: any[];
  selected_awards: any[];
  selected_volunteering: any[];
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
  const [cvOutput, setCvOutput] = useState<CvOutput | null>(null);
  const [cvLoading, setCvLoading] = useState(false);
  const [cvFetched, setCvFetched] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string | null; email: string | null }>({ full_name: null, email: null });
  const [copiedCv, setCopiedCv] = useState(false);
  const [cvHistory, setCvHistory] = useState<any[]>([]);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewVersion, setPreviewVersion] = useState<any | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUserId(session.user.id);

      const { data: jobData } = await supabase
        .from("jobs")
        .select("*")
        .eq("id", jobId!)
        .eq("user_id", session.user.id)
        .single();
      if (!jobData) { navigate("/dashboard"); return; }
      setJob(jobData as any);
      setNotes(jobData.notes || "");

      // If no match score yet, it might be calculating — poll for it
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
        // Stop polling after 60s
        setTimeout(() => { clearInterval(pollInterval); setMatchLoading(false); }, 60000);
      }

      const { data: contactData } = await supabase
        .from("contacts")
        .select("*")
        .eq("job_id", jobId!)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: true });
      if (contactData) setContacts(contactData as any);

      // Fetch existing CV output
      const { data: cvData } = await supabase
        .from("cv_outputs")
        .select("*")
        .eq("job_id", jobId!)
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cvData) setCvOutput(cvData as any);
      setCvFetched(true);

      // Fetch CV history
      const { data: histData } = await supabase
        .from("cv_output_history")
        .select("*")
        .eq("job_id", jobId!)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });
      if (histData) setCvHistory(histData);

      // Fetch user profile for CV header
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session.user.id)
        .single();
      if (profileData) setUserProfile(profileData);
    };
    init();
  }, [jobId, navigate]);

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

    // If CV exists and not confirmed, show confirmation
    if (cvOutput && !skipConfirm) {
      setRegenConfirmOpen(true);
      return;
    }

    setRegenConfirmOpen(false);
    setCvLoading(true);
    try {
      // Save current version to history before regenerating
      if (cvOutput) {
        const snapshot = {
          profile_headline: cvOutput.profile_headline,
          selected_experiences: cvOutput.selected_experiences,
          selected_hard_skills: cvOutput.selected_hard_skills,
          selected_soft_skills: cvOutput.selected_soft_skills,
          selected_education: cvOutput.selected_education,
          selected_languages: cvOutput.selected_languages,
          selected_awards: cvOutput.selected_awards,
          selected_volunteering: cvOutput.selected_volunteering,
          tailoring_notes: cvOutput.tailoring_notes,
          updated_at: cvOutput.updated_at,
        };
        await supabase.from("cv_output_history").insert({
          cv_output_id: cvOutput.id,
          job_id: jobId,
          user_id: userId,
          snapshot,
        });

        // Enforce max 5 history entries — delete oldest if over limit
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
        toast.error(data?.message || "CV generation failed. Please try again.");
        return;
      }
      setCvOutput(data.data as CvOutput);
      toast.success("CV generated successfully!");

      // Refresh history
      const { data: histData } = await supabase
        .from("cv_output_history")
        .select("*")
        .eq("job_id", jobId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (histData) setCvHistory(histData);
    } catch {
      toast.error("CV generation failed. Please try again.");
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
        profile_headline: snapshot.profile_headline,
        selected_experiences: snapshot.selected_experiences,
        selected_hard_skills: snapshot.selected_hard_skills,
        selected_soft_skills: snapshot.selected_soft_skills,
        selected_education: snapshot.selected_education,
        selected_languages: snapshot.selected_languages,
        selected_awards: snapshot.selected_awards,
        selected_volunteering: snapshot.selected_volunteering,
        tailoring_notes: snapshot.tailoring_notes,
      })
      .eq("id", cvOutput.id);
    if (error) {
      toast.error("Failed to restore version.");
      return;
    }
    setCvOutput(prev => prev ? {
      ...prev,
      ...snapshot,
      updated_at: new Date().toISOString(),
    } : prev);
    setPreviewVersion(null);
    toast.success("Version restored successfully!");
  };

  const buildCvPlainText = () => {
    if (!cvOutput) return "";
    const lines: string[] = [];
    if (userProfile.full_name) lines.push(userProfile.full_name);
    if (userProfile.email) lines.push(userProfile.email);
    if (cvOutput.profile_headline) lines.push(cvOutput.profile_headline);
    lines.push("");

    if (cvOutput.selected_experiences?.length) {
      lines.push("EXPERIENCE");
      lines.push("─".repeat(40));
      for (const exp of cvOutput.selected_experiences) {
        lines.push(`${exp.company} — ${exp.job_title}`);
        lines.push(`${exp.start_date} – ${exp.end_date}${exp.location ? ` | ${exp.location}` : ""}`);
        for (const b of exp.selected_bullets || []) lines.push(`  • ${b}`);
        lines.push("");
      }
    }

    if (cvOutput.selected_education?.length) {
      lines.push("EDUCATION");
      lines.push("─".repeat(40));
      for (const edu of cvOutput.selected_education) {
        lines.push(`${edu.institution} — ${edu.degree}, ${edu.field}`);
        if (edu.grade) lines.push(`  Grade: ${edu.grade}`);
        if (edu.activities) lines.push(`  Activities: ${edu.activities}`);
        lines.push("");
      }
    }

    if (cvOutput.selected_hard_skills?.length || cvOutput.selected_soft_skills?.length) {
      lines.push("SKILLS");
      lines.push("─".repeat(40));
      if (cvOutput.selected_hard_skills?.length) lines.push(`Hard Skills: ${cvOutput.selected_hard_skills.join(", ")}`);
      if (cvOutput.selected_soft_skills?.length) lines.push(`Soft Skills: ${cvOutput.selected_soft_skills.join(", ")}`);
      lines.push("");
    }

    if (cvOutput.selected_languages?.length) {
      lines.push("LANGUAGES");
      lines.push("─".repeat(40));
      for (const l of cvOutput.selected_languages) lines.push(`${l.language} — ${l.proficiency}`);
      lines.push("");
    }

    if (cvOutput.selected_awards?.length) {
      lines.push("AWARDS");
      lines.push("─".repeat(40));
      for (const a of cvOutput.selected_awards) lines.push(`${a.award_name || a.name}${a.organization ? ` — ${a.organization}` : ""}${a.year ? ` (${a.year})` : ""}`);
      lines.push("");
    }

    if (cvOutput.selected_volunteering?.length) {
      lines.push("VOLUNTEERING");
      lines.push("─".repeat(40));
      for (const v of cvOutput.selected_volunteering) lines.push(`${v.organization}${v.role ? ` — ${v.role}` : ""}${v.start_year ? ` (${v.start_year}–${v.end_year || "Present"})` : ""}`);
      lines.push("");
    }

    return lines.join("\n");
  };

  const handleCopyCv = async () => {
    const text = buildCvPlainText();
    await navigator.clipboard.writeText(text);
    setCopiedCv(true);
    setTimeout(() => setCopiedCv(false), 2000);
    toast.success("CV copied to clipboard");
  };

  const handleDownloadPdf = async () => {
    if (!cvOutput) return;
    // Build a printable HTML document
    const name = userProfile.full_name || "";
    const email = userProfile.email || "";
    const headline = cvOutput.profile_headline || "";

    const sectionStyle = `style="margin-top:18px;font-size:12px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;border-bottom:2px solid #950606;padding-bottom:3px;margin-bottom:8px;"`;
    const bodyStyle = `style="font-size:10px;line-height:1.5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px;"`;

    let html = `<html><head><style>@page{margin:50px 60px;}body{font-size:10px;line-height:1.5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:700px;margin:0 auto;padding:40px;}ul{margin:3px 0;padding-left:18px;}li{margin-bottom:2px;}</style></head><body ${bodyStyle}>`;

    // Header
    html += `<div style="text-align:center;margin-bottom:16px;">`;
    html += `<div style="font-size:18px;font-weight:bold;">${name}</div>`;
    if (email) html += `<div style="font-size:10px;color:#666;">${email}</div>`;
    if (headline) html += `<div style="font-size:10px;font-style:italic;color:#444;margin-top:4px;">${headline}</div>`;
    html += `</div>`;

    // Experience
    if (cvOutput.selected_experiences?.length) {
      html += `<div ${sectionStyle}>Experience</div>`;
      for (const exp of cvOutput.selected_experiences) {
        html += `<div style="display:flex;justify-content:space-between;margin-top:8px;"><div><strong>${exp.company}</strong> — ${exp.job_title}</div><div style="color:#666;font-size:9px;">${exp.start_date} – ${exp.end_date}</div></div>`;
        if (exp.location) html += `<div style="color:#888;font-size:9px;">${exp.location}</div>`;
        if (exp.selected_bullets?.length) {
          html += `<ul>`;
          for (const b of exp.selected_bullets) html += `<li>${b}</li>`;
          html += `</ul>`;
        }
      }
    }

    // Education
    if (cvOutput.selected_education?.length) {
      html += `<div ${sectionStyle}>Education</div>`;
      for (const edu of cvOutput.selected_education) {
        html += `<div style="margin-top:6px;"><strong>${edu.institution}</strong> — ${edu.degree}, ${edu.field}</div>`;
        if (edu.grade) html += `<div style="font-size:9px;color:#666;">Grade: ${edu.grade}</div>`;
        if (edu.activities) html += `<div style="font-size:9px;color:#666;">Activities: ${edu.activities}</div>`;
      }
    }

    // Skills
    if (cvOutput.selected_hard_skills?.length || cvOutput.selected_soft_skills?.length) {
      html += `<div ${sectionStyle}>Skills</div>`;
      if (cvOutput.selected_hard_skills?.length) html += `<div><strong>Hard Skills:</strong> ${cvOutput.selected_hard_skills.join(", ")}</div>`;
      if (cvOutput.selected_soft_skills?.length) html += `<div><strong>Soft Skills:</strong> ${cvOutput.selected_soft_skills.join(", ")}</div>`;
    }

    // Languages
    if (cvOutput.selected_languages?.length) {
      html += `<div ${sectionStyle}>Languages</div>`;
      for (const l of cvOutput.selected_languages) html += `<div>${l.language} — ${l.proficiency}</div>`;
    }

    // Awards
    if (cvOutput.selected_awards?.length) {
      html += `<div ${sectionStyle}>Awards</div>`;
      for (const a of cvOutput.selected_awards) html += `<div>${a.award_name || a.name}${a.organization ? ` — ${a.organization}` : ""}${a.year ? ` (${a.year})` : ""}</div>`;
    }

    // Volunteering
    if (cvOutput.selected_volunteering?.length) {
      html += `<div ${sectionStyle}>Volunteering</div>`;
      for (const v of cvOutput.selected_volunteering) html += `<div>${v.organization}${v.role ? ` — ${v.role}` : ""}${v.start_year ? ` (${v.start_year}–${v.end_year || "Present"})` : ""}</div>`;
    }

    html += `</body></html>`;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); }, 500);
    }
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
            {/* Applied Date */}
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
                  <p className="text-sm text-foreground">{job.application_deadline || "–"}</p>
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
                  {/* Score + Summary */}
                  <div className="flex items-center gap-5">
                    <span className={`inline-flex items-center justify-center h-16 w-16 rounded-full border-2 text-2xl font-bold shrink-0 ${getScoreColor(job.match_score)}`}>
                      {job.match_score}
                    </span>
                    {job.match_details.match_summary && (
                      <p className="text-sm text-muted-foreground italic">{job.match_details.match_summary}</p>
                    )}
                  </div>

                  {/* Sub-score bars */}
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

                  {/* Strengths & Missing Skills */}
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

        {/* CV Tab */}
        <TabsContent value="cv" className="mt-6 space-y-6">
          {/* Generate / Regenerate button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">AI-Tailored CV</h3>
              <p className="text-sm text-muted-foreground">Generate a CV tailored to this specific job posting.</p>
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
                  <p className="text-sm font-medium text-foreground">Hiro is tailoring your CV for this role...</p>
                  <p className="text-xs text-muted-foreground">This usually takes 10–15 seconds. We're selecting the best experiences, rewriting bullets, and optimising your profile.</p>
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4 mx-auto" />
                  <Skeleton className="h-4 w-1/2 mx-auto" />
                  <Skeleton className="h-4 w-2/3 mx-auto" />
                  <div className="space-y-3 pt-4">
                    {[1,2,3].map(i => (
                      <div key={i} className="space-y-2">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                        <Skeleton className="h-3 w-4/6" />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!cvLoading && !cvOutput && cvFetched && (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Click "Generate Tailored CV" to create a CV optimised for this position.</p>
              </CardContent>
            </Card>
          )}

          {/* CV Preview */}
          {!cvLoading && cvOutput && (
            <>
              <Card>
                <CardContent className="p-8">
                  {/* Header */}
                  <div className="text-center mb-6 pb-4 border-b">
                    <h2 className="text-xl font-bold text-foreground">{userProfile.full_name || "Your Name"}</h2>
                    {userProfile.email && <p className="text-sm text-muted-foreground">{userProfile.email}</p>}
                    {cvOutput.profile_headline && <p className="text-sm italic text-muted-foreground mt-1">{cvOutput.profile_headline}</p>}
                  </div>

                  {/* Experience */}
                  {cvOutput.selected_experiences?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground border-b-2 border-[#950606] pb-1 mb-3">Experience</h3>
                      <div className="space-y-4">
                        {cvOutput.selected_experiences.map((exp: any, i: number) => (
                          <div key={i}>
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-semibold text-sm text-foreground">{exp.company}</span>
                                <span className="text-sm text-foreground"> — {exp.job_title}</span>
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{exp.start_date} – {exp.end_date}</span>
                            </div>
                            {exp.location && <p className="text-xs text-muted-foreground">{exp.location}</p>}
                            {exp.selected_bullets?.length > 0 && (
                              <ul className="mt-1.5 space-y-1 list-disc list-outside ml-4">
                                {exp.selected_bullets.map((b: string, j: number) => (
                                  <li key={j} className="text-sm text-foreground">{b}</li>
                                ))}
                              </ul>
                            )}
                            <span className="inline-block mt-1.5 text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              {exp.relevance_score}% match
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Education */}
                  {cvOutput.selected_education?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground border-b-2 border-[#950606] pb-1 mb-3">Education</h3>
                      <div className="space-y-3">
                        {cvOutput.selected_education.map((edu: any, i: number) => (
                          <div key={i}>
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-semibold text-sm text-foreground">{edu.institution}</span>
                                <span className="text-sm text-foreground"> — {edu.degree}, {edu.field}</span>
                              </div>
                            </div>
                            {edu.grade && <p className="text-xs text-muted-foreground">Grade: {edu.grade}</p>}
                            {edu.activities && <p className="text-xs text-muted-foreground">Activities: {edu.activities}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Skills */}
                  {(cvOutput.selected_hard_skills?.length > 0 || cvOutput.selected_soft_skills?.length > 0) && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground border-b-2 border-[#950606] pb-1 mb-3">Skills</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {cvOutput.selected_hard_skills?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Hard Skills</p>
                            <p className="text-sm text-foreground">{cvOutput.selected_hard_skills.join(", ")}</p>
                          </div>
                        )}
                        {cvOutput.selected_soft_skills?.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Soft Skills</p>
                            <p className="text-sm text-foreground">{cvOutput.selected_soft_skills.join(", ")}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {cvOutput.selected_languages?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground border-b-2 border-[#950606] pb-1 mb-3">Languages</h3>
                      <div className="space-y-1">
                        {cvOutput.selected_languages.map((l: any, i: number) => (
                          <p key={i} className="text-sm text-foreground">{l.language} — <span className="text-muted-foreground">{l.proficiency}</span></p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Awards */}
                  {cvOutput.selected_awards?.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground border-b-2 border-[#950606] pb-1 mb-3">Awards</h3>
                      <div className="space-y-1">
                        {cvOutput.selected_awards.map((a: any, i: number) => (
                          <p key={i} className="text-sm text-foreground">
                            {a.award_name || a.name}{a.organization ? ` — ${a.organization}` : ""}{a.year ? ` (${a.year})` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Volunteering */}
                  {cvOutput.selected_volunteering?.length > 0 && (
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground border-b-2 border-[#950606] pb-1 mb-3">Volunteering</h3>
                      <div className="space-y-1">
                        {cvOutput.selected_volunteering.map((v: any, i: number) => (
                          <p key={i} className="text-sm text-foreground">
                            {v.organization}{v.role ? ` — ${v.role}` : ""}{v.start_year ? ` (${v.start_year}–${v.end_year || "Present"})` : ""}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tailoring Notes */}
              {cvOutput.tailoring_notes?.length > 0 && (
                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Lightbulb className="h-4 w-4 text-amber-600" />
                      <h4 className="font-semibold text-sm text-amber-900">Why Hiro tailored it this way</h4>
                    </div>
                    <ul className="space-y-1.5 list-disc list-outside ml-5">
                      {cvOutput.tailoring_notes.map((note, i) => (
                        <li key={i} className="text-sm text-amber-800">{note}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopyCv}>
                  {copiedCv ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedCv ? "Copied!" : "Copy all text"}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadPdf}>
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </Button>
              </div>
            </>
          )}
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
