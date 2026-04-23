import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Trash2, MessageSquare, ExternalLink, Loader2, Copy, RefreshCw, Check } from "lucide-react";
import { format } from "date-fns";

/* ── Types ── */
type OutreachContact = {
  id: string;
  user_id: string;
  job_id: string;
  name: string | null;
  title: string | null;
  company: string | null;
  linkedin_url: string | null;
  category: "in_role" | "hiring_manager" | "recruiter" | null;
  connection_degree: "1st" | "2nd" | "3rd" | "unknown" | null;
  status: "not_contacted" | "messaged" | "replied" | "meeting_booked";
  notes: string | null;
  drafted_message: string | null;
  date_added: string;
  date_messaged: string | null;
};

const CATEGORY_OPTIONS: { value: OutreachContact["category"]; label: string; cls: string }[] = [
  { value: "in_role", label: "In the role", cls: "bg-blue-100 text-blue-700" },
  { value: "hiring_manager", label: "Hiring manager", cls: "bg-purple-100 text-purple-700" },
  { value: "recruiter", label: "Recruiter", cls: "bg-teal-100 text-teal-700" },
];

const DEGREE_OPTIONS: OutreachContact["connection_degree"][] = ["1st", "2nd", "3rd", "unknown"];

const STATUS_OPTIONS: { value: OutreachContact["status"]; label: string; cls: string }[] = [
  { value: "not_contacted", label: "Not contacted", cls: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "messaged", label: "Messaged", cls: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "replied", label: "Replied", cls: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "meeting_booked", label: "Meeting booked", cls: "bg-green-100 text-green-700 border-green-200" },
];

const LINKEDIN_RE = /^https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9\-_%]+\/?/i;

const getCategory = (v: string | null) =>
  CATEGORY_OPTIONS.find((c) => c.value === v);
const getStatus = (v: string) =>
  STATUS_OPTIONS.find((s) => s.value === v) || STATUS_OPTIONS[0];

const ContactTracker = ({
  jobId,
  userId,
  companyName,
  jobTitle,
  jobDescription,
  onDraftMessage,
}: {
  jobId: string;
  userId: string;
  companyName: string | null;
  jobTitle: string | null;
  jobDescription: string | null;
  onDraftMessage?: (contact: OutreachContact) => void;
}) => {
  const [contacts, setContacts] = useState<OutreachContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Draft modal state
  const [draftContact, setDraftContact] = useState<OutreachContact | null>(null);
  const [draftType, setDraftType] = useState<"connection_request" | "outreach">("connection_request");
  const [draftText, setDraftText] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftCopied, setDraftCopied] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [hasCv, setHasCv] = useState<boolean | null>(null);
  const [cvSummary, setCvSummary] = useState<string>("");
  const [confirmStatusOpen, setConfirmStatusOpen] = useState(false);

  // Form state
  const [fLinkedin, setFLinkedin] = useState("");
  const [fName, setFName] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fCompany, setFCompany] = useState(companyName || "");
  const [fCategory, setFCategory] = useState<OutreachContact["category"]>("in_role");
  const [fDegree, setFDegree] = useState<OutreachContact["connection_degree"]>("unknown");
  const [fNotes, setFNotes] = useState("");
  const [fLinkedinError, setFLinkedinError] = useState<string | null>(null);

  useEffect(() => {
    if (addOpen) setFCompany(companyName || "");
  }, [addOpen, companyName]);

  const resetForm = () => {
    setFLinkedin("");
    setFName("");
    setFTitle("");
    setFCompany(companyName || "");
    setFCategory("in_role");
    setFDegree("unknown");
    setFNotes("");
    setFLinkedinError(null);
  };

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("outreach_contacts" as any)
      .select("*")
      .eq("job_id", jobId)
      .order("date_added", { ascending: false });
    if (error) {
      toast.error("Could not load contacts");
    } else {
      setContacts((data || []) as unknown as OutreachContact[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // Detect whether the user has any CV data — drives the AI draft buttons
  useEffect(() => {
    let cancelled = false;
    const checkCv = async () => {
      const [wRes, eRes, sRes, pRes] = await Promise.all([
        supabase
          .from("work_experiences")
          .select("company_name, job_title, bullet_points, start_year")
          .eq("user_id", userId)
          .order("start_year", { ascending: false })
          .limit(3),
        supabase
          .from("education")
          .select("institution, degree, field_of_study, start_year")
          .eq("user_id", userId)
          .order("start_year", { ascending: false })
          .limit(3),
        supabase
          .from("skills")
          .select("hard_skills, soft_skills")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("profiles")
          .select("full_name, base_cv_text")
          .eq("id", userId)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const works = wRes.data ?? [];
      const edus = eRes.data ?? [];
      const skills = sRes.data as { hard_skills?: string[]; soft_skills?: string[] } | null;
      const profile = pRes.data as { full_name?: string | null; base_cv_text?: string | null } | null;

      const has =
        works.length > 0 ||
        edus.length > 0 ||
        !!profile?.base_cv_text;
      setHasCv(has);

      // Build a compact CV summary used by the drafting Edge Function
      const experiences = works
        .map(
          (w: any) =>
            `- ${w.job_title} at ${w.company_name}: ${(w.bullet_points ?? []).slice(0, 2).join("; ")}`
        )
        .join("\n");
      const schools = edus
        .map(
          (ed: any) =>
            `${ed.institution} (${ed.degree}${ed.field_of_study ? `, ${ed.field_of_study}` : ""})`
        )
        .join("; ");
      const skillsList = skills
        ? [...(skills.hard_skills ?? []), ...(skills.soft_skills ?? [])].slice(0, 10).join(", ")
        : "";
      const summary = [
        profile?.full_name ? `Name: ${profile.full_name}` : null,
        schools ? `Education: ${schools}` : null,
        experiences ? `Recent experience:\n${experiences}` : null,
        skillsList ? `Key skills: ${skillsList}` : null,
        profile?.base_cv_text
          ? `Additional CV context: ${profile.base_cv_text.slice(0, 1500)}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");
      setCvSummary(summary);
    };
    checkCv();
    return () => { cancelled = true; };
  }, [userId]);

  const validateLinkedin = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return "LinkedIn URL is required";
    if (!LINKEDIN_RE.test(trimmed)) return "Must be a linkedin.com/in/ profile URL";
    return null;
  };

  const handleLinkedinChange = (v: string) => {
    setFLinkedin(v);
    if (v.trim()) setFLinkedinError(validateLinkedin(v));
    else setFLinkedinError(null);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (LINKEDIN_RE.test(pasted)) {
      e.preventDefault();
      setFLinkedin(pasted);
      setFLinkedinError(null);
    }
  };

  const handleAdd = async () => {
    const err = validateLinkedin(fLinkedin);
    if (err) { setFLinkedinError(err); return; }
    setSaving(true);
    const payload = {
      user_id: userId,
      job_id: jobId,
      linkedin_url: fLinkedin.trim(),
      name: fName.trim() || null,
      title: fTitle.trim() || null,
      company: fCompany.trim() || null,
      category: fCategory,
      connection_degree: fDegree,
      status: "not_contacted",
      notes: fNotes.trim() || null,
    };
    const { data, error } = await supabase
      .from("outreach_contacts" as any)
      .insert(payload)
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("Could not add contact");
      return;
    }
    setContacts((prev) => [data as unknown as OutreachContact, ...prev]);
    toast.success("Contact added");
    setAddOpen(false);
    resetForm();
  };

  const updateField = async (id: string, patch: Partial<OutreachContact>) => {
    const prev = contacts;
    setContacts((c) => c.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const { error } = await supabase
      .from("outreach_contacts" as any)
      .update(patch)
      .eq("id", id);
    if (error) {
      setContacts(prev);
      toast.error("Update failed");
    }
  };

  const handleStatusChange = (c: OutreachContact, status: OutreachContact["status"]) => {
    const patch: Partial<OutreachContact> = { status };
    if (status === "messaged" && !c.date_messaged) {
      patch.date_messaged = new Date().toISOString();
    }
    updateField(c.id, patch);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("outreach_contacts" as any).delete().eq("id", deleteId);
    if (error) {
      toast.error("Could not delete contact");
    } else {
      setContacts((c) => c.filter((x) => x.id !== deleteId));
      toast.success("Contact removed");
    }
    setDeleteId(null);
  };

  /* ── Draft message ── */
  const openDraft = (c: OutreachContact, type: "connection_request" | "outreach") => {
    setDraftContact(c);
    setDraftType(type);
    setDraftText("");
    setDraftCopied(false);
    setDraftError(null);
    generateDraft(c, type);
  };

  const generateDraft = async (
    _c: OutreachContact,
    type: "connection_request" | "outreach"
  ) => {
    setDraftLoading(true);
    setDraftError(null);
    try {
      if (!cvSummary) {
        setDraftError("Add your CV in Settings to enable AI-drafted messages");
        return;
      }
      const { data, error } = await supabase.functions.invoke("draft-outreach-messages", {
        body: {
          jobTitle: jobTitle ?? "",
          companyName: companyName ?? "",
          jobDescription: jobDescription ?? "",
          cvSummary,
          messageType: type,
        },
      });
      if (error || !data) {
        setDraftError("Could not generate draft. Please try again.");
        return;
      }
      if ((data as any).error) {
        setDraftError("Could not generate draft. Please try again.");
        return;
      }
      const msg = ((data as any).message || "").toString().trim();
      if (!msg) {
        setDraftError("Could not generate draft. Please try again.");
        return;
      }
      // Hard-enforce length cap
      const cap = type === "connection_request" ? 300 : 800;
      setDraftText(msg.length > cap ? msg.slice(0, cap - 1).trimEnd() + "\u2026" : msg);
    } catch {
      setDraftError("Could not generate draft. Please try again.");
    } finally {
      setDraftLoading(false);
    }
  };

  const handleSwitchType = (next: "connection_request" | "outreach") => {
    if (next === draftType || !draftContact) return;
    setDraftType(next);
    setDraftText("");
    setDraftError(null);
    generateDraft(draftContact, next);
  };

  const handleCopyDraft = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setDraftCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setDraftCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  const persistDraft = async (alsoMarkMessaged: boolean) => {
    if (!draftContact) return;
    setDraftSaving(true);
    const patch: Partial<OutreachContact> = { drafted_message: draftText };
    if (alsoMarkMessaged) {
      patch.status = "messaged";
      if (!draftContact.date_messaged) patch.date_messaged = new Date().toISOString();
    }
    const { error } = await supabase
      .from("outreach_contacts" as any)
      .update(patch)
      .eq("id", draftContact.id);
    setDraftSaving(false);
    if (error) {
      toast.error("Could not save draft");
      return;
    }
    setContacts((cs) => cs.map((x) => (x.id === draftContact.id ? { ...x, ...patch } : x)));
    toast.success(alsoMarkMessaged ? "Draft saved · marked as messaged" : "Draft saved");
    setConfirmStatusOpen(false);
    setDraftContact(null);
  };

  const handleSaveDraft = () => {
    if (!draftContact) return;
    if (draftContact.status === "not_contacted") {
      setConfirmStatusOpen(true);
    } else {
      persistDraft(false);
    }
  };

  const isConnNote = draftType === "connection_request";
  const charCount = draftText.length;
  const counterColor = isConnNote
    ? charCount >= 290
      ? "text-red-600"
      : charCount >= 260
      ? "text-amber-600"
      : "text-muted-foreground"
    : "text-muted-foreground";

  return (
    <div className="rounded-lg border bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-foreground" style={{ fontFamily: "Sora, sans-serif", fontSize: 15 }}>
            Contact tracker
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            People you've identified for this application.
          </p>
        </div>
        <Button
          onClick={() => { resetForm(); setAddOpen(true); }}
          className="gap-2 bg-[#950606] hover:bg-[#7a0505] text-white"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Add contact
        </Button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
          Loading contacts…
        </div>
      ) : contacts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-200 bg-[#FAFAFB] py-10 px-6 text-center">
          <p className="text-sm text-foreground font-medium">No contacts added yet.</p>
          <p className="text-xs text-muted-foreground mt-1.5">
            Use the search links above to find people on LinkedIn, then add them here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="font-medium py-2 pr-3">Name</th>
                <th className="font-medium py-2 pr-3">Title</th>
                <th className="font-medium py-2 pr-3">Category</th>
                <th className="font-medium py-2 pr-3">Connection</th>
                <th className="font-medium py-2 pr-3">Status</th>
                <th className="font-medium py-2 pr-3">Date added</th>
                <th className="font-medium py-2 pr-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const cat = getCategory(c.category);
                const st = getStatus(c.status);
                return (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-gray-50/60">
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {c.name || "Unnamed contact"}
                        </span>
                        {c.linkedin_url && (
                          <a
                            href={c.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-[#950606]"
                            title="Open LinkedIn profile"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-foreground/80">
                      {c.title || <span className="text-muted-foreground">–</span>}
                    </td>
                    <td className="py-2.5 pr-3">
                      {cat ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cat.cls}`}>
                          {cat.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={c.connection_degree || "unknown"}
                        onChange={(e) => updateField(c.id, { connection_degree: e.target.value as any })}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white hover:border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#950606]"
                      >
                        {DEGREE_OPTIONS.map((d) => (
                          <option key={d!} value={d!}>{d}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={c.status}
                        onChange={(e) => handleStatusChange(c, e.target.value as OutreachContact["status"])}
                        className={`text-xs border rounded px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-[#950606] ${st.cls}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(c.date_added), "MMM d, yyyy")}
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.drafted_message && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-700 border border-green-200"
                            title="A draft message is saved"
                          >
                            <Check className="h-2.5 w-2.5" />
                            Draft saved
                          </span>
                        )}
                        {hasCv === false ? (
                          <span
                            className="text-[11px] text-muted-foreground italic"
                            title="Add your CV in Settings to enable AI-drafted messages"
                          >
                            Add your CV in Settings to enable AI-drafted messages
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => { onDraftMessage?.(c); openDraft(c, "connection_request"); }}
                              disabled={hasCv === null}
                            >
                              <MessageSquare className="h-3 w-3" />
                              Draft connection request
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5"
                              onClick={() => { onDraftMessage?.(c); openDraft(c, "outreach"); }}
                              disabled={hasCv === null}
                            >
                              <MessageSquare className="h-3 w-3" />
                              Draft outreach message
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => setDeleteId(c.id)}
                          title="Remove contact"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add contact slide-in */}
      <Sheet open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle style={{ fontFamily: "Sora, sans-serif" }}>Add contact</SheetTitle>
            <SheetDescription>
              Track someone you've found on LinkedIn for this application.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ct-linkedin" className="text-xs font-medium">
                LinkedIn URL <span className="text-red-600">*</span>
              </Label>
              <Input
                id="ct-linkedin"
                value={fLinkedin}
                onChange={(e) => handleLinkedinChange(e.target.value)}
                onPaste={handlePaste}
                placeholder="https://www.linkedin.com/in/username"
                maxLength={500}
                aria-invalid={!!fLinkedinError}
              />
              {fLinkedinError && (
                <p className="text-xs text-red-600">{fLinkedinError}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ct-name" className="text-xs font-medium">Name</Label>
                <Input
                  id="ct-name"
                  value={fName}
                  onChange={(e) => setFName(e.target.value)}
                  maxLength={100}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-title" className="text-xs font-medium">Title</Label>
                <Input
                  id="ct-title"
                  value={fTitle}
                  onChange={(e) => setFTitle(e.target.value)}
                  maxLength={150}
                  placeholder="Senior Product Manager"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ct-company" className="text-xs font-medium">Company</Label>
              <Input
                id="ct-company"
                value={fCompany}
                onChange={(e) => setFCompany(e.target.value)}
                maxLength={150}
                placeholder="Company name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ct-category" className="text-xs font-medium">Category</Label>
                <select
                  id="ct-category"
                  value={fCategory || "in_role"}
                  onChange={(e) => setFCategory(e.target.value as any)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#950606]"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value!} value={c.value!}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ct-degree" className="text-xs font-medium">Connection</Label>
                <select
                  id="ct-degree"
                  value={fDegree || "unknown"}
                  onChange={(e) => setFDegree(e.target.value as any)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#950606]"
                >
                  {DEGREE_OPTIONS.map((d) => (
                    <option key={d!} value={d!}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ct-notes" className="text-xs font-medium">Notes</Label>
              <Textarea
                id="ct-notes"
                value={fNotes}
                onChange={(e) => setFNotes(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Anything useful — shared connections, context, why you're reaching out…"
              />
            </div>
          </div>

          <SheetFooter className="mt-6 gap-2">
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving || !fLinkedin.trim() || !!fLinkedinError}
              className="bg-[#950606] hover:bg-[#7a0505] text-white"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Adding…</> : "Add contact"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the contact from your tracker for this job.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Draft message modal */}
      <Dialog open={!!draftContact} onOpenChange={(v) => { if (!v) { setDraftContact(null); setDraftText(""); } }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "Sora, sans-serif" }}>
              Draft message
            </DialogTitle>
            {draftContact && (
              <DialogDescription>
                <span className="font-medium text-foreground">{draftContact.name || "Unnamed contact"}</span>
                {draftContact.title && <> · {draftContact.title}</>}
                {draftContact.company && <> · {draftContact.company}</>}
              </DialogDescription>
            )}
          </DialogHeader>

          {/* Type toggle */}
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 self-start">
            <button
              type="button"
              onClick={() => handleSwitchType("connection_request")}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                isConnNote ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Connection request note
            </button>
            <button
              type="button"
              onClick={() => handleSwitchType("outreach")}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                !isConnNote ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Outreach message
            </button>
          </div>

          {/* Inline error */}
          {draftError && !draftLoading && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {draftError}
            </div>
          )}

          {/* Textarea */}
          <div className="space-y-1.5">
            <Textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={isConnNote ? 6 : 10}
              maxLength={isConnNote ? 300 : 800}
              placeholder={draftLoading ? "Generating draft…" : "Your draft will appear here."}
              disabled={draftLoading}
              className="resize-none text-sm leading-relaxed"
            />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {isConnNote ? "LinkedIn connection notes are limited to 300 characters." : "Outreach messages are limited to 800 characters."}
              </span>
              <span className={`font-medium tabular-nums ${counterColor}`}>
                {charCount} / {isConnNote ? 300 : 800}
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => draftContact && generateDraft(draftContact, draftType)}
              disabled={draftLoading || draftSaving}
              className="gap-1.5"
            >
              {draftLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Regenerate
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyDraft}
                disabled={!draftText.trim() || draftLoading}
                className="gap-1.5"
              >
                {draftCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                {draftCopied ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveDraft}
                disabled={!draftText.trim() || draftLoading || draftSaving}
                className="bg-[#950606] hover:bg-[#7a0505] text-white gap-1.5"
              >
                {draftSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save draft
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm status update on save */}
      <AlertDialog open={confirmStatusOpen} onOpenChange={setConfirmStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this contact as messaged?</AlertDialogTitle>
            <AlertDialogDescription>
              You can save the draft only, or also update the contact's status to "Messaged" and stamp today's date.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={draftSaving}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => persistDraft(false)}
              disabled={draftSaving}
            >
              Save draft only
            </Button>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); persistDraft(true); }}
              disabled={draftSaving}
              className="bg-[#950606] hover:bg-[#7a0505] text-white"
            >
              Save & mark messaged
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContactTracker;