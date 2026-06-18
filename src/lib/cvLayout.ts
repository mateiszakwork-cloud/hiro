// Shared CV layout constants and types.
// The CV layout is FIXED: header → education → experience → languages → soft skills → hard skills.
// Used by buildCvData, generateCvDocx, generateCvPdf, CvPreview.

export type CvSectionId =
  | "education"
  | "experience"
  | "languages"
  | "softSkills"
  | "hardSkills";

export interface CvSectionMeta {
  id: CvSectionId;
  label: string;
  visible: boolean;
}

export interface CvSectionConfig {
  sections: CvSectionMeta[];
}

/** Fixed section labels. Casing here is the user-visible source of truth. */
export const DEFAULT_SECTION_LABELS: Record<CvSectionId, string> = {
  education: "Education",
  experience: "Work experience",
  languages: "Languages",
  softSkills: "Soft skills",
  hardSkills: "Hard skills",
};

/** Canonical, non-configurable CV layout. */
export const FIXED_SECTION_ORDER: CvSectionId[] = [
  "education",
  "experience",
  "languages",
  "softSkills",
  "hardSkills",
];

export const DEFAULT_SECTION_CONFIG: CvSectionConfig = {
  sections: FIXED_SECTION_ORDER.map((id) => ({
    id,
    label: DEFAULT_SECTION_LABELS[id],
    visible: true,
  })),
};

/** Always returns the fixed config. Stored section_config is intentionally ignored —
 *  the CV layout is no longer user-configurable. */
export function normalizeSectionConfig(_raw?: unknown): CvSectionConfig {
  return DEFAULT_SECTION_CONFIG;
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