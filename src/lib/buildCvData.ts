// Shared builder that turns the per-job cvOutput + the user profile into
// the CvData shape consumed by generateCvDocx and generateCvPdf.

type BulletItem = { original: string; tailored: string; use_tailored: boolean };
type BulletBlock = { company: string; job_title: string; bullets: BulletItem[] | string[] };

export interface CvData {
  fullName: string;
  email: string | null;
  location: string | null;
  summary: string | null;
  workExperiences: any[];
  volunteering: any[];
  education: any[];
  languages: any[];
  interests: string[];
  awards: any[];
  selectedBullets: Record<string, string[]> | null;
  selectedExperiences: any[] | null;
  selectedHardSkills: Record<string, string[]> | string[] | null;
  isBaseCvMode: boolean;
  companyName: string;
}

function bulletText(b: BulletItem | string): string {
  if (typeof b === "string") return b;
  return b.use_tailored !== false ? (b.tailored || b.original) : (b.original || b.tailored);
}

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

  return {
    fullName: profile.full_name || "Your Name",
    email: profile.email || null,
    location: null,
    summary: cvOutput.tailored_summary,
    workExperiences: profile.work_experiences || [],
    volunteering: profile.volunteering || [],
    education: profile.education || [],
    languages: profile.languages || [],
    interests: profile.interests || [],
    awards: profile.awards || [],
    selectedBullets: Object.keys(selectedBullets).length ? selectedBullets : null,
    selectedExperiences: null,
    selectedHardSkills: cvOutput.selected_hard_skills || null,
    isBaseCvMode: true,
    companyName: job.company_name || "Company",
  };
}