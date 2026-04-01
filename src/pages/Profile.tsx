import { useEffect, useState, type KeyboardEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

/* ───────── shared constants (same as onboarding) ───────── */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WORK_YEARS = Array.from({ length: 12 }, (_, i) => 2015 + i);
const EDU_START_YEARS = Array.from({ length: 17 }, (_, i) => 2010 + i);
const EDU_END_YEARS = Array.from({ length: 21 }, (_, i) => 2010 + i);
const PROFICIENCIES = ["Basic","Conversational","Professional Working","Fluent","Native"];

/* ───────── types ───────── */
interface WorkExp { id?: string; company_name: string; job_title: string; start_month: number; start_year: number; end_month: number | null; end_year: number | null; is_current: boolean; bullet_points: string[]; }
interface Edu { id?: string; institution: string; degree: string; field_of_study: string; start_year: number; end_year: number | null; is_expected: boolean; }
interface Skills { hard_skills: string[]; soft_skills: string[]; }
interface Lang { id?: string; language_name: string; proficiency: string; }

/* ───────── Tag Input (reused from onboarding) ───────── */
const TagInput = ({ tags, onAdd, onRemove, placeholder, pillClass }: { tags: string[]; onAdd: (t: string) => void; onRemove: (i: number) => void; placeholder: string; pillClass: string; }) => {
  const [input, setInput] = useState("");
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); const t = input.trim(); if (t && !tags.some(x => x.toLowerCase() === t.toLowerCase())) onAdd(t); setInput(""); }
    if (e.key === "Backspace" && !input && tags.length > 0) onRemove(tags.length - 1);
  };
  const handleChange = (v: string) => { if (v.includes(",")) { v.split(",").forEach(p => { const t = p.trim(); if (t && !tags.some(x => x.toLowerCase() === t.toLowerCase())) onAdd(t); }); setInput(""); } else setInput(v); };
  return (
    <div className="rounded-lg border border-input bg-background p-2 flex flex-wrap gap-2 min-h-[80px] focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background transition-shadow">
      {tags.map((tag, idx) => (
        <span key={idx} className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${pillClass}`}>
          {tag}
          <button type="button" onClick={() => onRemove(idx)} className="hover:opacity-80"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={input} onChange={e => handleChange(e.target.value)} onKeyDown={handleKeyDown} placeholder={tags.length === 0 ? placeholder : ""} className="flex-1 min-w-[120px] bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
    </div>
  );
};

/* ═══════════════════════════════════════════════════════ */
const Profile = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");

  const [workExps, setWorkExps] = useState<WorkExp[]>([]);
  const [edus, setEdus] = useState<Edu[]>([]);
  const [skills, setSkills] = useState<Skills>({ hard_skills: [], soft_skills: [] });
  const [langs, setLangs] = useState<Lang[]>([]);

  // edit states
  const [editSection, setEditSection] = useState<string | null>(null);
  const [editWork, setEditWork] = useState<WorkExp[]>([]);
  const [editEdu, setEditEdu] = useState<Edu[]>([]);
  const [editSkills, setEditSkills] = useState<Skills>({ hard_skills: [], soft_skills: [] });
  const [editLangs, setEditLangs] = useState<Lang[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const uid = session.user.id;
      setUserId(uid);
      setEmail(session.user.email || "");

      const { data: profile } = await supabase.from("profiles").select("created_at").eq("id", uid).single();
      if (profile) setMemberSince(format(new Date(profile.created_at), "MMMM yyyy"));

      fetchAll(uid);
    };
    init();
  }, []);

  const fetchAll = async (uid: string) => {
    const [w, e, s, l] = await Promise.all([
      supabase.from("work_experiences").select("*").eq("user_id", uid).order("start_year", { ascending: false }),
      supabase.from("education").select("*").eq("user_id", uid).order("start_year", { ascending: false }),
      supabase.from("skills").select("*").eq("user_id", uid).single(),
      supabase.from("languages").select("*").eq("user_id", uid),
    ]);
    if (w.data) setWorkExps(w.data);
    if (e.data) setEdus(e.data);
    if (s.data) setSkills({ hard_skills: s.data.hard_skills, soft_skills: s.data.soft_skills });
    if (l.data) setLangs(l.data);
  };

  const startEdit = (section: string) => {
    setEditSection(section);
    if (section === "work") setEditWork(workExps.map(w => ({ ...w, bullet_points: [...w.bullet_points] })));
    if (section === "edu") setEditEdu(edus.map(e => ({ ...e })));
    if (section === "skills") setEditSkills({ hard_skills: [...skills.hard_skills], soft_skills: [...skills.soft_skills] });
    if (section === "langs") setEditLangs(langs.map(l => ({ ...l })));
  };

  const cancel = () => setEditSection(null);

  /* ── Save handlers ── */
  const saveWork = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("work_experiences").delete().eq("user_id", userId);
    const rows = editWork.map(b => ({
      user_id: userId, company_name: b.company_name, job_title: b.job_title,
      start_month: b.start_month, start_year: b.start_year,
      end_month: b.is_current ? null : b.end_month, end_year: b.is_current ? null : b.end_year,
      is_current: b.is_current, bullet_points: b.bullet_points.filter(bp => bp.trim()),
    }));
    const { error } = await supabase.from("work_experiences").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await fetchAll(userId); setEditSection(null);
  };

  const saveEdu = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("education").delete().eq("user_id", userId);
    const rows = editEdu.map(b => ({
      user_id: userId, institution: b.institution, degree: b.degree, field_of_study: b.field_of_study,
      start_year: b.start_year, end_year: b.is_expected ? null : b.end_year, is_expected: b.is_expected,
    }));
    const { error } = await supabase.from("education").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await fetchAll(userId); setEditSection(null);
  };

  const saveSkills = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("skills").delete().eq("user_id", userId);
    const { error } = await supabase.from("skills").insert({ user_id: userId, hard_skills: editSkills.hard_skills, soft_skills: editSkills.soft_skills });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await fetchAll(userId); setEditSection(null);
  };

  const saveLangs = async () => {
    if (!userId) return;
    setSaving(true);
    await supabase.from("languages").delete().eq("user_id", userId);
    const rows = editLangs.filter(r => r.language_name.trim()).map(r => ({ user_id: userId, language_name: r.language_name.trim(), proficiency: r.proficiency }));
    const { error } = await supabase.from("languages").insert(rows);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await fetchAll(userId); setEditSection(null);
  };

  /* ── helpers for edit-work ── */
  const updateWorkBlock = (idx: number, patch: Partial<WorkExp>) => setEditWork(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  const addWorkBlock = () => setEditWork(prev => [...prev, { company_name: "", job_title: "", start_month: 1, start_year: 2024, end_month: null, end_year: null, is_current: false, bullet_points: [""] }]);
  const removeWorkBlock = (idx: number) => setEditWork(prev => prev.filter((_, i) => i !== idx));

  const updateEduBlock = (idx: number, patch: Partial<Edu>) => setEditEdu(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  const addEduBlock = () => setEditEdu(prev => [...prev, { institution: "", degree: "", field_of_study: "", start_year: 2024, end_year: null, is_expected: false }]);
  const removeEduBlock = (idx: number) => setEditEdu(prev => prev.filter((_, i) => i !== idx));

  const formatDateRange = (w: WorkExp) => {
    const s = `${MONTHS[w.start_month - 1]} ${w.start_year}`;
    if (w.is_current) return `${s} – Present`;
    const e = w.end_month && w.end_year ? `${MONTHS[w.end_month - 1]} ${w.end_year}` : "";
    return `${s} – ${e}`;
  };

  const sectionHeader = (title: string, section: string) => (
    <CardHeader className="flex flex-row items-center justify-between pb-4">
      <CardTitle className="text-lg" style={{ color: "#0F1F3D" }}>{title}</CardTitle>
      {editSection !== section && (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => startEdit(section)}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
      )}
    </CardHeader>
  );

  const editFooter = (onSave: () => void) => (
    <div className="flex gap-3 justify-end pt-4 border-t mt-4">
      <Button variant="outline" size="sm" onClick={cancel}>Cancel</Button>
      <Button size="sm" onClick={onSave} disabled={saving} style={{ background: "#0F1F3D" }}>
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[28px] font-bold" style={{ color: "#0F1F3D" }}>Profile</h1>
        <p className="text-muted-foreground mt-0.5">{email}</p>
        {memberSince && <p className="text-sm text-muted-foreground">Member since {memberSince}</p>}
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
                      <div key={bIdx} className="flex items-center gap-2">
                        <Input value={bp} onChange={e => { const bps = [...block.bullet_points]; bps[bIdx] = e.target.value; updateWorkBlock(idx, { bullet_points: bps }); }} className="rounded-lg" />
                        {bIdx > 0 && <button type="button" onClick={() => { const bps = block.bullet_points.filter((_, j) => j !== bIdx); updateWorkBlock(idx, { bullet_points: bps }); }} className="shrink-0 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>}
                      </div>
                    ))}
                    {block.bullet_points.length < 6 && <button type="button" onClick={() => updateWorkBlock(idx, { bullet_points: [...block.bullet_points, ""] })} className="text-sm font-medium" style={{ color: "#0F1F3D" }}>+ Add bullet</button>}
                  </div>
                  <button type="button" onClick={() => removeWorkBlock(idx)} className="text-sm font-medium text-destructive hover:underline">Remove experience</button>
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
                  <p className="text-sm text-muted-foreground">{formatDateRange(w)}</p>
                  {w.bullet_points.length > 0 && (
                    <ul className="mt-2 ml-5 list-disc text-sm text-foreground space-y-1">
                      {w.bullet_points.filter(bp => bp.trim()).map((bp, j) => <li key={j}>{bp}</li>)}
                    </ul>
                  )}
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
                  <TagInput tags={editSkills.hard_skills} onAdd={t => setEditSkills(p => ({ ...p, hard_skills: [...p.hard_skills, t] }))} onRemove={i => setEditSkills(p => ({ ...p, hard_skills: p.hard_skills.filter((_, j) => j !== i) }))} placeholder="Type a skill and press Enter..." pillClass="bg-[#0F1F3D] text-white" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Soft Skills</h3>
                  <TagInput tags={editSkills.soft_skills} onAdd={t => setEditSkills(p => ({ ...p, soft_skills: [...p.soft_skills, t] }))} onRemove={i => setEditSkills(p => ({ ...p, soft_skills: p.soft_skills.filter((_, j) => j !== i) }))} placeholder="Type a skill and press Enter..." pillClass="bg-slate-200 text-slate-700" />
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
                  {skills.hard_skills.map((s, i) => (
                    <span key={i} className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-[#0F1F3D] text-white">{s}</span>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Soft Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {skills.soft_skills.length === 0 && <p className="text-muted-foreground text-sm">None added yet.</p>}
                  {skills.soft_skills.map((s, i) => (
                    <span key={i} className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-slate-200 text-slate-700">{s}</span>
                  ))}
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
                  <div className="flex-1 space-y-1.5">
                    {idx === 0 && <Label>Language</Label>}
                    <Input value={row.language_name} onChange={e => setEditLangs(p => p.map((r, i) => i === idx ? { ...r, language_name: e.target.value } : r))} placeholder="e.g. English" className="rounded-lg" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    {idx === 0 && <Label>Proficiency</Label>}
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
    </div>
  );
};

export default Profile;
