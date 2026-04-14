import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Search, Users, ChevronDown, ChevronUp, Check, X as XIcon, Trash2, Copy,
  Pencil, Loader2, AlertTriangle, Plus, ExternalLink, Settings
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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

const CATEGORIES = ["In the Role", "Hiring Manager", "HR and Recruiter", "Your Network"];

/* ── Module-level search results cache (survives tab switches) ── */
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
  status,
  onChange,
}: {
  status: string;
  onChange: (v: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
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

/* ── Expandable message cell ── */
const MessageCell = ({
  type,
  contactId,
  jobId,
  draft,
  subjectDraft,
  onGenerated,
}: {
  type: "connection_note" | "inmail";
  contactId: string;
  jobId: string;
  draft: string | null;
  subjectDraft?: string | null;
  onGenerated: (patch: Partial<OutreachContact>) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [text, setText] = useState(draft || "");
  const [subject, setSubject] = useState(subjectDraft || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => { setText(draft || ""); }, [draft]);
  useEffect(() => { setSubject(subjectDraft || ""); }, [subjectDraft]);

  const generate = async () => {
    setGenerating(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) { toast.error("Session expired."); setGenerating(false); return; }

      const { data, error } = await supabase.functions.invoke("draft-outreach-messages", {
        body: { contact_id: contactId, job_id: jobId, message_type: type },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (error || !data?.success) {
        toast.error(data?.error || "Failed to generate message.");
        return;
      }
      if (type === "connection_note") {
        setText(data.connection_note || "");
        onGenerated({ connection_note_draft: data.connection_note });
      } else {
        setText(data.inmail || "");
        setSubject(data.inmail_subject || "");
        onGenerated({ inmail_draft: data.inmail, inmail_subject_draft: data.inmail_subject });
      }
      toast.success("Message generated!");
    } catch {
      toast.error("Failed to generate.");
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    const patch: any = {};
    if (type === "connection_note") patch.connection_note_draft = text;
    else { patch.inmail_draft = text; patch.inmail_subject_draft = subject; }
    await supabase.from("contacts").update(patch).eq("id", contactId);
    onGenerated(patch);
    toast.success("Saved");
  };

  const handleCopy = async () => {
    const copyText = type === "inmail" && subject ? `Subject: ${subject}\n\n${text}` : text;
    await navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!draft && !generating) {
    return (
      <button onClick={generate} className="text-xs text-gray-400 hover:text-gray-600 border border-dashed border-gray-300 rounded px-2.5 py-1.5 hover:border-gray-400 transition-colors">
        Generate
      </button>
    );
  }

  if (generating) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Generating…</span>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="text-left text-[13px] text-gray-600 hover:text-gray-900 transition-colors max-w-[200px]">
        <span className="line-clamp-1">{text.slice(0, 60)}{text.length > 60 ? "…" : ""}</span>
        <span className="text-[10px] text-gray-400 block mt-0.5">Click to expand</span>
      </button>
    );
  }

  const charCount = text.length;
  const isOverLimit = type === "connection_note" && charCount > 300;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setExpanded(false)}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-5 space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">
            {type === "connection_note" ? "Connection Note" : "InMail"}
          </h4>
          <button onClick={() => setExpanded(false)} className="text-gray-400 hover:text-gray-600">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {type === "inmail" && (
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-[13px]"
              placeholder="InMail subject line"
            />
          </div>
        )}
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={type === "connection_note" ? 4 : 6}
          className="text-[13px] resize-none focus:ring-1 focus:ring-[#950606] focus:border-[#950606]"
        />
        <div className="flex items-center justify-between">
          <span className={`text-[11px] ${isOverLimit ? "text-red-600 font-medium" : "text-gray-400"}`}>
            {type === "connection_note" ? `${charCount}/300 chars` : `${wordCount} words`}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={generate} disabled={generating}>
              Regenerate
            </Button>
            <Button size="sm" className="h-7 text-xs bg-[#950606] hover:bg-[#7a0505] text-white" onClick={save}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Main Component ── */
const OutreachTab = ({
  jobId,
  userId,
  companyName,
  jobTitle,
  jobFunction,
  contacts,
  setContacts,
}: {
  jobId: string;
  userId: string;
  companyName: string | null;
  jobTitle: string | null;
  jobFunction: string | null;
  contacts: OutreachContact[];
  setContacts: React.Dispatch<React.SetStateAction<OutreachContact[]>>;
}) => {
  const navigate = useNavigate();
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [addedUrls, setAddedUrls] = useState<Set<string>>(new Set());
  const [dismissedUrls, setDismissedUrls] = useState<Set<string>>(new Set());
  const [noCookie, setNoCookie] = useState(false);
  const [cookieExpired, setCookieExpired] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState("");
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    "In the Role": true,
    "Hiring Manager": true,
    "HR and Recruiter": true,
    "Your Network": true,
  });
  const [rateLimitUntil, setRateLimitUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore from cache on mount (no auto-search)
  useEffect(() => {
    const cacheKey = companyName || "";
    const cached = searchResultsCache[cacheKey];
    if (cached && cached.length > 0) {
      setSearchResults(cached);
      setSearched(true);
    }
  }, [companyName]);

  // Countdown timer for rate limit
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

  // Track which contacts are already added by profile_url
  useEffect(() => {
    setAddedUrls(new Set(contacts.map((c) => c.linkedin_url).filter(Boolean) as string[]));
  }, [contacts]);

  const handleSearch = async () => {
    console.log('Search LinkedIn clicked');
    if (rateLimitUntil && Date.now() < rateLimitUntil) return;
    setSearching(true);
    setNoCookie(false);
    setCookieExpired(false);
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
        if (data?.step === "no_cookie") { setNoCookie(true); }
        else if (data?.step === "cookie_expired") { setCookieExpired(true); toast.error(data.message); }
        else if (data?.step === "rate_limited") {
          const until = Date.now() + 120_000;
          setRateLimitUntil(until);
          toast.error("LinkedIn rate limit reached — please wait 2 minutes before searching again.");
        }
        else {
          toast.error("LinkedIn search failed — please try again.");
        }
        else { toast.error(data?.message || "Search failed."); }
        return;
      }

      const results = data.contacts || [];
      setSearchResults(results);
      setSearched(true);
      // Cache results
      const cacheKey = companyName || "";
      searchResultsCache[cacheKey] = results;
      if (results.length === 0) toast("No contacts found. Try a different company name.");
    } catch {
      toast.error("Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleAddContact = async (result: SearchResult) => {
    const { data, error } = await supabase
      .from("contacts")
      .insert({
        job_id: jobId,
        user_id: userId,
        linkedin_url: result.profile_url,
        name: result.full_name,
        headline: result.headline,
        current_title: result.current_title,
        profile_picture_url: result.profile_picture_url,
        connection_degree: result.connection_degree,
        is_alumni: result.is_alumni,
        shared_connections_count: result.shared_connections_count || null,
        category: result.category,
        priority_score: result.priority_score,
        outreach_status: "Not contacted",
      } as any)
      .select("*")
      .single();

    if (!error && data) {
      setContacts((prev) => [...prev, data as any]);
      setAddedUrls((prev) => new Set(prev).add(result.profile_url));
      toast.success(`${result.full_name} added`);
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

  // Group search results by category
  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = searchResults.filter(
      (r) => r.category === cat && !dismissedUrls.has(r.profile_url)
    );
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <div className="space-y-8">
      {/* ── SECTION 1: Find Contacts ── */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-foreground text-base" style={{ fontFamily: "Sora, sans-serif" }}>
                Find Contacts
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                Hiro searches LinkedIn as you, using your network and alumni connections to find the most relevant people at{" "}
                <strong>{companyName || "this company"}</strong>.
              </p>
            </div>
          </div>

          {noCookie && (
            <div className="flex items-center gap-3 rounded-lg p-4 bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="text-sm text-amber-800">
                Connect your LinkedIn in{" "}
                <button onClick={() => navigate("/settings")} className="underline font-medium hover:text-amber-900">
                  Settings
                </button>{" "}
                first.
              </div>
            </div>
          )}

          {cookieExpired && (
            <div className="flex items-center gap-3 rounded-lg p-4 bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="text-sm text-amber-800">
                Your LinkedIn session has expired. Update your cookie in{" "}
                <button onClick={() => navigate("/settings")} className="underline font-medium hover:text-amber-900">
                  Settings
                </button>.
              </div>
            </div>
          )}

          {rateLimitUntil && countdown > 0 && (
            <div className="flex items-center gap-3 rounded-lg p-4 bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="text-sm text-amber-800">
                LinkedIn rate limit reached — please wait {countdown}s before searching again.
              </div>
            </div>
          )}

          <Button
            onClick={handleSearch}
            disabled={searching || (!!rateLimitUntil && countdown > 0)}
            className="gap-2 bg-[#950606] hover:bg-[#7a0505] text-white"
          >
            {searching ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Searching…</>
            ) : rateLimitUntil && countdown > 0 ? (
              <>Wait {countdown}s</>
            ) : (
              <><Search className="h-4 w-4" /> Search LinkedIn</>
            )}
          </Button>

          {/* Loading skeleton */}
          {searching && (
            <div className="space-y-4 pt-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="space-y-1.5 flex-1">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground text-center animate-pulse">
                Searching LinkedIn as you…
              </p>
            </div>
          )}

          {/* Search results */}
          {searched && !searching && searchResults.length > 0 && (
            <div className="space-y-3 pt-2">
              {CATEGORIES.map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;
                const isOpen = sectionsOpen[cat] ?? true;
                return (
                  <Collapsible key={cat} open={isOpen} onOpenChange={(o) => setSectionsOpen((p) => ({ ...p, [cat]: o }))}>
                    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5">
                      {isOpen ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                      <span className="text-xs font-semibold text-foreground uppercase tracking-wide">{cat}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{items.length}</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-1 mt-1">
                      {items.map((r) => {
                        const isAdded = addedUrls.has(r.profile_url);
                        return (
                          <div
                            key={r.profile_url}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <Avatar url={r.profile_picture_url} name={r.full_name} />
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-foreground truncate">{r.full_name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{r.current_title}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getDegreeBadge(r.connection_degree)}`}>
                              {r.connection_degree}
                            </span>
                            {r.is_alumni && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#950606]/10 text-[#950606]">
                                Alumni
                              </span>
                            )}
                            {r.shared_connections_count > 0 && (
                              <span className="text-[10px] text-gray-400">{r.shared_connections_count} shared</span>
                            )}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isAdded ? (
                                <span className="text-green-600">
                                  <Check className="h-4 w-4" />
                                </span>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-[#950606] hover:bg-[#7a0505] text-white px-3"
                                    onClick={() => handleAddContact(r)}
                                  >
                                    Add
                                  </Button>
                                  <button
                                    onClick={() => setDismissedUrls((p) => new Set(p).add(r.profile_url))}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <XIcon className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {searched && !searching && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No contacts found at {companyName || "this company"}.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── SECTION 2: Outreach Tracker ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-base text-foreground" style={{ fontFamily: "Sora, sans-serif" }}>
            Outreach Tracker
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
            {contacts.length}
          </span>
        </div>

        {contacts.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">No contacts yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click Search LinkedIn above to find the right people at{" "}
                <strong>{companyName || "this company"}</strong>.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
            <table className="w-full" style={{ minWidth: 1050 }}>
              <thead>
                <tr className="border-b">
                  {["Person", "Role", "Category", "Connection", "Status", "Connection Note", "InMail", ""].map((h, i) => (
                    <th
                      key={i}
                      className="text-left px-3 py-2.5 text-[11px] font-medium text-gray-400 uppercase tracking-wider"
                      style={h === "Connection Note" || h === "InMail" ? { minWidth: 200 } : undefined}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.map((c) => (
                  <tr key={c.id} className="border-b border-gray-100 hover:bg-[#FFF5F5] transition-colors">
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
                              className="text-[13px] font-semibold text-foreground hover:text-[#950606] transition-colors truncate block"
                            >
                              {c.name || "Unknown"}
                            </a>
                          ) : (
                            <span className="text-[13px] font-semibold text-foreground truncate block">
                              {c.name || "Unknown"}
                            </span>
                          )}
                          <p className="text-[11px] text-gray-400 truncate">{c.current_title || "–"}</p>
                        </div>
                      </div>
                    </td>
                    {/* Role */}
                    <td className="px-3 py-3">
                      <span className="text-[13px] text-gray-600 truncate block max-w-[140px]" title={c.current_title || ""}>
                        {c.current_title || "–"}
                      </span>
                    </td>
                    {/* Category */}
                    <td className="px-3 py-3">
                      {c.category && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 whitespace-nowrap">
                          {c.category}
                        </span>
                      )}
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
                    <td className="px-3 py-3" style={{ minWidth: 200 }}>
                      <MessageCell
                        type="connection_note"
                        contactId={c.id}
                        jobId={jobId}
                        draft={c.connection_note_draft}
                        onGenerated={(patch) => updateContact(c.id, patch)}
                      />
                    </td>
                    {/* InMail */}
                    <td className="px-3 py-3" style={{ minWidth: 200 }}>
                      <MessageCell
                        type="inmail"
                        contactId={c.id}
                        jobId={jobId}
                        draft={c.inmail_draft}
                        subjectDraft={c.inmail_subject_draft}
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
            <Plus className="h-3 w-3" /> Add contact manually
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
      </div>

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
