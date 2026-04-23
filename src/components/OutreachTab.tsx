import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Search, Users, ChevronDown, Check, X as XIcon, Trash2, Copy,
  Loader2, AlertTriangle, Plus, ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import ContactTracker from "@/components/ContactTracker";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/* ── Types ── */
export type OutreachContact = {
  id: string;
  job_id: string;
  user_id: string;
  linkedin_url: string | null;
  name: string | null;
  headline: string | null;
  current_title: string | null;
  current_company: string | null;
  profile_picture_url: string | null;
  connection_degree: string | null;
  is_alumni: boolean;
  shared_connections_count: number | null;
  category: string | null;
  priority_score: number | null;
  connection_note_draft: string | null;
  inmail_subject_draft: string | null;
  inmail_draft: string | null;
  outreach_status: string;
  created_at: string;
};

type SearchResult = {
  full_name: string;
  headline: string;
  current_title: string;
  current_company?: string;
  profile_url: string;
  connection_degree: string;
  profile_picture_url: string;
  shared_connections_count: number;
  is_alumni: boolean;
  category: string;
  priority_score: number;
};

/* ── Constants ── */
const OUTREACH_STATUSES = [
  { value: "Not contacted", color: "bg-gray-100 text-gray-600" },
  { value: "Connection sent", color: "bg-blue-100 text-blue-700" },
  { value: "Connected", color: "bg-green-100 text-green-700" },
  { value: "Replied", color: "bg-amber-100 text-amber-700" },
  { value: "Meeting booked", color: "bg-[#950606]/10 text-[#950606]" },
];

const CATEGORY_STYLES: Record<string, string> = {
  "In the Role": "bg-blue-100 text-blue-700",
  "Hiring Manager": "bg-purple-100 text-purple-700",
  "HR and Recruiter": "bg-teal-100 text-teal-700",
  "Your Network": "bg-green-100 text-green-700",
};

/* ── Module-level cache (survives tab switches) ── */
const searchResultsCache: Record<string, SearchResult[]> = {};

const getStatusStyle = (status: string) =>
  OUTREACH_STATUSES.find((s) => s.value === status)?.color || "bg-gray-100 text-gray-600";

const getDegreeBadge = (d: string | null) => {
  if (d === "1st") return "bg-green-100 text-green-700";
  if (d === "2nd") return "bg-blue-100 text-blue-700";
  return "bg-gray-100 text-gray-500";
};

const initials = (name: string | null) => {
  if (!name) return "?";
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
};

/* ── Avatar ── */
const Avatar = ({ url, name }: { url: string | null; name: string | null }) => (
  <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden shrink-0">
    {url ? (
      <img src={url} alt="" className="h-full w-full object-cover" />
    ) : (
      <span className="text-[11px] font-semibold text-gray-500">{initials(name)}</span>
    )}
  </div>
);

/* ── Status Dropdown ── */
const StatusPill = ({
  status, onChange,
}: { status: string; onChange: (v: string) => void }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${getStatusStyle(status)}`}
      >
        {status}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-full mt-1 left-0 bg-white border rounded-lg shadow-lg py-1 min-w-[160px]">
            {OUTREACH_STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => { onChange(s.value); setOpen(false); }}
                className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 ${status === s.value ? "font-semibold" : ""}`}
              >
                <span className={`inline-block px-2 py-0.5 rounded-full ${s.color}`}>{s.value}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ── Inline expandable message cell ── */
const MessageCell = ({
  type, contactId, jobId, draft, subjectDraft, expanded, onToggleExpand, onGenerated,
}: {
  type: "connection_note" | "inmail";
  contactId: string;
  jobId: string;
  draft: string | null;
  subjectDraft?: string | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onGenerated: (patch: Partial<OutreachContact>) => void;
}) => {
  const [generating, setGenerating] = useState(false);
  const [text, setText] = useState(draft || "");
  const [subject, setSubject] = useState(subjectDraft || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => { setText(draft || ""); }, [draft]);
  useEffect(() => { setSubject(subjectDraft || ""); }, [subjectDraft]);

  const generate = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    console.log('Draft button clicked for contact:', contactId);
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast.error("Session expired."); setGenerating(false); return; }

      const { data, error } = await supabase.functions.invoke("draft-outreach-messages", {
        body: { contact_id: contactId, job_id: jobId, message_type: "both" },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Failed to generate message.");
        return;
      }
      const patch: Partial<OutreachContact> = {};
      if (data.connection_note !== undefined) patch.connection_note_draft = data.connection_note;
      if (data.inmail !== undefined) patch.inmail_draft = data.inmail;
      if (data.inmail_subject !== undefined) patch.inmail_subject_draft = data.inmail_subject;
      if (type === "connection_note") setText(data.connection_note || "");
      else {
        setText(data.inmail || "");
        setSubject(data.inmail_subject || "");
      }
      onGenerated(patch);
      toast.success("Message generated!");
    } catch {
      toast.error("Failed to generate.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveText = async (newText: string) => {
    setText(newText);
    const patch: any = {};
    if (type === "connection_note") patch.connection_note_draft = newText;
    else patch.inmail_draft = newText;
    await supabase.from("contacts").update(patch).eq("id", contactId);
    onGenerated(patch);
  };

  const handleSaveSubject = async (newSubject: string) => {
    setSubject(newSubject);
    await supabase.from("contacts").update({ inmail_subject_draft: newSubject }).eq("id", contactId);
    onGenerated({ inmail_subject_draft: newSubject });
  };

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const copyText = type === "inmail" && subject ? `Subject: ${subject}\n\n${text}` : text;
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (generating) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Generating…</span>
      </div>
    );
  }

  if (!draft) {
    return (
      <button
        onClick={generate}
        className="text-xs rounded px-2.5 py-1 transition-colors font-medium"
        style={{ background: "var(--color-primary-light)", color: "var(--color-primary)" }}
      >
        Draft
      </button>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 cursor-pointer group"
        onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
      >
        <span className="text-[12px] text-gray-700 truncate max-w-[160px]">
          {text.slice(0, 40)}{text.length > 40 ? "…" : ""}
        </span>
        <button onClick={handleCopy} className="text-gray-400 hover:text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
          {type === "inmail" && (
            <Input
              value={subject}
              onChange={(e) => handleSaveSubject(e.target.value)}
              placeholder="Subject line"
              className="text-[12px] h-7"
            />
          )}
          <Textarea
            value={text}
            onChange={(e) => handleSaveText(e.target.value)}
            rows={type === "connection_note" ? 3 : 5}
            className="text-[12px] resize-none"
            maxLength={type === "connection_note" ? 300 : undefined}
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-gray-400">
              {type === "connection_note" ? `${text.length}/300` : `${text.length} chars`}
            </span>
            <button
              onClick={generate}
              className="text-[10px] text-gray-500 hover:text-gray-800 underline"
            >
              Regenerate
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── LinkedIn Search Panel ── */
/* Country → LinkedIn geoUrn ID map */
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

/* Suggest senior titles given a junior/intern role */
const suggestTitle = (jobTitle: string | null): string => {
  const t = (jobTitle || "").trim();
  if (!t) return "Manager";
  const lower = t.toLowerCase();
  if (lower.includes("brand")) return "Brand Manager";
  if (lower.includes("marketing")) return "Marketing Manager";
  if (lower.includes("product")) return "Product Manager";
  if (lower.includes("sales")) return "Sales Manager";
  if (lower.includes("finance") || lower.includes("financial")) return "Finance Manager";
  if (lower.includes("consulting") || lower.includes("consultant")) return "Consultant";
  if (lower.includes("strategy")) return "Strategy Manager";
  return "Manager";
};

/* Detect country from a free-text location string */
const detectGeoFromLocation = (location: string | null): string => {
  if (!location) return "";
  const l = location.toLowerCase();
  const map: Record<string, string> = {
    netherlands: "102890719",
    holland: "102890719",
    amsterdam: "102890719",
    rotterdam: "102890719",
    "the hague": "102890719",
    utrecht: "102890719",
    "united kingdom": "101165590",
    uk: "101165590",
    england: "101165590",
    london: "101165590",
    manchester: "101165590",
    france: "105015875",
    paris: "105015875",
    germany: "101282230",
    berlin: "101282230",
    munich: "101282230",
    "united states": "103644278",
    usa: "103644278",
    "u.s.": "103644278",
    "new york": "103644278",
    "san francisco": "103644278",
    belgium: "100565514",
    brussels: "100565514",
    spain: "105646813",
    madrid: "105646813",
    barcelona: "105646813",
    portugal: "100364837",
    lisbon: "100364837",
    switzerland: "106693272",
    zurich: "106693272",
    geneva: "106693272",
    luxembourg: "104042105",
  };
  for (const key of Object.keys(map)) {
    if (l.includes(key)) return map[key];
  }
  return "";
};

/* Build a LinkedIn People Search URL with proper filter parameters */
const buildLinkedInUrl = (opts: {
  titleFreeText?: string;
  company?: string;
  geoUrnId?: string;
  network?: "F" | "S" | "O";
}): string => {
  const params = new URLSearchParams();
  if (opts.titleFreeText?.trim()) {
    params.set("titleFreeText", opts.titleFreeText.trim());
  }
  if (opts.company?.trim()) {
    params.set("company", opts.company.trim());
  }
  if (opts.geoUrnId) {
    params.set("geoUrn", JSON.stringify([opts.geoUrnId]));
  }
  if (opts.network) {
    params.set("network", JSON.stringify([opts.network]));
  }
  params.set("origin", "FACETED_SEARCH");
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
};

const LinkedInSearchPanel = ({
  companyName,
  jobTitle,
  jobLocation,
}: {
  companyName: string | null;
  jobTitle: string | null;
  jobLocation: string | null;
}) => {
  const company = (companyName || "").trim();
  const initialGeo = detectGeoFromLocation(jobLocation) || "102890719";

  // Section 1 — Find a Contact
  const [targetTitle, setTargetTitle] = useState<string>(suggestTitle(jobTitle));
  const [targetCompany, setTargetCompany] = useState<string>(company);
  const [targetGeo, setTargetGeo] = useState<string>(initialGeo);
  const [targetNetwork, setTargetNetwork] = useState<"F" | "S" | "O">("S");

  // Section 2 — Find a Recruiter
  const [recCompany, setRecCompany] = useState<string>(company);
  const [recGeo, setRecGeo] = useState<string>(initialGeo);
  const [recNetwork, setRecNetwork] = useState<"F" | "S" | "O">("S");

  const openContactSearch = () => {
    const url = buildLinkedInUrl({
      titleFreeText: targetTitle,
      company: targetCompany,
      geoUrnId: targetGeo,
      network: targetNetwork,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openRecruiterSearch = (title: "Recruiter" | "Talent Acquisition Partner") => {
    const url = buildLinkedInUrl({
      titleFreeText: title,
      company: recCompany,
      geoUrnId: recGeo,
      network: recNetwork,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

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
      {/* Section 1 — Find a Contact */}
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-foreground" style={{ fontFamily: "Sora, sans-serif", fontSize: 15 }}>
            Find a Contact
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Search for someone in or one level above your target role at this company.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Target Title</label>
            <Input
              value={targetTitle}
              onChange={(e) => setTargetTitle(e.target.value)}
              placeholder="e.g. Brand Manager"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Company</label>
            <Input
              value={targetCompany}
              onChange={(e) => setTargetCompany(e.target.value)}
              placeholder="Company name"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Location</label>
            <Select value={targetGeo} onValueChange={setTargetGeo}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {GEO_URNS.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Network</label>
            <div className="h-10 flex items-center">
              <NetworkRadio value={targetNetwork} onChange={setTargetNetwork} name="contact-network" />
            </div>
          </div>
        </div>

        <Button
          onClick={openContactSearch}
          className="gap-2 bg-[#950606] hover:bg-[#7a0505] text-white"
        >
          <ExternalLink className="h-4 w-4" />
          Search on LinkedIn
        </Button>
      </div>

      {/* Section 2 — Find a Recruiter */}
      <div className="rounded-lg border bg-white p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-foreground" style={{ fontFamily: "Sora, sans-serif", fontSize: 15 }}>
            Find a Recruiter
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Two separate searches — recruiters and talent acquisition partners.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Company</label>
            <Input
              value={recCompany}
              onChange={(e) => setRecCompany(e.target.value)}
              placeholder="Company name"
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Location</label>
            <Select value={recGeo} onValueChange={setRecGeo}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {GEO_URNS.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Network</label>
            <div className="h-10 flex items-center">
              <NetworkRadio value={recNetwork} onChange={setRecNetwork} name="recruiter-network" />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => openRecruiterSearch("Recruiter")}
            variant="outline"
            className="gap-2 border-[#950606]/20 text-[#950606] hover:bg-[#FFF5F5] hover:text-[#950606]"
          >
            <ExternalLink className="h-4 w-4" />
            Search Recruiters
          </Button>
          <Button
            onClick={() => openRecruiterSearch("Talent Acquisition Partner")}
            variant="outline"
            className="gap-2 border-[#950606]/20 text-[#950606] hover:bg-[#FFF5F5] hover:text-[#950606]"
          >
            <ExternalLink className="h-4 w-4" />
            Search Talent Acquisition
          </Button>
        </div>

        <p className="text-xs text-muted-foreground italic border-t pt-3">
          Find someone relevant, copy their LinkedIn profile URL, and add them to your contact tracker below.
        </p>
      </div>
    </div>
  );
};

/* ── Main Component ── */
const OutreachTab = ({
  jobId, userId, companyName, jobTitle, jobLocation, jobFunction, contacts, setContacts,
}: {
  jobId: string;
  userId: string;
  companyName: string | null;
  jobTitle: string | null;
  jobLocation: string | null;
  jobFunction: string | null;
  contacts: OutreachContact[];
  setContacts: React.Dispatch<React.SetStateAction<OutreachContact[]>>;
}) => {
  const navigate = useNavigate();
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [noCookie, setNoCookie] = useState(false);
  const [cookieExpired, setCookieExpired] = useState(false);
  const [sessionBlocked, setSessionBlocked] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [expandedCell, setExpandedCell] = useState<string | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore cache marker
  useEffect(() => {
    const cacheKey = companyName || "";
    if (searchResultsCache[cacheKey]?.length) setSearched(true);
  }, [companyName]);

  useEffect(() => {
    if (rateLimitUntil) {
      const tick = () => {
        const remaining = Math.max(0, Math.ceil((rateLimitUntil - Date.now()) / 1000));
        setCountdown(remaining);
        if (remaining <= 0) {
          setRateLimitUntil(null);
          if (countdownRef.current) clearInterval(countdownRef.current);
        }
      };
      tick();
      countdownRef.current = setInterval(tick, 1000);
      return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
    }
  }, [rateLimitUntil]);

  const refreshContactsFromDb = async () => {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("job_id", jobId)
      .order("priority_score", { ascending: false, nullsFirst: false });
    if (!error && data) {
      setContacts(data as any);
    }
  };

  const handleSearch = async () => {
    if (rateLimitUntil && Date.now() < rateLimitUntil) return;
    setSearching(true);
    setNoCookie(false);
    setCookieExpired(false);
    setSessionBlocked(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const token = session?.access_token;
      if (!session) { toast.error("Session expired."); setSearching(false); return; }

      const { data, error } = await supabase.functions.invoke("search-linkedin-contacts", {
        body: { company_name: companyName, job_title: jobTitle, job_function: jobFunction, job_id: jobId, user_id: session.user.id },
        ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
      });

      if (error || !data?.success) {
        if (data?.step === "no_cookie") setNoCookie(true);
        else if (data?.step === "cookie_expired") { setCookieExpired(true); toast.error(data.message); }
        else if (data?.step === "rate_limited") {
          setRateLimitUntil(Date.now() + 120_000);
          toast.error("LinkedIn rate limit reached — please wait 2 minutes before searching again.");
        } else if (data?.step === "all_searches_failed") {
          setSessionBlocked(true);
        } else {
          toast.error("LinkedIn search failed — please try again.");
        }
        return;
      }

      const results: SearchResult[] = data.contacts || [];
      setSearched(true);
      searchResultsCache[companyName || ""] = results;
      // Edge function persisted contacts to DB — refresh from source of truth
      await refreshContactsFromDb();
      if (results.length === 0) toast(`No contacts found for ${companyName || "this company"}.`);
    } catch {
      toast.error("LinkedIn search failed — please try again.");
    } finally {
      setSearching(false);
    }
  };

  const handleManualAdd = async () => {
    const url = manualUrl.trim();
    if (!url) return;
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        job_id: jobId,
        user_id: userId,
        linkedin_url: url,
        name: "Manual contact",
        outreach_status: "Not contacted",
      } as any)
      .select("*")
      .single();
    if (!error && data) {
      setContacts((prev) => [...prev, data as any]);
      setManualUrl("");
      setManualOpen(false);
      toast.success("Contact added");
    }
  };

  const updateContact = async (id: string, patch: Partial<OutreachContact>) => {
    await supabase.from("contacts").update(patch as any).eq("id", id);
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const deleteContact = async (id: string) => {
    await supabase.from("contacts").delete().eq("id", id);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setDeleteId(null);
    toast.success("Contact removed");
  };

  const isLocked = !!rateLimitUntil && countdown > 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-bold text-foreground" style={{ fontFamily: "Sora, sans-serif", fontSize: 20 }}>
            Outreach
          </h2>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button
            onClick={handleSearch}
            disabled={searching || isLocked}
            className="gap-2 bg-[#950606] hover:bg-[#7a0505] text-white"
          >
            {searching ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</>
            ) : isLocked ? (
              <>Wait {countdown}s</>
            ) : (
              <><Search className="h-4 w-4" /> {contacts.length > 0 ? "Search for more contacts" : "Search LinkedIn"}</>
            )}
          </Button>
          <p className="text-[11px] text-gray-400 max-w-[280px] text-right">
            Hiro searches LinkedIn as you. Contacts are saved automatically.
          </p>
        </div>
      </div>

      {/* LinkedIn Search Panel — manual search URLs */}
      <LinkedInSearchPanel companyName={companyName} jobTitle={jobTitle} jobLocation={jobLocation} />

      {/* Contact Tracker — outreach_contacts table */}
      <ContactTracker jobId={jobId} userId={userId} companyName={companyName} />

      {/* Alerts */}
      {noCookie && (
        <div className="flex items-center gap-3 rounded-lg p-3 bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-800">
            Connect your LinkedIn in{" "}
            <button onClick={() => navigate("/settings")} className="underline font-medium">Settings</button> first.
          </div>
        </div>
      )}
      {cookieExpired && (
        <div className="flex items-center gap-3 rounded-lg p-3 bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-800">
            Your LinkedIn session has expired. Update it in{" "}
            <button onClick={() => navigate("/settings")} className="underline font-medium">Settings</button>.
          </div>
        </div>
      )}
      {sessionBlocked && (
        <div className="flex items-start gap-3 rounded-lg p-4 bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-900 space-y-2 flex-1">
            <p className="font-semibold">LinkedIn temporarily blocked.</p>
            <p>Please wait 10 minutes and try again.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setSessionBlocked(false); handleSearch(); }}
              className="mt-1 border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              Retry
            </Button>
          </div>
        </div>
      )}
      {isLocked && (
        <div className="flex items-center gap-3 rounded-lg p-3 bg-amber-50 border border-amber-200">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="text-sm text-amber-800">
            LinkedIn rate limit reached — please wait {countdown}s before searching again.
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {searching && (
        <div className="space-y-3 py-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty states */}
      {!searching && contacts.length === 0 && !searched && (
        <div className="border rounded-lg bg-white py-16 text-center">
          <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No contacts yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Click Search LinkedIn to find people at <strong>{companyName || "this company"}</strong>.
          </p>
        </div>
      )}

      {!searching && contacts.length === 0 && searched && (
        <div className="border rounded-lg bg-white py-12 text-center px-6">
          <p className="text-sm font-medium text-foreground">
            No contacts found for {companyName || "this company"}.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Try searching manually by pasting a LinkedIn URL below.
          </p>
        </div>
      )}

      {/* Unified table */}
      {contacts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="w-full" style={{ minWidth: 1100 }}>
            <thead>
              <tr className="border-b bg-gray-50/50">
                {["Person", "Category", "Company", "Connection", "Status", "Connection Note", "InMail", ""].map((h, i) => (
                  <th
                    key={i}
                    className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-[#FFF5F5]/30 transition-colors align-top">
                  {/* Person */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar url={c.profile_picture_url} name={c.name} />
                      <div className="min-w-0">
                        {c.linkedin_url ? (
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[14px] font-bold text-foreground hover:text-[#950606] transition-colors truncate block"
                          >
                            {c.name || "Unknown"}
                          </a>
                        ) : (
                          <span className="text-[14px] font-bold text-foreground truncate block">
                            {c.name || "Unknown"}
                          </span>
                        )}
                        <p className="text-[12px] text-gray-500 truncate">{c.current_title || "–"}</p>
                      </div>
                    </div>
                  </td>
                  {/* Category */}
                  <td className="px-3 py-3">
                    {c.category && (
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${CATEGORY_STYLES[c.category] || "bg-gray-100 text-gray-500"}`}>
                        {c.category}
                      </span>
                    )}
                  </td>
                  {/* Company */}
                  <td className="px-3 py-3">
                    <span className="text-[13px] text-gray-700">{c.current_company || "–"}</span>
                  </td>
                  {/* Connection */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      {c.connection_degree && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getDegreeBadge(c.connection_degree)}`}>
                          {c.connection_degree}
                        </span>
                      )}
                      {c.is_alumni && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#950606]/10 text-[#950606]">
                          Alumni
                        </span>
                      )}
                    </div>
                  </td>
                  {/* Status */}
                  <td className="px-3 py-3">
                    <StatusPill
                      status={c.outreach_status}
                      onChange={(v) => updateContact(c.id, { outreach_status: v })}
                    />
                  </td>
                  {/* Connection Note */}
                  <td className="px-3 py-3" style={{ minWidth: 220 }}>
                    <MessageCell
                      type="connection_note"
                      contactId={c.id}
                      jobId={jobId}
                      draft={c.connection_note_draft}
                      expanded={expandedCell === `${c.id}-note`}
                      onToggleExpand={() =>
                        setExpandedCell(expandedCell === `${c.id}-note` ? null : `${c.id}-note`)
                      }
                      onGenerated={(patch) => updateContact(c.id, patch)}
                    />
                  </td>
                  {/* InMail */}
                  <td className="px-3 py-3" style={{ minWidth: 220 }}>
                    <MessageCell
                      type="inmail"
                      contactId={c.id}
                      jobId={jobId}
                      draft={c.inmail_draft}
                      subjectDraft={c.inmail_subject_draft}
                      expanded={expandedCell === `${c.id}-inmail`}
                      onToggleExpand={() =>
                        setExpandedCell(expandedCell === `${c.id}-inmail` ? null : `${c.id}-inmail`)
                      }
                      onGenerated={(patch) => updateContact(c.id, patch)}
                    />
                  </td>
                  {/* Actions */}
                  <td className="px-3 py-3">
                    <button
                      onClick={() => setDeleteId(c.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
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

      {/* Manual add */}
      {!manualOpen ? (
        <button
          onClick={() => setManualOpen(true)}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors"
        >
          <Plus className="h-3 w-3" /> Add contact manually by LinkedIn URL
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={manualUrl}
            onChange={(e) => setManualUrl(e.target.value)}
            placeholder="Paste LinkedIn profile URL"
            className="flex-1 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleManualAdd()}
          />
          <Button size="sm" onClick={handleManualAdd} className="bg-[#950606] hover:bg-[#7a0505] text-white">
            Add
          </Button>
          <button onClick={() => { setManualOpen(false); setManualUrl(""); }} className="text-gray-400 hover:text-gray-600">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this contact?</AlertDialogTitle>
            <AlertDialogDescription>Their messages will also be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteContact(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OutreachTab;
