import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Briefcase, MapPin, Trash2, ExternalLink, Loader2, CalendarIcon, ArrowUp, ArrowDown, ArrowUpDown, Wand2, Check, Copy, ArrowRight, Pencil, Users, AlertCircle, X } from "lucide-react";
import { computeDeadlineState, DeadlineBadge } from "@/lib/deadlineUtils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ManualJobModal from "@/components/ManualJobModal";

type Job = {
  id: string; url: string | null; company_name: string | null; job_title: string | null;
  function: string | null; location: string | null; work_mode: string | null;
  duration: string | null; status: string; match_score: number | null; created_at: string;
  priority: string; applied_date: string | null; application_deadline: string | null;
};

type CvOutput = {
  tailored_summary: string | null;
  selected_bullets: { company: string; job_title: string; bullets: string[] }[] | null;
  selected_hard_skills: Record<string, string[]> | null;
  selected_soft_skills: string[] | null;
  tailoring_notes: string[] | null;
  updated_at: string;
};

const FUNCTION_PILL: Record<string, { bg: string; color: string }> = {
  Strategy:   { bg: "#EFF6FF", color: "#1D4ED8" },
  Finance:    { bg: "#F0FDF4", color: "#166534" },
  Marketing:  { bg: "#FDF2F8", color: "#9D174D" },
  Product:    { bg: "#F5F3FF", color: "#5B21B6" },
  Operations: { bg: "#FFF7ED", color: "#9A3412" },
  HR:         { bg: "#F0FDFA", color: "#0F766E" },
  Consulting: { bg: "#EEF2FF", color: "#3730A3" },
  Other:      { bg: "#F3F4F6", color: "#6B7280" },
};

const FUNCTION_COLORS: Record<string, string> = {
  Strategy: "bg-primary text-primary-foreground",
  Finance: "bg-[#16A34A]/15 text-[#16A34A]",
  Marketing: "bg-[#DB2777]/15 text-[#DB2777]",
  Product: "bg-[#7C3AED]/15 text-[#7C3AED]",
  Operations: "bg-[#EA580C]/15 text-[#EA580C]",
  HR: "bg-[#0D9488]/15 text-[#0D9488]",
  Consulting: "bg-[#4338CA]/15 text-[#4338CA]",
  Other: "bg-muted text-muted-foreground",
};

const WORK_MODE_COLORS: Record<string, string> = {
  Onsite: "bg-muted text-muted-foreground",
  Hybrid: "bg-blue-100 text-blue-700",
  Remote: "bg-green-100 text-green-700",
};

const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  Saved:     { bg: "#F3F4F6", color: "#6B7280" },
  Applied:   { bg: "#EFF6FF", color: "#1D4ED8" },
  Screening: { bg: "#FFFBEB", color: "#92400E" },
  Interview: { bg: "#FFF7ED", color: "#C2410C" },
  Offer:     { bg: "#F0FDF4", color: "#15803D" },
  Rejected:  { bg: "#FEF2F2", color: "#991B1B" },
};

const STATUS_OPTIONS = [
  { value: "Saved", color: "bg-gray-200 text-gray-700" },
  { value: "Applied", color: "bg-blue-100 text-blue-700" },
  { value: "Screening", color: "bg-amber-100 text-amber-700" },
  { value: "Interview", color: "bg-orange-100 text-orange-700" },
  { value: "Offer", color: "bg-green-100 text-green-700" },
  { value: "Rejected", color: "bg-red-100 text-red-700" },
];

const getStatusPillStyle = (status: string): React.CSSProperties => {
  const p = STATUS_PILL[status] || { bg: "#F3F4F6", color: "#6B7280" };
  return { background: p.bg, color: p.color };
};

const getStatusColor = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.color || "bg-muted text-muted-foreground";

const getScoreColor = (score: number | null) => {
  if (score === null) return "";
  if (score >= 70) return "text-green-600 border-green-300 bg-green-50";
  if (score >= 40) return "text-amber-600 border-amber-300 bg-amber-50";
  return "text-red-600 border-red-300 bg-red-50";
};

const getScoreBadgeStyle = (score: number | null): React.CSSProperties => {
  if (score === null) return { background: "#F3F4F6", color: "#9CA3AF", border: "2px solid #E5E7EB" };
  if (score >= 70) return { background: "#F0FDF4", color: "#15803D", border: "2px solid #BBF7D0" };
  if (score >= 40) return { background: "#FFFBEB", color: "#92400E", border: "2px solid #FDE68A" };
  return { background: "#FEF2F2", color: "#991B1B", border: "2px solid #FECACA" };
};

const PRIORITY_OPTIONS = [
  { value: "High", color: "bg-primary/15 text-primary" },
  { value: "Medium", color: "bg-amber-100 text-amber-700" },
  { value: "Low", color: "bg-gray-200 text-gray-500" },
];

const getPriorityColor = (priority: string) =>
  PRIORITY_OPTIONS.find((p) => p.value === priority)?.color || "bg-gray-200 text-gray-500";

const getPriorityFromScore = (score: number | null): string => {
  if (score === null) return "Medium";
  if (score > 75) return "High";
  if (score >= 40) return "Medium";
  return "Low";
};

const isValidUrl = (str: string): boolean => {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

type SortKey = "company_name" | "job_title" | "function" | "location" | "duration" | "status" | "match_score" | "priority" | "created_at" | "applied_date" | "application_deadline";
type SortDir = "asc" | "desc";

// Default column widths in pixels — generous so all columns fit a 1280px screen
// without horizontal scroll (sidebar 240 + page padding ~64 = 304 reserved).
const COLUMNS: { label: string; key: SortKey | null; width: number; resizable: boolean }[] = [
  { label: "",         key: null,                   width: 36,  resizable: false },
  { label: "Company",  key: "company_name",         width: 140, resizable: true  },
  { label: "Job Title",key: "job_title",            width: 220, resizable: true  },
  { label: "Function", key: "function",             width: 120, resizable: true  },
  { label: "Location", key: "location",             width: 140, resizable: true  },
  { label: "Duration", key: "duration",             width: 90,  resizable: true  },
  { label: "Deadline", key: "application_deadline", width: 110, resizable: true  },
  { label: "Status",   key: "status",               width: 110, resizable: true  },
  { label: "Match",    key: "match_score",          width: 80,  resizable: true  },
  { label: "Kit",      key: null,                   width: 44,  resizable: false },
  { label: "Outreach", key: null,                   width: 90,  resizable: true  },
  { label: "Priority", key: "priority",             width: 90,  resizable: true  },
  { label: "Applied",  key: "applied_date",         width: 100, resizable: true  },
];
const MIN_COL_WIDTH = 60;

const FUNCTION_VALUES = ["Strategy", "Finance", "Marketing", "Product", "Operations", "HR", "Consulting", "Other"];

const compareStr = (a: string | null, b: string | null, dir: SortDir) => {
  const av = (a || "").toLowerCase();
  const bv = (b || "").toLowerCase();
  return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
};

const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard`);
};

// Returns a safe display value, replacing null / undefined / empty / literal "null" with em-dash
const safeText = (v: unknown): string => {
  if (v === null || v === undefined) return "–";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "–";
  return s;
};
const isBlank = (v: unknown): boolean => safeText(v) === "–";

const JobTracker = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [url, setUrl] = useState("");
  const [urlError, setUrlError] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);
  const [parseFailedUrl, setParseFailedUrl] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPrefillUrl, setManualPrefillUrl] = useState("");
  const [cvMap, setCvMap] = useState<Record<string, CvOutput>>({});
  const [generatingKit, setGeneratingKit] = useState<string | null>(null);
  const [kitModalJobId, setKitModalJobId] = useState<string | null>(null);
  const [outreachMap, setOutreachMap] = useState<Record<string, { count: number; maxStatus: string; counts: Record<string, number>; lastActivity: string | null }>>({});
  const [contactsReached, setContactsReached] = useState(0);
  const [onlyOutreach, setOnlyOutreach] = useState(false);
  const [deadlineAlertDismissed, setDeadlineAlertDismissed] = useState(false);

  // Compute urgent deadline jobs (within 7 days, status Saved or Applied)
  const urgentDeadlineJobs = useMemo(() => {
    return jobs.filter(j => {
      if (j.status !== "Saved" && j.status !== "Applied") return false;
      const state = computeDeadlineState(j.application_deadline, j.status);
      return state.kind === "red" || state.kind === "orange";
    });
  }, [jobs]);

  // Compute summary stats
  const stats = useMemo(() => {
    const total = jobs.length;
    const appliedStatuses = new Set(["Applied", "Screening", "Interview", "Offer"]);
    const inProgressStatuses = new Set(["Screening", "Interview"]);
    const applied = jobs.filter(j => appliedStatuses.has(j.status)).length;
    const inProgress = jobs.filter(j => inProgressStatuses.has(j.status)).length;
    const interviews = jobs.filter(j => j.status === "Interview").length;
    const scored = jobs.filter(j => j.match_score !== null);
    const avgScore = scored.length
      ? Math.round(scored.reduce((s, j) => s + (j.match_score || 0), 0) / scored.length)
      : null;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const appliedThisWeek = jobs.filter(j =>
      appliedStatuses.has(j.status) && new Date(j.created_at) >= sevenDaysAgo
    ).length;

    return { total, applied, inProgress, interviews, avgScore, appliedThisWeek };
  }, [jobs]);

  const getAvgScoreColor = (score: number | null) => {
    if (score === null) return "text-foreground";
    if (score > 70) return "text-green-600";
    if (score >= 40) return "text-amber-600";
    return "text-red-600";
  };

  // Sort & filter state
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterFunction, setFilterFunction] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");

  // In-memory column widths (persists for the session, resets on refresh)
  const [colWidths, setColWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(COLUMNS.map(c => [c.label || "_open", c.width]))
  );
  const resizingRef = useRef<{ label: string; startX: number; startWidth: number } | null>(null);

  const handleResizeStart = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      label,
      startX: e.clientX,
      startWidth: colWidths[label] ?? 100,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const next = Math.max(MIN_COL_WIDTH, r.startWidth + (ev.clientX - r.startX));
      setColWidths(prev => ({ ...prev, [r.label]: next }));
    };
    const onUp = () => {
      resizingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const handleSort = (key: SortKey | null) => {
    if (!key) return;
    if (sortKey === key) {
      setSortDir(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "match_score" || key === "created_at" || key === "applied_date" || key === "application_deadline" ? "desc" : "asc");
    }
  };

  const filtersActive = filterStatus !== "All" || filterFunction !== "All" || filterPriority !== "All";

  const filteredAndSorted = useMemo(() => {
    let result = [...jobs];
    if (filterStatus !== "All") result = result.filter(j => j.status === filterStatus);
    if (filterFunction !== "All") result = result.filter(j => j.function === filterFunction);
    if (filterPriority !== "All") result = result.filter(j => j.priority === filterPriority);

    result.sort((a, b) => {
      if (sortKey === "match_score") {
        const av = a.match_score ?? -1;
        const bv = b.match_score ?? -1;
        return sortDir === "desc" ? bv - av : av - bv;
      }
      if (sortKey === "created_at") {
        return sortDir === "desc"
          ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          : new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortKey === "applied_date" || sortKey === "application_deadline") {
        const av = a[sortKey] as string | null;
        const bv = b[sortKey] as string | null;
        if (!av && !bv) return 0;
        if (!av) return 1;
        if (!bv) return -1;
        return sortDir === "desc"
          ? new Date(bv).getTime() - new Date(av).getTime()
          : new Date(av).getTime() - new Date(bv).getTime();
      }
      return compareStr(a[sortKey] as string | null, b[sortKey] as string | null, sortDir);
    });
    return result;
  }, [jobs, sortKey, sortDir, filterStatus, filterFunction, filterPriority]);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
      fetchJobs(session.user.id);
      const { data: cvData } = await supabase
        .from("cv_outputs")
        .select("job_id, updated_at, tailored_summary, selected_bullets, selected_hard_skills, selected_soft_skills, tailoring_notes")
        .eq("user_id", session.user.id);
      if (cvData) {
        const map: Record<string, CvOutput> = {};
        for (const row of cvData) {
          map[row.job_id] = {
            tailored_summary: row.tailored_summary,
            selected_bullets: row.selected_bullets as any,
            selected_hard_skills: row.selected_hard_skills as any,
            selected_soft_skills: row.selected_soft_skills,
            tailoring_notes: row.tailoring_notes,
            updated_at: row.updated_at,
          };
        }
        setCvMap(map);
      }
      // Fetch outreach summary per job from outreach_contacts
      const { data: contactData } = await supabase
        .from("outreach_contacts" as any)
        .select("job_id, status, date_added, date_messaged")
        .eq("user_id", session.user.id);
      if (contactData) {
        const STATUS_ORDER = ["not_contacted", "messaged", "replied", "meeting_booked"];
        const oMap: Record<string, { count: number; maxStatus: string; counts: Record<string, number>; lastActivity: string | null }> = {};
        let reached = 0;
        for (const row of contactData as any[]) {
          if (!oMap[row.job_id]) oMap[row.job_id] = {
            count: 0, maxStatus: "not_contacted",
            counts: { not_contacted: 0, messaged: 0, replied: 0, meeting_booked: 0 },
            lastActivity: null,
          };
          const o = oMap[row.job_id];
          o.count++;
          o.counts[row.status] = (o.counts[row.status] || 0) + 1;
          if (row.status && row.status !== "not_contacted") reached++;
          const currentIdx = STATUS_ORDER.indexOf(o.maxStatus);
          const newIdx = STATUS_ORDER.indexOf(row.status);
          if (newIdx > currentIdx) o.maxStatus = row.status;
          const ts = row.date_messaged || row.date_added;
          if (ts && (!o.lastActivity || ts > o.lastActivity)) o.lastActivity = ts;
        }
        setOutreachMap(oMap);
        setContactsReached(reached);
      }
    };
    init();
  }, []);

  const fetchJobs = async (uid: string) => {
    const { data } = await supabase
      .from("jobs")
      .select("id, url, company_name, job_title, function, location, work_mode, duration, status, match_score, created_at, priority, applied_date, application_deadline")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setJobs(data as any);
  };

  const handleGenerateKit = async (jobId: string, companyName: string | null) => {
    setGeneratingKit(jobId);
    try {
      const { data, error } = await supabase.functions.invoke("tailor-cv", {
        body: { job_id: jobId },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Kit generation failed. Please try again.");
        setGeneratingKit(null);
        return;
      }
      const output = data.data;
      const cvOutput: CvOutput = {
        tailored_summary: output.tailored_summary,
        selected_bullets: output.selected_bullets,
        selected_hard_skills: output.selected_hard_skills,
        selected_soft_skills: output.selected_soft_skills,
        tailoring_notes: output.tailoring_notes,
        updated_at: output.updated_at,
      };
      setCvMap(prev => ({ ...prev, [jobId]: cvOutput }));
      toast.success(`Application Kit ready for ${companyName || "this role"}`);
      setKitModalJobId(jobId);
    } catch {
      toast.error("Kit generation failed. Please try again.");
    }
    setGeneratingKit(null);
  };

  const handleKitClick = (e: React.MouseEvent, job: Job) => {
    e.stopPropagation();
    if (generatingKit === job.id) return;
    if (cvMap[job.id]) {
      setKitModalJobId(job.id);
    } else {
      handleGenerateKit(job.id, job.company_name);
    }
  };

  const handleAddJob = async () => {
    if (!userId) return;
    setUrlError("");
    const jobUrl = url.trim();

    if (!jobUrl) { setUrlError("Please paste a valid job posting URL"); return; }
    if (!isValidUrl(jobUrl)) { setUrlError("Please paste a valid job posting URL"); return; }

    setLoading(true);
    setParsing(true);
    setUrl("");

    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("parse-job", {
        body: { url: jobUrl },
      });

      if (fnError) {
        toast.error("Failed to add job. Please try again.");
        setParsing(false);
        setLoading(false);
        return;
      }

      if (result?.success && result.job) {
        const newJob = { ...result.job, priority: result.job.priority || "Medium", applied_date: result.job.applied_date || null };
        setJobs((prev) => [newJob, ...prev]);
        toast.success("Job added successfully ✓");

        supabase.functions.invoke("calculate-match-score", {
          body: { job_id: result.job.id },
        }).then(async ({ data: scoreResult }) => {
          if (scoreResult?.success && scoreResult.score !== null) {
            const priority = getPriorityFromScore(scoreResult.score);
            await supabase.from("jobs").update({ priority }).eq("id", result.job.id);
            setJobs((prev) =>
              prev.map((j) =>
                j.id === result.job.id ? { ...j, match_score: scoreResult.score, priority } : j
              )
            );
          }
        }).catch(() => {});
      } else {
        const errorType = result?.error;
        const message = result?.message || "Something went wrong.";
        toast.error(message);
        if (errorType === "parse_failed") setParseFailedUrl(jobUrl);
      }
    } catch (e) {
      console.error("Add job error:", e);
      toast.error("An unexpected error occurred. Please try again.");
    }

    setParsing(false);
    setLoading(false);
  };

  const handleAddManually = () => {
    setManualPrefillUrl(parseFailedUrl || "");
    setParseFailedUrl(null);
    setManualOpen(true);
  };

  const handleManualSave = async (data: any) => {
    if (!userId) return;
    const insertData: any = {
      user_id: userId, status: "Saved",
      job_title: data.job_title.trim(), company_name: data.company_name.trim(),
      url: data.url.trim() || null, function: data.function || null,
      location: data.location.trim() || null, work_mode: data.work_mode || null,
      duration: data.duration.trim() || null, hard_skills: data.hard_skills,
      soft_skills: data.soft_skills, languages_required: data.languages_required,
      application_deadline: data.application_deadline || null,
    };
    const { data: job, error } = await supabase
      .from("jobs")
      .insert(insertData)
      .select("id, url, company_name, job_title, function, location, work_mode, duration, status, match_score, created_at, priority, applied_date, application_deadline")
      .single();
    if (error || !job) { toast.error("Failed to save job."); return; }
    setJobs((prev) => [job as any, ...prev]);
    toast.success("Job added successfully ✓");

    if (data.job_description?.trim()) {
      supabase.functions.invoke("calculate-match-score", {
        body: { job_id: job.id },
      }).then(({ data: scoreResult }) => {
        if (scoreResult?.success && scoreResult.score !== null) {
          setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, match_score: scoreResult.score } : j));
        }
      }).catch(() => {});
    }
  };

  const handleRetryParse = () => {
    if (parseFailedUrl) setUrl(parseFailedUrl);
    setParseFailedUrl(null);
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    const updates: any = { status: newStatus };
    const currentJob = jobs.find(j => j.id === jobId);
    if (newStatus === "Applied" && !currentJob?.applied_date) {
      updates.applied_date = format(new Date(), "yyyy-MM-dd");
    }
    await supabase.from("jobs").update(updates).eq("id", jobId);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j)));

    // Auto-trigger interview prep generation in background when status changes to Interview
    if (newStatus === "Interview" && currentJob?.status !== "Interview") {
      toast.success("Interview prep is being prepared in the background", {
        style: { background: "#16A34A", color: "white", border: "none" },
      });
      (async () => {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          if (!token) return;
          await supabase.functions.invoke("generate-interview-prep", {
            body: { job_id: jobId },
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {
          // Silent failure - user did not explicitly trigger this
        }
      })();
    }
  };

  const handlePriorityChange = async (jobId: string, newPriority: string) => {
    await supabase.from("jobs").update({ priority: newPriority }).eq("id", jobId);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, priority: newPriority } : j)));
  };

  const handleAppliedDateChange = async (jobId: string, date: Date | undefined) => {
    const applied_date = date ? format(date, "yyyy-MM-dd") : null;
    await supabase.from("jobs").update({ applied_date }).eq("id", jobId);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, applied_date } : j)));
  };

  const handleDeadlineChange = async (jobId: string, date: Date | undefined) => {
    const application_deadline = date ? format(date, "yyyy-MM-dd") : null;
    await supabase.from("jobs").update({ application_deadline }).eq("id", jobId);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, application_deadline } : j)));
  };

  const confirmDeleteJob = async () => {
    if (!deleteJobId) return;
    await supabase.from("jobs").delete().eq("id", deleteJobId);
    setJobs((prev) => prev.filter((j) => j.id !== deleteJobId));
    setDeleteJobId(null);
  };

  const showTable = parsing || jobs.length > 0;
  const modalJob = kitModalJobId ? jobs.find(j => j.id === kitModalJobId) : null;
  const modalCv = kitModalJobId ? cvMap[kitModalJobId] : null;

  // Premium metric card style
  const metricCardStyle: React.CSSProperties = {
    background: "var(--color-bg-white)",
    borderRadius: "var(--radius-lg)",
    border: "1px solid var(--color-border)",
    padding: "12px 16px",
    transition: "var(--transition)",
  };
  const metricNumStyle: React.CSSProperties = {
    fontFamily: "var(--font-data)",
    fontSize: "22px",
    fontWeight: 700,
    color: "var(--color-text-primary)",
    letterSpacing: "-0.02em",
    lineHeight: 1,
  };
  const metricLabelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "10px",
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginTop: "6px",
  };
  const metricCardHover = (e: React.MouseEvent<HTMLDivElement>, hover: boolean) => {
    e.currentTarget.style.boxShadow = hover ? "var(--shadow-md)" : "none";
    e.currentTarget.style.transform = hover ? "translateY(-1px)" : "translateY(0)";
  };

  return (
    <div style={{ margin: "-32px", background: "var(--color-bg-page)", minHeight: "calc(100vh - 0px)" }}>
      {/* Page header bar */}
      <div
        style={{
          background: "var(--color-bg-white)",
          padding: "20px 28px",
          borderBottom: "1px solid var(--color-border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "24px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "22px",
              fontWeight: 800,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
            }}
          >
            Job Tracker
          </h1>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              color: "var(--color-text-muted)",
              marginTop: "6px",
            }}
          >
            Paste a job URL to automatically fill every column
          </p>
        </div>

        <div style={{ flex: 1, maxWidth: "520px", minWidth: "280px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <Input
              value={url}
              onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(""); }}
              placeholder="Paste a job posting URL..."
              onKeyDown={(e) => e.key === "Enter" && !loading && handleAddJob()}
              disabled={loading}
              style={{
                height: "44px",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                border: `1.5px solid ${urlError ? "#DC2626" : "var(--color-border)"}`,
                borderRadius: "var(--radius-md)",
                flex: 1,
              }}
            />
            <button
              onClick={handleAddJob}
              disabled={loading}
              style={{
                height: "44px",
                background: "var(--color-primary)",
                color: "#fff",
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                fontWeight: 600,
                borderRadius: "var(--radius-md)",
                padding: "0 20px",
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "var(--transition)",
                opacity: loading ? 0.7 : 1,
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = "var(--color-primary-hover)";
                  e.currentTarget.style.boxShadow = "var(--shadow-red)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "var(--color-primary)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Parsing...</> : "Add Job"}
            </button>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            {urlError && <p className="text-destructive text-xs">{urlError}</p>}
            <button
              type="button"
              onClick={() => { setManualPrefillUrl(url.trim()); setManualOpen(true); }}
              className="text-xs ml-auto"
              style={{ color: "var(--color-text-muted)" }}
            >
              Add manually
            </button>
          </div>
        </div>
      </div>

      {/* Metrics bar */}
      <div style={{ padding: "16px 28px" }}>
        {stats.total === 0 ? (
          <div
            style={{
              background: "var(--color-bg-white)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              padding: "20px",
              fontSize: "14px",
              color: "var(--color-text-secondary)",
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--color-text-primary)", fontFamily: "var(--font-data)" }}>
              Welcome to Hiro.
            </span>{" "}
            Paste your first job URL above to get started.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
              gap: "12px",
            }}
            className="hiro-metrics-grid"
          >
            <div style={metricCardStyle} onMouseEnter={(e) => metricCardHover(e, true)} onMouseLeave={(e) => metricCardHover(e, false)}>
              <div style={metricNumStyle}>{stats.total}</div>
              <div style={metricLabelStyle}>Total Tracked</div>
            </div>
            <div
              style={{ ...metricCardStyle, borderLeft: "3px solid var(--color-primary)" }}
              onMouseEnter={(e) => metricCardHover(e, true)}
              onMouseLeave={(e) => metricCardHover(e, false)}
            >
              <div style={metricNumStyle}>{stats.applied}</div>
              <div style={metricLabelStyle}>Applied</div>
              <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
                ({stats.appliedThisWeek} this week)
              </div>
            </div>
            <div style={metricCardStyle} onMouseEnter={(e) => metricCardHover(e, true)} onMouseLeave={(e) => metricCardHover(e, false)}>
              <div style={metricNumStyle}>{stats.inProgress}</div>
              <div style={metricLabelStyle}>In Progress</div>
            </div>
            <div
              style={{ ...metricCardStyle, borderLeft: "3px solid var(--color-primary)" }}
              onMouseEnter={(e) => metricCardHover(e, true)}
              onMouseLeave={(e) => metricCardHover(e, false)}
            >
              <div style={metricNumStyle}>{stats.interviews}</div>
              <div style={metricLabelStyle}>Interviews</div>
            </div>
            <div style={metricCardStyle} onMouseEnter={(e) => metricCardHover(e, true)} onMouseLeave={(e) => metricCardHover(e, false)}>
              <div style={{ ...metricNumStyle, color: stats.avgScore === null ? "var(--color-text-primary)" : stats.avgScore > 70 ? "#15803D" : stats.avgScore >= 40 ? "#92400E" : "#991B1B" }}>
                {stats.avgScore !== null ? `${stats.avgScore}%` : "–"}
              </div>
              <div style={metricLabelStyle}>Avg Match</div>
            </div>
            <div style={metricCardStyle} onMouseEnter={(e) => metricCardHover(e, true)} onMouseLeave={(e) => metricCardHover(e, false)}>
              <div style={metricNumStyle}>{contactsReached}</div>
              <div style={metricLabelStyle}>Contacts Reached</div>
            </div>
          </div>
        )}
      </div>

      {/* Urgent deadline alert */}
      {!deadlineAlertDismissed && urgentDeadlineJobs.length > 0 && (
        <div style={{ padding: "0 28px 16px" }}>
          <div
            className="flex items-start justify-between gap-3 rounded-lg border p-3"
            style={{ backgroundColor: "#FFF5F5", borderColor: "#950606" }}
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "#950606" }} />
              <div className="text-sm">
                <p className="font-semibold" style={{ color: "#950606" }}>
                  You have {urgentDeadlineJobs.length} application deadline{urgentDeadlineJobs.length === 1 ? "" : "s"} in the next 7 days
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {urgentDeadlineJobs.map((j) => {
                    const s = computeDeadlineState(j.application_deadline, j.status);
                    const days = s.kind === "red" || s.kind === "orange" ? s.days : 0;
                    return (
                      <button
                        key={j.id}
                        onClick={() => navigate(`/jobs/${j.id}`)}
                        className="text-xs underline-offset-2 hover:underline text-foreground"
                      >
                        <span className="font-medium">{safeText(j.company_name)}</span>
                        <span className="text-muted-foreground"> · {safeText(j.job_title)}</span>
                        <span className="ml-1 font-semibold" style={{ color: "#950606" }}>({days}d)</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <button
              onClick={() => setDeadlineAlertDismissed(true)}
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {showTable && (
        <div style={{ padding: "0 28px 12px" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="ml-auto flex items-center gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs border rounded-lg">
                  <SelectValue placeholder="Status" />
                  {filterStatus !== "All" && (
                    <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {jobs.filter(j => j.status === filterStatus).length}
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Statuses</SelectItem>
                  {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterFunction} onValueChange={setFilterFunction}>
                <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs border rounded-lg">
                  <SelectValue placeholder="Function" />
                  {filterFunction !== "All" && (
                    <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {jobs.filter(j => j.function === filterFunction).length}
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Functions</SelectItem>
                  {FUNCTION_VALUES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="h-8 w-auto gap-1 px-3 text-xs border rounded-lg">
                  <SelectValue placeholder="Priority" />
                  {filterPriority !== "All" && (
                    <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                      {jobs.filter(j => j.priority === filterPriority).length}
                    </span>
                  )}
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Priorities</SelectItem>
                  {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.value}</SelectItem>)}
                </SelectContent>
              </Select>
              {filtersActive && (
                <button
                  onClick={() => { setFilterStatus("All"); setFilterFunction("All"); setFilterPriority("All"); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table card wrapper */}
      <div style={{ padding: "0 28px 24px" }}>
        <div
          style={{
            background: "var(--color-bg-white)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid var(--color-border)",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          {!showTable ? (
            <div style={{ padding: "80px 32px", textAlign: "center" }}>
              <Briefcase style={{ width: 48, height: 48, color: "#D1D5DB", margin: "0 auto" }} />
              <h2
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: "22px",
                  color: "var(--color-text-primary)",
                  marginTop: "16px",
                }}
              >
                No jobs tracked yet
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "15px",
                  color: "var(--color-text-muted)",
                  marginTop: "8px",
                  maxWidth: "400px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Paste a job URL at the top of the page and Hiro will fill in every column for you.
              </p>
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table className="text-sm" style={{ tableLayout: "fixed", width: "max-content", minWidth: "100%" }}>
                <colgroup>
                  {COLUMNS.map((col) => {
                    const key = col.label || "_open";
                    return <col key={`col-${key}`} style={{ width: `${colWidths[key] ?? col.width}px` }} />;
                  })}
                </colgroup>
                <thead>
                   <tr style={{ background: "#F9FAFB", borderBottom: "2px solid var(--color-border)" }}>
                     {COLUMNS.map((col) => {
                       const key = col.label || "_open";
                       return (
                         <th
                           key={key}
                           style={{
                             fontFamily: "var(--font-body)",
                             fontSize: "11px",
                             fontWeight: 600,
                             color: "var(--color-text-muted)",
                             textTransform: "uppercase",
                             letterSpacing: "0.08em",
                             padding: "10px 14px",
                             textAlign: "left",
                             whiteSpace: "nowrap",
                             position: "relative",
                             width: `${colWidths[key] ?? col.width}px`,
                             minWidth: `${colWidths[key] ?? col.width}px`,
                             maxWidth: `${colWidths[key] ?? col.width}px`,
                           }}
                           className={cn(
                             col.key && "cursor-pointer select-none hover:text-foreground transition-colors group/th"
                           )}
                           onClick={() => handleSort(col.key)}
                         >
                           {col.label && (
                              <span className="inline-flex items-center gap-1 overflow-hidden text-ellipsis max-w-full">
                               {col.label}
                               {col.key && (
                                 sortKey === col.key ? (
                                   sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                 ) : (
                                   <ArrowUpDown className="h-3 w-3 opacity-0 group-hover/th:opacity-50 transition-opacity" />
                                 )
                               )}
                             </span>
                           )}
                           {col.resizable && (
                              <div
                               role="separator"
                               aria-orientation="vertical"
                               aria-label={`Resize ${col.label} column`}
                               onMouseDown={(e) => handleResizeStart(e, key)}
                               onClick={(e) => e.stopPropagation()}
                                onDoubleClick={(e) => e.stopPropagation()}
                               className="hiro-col-resize-handle"
                             />
                           )}
                         </th>
                       );
                     })}
                   </tr>
                </thead>
                <tbody>
                  {parsing && (
                    <tr className="border-b animate-pulse">
                      <td className="px-3 py-3"></td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2.5"><Skeleton className="h-8 w-8 rounded" /><Skeleton className="h-4 w-24" /></div></td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          <span className="text-muted-foreground text-sm italic">Reading...</span>
                        </div>
                      </td>
                      <td className="px-3 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-8 w-8 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                    </tr>
                  )}
                  {filteredAndSorted.map((job) => (
                    <tr
                      key={job.id}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="group hiro-table-row"
                      style={{
                        borderBottom: "1px solid #F3F4F6",
                        cursor: "pointer",
                        transition: "var(--transition)",
                        minHeight: "56px",
                      }}
                    >
                      {/* Open Full Page arrow - first column */}
                      <td className="px-3 py-3" onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.id}`); }}>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="text-muted-foreground hover:text-primary transition-colors">
                                <ArrowRight className="h-4 w-4 stroke-[2.5]" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Open full page</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-3">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="h-7 w-7 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                                  {safeText(job.company_name)[0].toUpperCase()}
                                </div>
                                <span className="font-semibold text-foreground truncate">{safeText(job.company_name)}</span>
                              </div>
                            </TooltipTrigger>
                            {!isBlank(job.company_name) && safeText(job.company_name).length > 14 && <TooltipContent>{safeText(job.company_name)}</TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-3">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-medium truncate block">
                                {!isBlank(job.job_title)
                                  ? safeText(job.job_title)
                                  : (job.url ? <span className="text-muted-foreground italic">Parsing...</span> : "–")}
                              </span>
                            </TooltipTrigger>
                            {!isBlank(job.job_title) && safeText(job.job_title).length > 18 && <TooltipContent>{safeText(job.job_title)}</TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-4 py-3">
                        {!isBlank(job.function) ? (
                          <span
                            style={{
                              display: "inline-block",
                              borderRadius: "var(--radius-full)",
                              padding: "4px 10px",
                              fontFamily: "var(--font-body)",
                              fontSize: "11px",
                              fontWeight: 600,
                              background: (FUNCTION_PILL[job.function as string] || FUNCTION_PILL.Other).bg,
                              color: (FUNCTION_PILL[job.function as string] || FUNCTION_PILL.Other).color,
                            }}
                          >
                            {job.function}
                          </span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="px-3 py-3">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-foreground truncate">
                                {!isBlank(job.location) ? <><MapPin className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate">{safeText(job.location)}</span></> : <span className="text-muted-foreground">–</span>}
                              </span>
                            </TooltipTrigger>
                            {!isBlank(job.location) && safeText(job.location).length > 12 && <TooltipContent>{safeText(job.location)}</TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-3">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-foreground truncate block">{safeText(job.duration)}</span>
                            </TooltipTrigger>
                            {!isBlank(job.duration) && safeText(job.duration).length > 8 && <TooltipContent>{safeText(job.duration)}</TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {(() => {
                          const state = computeDeadlineState(job.application_deadline, job.status);
                          if (state.kind === "none") {
                            return (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button className="inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors text-xs">
                                    <span>–</span>
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={undefined}
                                    onSelect={(d) => handleDeadlineChange(job.id, d)}
                                    className={cn("p-3 pointer-events-auto")}
                                  />
                                </PopoverContent>
                              </Popover>
                            );
                          }
                          return (
                            <Popover>
                              <PopoverTrigger asChild>
                                <button className="hover:opacity-80 transition-opacity">
                                  <DeadlineBadge state={state} />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={job.application_deadline ? new Date(job.application_deadline) : undefined}
                                  onSelect={(d) => handleDeadlineChange(job.id, d)}
                                  className={cn("p-3 pointer-events-auto")}
                                />
                              </PopoverContent>
                            </Popover>
                          );
                        })()}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <Select value={job.status} onValueChange={(v) => handleStatusChange(job.id, v)}>
                          <SelectTrigger
                            className="h-6 w-auto border-0 gap-1 rounded-full"
                            style={{
                              ...getStatusPillStyle(job.status),
                              fontFamily: "var(--font-body)",
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "3px 8px",
                            }}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td>
                        {job.match_score !== null ? (
                          <span
                            style={{
                              ...getScoreBadgeStyle(job.match_score),
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "30px",
                              height: "30px",
                              borderRadius: "50%",
                              fontFamily: "var(--font-data)",
                              fontSize: "10px",
                              fontWeight: 700,
                            }}
                          >
                            {job.match_score}
                          </span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      {/* Kit column */}
                      <td className="px-3 py-3" onClick={(e) => { e.stopPropagation(); handleKitClick(e, job); }}>
                        <TooltipProvider delayDuration={200}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button className="transition-colors relative">
                                {generatingKit === job.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                ) : cvMap[job.id] ? (
                                  <span className="relative inline-block">
                                    <Wand2 className="h-4 w-4 text-[#950606]" />
                                    <Check className="h-2.5 w-2.5 text-[#950606] absolute -bottom-0.5 -right-1 stroke-[3]" />
                                  </span>
                                ) : (
                                  <Wand2 className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {generatingKit === job.id
                                ? "Generating..."
                                : cvMap[job.id]
                                  ? "Kit ready — click to view"
                                  : "Generate Application Kit"}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      {/* Outreach column */}
                      <td className="px-3 py-3" onClick={(e) => { e.stopPropagation(); navigate(`/jobs/${job.id}?tab=outreach`); }}>
                        {(() => {
                          const o = outreachMap[job.id];
                          if (!o) return <span className="text-muted-foreground">–</span>;
                          const dotColor: Record<string, string> = {
                            "Not contacted": "bg-gray-400",
                            "Connection sent": "bg-blue-500",
                            "Connected": "bg-green-500",
                            "Replied": "bg-amber-500",
                            "Meeting booked": "bg-[#950606]",
                          };
                          return (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
                                    <Users className="h-3.5 w-3.5" />
                                    <span className="text-xs font-medium">{o.count}</span>
                                    <span className={`h-2 w-2 rounded-full ${dotColor[o.maxStatus] || "bg-gray-400"}`} />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>{o.count} contact{o.count !== 1 ? "s" : ""} — most advanced: {o.maxStatus}</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })()}
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select value={job.priority} onValueChange={(v) => handlePriorityChange(job.id, v)}>
                          <SelectTrigger className={`h-7 w-auto border-0 gap-1 px-2 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.value}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {job.status === "Saved" && !job.applied_date ? (
                          <span className="text-muted-foreground">–</span>
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="text-sm text-foreground hover:text-primary transition-colors whitespace-nowrap">
                                {job.applied_date ? format(new Date(job.applied_date), "MMM d") : <span className="flex items-center gap-1 text-muted-foreground"><CalendarIcon className="h-3 w-3" /> Set</span>}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={job.applied_date ? new Date(job.applied_date) : undefined}
                                onSelect={(d) => handleAppliedDateChange(job.id, d)}
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Application Kit Modal */}
      <Dialog open={!!kitModalJobId} onOpenChange={(open) => !open && setKitModalJobId(null)}>
        <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto p-0 rounded-xl shadow-xl animate-in fade-in-0 duration-200 sm:mx-0 mx-4">
          {modalJob && (
            <>
              <DialogHeader className="px-6 pt-6 pb-0">
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                  {safeText(modalJob.job_title) === "–" ? "Job" : safeText(modalJob.job_title)}
                  <button
                    onClick={() => { setKitModalJobId(null); navigate(`/jobs/${modalJob.id}?tab=overview&edit=true`); }}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Edit job details"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </DialogTitle>
                <p className="text-sm" style={{ color: '#950606' }}>{safeText(modalJob.company_name)}</p>
                <button
                  onClick={() => { setKitModalJobId(null); navigate(`/jobs/${kitModalJobId}`); }}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg border-2 transition-colors hover:bg-[#950606] hover:text-white"
                  style={{ color: '#950606', borderColor: '#950606' }}
                >
                  Open full page <ArrowRight className="h-4 w-4" />
                </button>
              </DialogHeader>

              {/* No kit generated yet */}
              {!modalCv && generatingKit !== modalJob.id && (
                <div className="px-6 pb-6 pt-8 flex flex-col items-center justify-center text-center gap-4">
                  <Wand2 className="h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No Application Kit generated yet for this role.</p>
                  <Button
                    onClick={() => handleGenerateKit(modalJob.id, modalJob.company_name)}
                    className="gap-2"
                    style={{ backgroundColor: '#950606' }}
                  >
                    <Wand2 className="h-4 w-4" /> Generate Application Kit
                  </Button>
                </div>
              )}

              {/* Generating state */}
              {generatingKit === modalJob.id && (
                <div className="px-6 pb-6 pt-8 flex flex-col items-center justify-center text-center gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-[#950606]" />
                  <p className="text-sm text-muted-foreground">Building your application kit...</p>
                </div>
              )}

              {/* Kit content */}
              {modalCv && generatingKit !== modalJob.id && (
                <div className="px-6 pb-6 pt-4 space-y-4">
                  {/* Summary */}
                  {modalCv.tailored_summary && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold text-sm text-foreground">Professional Summary</h4>
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#950606]/10 text-[#950606]">
                              Tailored for {modalJob.company_name}
                            </span>
                          </div>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => {
                            const el = document.getElementById("modal-summary");
                            if (el) copyToClipboard(el.innerText, "Summary");
                          }}>
                            <Copy className="h-3 w-3" /> Copy
                          </Button>
                        </div>
                        <div
                          id="modal-summary"
                          contentEditable
                          suppressContentEditableWarning
                          className="text-sm text-foreground leading-relaxed outline-none focus:ring-1 focus:ring-ring rounded p-1.5 -m-1.5"
                        >
                          {modalCv.tailored_summary}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Bullets */}
                  {Array.isArray(modalCv.selected_bullets) && modalCv.selected_bullets.length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <h4 className="font-semibold text-sm text-foreground mb-3">Selected Bullet Points</h4>
                        <div className="space-y-4">
                          {modalCv.selected_bullets.map((block, i) => (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1.5">
                                <div>
                                  <p className="font-semibold text-sm text-foreground">{block.company}</p>
                                  <p className="text-xs text-muted-foreground">{block.job_title}</p>
                                </div>
                                <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => {
                                  const container = document.getElementById(`modal-bullets-${i}`);
                                  if (container) copyToClipboard(container.innerText, `${block.company} bullets`);
                                }}>
                                  <Copy className="h-3 w-3" /> Copy
                                </Button>
                              </div>
                              <ul id={`modal-bullets-${i}`} className="space-y-1 ml-4 list-disc list-outside">
                                {block.bullets.map((b: any, j: number) => {
                                  const text = typeof b === "string" ? b : (b.use_tailored !== false ? (b.tailored || b.original || "") : (b.original || b.tailored || ""));
                                  return (
                                    <li key={j} className="text-sm text-foreground">
                                      <span contentEditable suppressContentEditableWarning className="outline-none focus:ring-1 focus:ring-ring rounded px-0.5">{text}</span>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Hard Skills */}
                  {modalCv.selected_hard_skills && Object.keys(modalCv.selected_hard_skills).length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm text-foreground">Hard Skills</h4>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => {
                            const parts = Object.entries(modalCv.selected_hard_skills!).map(
                              ([cat, skills]) => `${cat}: ${(skills as string[]).join(", ")}`
                            );
                            copyToClipboard("Software Skills: " + parts.join("; ") + ".", "Hard skills");
                          }}>
                            <Copy className="h-3 w-3" /> Copy all
                          </Button>
                        </div>
                        <div className="space-y-2.5">
                          {Object.entries(modalCv.selected_hard_skills).map(([category, skills]) => (
                            <div key={category}>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">{category}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(skills as string[]).map((skill, i) => (
                                  <span key={i} className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">{skill}</span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Soft Skills */}
                  {modalCv.selected_soft_skills && modalCv.selected_soft_skills.length > 0 && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-sm text-foreground">Soft Skills</h4>
                          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => {
                            copyToClipboard(modalCv.selected_soft_skills!.join(", "), "Soft skills");
                          }}>
                            <Copy className="h-3 w-3" /> Copy all
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {modalCv.selected_soft_skills.map((skill, i) => (
                            <span key={i} className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">{skill}</span>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteJobId} onOpenChange={(open) => !open && setDeleteJobId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this job?</AlertDialogTitle>
            <AlertDialogDescription>
              All associated contacts and notes will also be deleted. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteJob} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Parse failed modal */}
      <Dialog open={!!parseFailedUrl} onOpenChange={(open) => !open && setParseFailedUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Could not read this job posting</DialogTitle>
            <p className="text-sm text-muted-foreground">
              We could not automatically read this job posting. Would you like to add the details manually?
            </p>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleRetryParse}>Try again</Button>
            <Button onClick={handleAddManually}>Add manually</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual entry modal */}
      <ManualJobModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        prefillUrl={manualPrefillUrl}
        onSave={handleManualSave}
      />
    </div>
  );
};

export default JobTracker;