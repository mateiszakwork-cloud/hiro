import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  TabStopType, TabStopPosition, BorderStyle, LevelFormat,
} from "docx";
import { saveAs } from "file-saver";

interface CvData {
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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (m: number, y: number) => `${MONTHS[m - 1] || ""} ${y}`;
const RED = "950606";

// DXA: 1 cm ≈ 567 DXA. 2cm = 1134, 2.2cm = 1247
const MARGIN_TB = 1134;
const MARGIN_LR = 1247;

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    spacing: { before: 200, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 2 } },
    children: [
      new TextRun({ text: title, bold: true, size: 18, font: "Calibri", allCaps: true }),
    ],
  });
}

function experienceBlock(
  jobTitle: string,
  companyName: string,
  dateStr: string,
  location: string | null,
  bullets: string[],
  numbering: { reference: string; level: number },
): Paragraph[] {
  const paras: Paragraph[] = [];

  // Job title + date on same line
  paras.push(new Paragraph({
    spacing: { before: 120, after: 0 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: [
      new TextRun({ text: jobTitle, bold: true, size: 20, font: "Calibri" }),
      new TextRun({ text: `\t${dateStr}`, size: 20, font: "Calibri" }),
    ],
  }));

  // Company + location on same line
  const companyChildren: TextRun[] = [
    new TextRun({ text: companyName, size: 20, font: "Calibri" }),
  ];
  if (location) {
    companyChildren.push(new TextRun({ text: `\t${location}`, size: 20, font: "Calibri" }));
  }
  paras.push(new Paragraph({
    spacing: { before: 0, after: 40 },
    tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
    children: companyChildren,
  }));

  // Bullets
  for (const b of bullets) {
    paras.push(new Paragraph({
      numbering,
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: b, size: 20, font: "Calibri" })],
    }));
  }

  return paras;
}

export async function generateCvDocx(data: CvData) {
  const {
    fullName, email, location, summary,
    workExperiences, volunteering, education, languages,
    interests, awards, selectedBullets, selectedExperiences,
    selectedHardSkills, isBaseCvMode, companyName,
  } = data;

  const contactParts = [email, location].filter(Boolean).join("  •  ");

  const children: Paragraph[] = [];

  // 1. Header - Name
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: fullName || "Your Name", bold: true, size: 36, font: "Calibri" })],
  }));

  // Contact line
  if (contactParts) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [new TextRun({ text: contactParts, size: 20, font: "Calibri", color: "555555" })],
    }));
  }

  // 2. Summary
  if (summary) {
    children.push(sectionHeading("SUMMARY"));
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [new TextRun({ text: summary, size: 20, font: "Calibri" })],
    }));
  }

  // 3. Professional Experience
  if (workExperiences?.length) {
    children.push(sectionHeading("PROFESSIONAL EXPERIENCE"));
    for (const exp of workExperiences) {
      const bullets: string[] = isBaseCvMode && selectedBullets
        ? (selectedBullets[exp.company_name] || exp.bullet_points || [])
        : (selectedExperiences?.find((se: any) => se.company === exp.company_name)?.selected_bullets || exp.bullet_points || []);

      const dateStr = `${fmtDate(exp.start_month, exp.start_year)} – ${exp.is_current ? "Present" : exp.end_month && exp.end_year ? fmtDate(exp.end_month, exp.end_year) : ""}`;

      children.push(...experienceBlock(
        exp.job_title, exp.company_name, dateStr, exp.location, bullets,
        { reference: "bullets", level: 0 },
      ));
    }
  }

  // 4. Volunteering / Entrepreneurial
  if (volunteering?.length) {
    children.push(sectionHeading("ENTREPRENEURIAL & VOLUNTEER EXPERIENCE"));
    for (const v of volunteering) {
      const dateStr = v.start_year ? `${v.start_year} – ${v.is_ongoing ? "Present" : v.end_year || ""}` : "";
      const title = v.role || v.organization;
      const org = v.role ? v.organization : "";

      children.push(new Paragraph({
        spacing: { before: 120, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: title, bold: true, size: 20, font: "Calibri" }),
          ...(dateStr ? [new TextRun({ text: `\t${dateStr}`, size: 20, font: "Calibri" })] : []),
        ],
      }));
      if (org) {
        children.push(new Paragraph({
          spacing: { before: 0, after: 40 },
          children: [new TextRun({ text: org, size: 20, font: "Calibri" })],
        }));
      }
      if (v.description) {
        children.push(new Paragraph({
          spacing: { before: 20, after: 40 },
          children: [new TextRun({ text: v.description, size: 20, font: "Calibri" })],
        }));
      }
    }
  }

  // 5. Education
  if (education?.length) {
    children.push(sectionHeading("EDUCATION"));
    for (const edu of education) {
      const dateStr = `${edu.start_year} – ${edu.is_expected ? "Expected" : edu.end_year || ""}`;
      children.push(new Paragraph({
        spacing: { before: 120, after: 0 },
        tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
        children: [
          new TextRun({ text: edu.institution, bold: true, size: 20, font: "Calibri" }),
          new TextRun({ text: `\t${dateStr}`, size: 20, font: "Calibri" }),
        ],
      }));
      children.push(new Paragraph({
        spacing: { before: 0, after: 20 },
        children: [new TextRun({ text: `${edu.degree} in ${edu.field_of_study}`, size: 20, font: "Calibri" })],
      }));
      if (edu.grade) {
        children.push(new Paragraph({
          spacing: { before: 0, after: 20 },
          children: [new TextRun({ text: `GPA: ${edu.grade}`, size: 20, font: "Calibri", color: "555555" })],
        }));
      }
      if (edu.activities) {
        children.push(new Paragraph({
          spacing: { before: 0, after: 20 },
          children: [new TextRun({ text: edu.activities, size: 20, font: "Calibri" })],
        }));
      }
      if (edu.description) {
        children.push(new Paragraph({
          spacing: { before: 0, after: 20 },
          children: [new TextRun({ text: edu.description, size: 20, font: "Calibri" })],
        }));
      }
    }
  }

  // 6. Awards
  if (awards?.length) {
    children.push(sectionHeading("AWARDS & HONOURS"));
    for (const a of awards) {
      const text = `${a.award_name}${a.issuing_organization ? ` — ${a.issuing_organization}` : ""}${a.year ? ` (${a.year})` : ""}`;
      children.push(new Paragraph({
        spacing: { before: 20, after: 20 },
        children: [new TextRun({ text, size: 20, font: "Calibri" })],
      }));
    }
  }

  // 7. Footer sections: Languages, Skills, Interests
  const footerSections: Paragraph[] = [];

  if (languages?.length) {
    footerSections.push(new Paragraph({
      spacing: { before: 200, after: 40 },
      border: footerSections.length === 0 ? { top: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } } : undefined,
      children: [new TextRun({ text: "LANGUAGES", bold: true, size: 18, font: "Calibri" })],
    }));
    for (const l of languages) {
      footerSections.push(new Paragraph({
        spacing: { before: 0, after: 10 },
        children: [
          new TextRun({ text: `${l.language_name} `, size: 20, font: "Calibri" }),
          new TextRun({ text: `(${l.proficiency})`, size: 20, font: "Calibri", color: "555555" }),
        ],
      }));
    }
  }

  if (selectedHardSkills) {
    footerSections.push(new Paragraph({
      spacing: { before: footerSections.length === 0 ? 200 : 120, after: 40 },
      border: footerSections.length === 0 ? { top: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } } : undefined,
      children: [new TextRun({ text: "SOFTWARE & SKILLS", bold: true, size: 18, font: "Calibri" })],
    }));
    if (!Array.isArray(selectedHardSkills)) {
      for (const [cat, skills] of Object.entries(selectedHardSkills)) {
        footerSections.push(new Paragraph({
          spacing: { before: 20, after: 10 },
          children: [
            new TextRun({ text: `${cat}: `, bold: true, size: 18, font: "Calibri", color: "555555" }),
            new TextRun({ text: (skills as string[]).join(", "), size: 20, font: "Calibri" }),
          ],
        }));
      }
    } else {
      footerSections.push(new Paragraph({
        spacing: { before: 0, after: 10 },
        children: [new TextRun({ text: selectedHardSkills.join(", "), size: 20, font: "Calibri" })],
      }));
    }
  }

  if (interests?.length) {
    footerSections.push(new Paragraph({
      spacing: { before: footerSections.length === 0 ? 200 : 120, after: 40 },
      border: footerSections.length === 0 ? { top: { style: BorderStyle.SINGLE, size: 4, color: RED, space: 4 } } : undefined,
      children: [new TextRun({ text: "PERSONAL INTERESTS", bold: true, size: 18, font: "Calibri" })],
    }));
    footerSections.push(new Paragraph({
      spacing: { before: 0, after: 10 },
      children: [new TextRun({ text: interests.join(", "), size: 20, font: "Calibri" })],
    }));
  }

  children.push(...footerSections);

  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: MARGIN_TB, bottom: MARGIN_TB, left: MARGIN_LR, right: MARGIN_LR },
        },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);

  // Build filename
  const nameParts = (fullName || "CV").replace(/\s+/g, "");
  const company = (companyName || "Company").replace(/[^a-zA-Z0-9]/g, "");
  const now = new Date();
  const monthStr = MONTHS[now.getMonth()];
  const yearStr = now.getFullYear();
  const filename = `${nameParts}_CV_${company}_${monthStr}${yearStr}.docx`;

  saveAs(buffer, filename);
}
