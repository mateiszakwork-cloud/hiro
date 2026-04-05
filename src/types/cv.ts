export interface ParsedWorkExperience {
  company_name: string;
  job_title: string;
  location: string | null;
  start_month: string | null;
  start_year: number;
  end_month: string | null;
  end_year: number | null;
  is_current: boolean;
  bullet_points: string[];
}

export interface ParsedEducation {
  institution: string;
  degree: string;
  field_of_study: string;
  start_year: number;
  end_year: number | null;
  grade: string | null;
  activities: string | null;
  description: string | null;
}

export interface ParsedLanguage {
  name: string;
  proficiency: string;
}

export interface ParsedCVData {
  work_experiences: ParsedWorkExperience[];
  education: ParsedEducation[];
  hard_skills: string[];
  soft_skills: string[];
  languages: ParsedLanguage[];
}
