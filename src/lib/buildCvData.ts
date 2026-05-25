// Shared builder that turns per-job cvOutput + the user profile into a structured
// CvData object used by all CV renderers (DOCX, PDF, on-screen preview).
//
// Global header fields (name, phone, email, linkedin, location) come ONLY from the
// user profile. Section ordering / visibility / labels come from cv_outputs.section_config.

import {
  CvSectionConfig,
  CvSectionId,
  DEFAULT_SECTION_CONFIG,
  normalizeSectionConfig,
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

export interface CvFooterData {
  languages: { name: string; proficiency: string }[];
  interests: string[];
  hardSkills: Record<string, string[]> | string[] | null;
}

export type CvSectionData =
  | { kind: "summary"; text: string }
  | { kind: "education"; entries: CvEducationEntry[] }
  | { kind: "experience"; entries: CvExperienceEntry[] }
  | { kind: "entrepreneurial"; entries: CvExperienceEntry[] }
  | { kind: "footer"; data: CvFooterData };

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
  return b.use_tailored !== false ? (b.tailored || b.original) : (b.original || b.tailored);
}

import { dateRange as fmtRange } from "./cvLayout";

function experienceEntries(
  work: any[],
  selectedBullets: Record<string, string[]>,
): CvExperienceEntry[] {
  return (work || []).map((exp) => ({
    jobTitle: exp.job_title || "",
    company: exp.company_name || "",
    location: exp.location || null,
    dateRange: fmtRange(exp.start_month, exp.start_year, exp.end_month, exp.end_year, !!exp.is_current),
    bullets: selectedBullets[exp.company_name] || exp.bullet_points || [],
  }));
}

function volunteeringEntries(vols: any[]): CvExperienceEntry[] {
  return (vols || []).map((v) => ({
    jobTitle: v.role || v.organization || "",
    company: v.role ? v.organization || "" : "",
    location: null,
    dateRange: v.start_year
      ? `${v.start_year} – ${v.is_ongoing ? "Present" : v.end_year || ""}`
      : "",
    bullets: v.description ? [v.description] : [],
  }));
}

function educationEntries(edus: any[]): CvEducationEntry[] {
  return (edus || []).map((e) => ({
    institution: e.institution || "",
    degree: e.degree || "",
    fieldOfStudy: e.field_of_study || "",
    location: e.location || null,
    dateRange: e.start_year
      ? `${e.start_year} – ${e.is_expected ? "Expected" : e.end_year || ""}`
      : "",
    grade: e.grade,
    activities: e.activities,
    description: e.description,
  }));
}

// ─── main builder ────────────────────────────────────────────────────────────

export function buildCvData(opts: {
  cvOutput: {
    tailored_summary: string | null;
    selected_bullets: BulletBlock[] | null;
    selected_hard_skills: Record<string, string[]> | string[] | null;
    selected_soft_skills?: string[];
    section_config?: unknown;
  };
  profile: {
    full_name: string | null;
    email: string | null;
    phone?: string | null;
    linkedin_url?: string | null;
    default_location?: string | null;
    work_experiences: any[];
    education: any[];
    languages: any[];
    interests: string[];
    awards: any[];
    volunteering: any[];
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
    fullName: profile.full_name || "Your Name",
    phone: profile.phone || null,
    email: profile.email || null,
    linkedin: profile.linkedin_url || null,
    location: profile.default_location || null,
  };

  const expEntries = experienceEntries(profile.work_experiences, selectedBullets);
  const volEntries = volunteeringEntries(profile.volunteering);
  const eduEntries = educationEntries(profile.education);
  const langs = (profile.languages || []).map((l: any) => ({
    name: l.language_name,
    proficiency: l.proficiency,
  }));

  const config: CvSectionConfig = normalizeSectionConfig(cvOutput.section_config);

  const dataById: Record<CvSectionId, CvSectionData> = {
    summary: { kind: "summary", text: cvOutput.tailored_summary || "" },
    education: { kind: "education", entries: eduEntries },
    experience: { kind: "experience", entries: expEntries },
    entrepreneurial: { kind: "entrepreneurial", entries: volEntries },
    footer: {
      kind: "footer",
      data: {
        languages: langs,
        interests: profile.interests || [],
        hardSkills: cvOutput.selected_hard_skills || null,
      },
    },
  };

  const emptyById: Record<CvSectionId, boolean> = {
    summary: !cvOutput.tailored_summary,
    education: eduEntries.length === 0,
    experience: expEntries.length === 0,
    entrepreneurial: volEntries.length === 0,
    footer:
      langs.length === 0 &&
      (profile.interests?.length || 0) === 0 &&
      !cvOutput.selected_hard_skills,
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

export { DEFAULT_SECTION_CONFIG, normalizeSectionConfig };