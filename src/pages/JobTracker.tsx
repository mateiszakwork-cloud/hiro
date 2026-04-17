import { useState, useEffect, useMemo } from "react";
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

const STATUS_OPTIONS = [
  { value: "Saved", color: "bg-gray-200 text-gray-700" },
  { value: "Applied", color: "bg-blue-100 text-blue-700" },
  { value: "Screening", color: "bg-amber-100 text-amber-700" },
  { value: "Interview", color: "bg-orange-100 text-orange-700" },
  { value: "Offer", color: "bg-green-100 text-green-700" },
  { value: "Rejected", color: "bg-red-100 text-red-700" },
];

const getStatusColor = (status: string) =>
  STATUS_OPTIONS.find((s) => s.value === status)?.color || "bg-muted text-muted-foreground";

const getScoreColor = (score: number | null) => {
  if (score === null) return "";
  if (score >= 70) return "text-green-600 border-green-300 bg-green-50";
  if (score >= 40) return "text-amber-600 border-amber-300 bg-amber-50";
  return "text-red-600 border-red-300 bg-red-50";
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

const COLUMNS: { label: string; key: SortKey | null; minWidth: string }[] = [
  { label: "", key: null, minWidth: "40px" },
  { label: "Company", key: "company_name", minWidth: "130px" },
  { label: "Job Title", key: "job_title", minWidth: "150px" },
  { label: "Function", key: "function", minWidth: "90px" },
  { label: "Location", key: "location", minWidth: "110px" },
  { label: "Duration", key: "duration", minWidth: "80px" },
  { label: "Deadline", key: "application_deadline", minWidth: "100px" },
  { label: "Status", key: "status", minWidth: "95px" },
  { label: "Match", key: "match_score", minWidth: "65px" },
  { label: "Kit", key: null, minWidth: "45px" },
  { label: "Outreach", key: null, minWidth: "75px" },
  { label: "Priority", key: "priority", minWidth: "75px" },
  { label: "Applied", key: "applied_date", minWidth: "85px" },
];

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
  const [outreachMap, setOutreachMap] = useState<Record<string, { count: number; maxStatus: string }>>({});

  // Sort & filter state
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterFunction, setFilterFunction] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");

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
      // Fetch outreach summary per job
      const { data: contactData } = await supabase
        .from("contacts")
        .select("job_id, outreach_status")
        .eq("user_id", session.user.id);
      if (contactData) {
        const STATUS_ORDER = ["Not contacted", "Connection sent", "Connected", "Replied", "Meeting booked"];
        const oMap: Record<string, { count: number; maxStatus: string }> = {};
        for (const row of contactData) {
          if (!oMap[row.job_id]) oMap[row.job_id] = { count: 0, maxStatus: "Not contacted" };
          oMap[row.job_id].count++;
          const currentIdx = STATUS_ORDER.indexOf(oMap[row.job_id].maxStatus);
          const newIdx = STATUS_ORDER.indexOf(row.outreach_status);
          if (newIdx > currentIdx) oMap[row.job_id].maxStatus = row.outreach_status;
        }
        setOutreachMap(oMap);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-primary">Job Tracker</h1>
        <p className="text-muted-foreground mt-1">Paste a job URL below to automatically fill in all details.</p>
      </div>

      <div>
        <div className="flex gap-3">
          <Input
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (urlError) setUrlError(""); }}
            placeholder="Paste a job posting URL here (e.g. from LinkedIn, Workday, or a company careers page)..."
            className={`h-12 flex-1 text-sm ${urlError ? "border-destructive" : ""}`}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleAddJob()}
            disabled={loading}
          />
          <Button onClick={handleAddJob} disabled={loading} className="h-12 px-6 text-sm font-semibold rounded-lg">
            {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Parsing...</> : "Add Job"}
          </Button>
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          {urlError && <p className="text-destructive text-xs">{urlError}</p>}
          <button
            type="button"
            onClick={() => { setManualPrefillUrl(url.trim()); setManualOpen(true); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            Add manually
          </button>
        </div>
      </div>

      {/* Filters */}
      {showTable && (
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
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {!showTable ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-semibold text-foreground">No jobs tracked yet</p>
              <p className="text-sm text-muted-foreground mt-1">Paste a job URL above to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" style={{ tableLayout: 'auto' }}>
                <thead>
                   <tr className="border-b bg-muted/40">
                     {COLUMNS.map((col) => (
                       <th
                         key={col.label || "_open"}
                         style={{ minWidth: col.minWidth }}
                         className={cn(
                           "px-3 py-3 text-left font-medium text-muted-foreground whitespace-nowrap",
                           col.key && "cursor-pointer select-none hover:text-foreground transition-colors group/th"
                         )}
                         onClick={() => handleSort(col.key)}
                       >
                         {col.label && (
                           <span className="inline-flex items-center gap-1">
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
                       </th>
                     ))}
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
                      <td className="px-3 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-8 w-8 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
                      <td className="px-3 py-3"><Skeleton className="h-4 w-14" /></td>
                    </tr>
                  )}
                  {filteredAndSorted.map((job) => (
                    <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="group border-b last:border-0 hover:bg-[#fff5f5] cursor-pointer transition-colors">
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
                                  {(job.company_name || "–")[0].toUpperCase()}
                                </div>
                                <span className="font-semibold text-foreground truncate">{job.company_name || "–"}</span>
                              </div>
                            </TooltipTrigger>
                            {job.company_name && job.company_name.length > 14 && <TooltipContent>{job.company_name}</TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-3">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-medium truncate block">
                                {job.job_title || (job.url ? <span className="text-muted-foreground italic">Parsing...</span> : "–")}
                              </span>
                            </TooltipTrigger>
                            {job.job_title && job.job_title.length > 18 && <TooltipContent>{job.job_title}</TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-3">
                        {job.function ? (
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium truncate max-w-full ${FUNCTION_COLORS[job.function] || FUNCTION_COLORS.Other}`}>{job.function}</span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="px-3 py-3">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1 text-foreground truncate">
                                {job.location ? <><MapPin className="h-3 w-3 text-muted-foreground shrink-0" /><span className="truncate">{job.location}</span></> : <span className="text-muted-foreground">–</span>}
                              </span>
                            </TooltipTrigger>
                            {job.location && job.location.length > 12 && <TooltipContent>{job.location}</TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-3">
                        <TooltipProvider delayDuration={300}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-foreground truncate block">{job.duration || "–"}</span>
                            </TooltipTrigger>
                            {job.duration && job.duration.length > 8 && <TooltipContent>{job.duration}</TooltipContent>}
                          </Tooltip>
                        </TooltipProvider>
                      </td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select value={job.status} onValueChange={(v) => handleStatusChange(job.id, v)}>
                          <SelectTrigger className={`h-7 w-auto border-0 gap-1 px-2 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-3">
                        {job.match_score !== null ? (
                          <span className={`inline-flex items-center justify-center h-7 w-7 rounded-full border text-xs font-bold ${getScoreColor(job.match_score)}`}>{job.match_score}</span>
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
        </CardContent>
      </Card>

      {/* Application Kit Modal */}
      <Dialog open={!!kitModalJobId} onOpenChange={(open) => !open && setKitModalJobId(null)}>
        <DialogContent className="max-w-[640px] max-h-[85vh] overflow-y-auto p-0 rounded-xl shadow-xl animate-in fade-in-0 duration-200 sm:mx-0 mx-4">
          {modalJob && (
            <>
              <DialogHeader className="px-6 pt-6 pb-0">
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2" style={{ fontFamily: 'Sora, sans-serif' }}>
                  {modalJob.job_title || "Job"}
                  <button
                    onClick={() => { setKitModalJobId(null); navigate(`/jobs/${modalJob.id}?tab=overview&edit=true`); }}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title="Edit job details"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </DialogTitle>
                <p className="text-sm" style={{ color: '#950606' }}>{modalJob.company_name}</p>
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