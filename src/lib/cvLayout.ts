// Shared CV layout constants, types, and section-config helpers.
// Used by buildCvData, generateCvDocx, generateCvPdf, CvPreview, CvSectionControls.

export type CvSectionId =
  | "education"
  | "experience"
  | "languages"
  | "hardSkills"
  | "softSkills";

export interface CvSectionMeta {
  id: CvSectionId;
  label: string;
  visible: boolean;
}

export interface CvSectionConfig {
  sections: CvSectionMeta[];
}

export const DEFAULT_SECTION_LABELS: Record<CvSectionId, string> = {
  education: "Education",
  experience: "Professional Experience",
  languages: "Languages",
  hardSkills: "Hard Skills",
  softSkills: "Soft Skills",
};

/** Sections that ship hidden by default (user can opt in). */
const OPTIONAL_HIDDEN_BY_DEFAULT: CvSectionId[] = ["softSkills"];

export const DEFAULT_SECTION_CONFIG: CvSectionConfig = {
  sections: (Object.keys(DEFAULT_SECTION_LABELS) as CvSectionId[]).map((id) => ({
    id,
    label: DEFAULT_SECTION_LABELS[id],
    visible: !OPTIONAL_HIDDEN_BY_DEFAULT.includes(id),
  })),
};

/** Merge a stored section_config (possibly empty or partial) with defaults so the order
 *  is stable and any missing section id is appended. */
export function normalizeSectionConfig(raw: unknown): CvSectionConfig {
  const stored = (raw && typeof raw === "object" && (raw as any).sections) as
    | CvSectionMeta[]
    | undefined;
  if (!Array.isArray(stored) || stored.length === 0) return DEFAULT_SECTION_CONFIG;

  const known = new Set<CvSectionId>();
  const out: CvSectionMeta[] = [];
  for (const s of stored) {
    if (!s || typeof s !== "object") continue;
    const id = s.id as CvSectionId;
    if (!DEFAULT_SECTION_LABELS[id] || known.has(id)) continue;
    known.add(id);
    out.push({
      id,
      label: (s.label && String(s.label).trim()) || DEFAULT_SECTION_LABELS[id],
      visible: s.visible !== false,
    });
  }
  // Append any missing default sections at the end (visible by default).
  for (const id of Object.keys(DEFAULT_SECTION_LABELS) as CvSectionId[]) {
    if (!known.has(id)) {
      out.push({
        id,
        label: DEFAULT_SECTION_LABELS[id],
        visible: !OPTIONAL_HIDDEN_BY_DEFAULT.includes(id),
      });
    }
  }
  return { sections: out };
}

// ── Shared visual constants ──────────────────────────────────────────────────

// DOCX uses DXA (1 cm ≈ 567). PDF uses points. We expose both so generators stay aligned.
export const LAYOUT = {
  margin: { topCm: 1.8, bottomCm: 1.8, leftCm: 2.0, rightCm: 2.0 },
  font: { body: "Calibri", bodyPt: 10, namePt: 22, contactPt: 9.5, headingPt: 10 },
  spacing: {
    headingBeforePt: 12,
    headingAfterPt: 4,
    entryBeforePt: 6,
    bulletBeforePt: 2,
  },
  muted: "#555555",
  rule: "#999999",
};

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const fmtMonth = (m?: number | null, y?: number | null) =>
  y ? `${m ? MONTHS[(m - 1) % 12] + " " : ""}${y}` : "";

export const dateRange = (
  sm: number | null | undefined,
  sy: number | null | undefined,
  em: number | null | undefined,
  ey: number | null | undefined,
  ongoing: boolean,
): string => {
  const start = fmtMonth(sm ?? null, sy ?? null);
  const end = ongoing ? "Present" : fmtMonth(em ?? null, ey ?? null);
  if (!start && !end) return "";
  if (!end) return start;
  return `${start} – ${end}`;
};