import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Briefcase, MapPin, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Job = {
  id: string; url: string | null; company_name: string | null; job_title: string | null;
  function: string | null; location: string | null; work_mode: string | null;
  duration: string | null; status: string; match_score: number | null; created_at: string;
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

const JobTracker = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleteJobId, setDeleteJobId] = useState<string | null>(null);

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
      .select("id, url, company_name, job_title, function, location, work_mode, duration, status, match_score, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (data) setJobs(data);
  };

  const handleAddJob = async () => {
    if (!userId) return;
    setLoading(true);
    const jobUrl = url.trim() || null;
    const { data, error } = await supabase
      .from("jobs")
      .insert({ user_id: userId, url: jobUrl, status: "Saved" })
      .select("id, url, company_name, job_title, function, location, work_mode, duration, status, match_score, created_at")
      .single();
    if (!error && data) {
      setUrl("");
      setJobs((prev) => [data, ...prev]);
    }
    setLoading(false);
  };

  const handleStatusChange = async (jobId: string, newStatus: string) => {
    await supabase.from("jobs").update({ status: newStatus }).eq("id", jobId);
    setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j)));
    if (selectedJob?.id === jobId) setSelectedJob((p) => p ? { ...p, status: newStatus } : p);
  };

  const confirmDeleteJob = async () => {
    if (!deleteJobId) return;
    await supabase.from("jobs").delete().eq("id", deleteJobId);
    setJobs((prev) => prev.filter((j) => j.id !== deleteJobId));
    if (selectedJob?.id === deleteJobId) setSelectedJob(null);
    setDeleteJobId(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[28px] font-bold text-primary">Job Tracker</h1>
        <p className="text-muted-foreground mt-1">Paste a job URL below to automatically fill in all details.</p>
      </div>

      <div className="flex gap-3">
        <Input
          value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a job posting URL here (e.g. from LinkedIn, Workday, or a company careers page)..."
          className="h-12 flex-1 text-sm"
          onKeyDown={(e) => e.key === "Enter" && handleAddJob()}
        />
        <Button onClick={handleAddJob} disabled={loading} className="h-12 px-6 text-sm font-semibold rounded-lg">
          Add Job
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {jobs.length === 0 ? (
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
                    {["Company","Job Title","Function","Location","Work Mode","Duration","Status","Match","Added",""].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} onClick={() => setSelectedJob(job)} className="group border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors">
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
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{format(new Date(job.created_at), "MMM d")}</td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setDeleteJobId(job.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          title="Delete job"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={!!selectedJob} onOpenChange={(open) => !open && setSelectedJob(null)}>
        <SheetContent className="w-[45vw] sm:max-w-none p-0" side="right">
          {selectedJob && (
            <div className="p-6 flex flex-col h-full">
              <SheetHeader className="mb-6">
                <SheetTitle className="text-xl text-primary">{selectedJob.job_title || "Untitled Position"}</SheetTitle>
                <p className="text-muted-foreground text-sm">{selectedJob.company_name || "Unknown Company"}</p>
              </SheetHeader>
              <p className="text-muted-foreground flex-1">Details loading...</p>
              <div className="pt-4 border-t mt-auto">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setDeleteJobId(selectedJob.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete Job
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

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
    </div>
  );
};

export default JobTracker;
