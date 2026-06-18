// Shared builder that turns per-job cvOutput + the user profile into a structured
// CvData object used by all CV renderers (DOCX, PDF, on-screen preview).
//
// Global header fields (name, phone, email, linkedin, location) come ONLY from the
// user profile. Section ordering / visibility / labels are FIXED (see cvLayout.ts).

import {
  CvSectionConfig,
  CvSectionId,
  DEFAULT_SECTION_CONFIG,
} from "./cvLayout";

type BulletItem = { original: string; tailored: string; use_tailored: boolean };
type BulletBlock = { company: string; job_title: string; bullets: BulletItem[] | string[] };

export interface CvHeader {
  fullName: string;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  location: string | null;
}

export interface CvExperienceEntry {
  jobTitle: string;
  company: string;
  location: string | null;
  dateRange: string;
  bullets: string[];
}

export interface CvEducationEntry {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  location?: string | null;
  dateRange: string;
  grade?: string | null;
  activities?: string | null;
  description?: string | null;
}

export interface CvLanguageEntry {
  name: string;
  proficiency: string;
}

/** Hard skills are always rendered as a single flat, ordered list — the canonical
 * CV structure has one "Hard skills" section, never per-category sub-headings.
 * Legacy CV outputs that stored a Record<category, string[]> are flattened here
 * so renderers never have to branch on shape. */
export type CvHardSkills = string[];

export type CvSectionData =
  | { kind: "education"; entries: CvEducationEntry[] }
  | { kind: "experience"; entries: CvExperienceEntry[] }
  | { kind: "languages"; entries: CvLanguageEntry[] }
  | { kind: "hardSkills"; data: CvHardSkills }
  | { kind: "softSkills"; items: string[] };

export interface CvSection {
  id: CvSectionId;
  label: string;
  visible: boolean;
  data: CvSectionData;
  isEmpty: boolean;
}

export interface CvData {
  header: CvHeader;
  sections: CvSection[];
  /** Used only for the export filename. */
  companyName: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function bulletText(b: BulletItem | string): string {
  if (typeof b === "string") return b;
  // Tailoring no longer rewrites bullets — we always render the user's original
  // wording. We still fall back to `tailored` only if `original` is unexpectedly empty
  // (e.g. legacy data where only one field was populated).
  return b.original || b.tailored || "";
}

import { dateRange as fmtRange } from "./cvLayout";

function cleanString(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim();
  return t.length ? t : null;
}

function flattenHardSkills(
  raw: Record<string, string[]> | string[] | null | undefined,
): string[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Object.values(raw).flat();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const t = item.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

function experienceEntries(
  work: any[],
  selectedBullets: Record<string, string[]>,
): CvExperienceEntry[] {
  return (work || [])
    .map((exp) => {
      const company = cleanString(exp.company_name) || "";
      const bullets = (selectedBullets[company] || exp.bullet_points || [])
        .map((b: unknown) => (typeof b === "string" ? b.trim() : ""))
        .filter((b: string) => b.length > 0);
      return {
        jobTitle: cleanString(exp.job_title) || "",
        company,
        location: cleanString(exp.location),
        dateRange: fmtRange(
          exp.start_month,
          exp.start_year,
          exp.end_month,
          exp.end_year,
          !!exp.is_current,
        ),
        bullets,
      };
    })
    // Skip experiences with no usable content — keeps export clean for sparse profiles.
    .filter((e) => e.jobTitle || e.company || e.bullets.length > 0);
}

function educationEntries(edus: any[]): CvEducationEntry[] {
  return (edus || [])
    .map((e) => {
      const start = e.start_year ? String(e.start_year) : "";
      const end = e.is_expected ? "Expected" : e.end_year ? String(e.end_year) : "";
      const dateRange = start
        ? end
          ? `${start} – ${end}`
          : start
        : end;
      return {
        institution: cleanString(e.institution) || "",
        degree: cleanString(e.degree) || "",
        fieldOfStudy: cleanString(e.field_of_study) || "",
        location: cleanString(e.location),
        dateRange,
        grade: cleanString(e.grade),
        activities: cleanString(e.activities),
        description: cleanString(e.description),
      };
    })
    .filter((e) => e.institution || e.degree || e.fieldOfStudy);
}

// ─── main builder ────────────────────────────────────────────────────────────

export function buildCvData(opts: {
  cvOutput: {
    tailored_summary: string | null;
    selected_bullets: BulletBlock[] | null;
    selected_hard_skills: Record<string, string[]> | string[] | null;
    selected_soft_skills?: string[];
  };
  profile: {
    full_name: string | null;
    email: string | null;
    contact_email?: string | null;
    phone?: string | null;
    linkedin_url?: string | null;
    default_location?: string | null;
    work_experiences: any[];
    education: any[];
    languages: any[];
    interests?: string[];
  };
  job: { company_name: string | null; location?: string | null };
}): CvData {
  const { cvOutput, profile, job } = opts;

  // Flatten BulletBlock[] → { [company]: string[] }
  const selectedBullets: Record<string, string[]> = {};
  for (const block of cvOutput.selected_bullets || []) {
    const bullets = (block.bullets || []).map(bulletText).filter(Boolean);
    if (bullets.length) selectedBullets[block.company] = bullets;
  }

  const header: CvHeader = {
    fullName: cleanString(profile.full_name) || "Your Name",
    phone: cleanString(profile.phone),
    email: cleanString(profile.contact_email) || cleanString(profile.email),
    linkedin: cleanString(profile.linkedin_url),
    location: cleanString(profile.default_location),
  };

  const expEntries = experienceEntries(profile.work_experiences, selectedBullets);
  const eduEntries = educationEntries(profile.education);
  const langEntries: CvLanguageEntry[] = (profile.languages || [])
    .map((l: any) => ({
      name: cleanString(l.language_name) || "",
      proficiency: cleanString(l.proficiency) || "",
    }))
    .filter((l) => l.name);
  const hardSkills: CvHardSkills = flattenHardSkills(cvOutput.selected_hard_skills);
  const softSkills = (cvOutput.selected_soft_skills || [])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean);

  // Layout is fixed — no per-job reordering.
  const config: CvSectionConfig = DEFAULT_SECTION_CONFIG;

  const dataById: Record<CvSectionId, CvSectionData> = {
    education: { kind: "education", entries: eduEntries },
    experience: { kind: "experience", entries: expEntries },
    languages: { kind: "languages", entries: langEntries },
    hardSkills: { kind: "hardSkills", data: hardSkills },
    softSkills: { kind: "softSkills", items: softSkills },
  };

  const emptyById: Record<CvSectionId, boolean> = {
    education: eduEntries.length === 0,
    experience: expEntries.length === 0,
    languages: langEntries.length === 0,
    hardSkills: hardSkills.length === 0,
    softSkills: softSkills.length === 0,
  };

  const sections: CvSection[] = config.sections.map((s) => ({
    id: s.id,
    label: s.label,
    visible: s.visible,
    data: dataById[s.id],
    isEmpty: emptyById[s.id],
  }));

  return {
    header,
    sections,
    companyName: job.company_name || "Company",
  };
}

export { DEFAULT_SECTION_CONFIG };