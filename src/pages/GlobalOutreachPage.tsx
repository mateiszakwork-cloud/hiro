import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, Linkedin, ExternalLink, Users, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type OutreachRow = {
  id: string;
  user_id: string;
  job_id: string | null;
  name: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string | null;
  category: string | null;
  connection_degree: string | null;
  status: string | null;
  notes: string | null;
  date_added: string | null;
  date_messaged: string | null;
  created_at: string | null;
};

type JobOption = { id: string; company_name: string | null; job_title: string | null };

const CATEGORIES = [
  { value: "inrole", label: "In role" },
  { value: "hiringmanager", label: "Hiring manager" },
  { value: "recruiter", label: "Recruiter" },
] as const;

const CATEGORY_BADGE: Record<string, string> = {
  inrole: "bg-blue-100 text-blue-700",
  hiringmanager: "bg-purple-100 text-purple-700",
  recruiter: "bg-teal-100 text-teal-700",
};

const DEGREES = [
  { value: "1st", label: "1st" },
  { value: "2nd", label: "2nd" },
  { value: "3rd", label: "3rd" },
  { value: "unknown", label: "Unknown" },
] as const;

const STATUSES = [
  { value: "notcontacted", label: "Not contacted", color: "bg-gray-100 text-gray-600" },
  { value: "reached_out", label: "Reached out", color: "bg-blue-100 text-blue-700" },
  { value: "replied", label: "Replied", color: "bg-amber-100 text-amber-700" },
  { value: "meeting_booked", label: "Meeting booked", color: "bg-green-100 text-green-700" },
  { value: "offer_referral", label: "Offer / Referral received", color: "bg-teal-100 text-teal-700" },
  { value: "closed", label: "Closed", color: "bg-muted text-muted-foreground" },
] as const;

const statusMeta = (v: string | null) =>
  STATUSES.find((s) => s.value === v) || STATUSES[0];
const categoryLabel = (v: string | null) =>
  CATEGORIES.find((c) => c.value === v)?.label || "—";

const LINKEDIN_RE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[^/\s?#]+/i;

const formatDate = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function GlobalOutreachPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OutreachRow[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    void load(userId);
  }, [userId]);

  const load = async (uid: string) => {
    setLoading(true);
    const [contacts, jobList] = await Promise.all([
      supabase
        .from("outreach_contacts")
        .select("*")
        .eq("user_id", uid)
        .order("date_added", { ascending: false }),
      supabase
        .from("jobs")
        .select("id, company_name, job_title")
        .eq("user_id", uid)
        .order("created_at", { ascending: false }),
    ]);
    if (contacts.error) toast.error("Failed to load contacts.");
    else setRows((contacts.data || []) as OutreachRow[]);
    if (!jobList.error) setJobs((jobList.data || []) as JobOption[]);
    setLoading(false);
  };

  const jobMap = useMemo(() => {
    const m = new Map<string, JobOption>();
    jobs.forEach((j) => m.set(j.id, j));
    return m;
  }, [jobs]);

  const updateField = async (
    id: string,
    patch: Partial<OutreachRow>,
  ) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    const { error } = await supabase.from("outreach_contacts").update(patch).eq("id", id);
    if (error) toast.error("Failed to save change.");
  };

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from("outreach_contacts").delete().eq("id", id);
    if (error) { toast.error("Failed to delete contact."); return; }
    setRows((prev) => prev.filter((r) => r.id !== id));
    toast.success("Contact deleted.");
  };

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "Sora, sans-serif" }}
          >
            Outreach
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            All your outreach contacts across every application.
          </p>
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="bg-[#950606] hover:bg-[#7a0505] text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add contact
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-[#950606] shrink-0" />
        <span>We're working on surfacing relevant contacts at your target companies automatically.</span>
      </div>

      <div className="rounded-lg border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20 px-6">
            <div className="h-12 w-12 rounded-full bg-[#950606]/10 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-[#950606]" />
            </div>
            <h3 className="text-base font-semibold text-foreground">
              No contacts yet
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Add your first contact to start tracking your outreach.
            </p>
            <Button
              onClick={() => setSheetOpen(true)}
              className="mt-4 bg-[#950606] hover:bg-[#7a0505] text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Add contact
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Name</th>
                  <th className="text-left font-medium px-4 py-3">Title</th>
                  <th className="text-left font-medium px-4 py-3">Company</th>
                  <th className="text-left font-medium px-4 py-3">Linked application</th>
                  <th className="text-left font-medium px-4 py-3">Category</th>
                  <th className="text-left font-medium px-4 py-3">Connection</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Date added</th>
                  <th className="text-right font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const job = r.job_id ? jobMap.get(r.job_id) : null;
                  const status = statusMeta(r.status);
                  return (
                    <tr key={r.id} className="border-t hover:bg-gray-50/60">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium">
                            {r.name || <span className="text-muted-foreground">Unnamed</span>}
                          </span>
                          {r.linkedin_url && (
                            <a
                              href={r.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#0A66C2] hover:text-[#0a52a0]"
                              aria-label="Open LinkedIn profile"
                            >
                              <Linkedin className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {r.title || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-foreground">
                        {r.company || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {job ? (
                          <a
                            href={`/jobs/${job.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            {job.company_name || "Untitled job"}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.category ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                              CATEGORY_BADGE[r.category] || "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {categoryLabel(r.category)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={r.connection_degree || "unknown"}
                          onValueChange={(v) => updateField(r.id, { connection_degree: v })}
                        >
                          <SelectTrigger className="h-8 w-[110px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DEGREES.map((d) => (
                              <SelectItem key={d.value} value={d.value} className="text-xs">
                                {d.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={r.status || "notcontacted"}
                          onValueChange={(v) => {
                            const patch: Partial<OutreachRow> = { status: v };
                            if (v !== "notcontacted" && !r.date_messaged) {
                              patch.date_messaged = new Date().toISOString();
                            }
                            updateField(r.id, patch);
                          }}
                        >
                          <SelectTrigger className="h-8 w-[180px] text-xs">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${status.color}`}
                            >
                              {status.label}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(r.date_added)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span tabIndex={0}>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  aria-disabled="true"
                                  className="h-8 gap-1.5 text-xs pointer-events-none opacity-60"
                                >
                                  <Sparkles className="h-3.5 w-3.5" />
                                  Draft message
                                </Button>
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs text-xs">
                              Coming soon — we'll draft a personalized message based on their role and your target company.
                            </TooltipContent>
                          </Tooltip>
                          <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Delete contact"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete contact?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This permanently removes {r.name || "this contact"} from your outreach list.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteRow(r.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddContactSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        jobs={jobs}
        userId={userId}
        onCreated={(row) => setRows((prev) => [row, ...prev])}
      />
    </div>
  );
}

function AddContactSheet({
  open, onOpenChange, jobs, userId, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  jobs: JobOption[];
  userId: string | null;
  onCreated: (row: OutreachRow) => void;
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [jobId, setJobId] = useState<string>("none");
  const [category, setCategory] = useState<string>("");
  const [degree, setDegree] = useState<string>("unknown");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setLinkedinUrl(""); setName(""); setTitle(""); setCompany("");
      setJobId("none"); setCategory(""); setDegree("unknown"); setNotes("");
      setError(null); setSaving(false);
    }
  }, [open]);

  const submit = async () => {
    if (!userId) { toast.error("Session expired."); return; }
    const url = linkedinUrl.trim();
    if (!LINKEDIN_RE.test(url)) {
      setError("Enter a valid LinkedIn profile URL (linkedin.com/in/…).");
      return;
    }
    setError(null);
    setSaving(true);
    const insert = {
      user_id: userId,
      linkedin_url: url,
      name: name.trim() || null,
      title: title.trim() || null,
      company: company.trim() || null,
      job_id: jobId === "none" ? null : jobId,
      category: category || null,
      connection_degree: degree,
      status: "notcontacted",
      notes: notes.trim() || null,
    };
    const { data, error } = await supabase
      .from("outreach_contacts")
      .insert(insert)
      .select("*")
      .single();
    setSaving(false);
    if (error || !data) { toast.error("Failed to add contact."); return; }
    onCreated(data as OutreachRow);
    toast.success("Contact added.");
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle style={{ fontFamily: "Sora, sans-serif" }}>Add contact</SheetTitle>
          <SheetDescription>
            Track a new outreach contact. LinkedIn URL is required.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label htmlFor="oc-url">LinkedIn URL *</Label>
            <Input
              id="oc-url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://www.linkedin.com/in/username"
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="oc-name">Name</Label>
              <Input id="oc-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="oc-title">Title</Label>
              <Input id="oc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oc-company">Company</Label>
            <Input id="oc-company" value={company} onChange={(e) => setCompany(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label>Link to application</Label>
            <Select value={jobId} onValueChange={setJobId}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {jobs.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {(j.company_name || "Untitled")}{j.job_title ? ` — ${j.job_title}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Connection degree</Label>
              <Select value={degree} onValueChange={setDegree}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEGREES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="oc-notes">Notes</Label>
            <Textarea
              id="oc-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              maxLength={1000}
            />
          </div>
        </div>

        <SheetFooter className="mt-6 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving}
            className="bg-[#950606] hover:bg-[#7a0505] text-white"
          >
            {saving ? "Adding…" : "Add contact"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}