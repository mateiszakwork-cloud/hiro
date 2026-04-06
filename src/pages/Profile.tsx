import { useEffect, useState, useRef, type KeyboardEvent, type ChangeEvent } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pencil, Trash2, X, Upload, Loader2, CheckCircle, AlertTriangle, RotateCcw, FileText, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { ParsedCVData } from "@/types/cv";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WORK_YEARS = Array.from({ length: 37 }, (_, i) => 1990 + i);
const EDU_START_YEARS = Array.from({ length: 37 }, (_, i) => 1990 + i);
const EDU_END_YEARS = Array.from({ length: 37 }, (_, i) => 1990 + i);
const PROFICIENCIES = ["Basic","Conversational","Professional Working","Fluent","Native"];
const AWARD_YEARS = Array.from({ length: 37 }, (_, i) => 1990 + i);

const HARD_SUGGESTIONS = ["Excel","PowerPoint","SQL","Python","Salesforce","Tableau","Google Analytics","Jira","Figma","SAP"];
const SOFT_SUGGESTIONS = ["Stakeholder management","Analytical thinking","Cross-functional collaboration","Project management","Communication","Problem solving","Leadership","Attention to detail"];
const INTEREST_SUGGESTIONS = ["Running","Cycling","Photography","Travel","Chess","Public Speaking","Volunteering","Music"];

interface WorkExp { id?: string; company_name: string; job_title: string; location: string | null; start_month: number; start_year: number; end_month: number | null; end_year: number | null; is_current: boolean; bullet_points: string[]; }
interface Edu { id?: string; institution: string; degree: string; field_of_study: string; start_year: number; end_year: number | null; is_expected: boolean; grade: string | null; activities: string | null; description: string | null; }
interface Skills { hard_skills: string[]; soft_skills: string[]; }
interface Lang { id?: string; language_name: string; proficiency: string; }
interface Award { id?: string; award_name: string; issuing_organization: string | null; year: number | null; description: string | null; }
interface Vol { id?: string; organization: string; role: string | null; start_year: number | null; end_year: number | null; is_ongoing: boolean; description: string | null; }

/* ── Skill Tag Input ── */
const SkillTagInput = ({ tags, onAdd, onRemove, placeholder, pillClass, suggestions }: { tags: string[]; onAdd: (t: string) => void; onRemove: (i: number) => void; placeholder: string; pillClass: string; suggestions: string[]; }) => {
  const [input, setInput] = useState("");
  const addTag = (raw: string) => { const tag = raw.trim(); if (tag && !tags.some(t => t.toLowerCase() === tag.toLowerCase())) onAdd(tag); };
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); input.split(/[,\n]/).forEach(p => addTag(p)); setInput(""); } if (e.key === "Backspace" && !input && tags.length > 0) onRemove(tags.length - 1); };
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => { const val = e.target.value; if (val.includes(",") || val.includes("\n")) { val.split(/[,\n]/).forEach(p => addTag(p)); setInput(""); } else setInput(val); };
  const unused = suggestions.filter(s => !tags.some(t => t.toLowerCase() === s.toLowerCase()));
  return (
    <div>
      <div className="rounded-lg border border-input bg-background p-2 flex flex-wrap gap-2 min-h-[80px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-shadow">
        {tags.map((tag, idx) => (<span key={idx} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${pillClass}`}>{tag}<button type="button" onClick={() => onRemove(idx)} className="hover:opacity-80"><X className="h-3 w-3" /></button></span>))}
        <textarea value={input} onChange={handleChange} onKeyDown={handleKeyDown} placeholder={tags.length === 0 ? placeholder : ""} className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground resize-none" rows={1} />
      </div>
      <p className="text-xs text-muted-foreground mt-1">💡 Paste from your CV — separate with commas or new lines</p>
      {unused.length > 0 && (<div className="flex flex-wrap gap-1.5 mt-2">{unused.map(s => (<button key={s} type="button" onClick={() => addTag(s)} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">+ {s}</button>))}</div>)}
    </div>
  );
};

/* ── Interest Tag Input ── */
const InterestTagInput = ({ tags, onAdd, onRemove, suggestions }: { tags: string[]; onAdd: (t: string) => void; onRemove: (i: number) => void; suggestions: string[]; }) => {
  const [input, setInput] = useState("");
  const addTag = (raw: string) => { const tag = raw.trim(); if (tag && !tags.some(t => t.toLowerCase() === tag.toLowerCase())) onAdd(tag); };
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); input.split(/[,\n]/).forEach(p => addTag(p)); setInput(""); } if (e.key === "Backspace" && !input && tags.length > 0) onRemove(tags.length - 1); };
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => { const val = e.target.value; if (val.includes(",") || val.includes("\n")) { val.split(/[,\n]/).forEach(p => addTag(p)); setInput(""); } else setInput(val); };
  const unused = suggestions.filter(s => !tags.some(t => t.toLowerCase() === s.toLowerCase()));
  return (
    <div>
      <div className="rounded-lg border border-input bg-background p-2 flex flex-wrap gap-2 min-h-[80px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-shadow">
        {tags.map((tag, idx) => (<span key={idx} className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{tag}<button type="button" onClick={() => onRemove(idx)} className="hover:opacity-80"><X className="h-3 w-3" /></button></span>))}
        <textarea value={input} onChange={handleChange} onKeyDown={handleKeyDown} placeholder={tags.length === 0 ? "e.g. Distance running, Videography, Padel..." : ""} className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground resize-none" rows={1} />
      </div>
      {unused.length > 0 && (<div className="flex flex-wrap gap-1.5 mt-2">{unused.map(s => (<button key={s} type="button" onClick={() => addTag(s)} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">+ {s}</button>))}</div>)}
    </div>
  );
};

const Profile = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [memberSince, setMemberSince] = useState("");

  const [workExps, setWorkExps] = useState<WorkExp[]>([]);
  const [edus, setEdus] = useState<Edu[]>([]);
  const [skills, setSkills] = useState<Skills>({ hard_skills: [], soft_skills: [] });
  const [langs, setLangs] = useState<Lang[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);
  const [vols, setVols] = useState<Vol[]>([]);
  const [interests, setInterests] = useState<string[]>([]);

  const [editSection, setEditSection] = useState<string | null>(null);
  const [editWork, setEditWork] = useState<WorkExp[]>([]);
  const [editEdu, setEditEdu] = useState<Edu[]>([]);
  const [editSkills, setEditSkills] = useState<Skills>({ hard_skills: [], soft_skills: [] });
  const [editLangs, setEditLangs] = useState<Lang[]>([]);
  const [editAwards, setEditAwards] = useState<Award[]>([]);
  const [editVols, setEditVols] = useState<Vol[]>([]);
  const [editInterests, setEditInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [removeWorkIdx, setRemoveWorkIdx] = useState<number | null>(null);

  // CV re-import state
  const cvInputRef = useRef<HTMLInputElement>(null);
  const [cvUploading, setCvUploading] = useState(false);
  const [cvError, setCvError] = useState(false);
  const [cvSuccess, setCvSuccess] = useState("");

  // Base CV state
  const baseCvInputRef = useRef<HTMLInputElement>(null);
  const [baseCvText, setBaseCvText] = useState<string | null>(null);
  const [baseCvUploadedAt, setBaseCvUploadedAt] = useState<string | null>(null);
  const [baseCvUploading, setBaseCvUploading] = useState(false);
  const [showExtractedText, setShowExtractedText] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      setUserId(uid);
      setEmail(session.user.email || "");
      const { data: profile } = await supabase.from("profiles").select("created_at, full_name, base_cv_text, base_cv_uploaded_at").eq("id", uid).single();
      if (profile) {
        setMemberSince(format(new Date(profile.created_at), "MMMM yyyy"));
        setFullName(profile.full_name || "");
        setBaseCvText((profile as any).base_cv_text || null);
        setBaseCvUploadedAt((profile as any).base_cv_uploaded_at || null);
      }
      fetchAll(uid);
    };
    init();
  }, []);

  const fetchAll = async (uid: string) => {
    const [w, e, s, l, a, v, int] = await Promise.all([
      supabase.from("work_experiences").select("*").eq("user_id", uid).order("start_year", { ascending: false }),
      supabase.from("education").select("*").eq("user_id", uid).order("start_year", { ascending: false }),
      supabase.from("skills").select("*").eq("user_id", uid).single(),
      supabase.from("languages").select("*").eq("user_id", uid),
      supabase.from("awards").select("*").eq("user_id", uid).order("year", { ascending: false }),
      supabase.from("volunteering").select("*").eq("user_id", uid).order("start_year", { ascending: false }),
      supabase.from("interests").select("*").eq("user_id", uid).single(),
    ]);
    if (w.data) setWorkExps(w.data as any);
    if (e.data) setEdus(e.data as any);
    if (s.data) setSkills({ hard_skills: s.data.hard_skills, soft_skills: s.data.soft_skills });
    if (l.data) setLangs(l.data);
    if (a.data) setAwards(a.data as any);
    if (v.data) setVols(v.data as any);
    if (int.data) setInterests((int.data as any).interests || []);
  };

  const handleCvReimport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    if (file.type !== "application/pdf" || file.size > 10 * 1024 * 1024) { setCvError(true); return; }
    setCvUploading(true); setCvError(false); setCvSuccess("");
    try {
      const filePath = `${userId}/cv-${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage.from("cv-uploads").upload(filePath, file);
      if (upErr) { setCvError(true); setCvUploading(false); return; }
      const { data, error: fnErr } = await supabase.functions.invoke("parse-cv", { body: { filePath } });
      if (fnErr || !data) { setCvError(true); setCvUploading(false); return; }
      const cv = data as ParsedCVData;
      // Pre-fill edit states and open all sections for review
      if (cv.work_experiences?.length) {
        const mapped = cv.work_experiences.map(d => ({ company_name: d.company_name || "", job_title: d.job_title || "", location: d.location || null, start_month: d.start_month ? MONTHS.indexOf(d.start_month) + 1 : 1, start_year: d.start_year || 2024, end_month: d.end_month ? MONTHS.indexOf(d.end_month) + 1 : null, end_year: d.end_year || null, is_current: d.is_current || false, bullet_points: d.bullet_points?.length ? d.bullet_points : [""] }));
        setEditWork(mapped as any); setEditSection("work");
      }
      if (cv.education?.length) {
        const mapped = cv.education.map(d => ({ institution: d.institution || "", degree: d.degree || "", field_of_study: d.field_of_study || "", start_year: d.start_year || 2024, end_year: d.end_year || null, is_expected: false, grade: d.grade || null, activities: d.activities || null, description: d.description || null }));
        setEditEdu(mapped as any);
      }
      if (cv.hard_skills?.length || cv.soft_skills?.length) {
        setEditSkills({ hard_skills: cv.hard_skills || [], soft_skills: cv.soft_skills || [] });
      }
      if (cv.languages?.length) {
        setEditLangs(cv.languages.map(l => ({ language_name: l.name || "", proficiency: l.proficiency || "Professional Working" })));
      }
      const expCount = cv.work_experiences?.length || 0;
      const skillCount = (cv.hard_skills?.length || 0) + (cv.soft_skills?.length || 0);
      setCvSuccess(`Imported ${expCount} experience${expCount !== 1 ? "s" : ""} and ${skillCount} skill${skillCount !== 1 ? "s" : ""}. Review and save each section.`);
      toast.success("CV imported! Review each section and save.");
    } catch { setCvError(true); } finally { setCvUploading(false); if (cvInputRef.current) cvInputRef.current.value = ""; }
  };

  const startEdit = (section: string) => {
    setEditSection(section);
    if (section === "work") setEditWork(workExps.map(w => ({ ...w, bullet_points: [...w.bullet_points] })));
    if (section === "edu") setEditEdu(edus.map(e => ({ ...e })));
    if (section === "skills") setEditSkills({ hard_skills: [...skills.hard_skills], soft_skills: [...skills.soft_skills] });
    if (section === "langs") setEditLangs(langs.map(l => ({ ...l })));
    if (section === "awards") setEditAwards(awards.map(a => ({ ...a })));
    if (section === "vols") setEditVols(vols.map(v => ({ ...v })));
    if (section === "interests") setEditInterests([...interests]);
  };

  const cancel = () => setEditSection(null);

  const saveWork = async () => {
    if (!userId) return; setSaving(true);
    await supabase.from("work_experiences").delete().eq("user_id", userId);
    const rows = editWork.map(b => ({ user_id: userId, company_name: b.company_name, job_title: b.job_title, location: b.location || null, start_month: b.start_month, start_year: b.start_year, end_month: b.is_current ? null : b.end_month, end_year: b.is_current ? null : b.end_year, is_current: b.is_current, bullet_points: b.bullet_points.filter(bp => bp.trim()) }));
    const { error } = await supabase.from("work_experiences").insert(rows);
    setSaving(false); if (error) { toast.error(error.message); return; }
    await fetchAll(userId); setEditSection(null);
  };

  const saveEdu = async () => {
    if (!userId) return; setSaving(true);
    await supabase.from("education").delete().eq("user_id", userId);
    const rows = editEdu.map(b => ({ user_id: userId, institution: b.institution, degree: b.degree, field_of_study: b.field_of_study, start_year: b.start_year, end_year: b.is_expected ? null : b.end_year, is_expected: b.is_expected, grade: b.grade || null, activities: b.activities || null, description: b.description || null }));
    const { error } = await supabase.from("education").insert(rows);
    setSaving(false); if (error) { toast.error(error.message); return; }
    await fetchAll(userId); setEditSection(null);
  };

  const saveSkills = async () => {
    if (!userId) return; setSaving(true);
    await supabase.from("skills").delete().eq("user_id", userId);
    const { error } = await supabase.from("skills").insert({ user_id: userId, hard_skills: editSkills.hard_skills, soft_skills: editSkills.soft_skills });
    setSaving(false); if (error) { toast.error(error.message); return; }
    await fetchAll(userId); setEditSection(null);
  };

  const saveLangs = async () => {
    if (!userId) return; setSaving(true);
    await supabase.from("languages").delete().eq("user_id", userId);
    const rows = editLangs.filter(r => r.language_name.trim()).map(r => ({ user_id: userId, language_name: r.language_name.trim(), proficiency: r.proficiency }));
    const { error } = await supabase.from("languages").insert(rows);
    setSaving(false); if (error) { toast.error(error.message); return; }
    await fetchAll(userId); setEditSection(null);
  };

  const saveAwards = async () => {
    if (!userId) return; setSaving(true);
    await supabase.from("awards").delete().eq("user_id", userId);
    const rows = editAwards.filter(a => a.award_name.trim()).map(a => ({ user_id: userId, award_name: a.award_name.trim(), issuing_organization: a.issuing_organization || null, year: a.year, description: a.description || null }));
    if (rows.length > 0) { const { error } = await supabase.from("awards").insert(rows); if (error) { setSaving(false); toast.error(error.message); return; } }
    setSaving(false); await fetchAll(userId); setEditSection(null);
  };

  const saveVols = async () => {
    if (!userId) return; setSaving(true);
    await supabase.from("volunteering").delete().eq("user_id", userId);
    const rows = editVols.filter(v => v.organization.trim()).map(v => ({ user_id: userId, organization: v.organization.trim(), role: v.role || null, start_year: v.start_year, end_year: v.is_ongoing ? null : v.end_year, is_ongoing: v.is_ongoing, description: v.description || null }));
    if (rows.length > 0) { const { error } = await supabase.from("volunteering").insert(rows); if (error) { setSaving(false); toast.error(error.message); return; } }
    setSaving(false); await fetchAll(userId); setEditSection(null);
  };

  const saveInterests = async () => {
    if (!userId) return; setSaving(true);
    await supabase.from("interests").delete().eq("user_id", userId);
    if (editInterests.length > 0) { const { error } = await supabase.from("interests").insert({ user_id: userId, interests: editInterests }); if (error) { setSaving(false); toast.error(error.message); return; } }
    setSaving(false); await fetchAll(userId); setEditSection(null);
  };

  const updateWorkBlock = (idx: number, patch: Partial<WorkExp>) => setEditWork(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  const addWorkBlock = () => setEditWork(prev => [...prev, { company_name: "", job_title: "", location: null, start_month: 1, start_year: 2024, end_month: null, end_year: null, is_current: false, bullet_points: [""] }]);
  const confirmRemoveWork = () => { if (removeWorkIdx !== null) { setEditWork(prev => prev.filter((_, i) => i !== removeWorkIdx)); setRemoveWorkIdx(null); } };

  const updateEduBlock = (idx: number, patch: Partial<Edu>) => setEditEdu(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  const addEduBlock = () => setEditEdu(prev => [...prev, { institution: "", degree: "", field_of_study: "", start_year: 2024, end_year: null, is_expected: false, grade: null, activities: null, description: null }]);
  const removeEduBlock = (idx: number) => setEditEdu(prev => prev.filter((_, i) => i !== idx));

  const formatDateRange = (w: WorkExp) => {
    const s = `${MONTHS[w.start_month - 1]} ${w.start_year}`;
    if (w.is_current) return `${s} – Present`;
    const e = w.end_month && w.end_year ? `${MONTHS[w.end_month - 1]} ${w.end_year}` : "";
    return `${s} – ${e}`;
  };

  const sectionHeader = (title: string, section: string) => (
    <CardHeader className="flex flex-row items-center justify-between pb-4">
      <CardTitle className="text-lg text-primary">{title}</CardTitle>
      {editSection !== section && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => startEdit(section)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
      )}
    </CardHeader>
  );

  const editFooter = (onSave: () => void) => (
    <div className="flex gap-3 justify-end pt-4 border-t mt-4">
      <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
      <Button size="sm" onClick={onSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[28px] font-bold text-primary">{fullName || "Profile"}</h1>
            <p className="text-muted-foreground mt-0.5">{email}</p>
            {memberSince && <p className="text-sm text-muted-foreground">Member since {memberSince}</p>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <input ref={cvInputRef} type="file" accept="application/pdf" onChange={handleCvReimport} className="hidden" />
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => cvInputRef.current?.click()} disabled={cvUploading}>
              {cvUploading ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing CV...</> : <><Upload className="h-3.5 w-3.5" /> Re-import from CV</>}
            </Button>
            {cvError && (
              <div className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" /> Failed to parse CV.
                <button onClick={() => { setCvError(false); cvInputRef.current?.click(); }} className="underline">Retry</button>
              </div>
            )}
            {cvSuccess && <p className="text-xs text-primary flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {cvSuccess}</p>}
          </div>
        </div>
      </div>

      {/* ─── Work Experience ─── */}
      <Card>
        {sectionHeader("Work Experience", "work")}
        <CardContent>
          {editSection === "work" ? (
            <div className="space-y-5">
              {editWork.map((block, idx) => (
                <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Company Name</Label><Input value={block.company_name} onChange={e => updateWorkBlock(idx, { company_name: e.target.value })} className="rounded-lg" /></div>
                    <div className="space-y-1.5"><Label>Job Title</Label><Input value={block.job_title} onChange={e => updateWorkBlock(idx, { job_title: e.target.value })} className="rounded-lg" /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Location</Label><Input value={block.location || ""} onChange={e => updateWorkBlock(idx, { location: e.target.value })} placeholder="e.g. Amsterdam, Netherlands" className="rounded-lg" /></div>
                  <div><Label>Start Date</Label>
                    <div className="mt-1.5 grid grid-cols-2 gap-3">
                      <Select value={MONTHS[block.start_month - 1] || ""} onValueChange={v => updateWorkBlock(idx, { start_month: MONTHS.indexOf(v) + 1 })}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Month" /></SelectTrigger>
                        <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={String(block.start_year)} onValueChange={v => updateWorkBlock(idx, { start_year: parseInt(v) })}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent>{WORK_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Label>End Date</Label>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Checkbox checked={block.is_current} onCheckedChange={v => updateWorkBlock(idx, { is_current: !!v })} id={`cur-${idx}`} />
                        <label htmlFor={`cur-${idx}`} className="text-sm text-muted-foreground cursor-pointer select-none">I currently work here</label>
                      </div>
                    </div>
                    {!block.is_current && (
                      <div className="grid grid-cols-2 gap-3">
                        <Select value={block.end_month ? MONTHS[block.end_month - 1] : ""} onValueChange={v => updateWorkBlock(idx, { end_month: MONTHS.indexOf(v) + 1 })}>
                          <SelectTrigger className="rounded-lg"><SelectValue placeholder="Month" /></SelectTrigger>
                          <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                        <Select value={block.end_year ? String(block.end_year) : ""} onValueChange={v => updateWorkBlock(idx, { end_year: parseInt(v) })}>
                          <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                          <SelectContent>{WORK_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Key Responsibilities / Achievements</Label>
                    {block.bullet_points.map((bp, bIdx) => (
                      <div key={bIdx} className="flex items-start gap-2">
                        <Textarea value={bp} onChange={e => { const bps = [...block.bullet_points]; bps[bIdx] = e.target.value; updateWorkBlock(idx, { bullet_points: bps }); }} className="rounded-lg min-h-[56px]" rows={2} />
                        {bIdx > 0 && <button type="button" onClick={() => { const bps = block.bullet_points.filter((_, j) => j !== bIdx); updateWorkBlock(idx, { bullet_points: bps }); }} className="shrink-0 mt-2 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    ))}
                    {block.bullet_points.length < 10 && <button type="button" onClick={() => updateWorkBlock(idx, { bullet_points: [...block.bullet_points, ""] })} className="text-sm font-medium text-primary">+ Add bullet</button>}
                  </div>
                  <button type="button" onClick={() => setRemoveWorkIdx(idx)} className="text-sm font-medium text-destructive hover:underline">Remove experience</button>
                </div>
              ))}
              <button type="button" onClick={addWorkBlock} className="w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add another experience</button>
              {editFooter(saveWork)}
            </div>
          ) : (
            <div className="space-y-5">
              {workExps.length === 0 && <p className="text-muted-foreground text-sm">No work experience added yet.</p>}
              {workExps.map((w, i) => (
                <div key={i} className={i > 0 ? "pt-4 border-t" : ""}>
                  <p className="font-semibold text-foreground">{w.company_name} — {w.job_title}</p>
                  {w.location && <p className="text-sm text-muted-foreground">{w.location}</p>}
                  <p className="text-sm text-muted-foreground">{formatDateRange(w)}</p>
                  {w.bullet_points.length > 0 && (<ul className="mt-2 ml-5 list-disc text-sm text-foreground space-y-1">{w.bullet_points.filter(bp => bp.trim()).map((bp, j) => <li key={j}>{bp}</li>)}</ul>)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Education ─── */}
      <Card>
        {sectionHeader("Education", "edu")}
        <CardContent>
          {editSection === "edu" ? (
            <div className="space-y-5">
              {editEdu.map((block, idx) => (
                <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
                  <div className="space-y-1.5"><Label>Institution Name</Label><Input value={block.institution} onChange={e => updateEduBlock(idx, { institution: e.target.value })} className="rounded-lg" placeholder="e.g. Rotterdam School of Management" /></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Degree</Label><Input value={block.degree} onChange={e => updateEduBlock(idx, { degree: e.target.value })} className="rounded-lg" /></div>
                    <div className="space-y-1.5"><Label>Field of Study</Label><Input value={block.field_of_study} onChange={e => updateEduBlock(idx, { field_of_study: e.target.value })} className="rounded-lg" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5"><Label>Start Year</Label>
                      <Select value={String(block.start_year)} onValueChange={v => updateEduBlock(idx, { start_year: parseInt(v) })}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent>{EDU_START_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5"><Label>End Year</Label>
                      <Select value={block.is_expected ? "expected" : block.end_year ? String(block.end_year) : ""} onValueChange={v => { if (v === "expected") updateEduBlock(idx, { is_expected: true, end_year: null }); else updateEduBlock(idx, { is_expected: false, end_year: parseInt(v) }); }}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                        <SelectContent>{EDU_END_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}<SelectItem value="expected">Expected</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Grade / GPA</Label><Input value={block.grade || ""} onChange={e => updateEduBlock(idx, { grade: e.target.value })} placeholder="e.g. 3.8 / 4.0" className="rounded-lg" /></div>
                    <div className="space-y-1.5"><Label>Activities and Societies</Label><Input value={block.activities || ""} onChange={e => updateEduBlock(idx, { activities: e.target.value })} placeholder="e.g. CEMS Club, Student Council" className="rounded-lg" /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Description</Label><Textarea value={block.description || ""} onChange={e => updateEduBlock(idx, { description: e.target.value })} placeholder="Additional context about your studies, thesis, or achievements" className="rounded-lg" rows={3} /></div>
                  <button type="button" onClick={() => removeEduBlock(idx)} className="text-sm font-medium text-destructive hover:underline">Remove education</button>
                </div>
              ))}
              <button type="button" onClick={addEduBlock} className="w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add another education</button>
              {editFooter(saveEdu)}
            </div>
          ) : (
            <div className="space-y-4">
              {edus.length === 0 && <p className="text-muted-foreground text-sm">No education added yet.</p>}
              {edus.map((e, i) => (
                <div key={i} className={i > 0 ? "pt-4 border-t" : ""}>
                  <p className="font-semibold text-foreground">{e.institution}</p>
                  <p className="text-sm text-foreground">{e.degree} – {e.field_of_study}</p>
                  <p className="text-sm text-muted-foreground">{e.start_year} – {e.is_expected ? "Expected" : e.end_year || ""}</p>
                  {e.grade && <p className="text-sm text-muted-foreground">Grade: {e.grade}</p>}
                  {e.activities && <p className="text-sm text-muted-foreground">{e.activities}</p>}
                  {e.description && <p className="text-sm text-foreground mt-1">{e.description}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Skills ─── */}
      <Card>
        {sectionHeader("Skills", "skills")}
        <CardContent>
          {editSection === "skills" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Hard Skills</h3>
                  <SkillTagInput tags={editSkills.hard_skills} onAdd={t => setEditSkills(p => ({ ...p, hard_skills: [...p.hard_skills, t] }))} onRemove={i => setEditSkills(p => ({ ...p, hard_skills: p.hard_skills.filter((_, j) => j !== i) }))} placeholder="Type a skill and press Enter..." pillClass="bg-primary text-primary-foreground" suggestions={HARD_SUGGESTIONS} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Soft Skills</h3>
                  <SkillTagInput tags={editSkills.soft_skills} onAdd={t => setEditSkills(p => ({ ...p, soft_skills: [...p.soft_skills, t] }))} onRemove={i => setEditSkills(p => ({ ...p, soft_skills: p.soft_skills.filter((_, j) => j !== i) }))} placeholder="Type a skill and press Enter..." pillClass="bg-muted text-muted-foreground" suggestions={SOFT_SUGGESTIONS} />
                </div>
              </div>
              {editFooter(saveSkills)}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Hard Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {skills.hard_skills.length === 0 && <p className="text-muted-foreground text-sm">None added yet.</p>}
                  {skills.hard_skills.map((s, i) => (<span key={i} className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-primary text-primary-foreground">{s}</span>))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Soft Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {skills.soft_skills.length === 0 && <p className="text-muted-foreground text-sm">None added yet.</p>}
                  {skills.soft_skills.map((s, i) => (<span key={i} className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-muted text-muted-foreground">{s}</span>))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Languages ─── */}
      <Card>
        {sectionHeader("Languages", "langs")}
        <CardContent>
          {editSection === "langs" ? (
            <div className="space-y-4">
              {editLangs.map((row, idx) => (
                <div key={idx} className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">{idx === 0 && <Label>Language</Label>}<Input value={row.language_name} onChange={e => setEditLangs(p => p.map((r, i) => i === idx ? { ...r, language_name: e.target.value } : r))} placeholder="e.g. English" className="rounded-lg" /></div>
                  <div className="flex-1 space-y-1.5">{idx === 0 && <Label>Proficiency</Label>}
                    <Select value={row.proficiency} onValueChange={v => setEditLangs(p => p.map((r, i) => i === idx ? { ...r, proficiency: v } : r))}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Select level" /></SelectTrigger>
                      <SelectContent>{PROFICIENCIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <button type="button" onClick={() => setEditLangs(p => p.filter((_, i) => i !== idx))} className="mb-1 shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <button type="button" onClick={() => setEditLangs(p => [...p, { language_name: "", proficiency: "" }])} className="text-sm font-medium text-primary hover:underline">+ Add language</button>
              {editFooter(saveLangs)}
            </div>
          ) : (
            <div className="space-y-2">
              {langs.length === 0 && <p className="text-muted-foreground text-sm">No languages added yet.</p>}
              {langs.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{l.language_name}</span>
                  <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">{l.proficiency}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Awards ─── */}
      <Card>
        {sectionHeader("Awards & Achievements", "awards")}
        <CardContent>
          {editSection === "awards" ? (
            <div className="space-y-5">
              {editAwards.map((block, idx) => (
                <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Award Name</Label><Input value={block.award_name} onChange={e => setEditAwards(p => p.map((a, i) => i === idx ? { ...a, award_name: e.target.value } : a))} className="rounded-lg" /></div>
                    <div className="space-y-1.5"><Label>Issuing Organization</Label><Input value={block.issuing_organization || ""} onChange={e => setEditAwards(p => p.map((a, i) => i === idx ? { ...a, issuing_organization: e.target.value } : a))} className="rounded-lg" /></div>
                  </div>
                  <div className="space-y-1.5"><Label>Year</Label>
                    <Select value={block.year ? String(block.year) : ""} onValueChange={v => setEditAwards(p => p.map((a, i) => i === idx ? { ...a, year: parseInt(v) } : a))}>
                      <SelectTrigger className="rounded-lg"><SelectValue placeholder="Year" /></SelectTrigger>
                      <SelectContent>{AWARD_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label>Description</Label><Textarea value={block.description || ""} onChange={e => setEditAwards(p => p.map((a, i) => i === idx ? { ...a, description: e.target.value } : a))} className="rounded-lg" rows={2} /></div>
                  <button type="button" onClick={() => setEditAwards(p => p.filter((_, i) => i !== idx))} className="text-sm font-medium text-destructive hover:underline">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setEditAwards(p => [...p, { award_name: "", issuing_organization: null, year: null, description: null }])} className="w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add an award</button>
              {editFooter(saveAwards)}
            </div>
          ) : (
            <div className="space-y-3">
              {awards.length === 0 && <p className="text-muted-foreground text-sm">No awards added yet.</p>}
              {awards.map((a, i) => (
                <div key={i} className={i > 0 ? "pt-3 border-t" : ""}>
                  <p className="font-semibold text-foreground">{a.award_name}</p>
                  {a.issuing_organization && <p className="text-sm text-muted-foreground">{a.issuing_organization}{a.year ? ` · ${a.year}` : ""}</p>}
                  {!a.issuing_organization && a.year && <p className="text-sm text-muted-foreground">{a.year}</p>}
                  {a.description && <p className="text-sm text-foreground mt-1">{a.description}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Volunteering ─── */}
      <Card>
        {sectionHeader("Volunteering", "vols")}
        <CardContent>
          {editSection === "vols" ? (
            <div className="space-y-5">
              {editVols.map((block, idx) => (
                <div key={idx} className="rounded-lg border border-border p-5 space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label>Organization</Label><Input value={block.organization} onChange={e => setEditVols(p => p.map((v, i) => i === idx ? { ...v, organization: e.target.value } : v))} className="rounded-lg" /></div>
                    <div className="space-y-1.5"><Label>Role</Label><Input value={block.role || ""} onChange={e => setEditVols(p => p.map((v, i) => i === idx ? { ...v, role: e.target.value } : v))} className="rounded-lg" /></div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Label>Duration</Label>
                      <div className="flex items-center gap-1.5 ml-auto">
                        <Checkbox checked={block.is_ongoing} onCheckedChange={v => setEditVols(p => p.map((vol, i) => i === idx ? { ...vol, is_ongoing: !!v } : vol))} id={`ongoing-${idx}`} />
                        <label htmlFor={`ongoing-${idx}`} className="text-sm text-muted-foreground cursor-pointer select-none">Ongoing</label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select value={block.start_year ? String(block.start_year) : ""} onValueChange={v => setEditVols(p => p.map((vol, i) => i === idx ? { ...vol, start_year: parseInt(v) } : vol))}>
                        <SelectTrigger className="rounded-lg"><SelectValue placeholder="Start Year" /></SelectTrigger>
                        <SelectContent>{AWARD_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                      </Select>
                      {!block.is_ongoing && (
                        <Select value={block.end_year ? String(block.end_year) : ""} onValueChange={v => setEditVols(p => p.map((vol, i) => i === idx ? { ...vol, end_year: parseInt(v) } : vol))}>
                          <SelectTrigger className="rounded-lg"><SelectValue placeholder="End Year" /></SelectTrigger>
                          <SelectContent>{AWARD_YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5"><Label>Description</Label><Textarea value={block.description || ""} onChange={e => setEditVols(p => p.map((v, i) => i === idx ? { ...v, description: e.target.value } : v))} className="rounded-lg" rows={2} /></div>
                  <button type="button" onClick={() => setEditVols(p => p.filter((_, i) => i !== idx))} className="text-sm font-medium text-destructive hover:underline">Remove</button>
                </div>
              ))}
              <button type="button" onClick={() => setEditVols(p => [...p, { organization: "", role: null, start_year: null, end_year: null, is_ongoing: false, description: null }])} className="w-full rounded-lg border-2 border-dashed border-border py-3 text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors">+ Add volunteering</button>
              {editFooter(saveVols)}
            </div>
          ) : (
            <div className="space-y-3">
              {vols.length === 0 && <p className="text-muted-foreground text-sm">No volunteering added yet.</p>}
              {vols.map((v, i) => (
                <div key={i} className={i > 0 ? "pt-3 border-t" : ""}>
                  <p className="font-semibold text-foreground">{v.organization}{v.role ? ` — ${v.role}` : ""}</p>
                  <p className="text-sm text-muted-foreground">{v.start_year || ""}{v.is_ongoing ? " – Ongoing" : v.end_year ? ` – ${v.end_year}` : ""}</p>
                  {v.description && <p className="text-sm text-foreground mt-1">{v.description}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Interests ─── */}
      <Card>
        {sectionHeader("Personal Interests", "interests")}
        <CardContent>
          {editSection === "interests" ? (
            <div className="space-y-4">
              <InterestTagInput tags={editInterests} onAdd={t => setEditInterests(p => [...p, t])} onRemove={i => setEditInterests(p => p.filter((_, j) => j !== i))} suggestions={INTEREST_SUGGESTIONS} />
              {editFooter(saveInterests)}
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {interests.length === 0 && <p className="text-muted-foreground text-sm">No interests added yet.</p>}
              {interests.map((s, i) => (<span key={i} className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-primary text-primary-foreground">{s}</span>))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove work experience dialog */}
      <AlertDialog open={removeWorkIdx !== null} onOpenChange={(open) => !open && setRemoveWorkIdx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this experience?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveWork} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Confirm Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Profile;
