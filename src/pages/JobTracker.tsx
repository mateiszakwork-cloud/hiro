import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Briefcase, MapPin, Trash2, ExternalLink, Loader2, CalendarIcon, ArrowUp, ArrowDown, ArrowUpDown, FileText, FileCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ManualJobModal from "@/components/ManualJobModal";

type Job = {
  id: string; url: string | null; company_name: string | null; job_title: string | null;
  function: string | null; location: string | null; work_mode: string | null;
  duration: string | null; status: string; match_score: number | null; created_at: string;
  priority: string; applied_date: string | null;
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

type SortKey = "company_name" | "job_title" | "function" | "location" | "work_mode" | "duration" | "status" | "match_score" | "priority" | "created_at" | "applied_date";
type SortDir = "asc" | "desc";

const COLUMNS: { label: string; key: SortKey | null }[] = [
  { label: "Company", key: "company_name" },
  { label: "Job Title", key: "job_title" },
  { label: "Function", key: "function" },
  { label: "Location", key: "location" },
  { label: "Work Mode", key: "work_mode" },
  { label: "Duration", key: "duration" },
  { label: "Status", key: "status" },
  { label: "Match", key: "match_score" },
  { label: "Priority", key: "priority" },
  { label: "Added", key: "created_at" },
  { label: "Applied", key: "applied_date" },
  { label: "", key: null },
];

const FUNCTION_VALUES = ["Strategy", "Finance", "Marketing", "Product", "Operations", "HR", "Consulting", "Other"];

const compareStr = (a: string | null, b: string | null, dir: SortDir) => {
  const av = (a || "").toLowerCase();
  const bv = (b || "").toLowerCase();
  return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
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
      setSortDir(key === "match_score" || key === "created_at" || key === "applied_date" ? "desc" : "asc");
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
      if (sortKey === "applied_date") {
        // nulls always last
        if (!a.applied_date && !b.applied_date) return 0;
        if (!a.applied_date) return 1;
        if (!b.applied_date) return -1;
        return sortDir === "desc"
          ? new Date(b.applied_date).getTime() - new Date(a.applied_date).getTime()
          : new Date(a.applied_date).getTime() - new Date(b.applied_date).getTime();
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
    };
    init();
  }, []);

  const fetchJobs = async (uid: string) => {
    const { data } = await supabase
      .from("jobs")
      .select("id, url, company_name, job_title, function, location, work_mode, duration, status, match_score, created_at, priority, applied_date")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setJobs(data as any);
  };

  const handleAddJob = async () => {
    if (!userId) return;
    setUrlError("");
    const jobUrl = url.trim();

    if (!jobUrl) {
      setUrlError("Please paste a valid job posting URL");
      return;
    }
    if (!isValidUrl(jobUrl)) {
      setUrlError("Please paste a valid job posting URL");
      return;
    }

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

        // Trigger match scoring in background
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

        if (errorType === "parse_failed") {
          setParseFailedUrl(jobUrl);
        }
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
      .select("id, url, company_name, job_title, function, location, work_mode, duration, status, match_score, created_at, priority, applied_date")
      .single();
    if (error || !job) { toast.error("Failed to save job."); return; }
    setJobs((prev) => [job as any, ...prev]);
    toast.success("Job added successfully ✓");

    // Trigger match scoring if job description was provided
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
    if (parseFailedUrl) {
      setUrl(parseFailedUrl);
    }
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

  const confirmDeleteJob = async () => {
    if (!deleteJobId) return;
    await supabase.from("jobs").delete().eq("id", deleteJobId);
    setJobs((prev) => prev.filter((j) => j.id !== deleteJobId));
    setDeleteJobId(null);
  };

  const showTable = parsing || jobs.length > 0;

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
              <table className="w-full text-sm">
                <thead>
                   <tr className="border-b bg-muted/40">
                     {COLUMNS.map((col) => (
                       <th
                         key={col.label || "_actions"}
                         className={cn(
                           "px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap",
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
                      <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Skeleton className="h-8 w-8 rounded" /><Skeleton className="h-4 w-24" /></div></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          <span className="text-muted-foreground text-sm italic">Reading job posting...</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-28" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-20" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-8 w-8 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-5 w-16 rounded-full" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-12" /></td>
                      <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  )}
                  {filteredAndSorted.map((job) => (
                    <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="group border-b last:border-0 hover:bg-[#fff5f5] cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                            {(job.company_name || "–")[0].toUpperCase()}
                          </div>
                          <span className="font-semibold text-foreground whitespace-nowrap">{job.company_name || "–"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {job.job_title || (job.url ? <span className="text-muted-foreground italic">Parsing...</span> : "–")}
                      </td>
                      <td className="px-4 py-3">
                        {job.function ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${FUNCTION_COLORS[job.function] || FUNCTION_COLORS.Other}`}>{job.function}</span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {job.location ? (
                          <span className="flex items-center gap-1 text-foreground"><MapPin className="h-3.5 w-3.5 text-muted-foreground" />{job.location}</span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="px-4 py-3">
                        {job.work_mode ? (
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${WORK_MODE_COLORS[job.work_mode] || WORK_MODE_COLORS.Onsite}`}>{job.work_mode}</span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-foreground">{job.duration || "–"}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select value={job.status} onValueChange={(v) => handleStatusChange(job.id, v)}>
                          <SelectTrigger className={`h-7 w-auto border-0 gap-1 px-2.5 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.value}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        {job.match_score !== null ? (
                          <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full border text-xs font-bold ${getScoreColor(job.match_score)}`}>{job.match_score}</span>
                        ) : <span className="text-muted-foreground">–</span>}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Select value={job.priority} onValueChange={(v) => handlePriorityChange(job.id, v)}>
                          <SelectTrigger className={`h-7 w-auto border-0 gap-1 px-2.5 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.value}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(job.created_at), "MMM d")}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
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
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setDeleteJobId(job.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            title="Delete job"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/jobs/${job.id}`)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
                            title="Open full page"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
            <DialogDescription>
              We could not automatically read this job posting. Would you like to add the details manually?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleRetryParse}>Try again</Button>
            <Button onClick={handleAddManually}>Add manually</Button>
          </DialogFooter>
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
