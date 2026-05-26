import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import type { CvData, CvSection, CvExperienceEntry, CvEducationEntry, CvFooterData } from "./buildCvData";
import { MONTHS } from "./cvLayout";

const MUTED = "#555555";
const RULE = "#BFBFBF";

// A4 in points: 595 x 842. Horizontal padding 56 → content width 483pt.
// Vertical padding base 44 → content height ~754pt (we may shrink padding too).
const PAGE_W = 595;
const PAGE_H = 842;
const PAD_X_BASE = 56;
const PAD_Y_BASE = 44;

function buildStyles(S: number, padY: number) {
  return StyleSheet.create({
    page: {
      paddingTop: padY, paddingBottom: padY, paddingHorizontal: PAD_X_BASE,
      fontFamily: "Helvetica", fontSize: 10 * S, color: "#000", lineHeight: 1.35,
    },
    name: { fontSize: 22 * S, fontWeight: 700, textAlign: "center", marginBottom: 2 * S },
    contact: { fontSize: 9.5 * S, textAlign: "center", color: MUTED, marginBottom: 12 * S },
    heading: {
      fontSize: 10 * S, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
      marginTop: 10 * S, marginBottom: 3 * S, paddingBottom: 2,
      borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: "solid",
    },
    body: { fontSize: 10 * S },
    entryHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 * S },
    entryHeaderText: { fontSize: 10 * S, fontWeight: 700, flex: 1, paddingRight: 8 },
    entryDate: { fontSize: 9.5 * S },
    entryMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 1 * S },
    entryMetaText: { fontSize: 10 * S, flex: 1, paddingRight: 8 },
    entryMetaRight: { fontSize: 9.5 * S, color: MUTED, textTransform: "uppercase" },
    bulletRow: { flexDirection: "row", marginTop: 1 * S, paddingLeft: 8 },
    bulletDot: { width: 10, fontSize: 10 * S },
    bulletText: { flex: 1, fontSize: 10 * S },
    footerLine: { fontSize: 10 * S, marginTop: 3 * S },
    bold: { fontWeight: 700 },
  });
}

// Estimate rendered height for the whole CV at a given scale.
// Helvetica avg char width ≈ 0.50 * fontSize for regular, 0.55 for bold.
function estimateHeight(data: CvData, S: number, padY: number): number {
  const contentW = PAGE_W - PAD_X_BASE * 2;
  const lineH = 10 * S * 1.35;
  const charW = 10 * S * 0.50;
  const wrap = (text: string | null | undefined, width: number) => {
    if (!text) return 0;
    const maxChars = Math.max(20, Math.floor(width / charW));
    // approximate wrapping: count words and pack
    const words = String(text).split(/\s+/);
    let lines = 1, used = 0;
    for (const w of words) {
      const wl = w.length + 1;
      if (used + wl > maxChars) { lines++; used = wl; } else { used += wl; }
    }
    return lines;
  };

  let h = padY * 2;
  // name + contact
  h += 22 * S * 1.15 + 2 * S;
  const hasContact = !!(data.header.phone || data.header.email || data.header.linkedin);
  if (hasContact) h += 9.5 * S * 1.2 + 12 * S;

  for (const s of data.sections) {
    if (!s.visible || s.isEmpty) continue;
    h += 10 * S + 10 * S * 1.2 + 3 * S + 2; // heading marginTop + line + marginBottom + border
    const d = s.data;
    if (d.kind === "summary") {
      h += wrap(d.text, contentW) * lineH;
    } else if (d.kind === "experience" || d.kind === "entrepreneurial") {
      for (const e of d.entries) {
        h += 6 * S + lineH; // header
        if (e.location) h += lineH + 1 * S;
        for (const b of e.bullets) {
          h += 1 * S + wrap(b, contentW - 18) * lineH;
        }
      }
    } else if (d.kind === "education") {
      for (const e of d.entries) {
        h += 6 * S + lineH;
        const line2 = [e.fieldOfStudy, e.grade ? `GPA: ${e.grade}` : null].filter(Boolean).join(" | ");
        if (line2 || e.location) h += lineH + 1 * S;
        for (const x of [e.activities, e.description].filter(Boolean) as string[]) {
          h += 1 * S + wrap(x, contentW - 18) * lineH;
        }
      }
    } else if (d.kind === "footer") {
      const f = d.data;
      if (f.languages?.length) {
        h += 3 * S + wrap(f.languages.map(l => `${l.name}: ${l.proficiency}`).join(" | "), contentW) * lineH;
      }
      if (f.interests?.length) {
        h += 3 * S + wrap("Personal Interests: " + f.interests.join(", "), contentW) * lineH;
      }
      if (f.hardSkills) {
        const txt = Array.isArray(f.hardSkills)
          ? f.hardSkills.join(", ")
          : Object.entries(f.hardSkills)
              .filter(([, v]) => Array.isArray(v) && v.length)
              .map(([cat, skills]) => `${cat}: ${(skills as string[]).join(", ")}`)
              .join("; ");
        h += 3 * S + wrap("Software Skills: " + txt, contentW) * lineH;
      }
    }
  }
  return h;
}

// Choose a scale + vertical padding that fits the content on one A4 page.
function computeFit(data: CvData): { S: number; padY: number } {
  // First try comfortable padding, then tighten if needed.
  const padOptions = [PAD_Y_BASE, 36, 30];
  for (const padY of padOptions) {
    let S = 1;
    const h1 = estimateHeight(data, S, padY);
    if (h1 <= PAGE_H) return { S, padY };
    // Linearly approximate: most content scales ~ linearly with S.
    S = Math.max(0.78, PAGE_H / h1);
    const h2 = estimateHeight(data, S, padY);
    if (h2 > PAGE_H) S = Math.max(0.78, S * (PAGE_H / h2));
    const h3 = estimateHeight(data, S, padY);
    if (h3 <= PAGE_H) return { S, padY };
  }
  // Last resort: minimum readable scale + tightest padding.
  return { S: 0.78, padY: 28 };
}

const T = Text as any;
const V = View as any;
const P = Page as any;
const D = Document as any;

function bullet(text: string, key: string, styles: ReturnType<typeof buildStyles>) {
  return React.createElement(V, { style: styles.bulletRow, key, wrap: false },
    React.createElement(T, { style: styles.bulletDot }, "\u2022"),
    React.createElement(T, { style: styles.bulletText }, text),
  );
}

function experience(e: CvExperienceEntry, idx: string, styles: ReturnType<typeof buildStyles>) {
  const titleText = e.company ? `${e.jobTitle} | ${e.company}` : e.jobTitle;
  const headerNode = React.createElement(V, { key: `${idx}h`, wrap: false },
    React.createElement(V, { style: styles.entryHeader },
      React.createElement(T, { style: styles.entryHeaderText }, titleText),
      e.dateRange ? React.createElement(T, { style: styles.entryDate }, e.dateRange) : null,
    ),
    e.location ? React.createElement(V, { style: styles.entryMeta },
      React.createElement(T, { style: styles.entryMetaText }, ""),
      React.createElement(T, { style: styles.entryMetaRight }, e.location),
    ) : null,
    // First bullet kept with header
    e.bullets[0] ? bullet(e.bullets[0], `${idx}b0`, styles) : null,
  );
  const rest = e.bullets.slice(1).map((b, i) => bullet(b, `${idx}b${i + 1}`, styles));
  return [headerNode, ...rest];
}

function education(e: CvEducationEntry, idx: string, styles: ReturnType<typeof buildStyles>) {
  const line2 = [e.fieldOfStudy, e.grade ? `GPA: ${e.grade}` : null].filter(Boolean).join(" | ");
  const head = React.createElement(V, { key: `${idx}h`, wrap: false },
    React.createElement(V, { style: styles.entryHeader },
      React.createElement(T, { style: styles.entryHeaderText },
        `${e.degree}${e.institution ? " at " + e.institution : ""}`),
      e.dateRange ? React.createElement(T, { style: styles.entryDate }, e.dateRange) : null,
    ),
    (line2 || e.location) ? React.createElement(V, { style: styles.entryMeta },
      React.createElement(T, { style: styles.entryMetaText }, line2),
      e.location ? React.createElement(T, { style: styles.entryMetaRight }, e.location) : null,
    ) : null,
  );
  const extras: any[] = [];
  for (const x of [e.activities, e.description].filter(Boolean) as string[]) {
    extras.push(bullet(x, `${idx}x${extras.length}`, styles));
  }
  return [head, ...extras];
}

function footer(f: CvFooterData, idx: string, styles: ReturnType<typeof buildStyles>) {
  const out: any[] = [];
  if (f.languages.length) {
    out.push(React.createElement(T, { key: `${idx}l`, style: styles.footerLine },
      f.languages.map(l => `${l.name}: ${l.proficiency}`).join(" | "),
    ));
  }
  if (f.interests?.length) {
    out.push(React.createElement(T, { key: `${idx}i`, style: styles.footerLine },
      React.createElement(T, { style: styles.bold }, "Personal Interests: "),
      f.interests.join(", "),
    ));
  }
  if (f.hardSkills) {
    const txt = Array.isArray(f.hardSkills)
      ? f.hardSkills.join(", ") + "."
      : Object.entries(f.hardSkills)
          .filter(([, v]) => Array.isArray(v) && v.length)
          .map(([cat, skills]) => `${cat}: ${(skills as string[]).join(", ")}`)
          .join("; ") + ".";
    out.push(React.createElement(T, { key: `${idx}s`, style: styles.footerLine },
      React.createElement(T, { style: styles.bold }, "Software Skills: "),
      txt,
    ));
  }
  return out;
}

function renderSection(s: CvSection, idx: number, styles: ReturnType<typeof buildStyles>): any[] {
  if (!s.visible || s.isEmpty) return [];
  const items: any[] = [
    React.createElement(T, { key: `s${idx}h`, style: styles.heading }, s.label),
  ];
  const d = s.data;
  if (d.kind === "summary") {
    items.push(React.createElement(T, { key: `s${idx}t`, style: styles.body }, d.text));
  } else if (d.kind === "experience" || d.kind === "entrepreneurial") {
    d.entries.forEach((e, i) => items.push(...experience(e, `s${idx}e${i}`, styles)));
  } else if (d.kind === "education") {
    d.entries.forEach((e, i) => items.push(...education(e, `s${idx}e${i}`, styles)));
  } else if (d.kind === "footer") {
    items.push(...footer(d.data, `s${idx}f`, styles));
  }
  return items;
}

function CvDoc({ data }: { data: CvData }) {
  const { S, padY } = computeFit(data);
  const styles = buildStyles(S, padY);
  const { header, sections } = data;
  const contactBits = [header.phone, header.email, header.linkedin].filter(Boolean) as string[];
  const children: any[] = [
    React.createElement(T, { key: "n", style: styles.name }, header.fullName),
  ];
  if (contactBits.length) {
    children.push(React.createElement(T, { key: "c", style: styles.contact }, contactBits.join("  |  ")));
  }
  sections.forEach((s, i) => children.push(...renderSection(s, i, styles)));
  // Wrap all content in a non-wrapping View so it cannot overflow to a second page.
  const body = React.createElement(V, { wrap: false }, ...children);
  return React.createElement(D, null,
    React.createElement(P, { size: "A4", style: styles.page, wrap: false }, body),
  );
}

export async function generateCvPdf(data: CvData) {
  const doc = React.createElement(CvDoc, { data });
  const blob = await pdf(doc as any).toBlob();
  const namePart = (data.header.fullName || "CV").replace(/\s+/g, "");
  const company = (data.companyName || "Company").replace(/[^a-zA-Z0-9]/g, "");
  const now = new Date();
  saveAs(blob, `${namePart}_CV_${company}_${MONTHS[now.getMonth()]}${now.getFullYear()}.pdf`);
}