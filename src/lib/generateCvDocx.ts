import {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  TabStopType, TabStopPosition, BorderStyle, LevelFormat,
} from "docx";
import { saveAs } from "file-saver";
import type {
  CvData, CvSection, CvExperienceEntry, CvEducationEntry,
  CvLanguageEntry, CvHardSkills,
} from "./buildCvData";
import { MONTHS } from "./cvLayout";

// ── DXA constants (1 cm ≈ 567 DXA, 1 pt ≈ 20 DXA) ─────────────────────────────
const MARGIN_TB = 1020;   // ~1.8cm
const MARGIN_LR = 1134;   // ~2cm
const RULE_GRAY = "BFBFBF";
const MUTED = "555555";
const FONT = "Calibri";

// Sizes in half-points
const SZ_NAME = 44;       // 22pt
const SZ_CONTACT = 19;    // 9.5pt
const SZ_HEADING = 20;    // 10pt
const SZ_BODY = 20;       // 10pt
const SZ_BULLET = 20;     // 10pt
const SZ_META = 19;       // 9.5pt

function heading(title: string): Paragraph {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 240, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE_GRAY, space: 2 } },
    children: [
      new TextRun({ text: title.toUpperCase(), bold: true, size: SZ_HEADING, font: FONT, characterSpacing: 12 }),
    ],
  });
}

const tabRight = [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }];

function experienceBlock(e: CvExperienceEntry): Paragraph[] {
  const out: Paragraph[] = [];

  // Line 1: ROLE | Company   ............   dates
  const titleText = e.company ? `${e.jobTitle} | ${e.company}` : e.jobTitle;
  out.push(new Paragraph({
    keepNext: true, keepLines: true,
    spacing: { before: 140, after: 0 },
    tabStops: tabRight,
    children: [
      new TextRun({ text: titleText, bold: true, size: SZ_BODY, font: FONT }),
      ...(e.dateRange ? [new TextRun({ text: `\t${e.dateRange}`, size: SZ_META, font: FONT })] : []),
    ],
  }));

  // Line 2: (optional) location right-aligned, muted
  if (e.location) {
    out.push(new Paragraph({
      keepNext: true, keepLines: true,
      spacing: { before: 0, after: 40 },
      tabStops: tabRight,
      children: [
        new TextRun({ text: "", size: SZ_META, font: FONT }),
        new TextRun({ text: `\t${e.location.toUpperCase()}`, size: SZ_META, font: FONT, color: MUTED }),
      ],
    }));
  } else {
    out.push(new Paragraph({ spacing: { before: 0, after: 40 }, children: [new TextRun({ text: "", size: 2 })] }));
  }

  // Bullets
  e.bullets.forEach((b, i) => {
    out.push(new Paragraph({
      numbering: { reference: "bullets", level: 0 },
      keepLines: true,
      keepNext: i === 0,
      spacing: { before: 40, after: 40, line: 280 },
      children: [new TextRun({ text: b, size: SZ_BULLET, font: FONT })],
    }));
  });

  return out;
}

function educationBlock(e: CvEducationEntry): Paragraph[] {
  const out: Paragraph[] = [];
  out.push(new Paragraph({
    keepNext: true, keepLines: true,
    spacing: { before: 140, after: 0 },
    tabStops: tabRight,
    children: [
      new TextRun({ text: `${e.degree}${e.institution ? " at " + e.institution : ""}`, bold: true, size: SZ_BODY, font: FONT }),
      ...(e.dateRange ? [new TextRun({ text: `\t${e.dateRange}`, size: SZ_META, font: FONT })] : []),
    ],
  }));
  const line2Parts: string[] = [];
  if (e.fieldOfStudy) line2Parts.push(e.fieldOfStudy);
  if (e.grade) line2Parts.push(`GPA: ${e.grade}`);
  out.push(new Paragraph({
    keepLines: true,
    spacing: { before: 0, after: 40 },
    tabStops: tabRight,
    children: [
      new TextRun({ text: line2Parts.join(" | "), size: SZ_BODY, font: FONT }),
      ...(e.location ? [new TextRun({ text: `\t${e.location.toUpperCase()}`, size: SZ_META, font: FONT, color: MUTED })] : []),
    ],
  }));
  for (const extra of [e.activities, e.description].filter(Boolean) as string[]) {
    out.push(new Paragraph({
      numbering: { reference: "bullets", level: 0 },
      spacing: { before: 20, after: 20, line: 280 },
      children: [new TextRun({ text: extra, size: SZ_BULLET, font: FONT })],
    }));
  }
  return out;
}

function languagesBlock(langs: CvLanguageEntry[]): Paragraph[] {
  if (!langs.length) return [];
  return [new Paragraph({
    spacing: { before: 60, after: 60, line: 280 },
    children: [new TextRun({
      text: langs.map(l => `${l.name}: ${l.proficiency}`).join(" | "),
      size: SZ_BODY, font: FONT,
    })],
  })];
}

function hardSkillsBlock(skills: CvHardSkills): Paragraph[] {
  if (!skills) return [];
  const text = Array.isArray(skills)
    ? skills.join(", ") + "."
    : Object.entries(skills)
        .filter(([, v]) => Array.isArray(v) && v.length)
        .map(([cat, list]) => `${cat}: ${(list as string[]).join(", ")}`)
        .join("; ") + ".";
  return [new Paragraph({
    spacing: { before: 60, after: 60, line: 280 },
    children: [new TextRun({ text, size: SZ_BODY, font: FONT })],
  })];
}

function softSkillsBlock(items: string[]): Paragraph[] {
  if (!items.length) return [];
  return [new Paragraph({
    spacing: { before: 60, after: 60, line: 280 },
    children: [new TextRun({ text: items.join(", ") + ".", size: SZ_BODY, font: FONT })],
  })];
}

function renderSection(s: CvSection): Paragraph[] {
  if (!s.visible || s.isEmpty) return [];
  const paras: Paragraph[] = [heading(s.label)];
  const d = s.data;
  if (d.kind === "experience") {
    d.entries.forEach(e => paras.push(...experienceBlock(e)));
  } else if (d.kind === "education") {
    d.entries.forEach(e => paras.push(...educationBlock(e)));
  } else if (d.kind === "languages") {
    paras.push(...languagesBlock(d.entries));
  } else if (d.kind === "hardSkills") {
    paras.push(...hardSkillsBlock(d.data));
  } else if (d.kind === "softSkills") {
    paras.push(...softSkillsBlock(d.items));
  }
  return paras;
}

export async function generateCvDocx(data: CvData) {
  const { header, sections, companyName } = data;
  const children: Paragraph[] = [];

  // Name centered, bold
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children: [new TextRun({ text: header.fullName, bold: true, size: SZ_NAME, font: FONT })],
  }));

  // Single contact line: phone | email | LinkedIn
  const contactBits = [header.phone, header.email, header.linkedin].filter(Boolean) as string[];
  if (contactBits.length) {
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: contactBits.join("  |  "), size: SZ_CONTACT, font: FONT, color: MUTED })],
    }));
  }

  for (const s of sections) children.push(...renderSection(s));

  const doc = new Document({
    numbering: {
      config: [{
        reference: "bullets",
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: "\u2022",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 220 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: { margin: { top: MARGIN_TB, bottom: MARGIN_TB, left: MARGIN_LR, right: MARGIN_LR } },
      },
      children,
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const namePart = (header.fullName || "CV").replace(/\s+/g, "");
  const company = (companyName || "Company").replace(/[^a-zA-Z0-9]/g, "");
  const now = new Date();
  saveAs(buffer, `${namePart}_CV_${company}_${MONTHS[now.getMonth()]}${now.getFullYear()}.docx`);
}
