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
import { Plus, Trash2, Linkedin, ExternalLink, Users } from "lucide-react";

/* ── Types ── */
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

/* ── Shared constants (kept in sync with GlobalOutreachPage) ── */
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

/* ── LinkedIn Search Panel (preserved verbatim) ── */
const GEO_URNS: { label: string; id: string }[] = [
  { label: "Netherlands", id: "102890719" },
  { label: "United Kingdom", id: "101165590" },
  { label: "France", id: "105015875" },
  { label: "Germany", id: "101282230" },
  { label: "United States", id: "103644278" },
  { label: "Belgium", id: "100565514" },
  { label: "Spain", id: "105646813" },
  { label: "Portugal", id: "100364837" },
  { label: "Switzerland", id: "106693272" },
  { label: "Luxembourg", id: "104042105" },
];

const NETWORK_OPTIONS: { value: "F" | "S" | "O"; label: string }[] = [
  { value: "F", label: "1st" },
  { value: "S", label: "2nd" },
  { value: "O", label: "3rd+" },
];

const deriveManagerTitle = (jobTitle: string | null): string => {
  const t = (jobTitle || "").toLowerCase();
  if (t.includes("brand")) return '"Brand Manager" OR "Marketing Manager" OR "Head of Brand"';
  if (t.includes("market")) return '"Marketing Manager" OR "Head of Marketing" OR "CMO"';
  if (t.includes("sales")) return '"Sales Manager" OR "Head of Sales" OR "Commercial Director"';
  if (t.includes("finance") || t.includes("financial")) return '"Finance Manager" OR "CFO" OR "Head of Finance"';
  if (t.includes("supply chain") || t.includes("logistics")) return '"Supply Chain Manager" OR "Head of Operations"';
  if (t.includes("product")) return '"Product Manager" OR "Head of Product" OR "CPO"';
  if (t.includes("engineer") || t.includes("software") || t.includes("developer")) return '"Engineering Manager" OR "Head of Engineering" OR "CTO"';
  if (t.includes("data") || t.includes("analyst")) return '"Data Manager" OR "Head of Analytics"';
  if (t.includes("strategy") || t.includes("consult")) return '"Strategy Director" OR "Head of Strategy" OR "VP Strategy"';
  if (t.includes("hr") || t.includes("people") || t.includes("talent")) return '"HR Director" OR "Head of People" OR "CHRO"';
  return '"Manager" OR "Director" OR "Head of"';
};

const RECRUITER_TITLE_QUERY = '"HR" OR "Recruiter" OR "Talent Acquisition" OR "People & Culture"';

const detectGeoFromLocation = (location: string | null): string => {
  if (!location) return "";
  const l = location.toLowerCase();
  const map: Record<string, string> = {
    netherlands: "102890719", holland: "102890719", amsterdam: "102890719",
    rotterdam: "102890719", "the hague": "102890719", utrecht: "102890719",
    "united kingdom": "101165590", uk: "101165590", england: "101165590",
    london: "101165590", manchester: "101165590",
    france: "105015875", paris: "105015875",
    germany: "101282230", berlin: "101282230", munich: "101282230",
    "united states": "103644278", usa: "103644278", "u.s.": "103644278",
    "new york": "103644278", "san francisco": "103644278",
    belgium: "100565514", brussels: "100565514",
    spain: "105646813", madrid: "105646813", barcelona: "105646813",
    portugal: "100364837", lisbon: "100364837",
    switzerland: "106693272", zurich: "106693272", geneva: "106693272",
    luxembourg: "104042105",
  };
  for (const key of Object.keys(map)) {
    if (l.includes(key)) return map[key];
  }
  return "";
};

const buildLinkedInUrl = (opts: {
  titleFreeText?: string;
  company?: string;
  geoUrnId?: string;
  network?: "F" | "S" | "O";
}): string => {
  const parts: string[] = [];
  if (opts.titleFreeText?.trim()) {
    parts.push(`titleFreeText=${encodeURIComponent(opts.titleFreeText.trim())}`);
  }
  if (opts.company?.trim()) {
    parts.push(`currentCompany=${encodeURIComponent(JSON.stringify([opts.company.trim()]))}`);
  }
  if (opts.geoUrnId) {
    parts.push(`geoUrn=${encodeURIComponent(JSON.stringify([opts.geoUrnId]))}`);
  }
  if (opts.network) {
    parts.push(`network=${encodeURIComponent(JSON.stringify([opts.network]))}`);
  }
  parts.push("origin=FACETED_SEARCH");
  return `https://www.linkedin.com/search/results/people/?${parts.join("&")}`;
};

const LinkedInSearchPanel = ({
  companyName, jobTitle, jobLocation,
}: {
  companyName: string | null;
  jobTitle: string | null;
  jobLocation: string | null;
}) => {
  const company = (companyName || "").trim();
  const initialGeo = detectGeoFromLocation(jobLocation) || "102890719";

  const [sharedCompany, setSharedCompany] = useState<string>(company);
  const [sharedGeo, setSharedGeo] = useState<string>(initialGeo);
  const [sharedNetwork, setSharedNetwork] = useState<"F" | "S" | "O">("S");

  const [recruiterTitle, setRecruiterTitle] = useState<string>(RECRUITER_TITLE_QUERY);
  const [managerTitle, setManagerTitle] = useState<string>(deriveManagerTitle(jobTitle));

  const recruiterUrl = buildLinkedInUrl({
    titleFreeText: recruiterTitle, company: sharedCompany, geoUrnId: sharedGeo, network: sharedNetwork,
  });
  const managerUrl = buildLinkedInUrl({
    titleFreeText: managerTitle, company: sharedCompany, geoUrnId: sharedGeo, network: sharedNetwork,
  });
  const browseUrl = buildLinkedInUrl({
    company: sharedCompany, geoUrnId: sharedGeo, network: sharedNetwork,
  });

  const openUrl = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  const NetworkRadio = ({
    value, onChange, name,
  }: { value: "F" | "S" | "O"; onChange: (v: "F" | "S" | "O") => void; name: string }) => (
    <div className="flex items-center gap-3">
      {NETWORK_OPTIONS.map((opt) => (
        <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="accent-[#950606]"
          />
          <span className="text-xs text-foreground">{opt.label}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-foreground" style={{ fontFamily: "Sora, sans-serif", fontSize: 15 }}>
            LinkedIn Search
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Three targeted searches at this company — recruiters, hiring managers, and a free browse.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Company</label>
            <Input value={sharedCompany} onChange={(e) => setSharedCompany(e.target.value)} placeholder="Company name" className="text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Location</label>
            <Select value={sharedGeo} onValueChange={setSharedGeo}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select country" /></SelectTrigger>
              <SelectContent>
                {GEO_URNS.map((g) => <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Network</label>
            <div className="h-10 flex items-center">
              <NetworkRadio value={sharedNetwork} onChange={setSharedNetwork} name="shared-network" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-5 space-y-3">
        <div>
          <h4 className="font-semibold text-foreground text-sm" style={{ fontFamily: "Sora, sans-serif" }}>
            Search on LinkedIn — HR & Recruiters
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Finds HR, recruiters, talent acquisition and people & culture roles at this company.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Title query</label>
          <Input value={recruiterTitle} onChange={(e) => setRecruiterTitle(e.target.value)} className="text-sm" />
        </div>
        <Button onClick={() => openUrl(recruiterUrl)} className="gap-2 bg-[#950606] hover:bg-[#7a0505] text-white">
          <ExternalLink className="h-4 w-4" /> Search on LinkedIn
        </Button>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">URL preview</label>
          <Input value={recruiterUrl} readOnly onFocus={(e) => e.currentTarget.select()} className="text-[11px] font-mono text-gray-600 bg-gray-50" />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-5 space-y-3">
        <div>
          <h4 className="font-semibold text-foreground text-sm" style={{ fontFamily: "Sora, sans-serif" }}>
            Search hiring manager
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Suggested titles based on the role: <span className="font-medium">{jobTitle || "—"}</span>.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Title query</label>
          <Input value={managerTitle} onChange={(e) => setManagerTitle(e.target.value)} className="text-sm" />
        </div>
        <Button onClick={() => openUrl(managerUrl)} variant="outline" className="gap-2 border-[#950606]/20 text-[#950606] hover:bg-[#FFF5F5] hover:text-[#950606]">
          <ExternalLink className="h-4 w-4" /> Search hiring manager
        </Button>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">URL preview</label>
          <Input value={managerUrl} readOnly onFocus={(e) => e.currentTarget.select()} className="text-[11px] font-mono text-gray-600 bg-gray-50" />
        </div>
      </div>

      <div className="rounded-lg border bg-white p-5 space-y-3">
        <div>
          <h4 className="font-semibold text-foreground text-sm" style={{ fontFamily: "Sora, sans-serif" }}>
            Find a Contact
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Browse all people at this company — no title filter applied.
          </p>
        </div>
        <Button onClick={() => openUrl(browseUrl)} variant="outline" className="gap-2 border-[#950606]/20 text-[#950606] hover:bg-[#FFF5F5] hover:text-[#950606]">
          <ExternalLink className="h-4 w-4" /> Browse on LinkedIn
        </Button>
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">URL preview</label>
          <Input value={browseUrl} readOnly onFocus={(e) => e.currentTarget.select()} className="text-[11px] font-mono text-gray-600 bg-gray-50" />
        </div>
        <p className="text-xs text-muted-foreground italic border-t pt-3 mt-2">
          Find someone relevant, copy their LinkedIn profile URL, and add them to your contact tracker above.
        </p>
      </div>
    </div>
  );
};

/* ── Per-job Outreach Tab ── */
const OutreachTab = ({
  jobId, userId, companyName, jobTitle, jobLocation,
}: {
  jobId: string;
  userId: string;
  companyName: string | null;
  jobTitle: string | null;
  jobLocation: string | null;
  /* Optional legacy props kept for caller compatibility — ignored. */
  jobFunction?: string | null;
  jobDescription?: string | null;
}) => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<OutreachRow[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("outreach_contacts")
        .select("*")
        .eq("job_id", jobId)
        .order("date_added", { ascending: false });
      if (cancelled) return;
      if (error) toast.error("Failed to load contacts.");
      else setRows((data || []) as OutreachRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  const updateField = async (id: string, patch: Partial<OutreachRow>) => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground" style={{ fontFamily: "Sora, sans-serif", fontSize: 20 }}>
            Outreach
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Contacts you're tracking for this application.
          </p>
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="bg-[#950606] hover:bg-[#7a0505] text-white"
        >
          <Plus className="h-4 w-4 mr-1.5" /> Add contact
        </Button>
      </div>

      {/* Contacts table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-14 px-6">
            <div className="h-12 w-12 rounded-full bg-[#950606]/10 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-[#950606]" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No contacts yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Add your first contact to start tracking your outreach for this role.
            </p>
            <Button
              onClick={() => setSheetOpen(true)}
              className="mt-4 bg-[#950606] hover:bg-[#7a0505] text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add contact
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
                  <th className="text-left font-medium px-4 py-3">Category</th>
                  <th className="text-left font-medium px-4 py-3">Connection</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Date added</th>
                  <th className="text-right font-medium px-4 py-3 w-12">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
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
                          <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DEGREES.map((d) => (
                              <SelectItem key={d.value} value={d.value} className="text-xs">{d.label}</SelectItem>
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
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${status.color}`}>
                              {status.label}
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDate(r.date_added)}
                      </td>
                      <td className="px-4 py-3 text-right">
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* LinkedIn Search Panel — preserved verbatim */}
      <LinkedInSearchPanel
        companyName={companyName}
        jobTitle={jobTitle}
        jobLocation={jobLocation}
      />

      <AddContactSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        userId={userId}
        jobId={jobId}
        defaultCompany={companyName}
        onCreated={(row) => setRows((prev) => [row, ...prev])}
      />
    </div>
  );
};

/* ── Add Contact Sheet (job pre-linked, no application dropdown) ── */
function AddContactSheet({
  open, onOpenChange, userId, jobId, defaultCompany, onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  jobId: string;
  defaultCompany: string | null;
  onCreated: (row: OutreachRow) => void;
}) {
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [category, setCategory] = useState<string>("");
  const [degree, setDegree] = useState<string>("unknown");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCompany(defaultCompany || "");
    } else {
      setLinkedinUrl(""); setName(""); setTitle(""); setCompany("");
      setCategory(""); setDegree("unknown"); setNotes("");
      setError(null); setSaving(false);
    }
  }, [open, defaultCompany]);

  const submit = async () => {
    const url = linkedinUrl.trim();
    if (!LINKEDIN_RE.test(url)) {
      setError("Enter a valid LinkedIn profile URL (linkedin.com/in/…).");
      return;
    }
    setError(null);
    setSaving(true);
    const insert = {
      user_id: userId,
      job_id: jobId,
      linkedin_url: url,
      name: name.trim() || null,
      title: title.trim() || null,
      company: company.trim() || null,
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
            This contact will be linked to the current application automatically.
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
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

export default OutreachTab;