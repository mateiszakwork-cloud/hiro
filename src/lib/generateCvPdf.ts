import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import type { CvData, CvSection, CvExperienceEntry, CvEducationEntry, CvFooterData } from "./buildCvData";
import { MONTHS } from "./cvLayout";

const MUTED = "#555555";
const RULE = "#BFBFBF";

const styles = StyleSheet.create({
  page: {
    paddingTop: 50, paddingBottom: 50, paddingHorizontal: 56,
    fontFamily: "Helvetica", fontSize: 10, color: "#000", lineHeight: 1.4,
  },
  name: { fontSize: 22, fontWeight: 700, textAlign: "center", marginBottom: 2 },
  contact: { fontSize: 9.5, textAlign: "center", color: MUTED, marginBottom: 14 },
  heading: {
    fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase",
    marginTop: 12, marginBottom: 4, paddingBottom: 2,
    borderBottomWidth: 0.5, borderBottomColor: RULE, borderBottomStyle: "solid",
  },
  body: { fontSize: 10 },
  entryHeader: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  entryHeaderText: { fontSize: 10, fontWeight: 700, flex: 1, paddingRight: 8 },
  entryDate: { fontSize: 9.5 },
  entryMeta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  entryMetaText: { fontSize: 10, flex: 1, paddingRight: 8 },
  entryMetaRight: { fontSize: 9.5, color: MUTED, textTransform: "uppercase" },
  bulletRow: { flexDirection: "row", marginTop: 1.5, paddingLeft: 8 },
  bulletDot: { width: 10, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10 },
  footerLine: { fontSize: 10, marginTop: 4 },
  bold: { fontWeight: 700 },
});

const T = Text as any;
const V = View as any;
const P = Page as any;
const D = Document as any;

function bullet(text: string, key: string) {
  return React.createElement(V, { style: styles.bulletRow, key, wrap: false },
    React.createElement(T, { style: styles.bulletDot }, "\u2022"),
    React.createElement(T, { style: styles.bulletText }, text),
  );
}

function experience(e: CvExperienceEntry, idx: string) {
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
    e.bullets[0] ? bullet(e.bullets[0], `${idx}b0`) : null,
  );
  const rest = e.bullets.slice(1).map((b, i) => bullet(b, `${idx}b${i + 1}`));
  return [headerNode, ...rest];
}

function education(e: CvEducationEntry, idx: string) {
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
    extras.push(bullet(x, `${idx}x${extras.length}`));
  }
  return [head, ...extras];
}

function footer(f: CvFooterData, idx: string) {
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

function renderSection(s: CvSection, idx: number): any[] {
  if (!s.visible || s.isEmpty) return [];
  const items: any[] = [
    React.createElement(T, { key: `s${idx}h`, style: styles.heading }, s.label),
  ];
  const d = s.data;
  if (d.kind === "summary") {
    items.push(React.createElement(T, { key: `s${idx}t`, style: styles.body }, d.text));
  } else if (d.kind === "experience" || d.kind === "entrepreneurial") {
    d.entries.forEach((e, i) => items.push(...experience(e, `s${idx}e${i}`)));
  } else if (d.kind === "education") {
    d.entries.forEach((e, i) => items.push(...education(e, `s${idx}e${i}`)));
  } else if (d.kind === "footer") {
    items.push(...footer(d.data, `s${idx}f`));
  }
  return items;
}

function CvDoc({ data }: { data: CvData }) {
  const { header, sections } = data;
  const contactBits = [header.phone, header.email, header.linkedin].filter(Boolean) as string[];
  const children: any[] = [
    React.createElement(T, { key: "n", style: styles.name }, header.fullName),
  ];
  if (contactBits.length) {
    children.push(React.createElement(T, { key: "c", style: styles.contact }, contactBits.join("  |  ")));
  }
  sections.forEach((s, i) => children.push(...renderSection(s, i)));
  return React.createElement(D, null, React.createElement(P, { size: "A4", style: styles.page }, ...children));
}

export async function generateCvPdf(data: CvData) {
  const doc = React.createElement(CvDoc, { data });
  const blob = await pdf(doc as any).toBlob();
  const namePart = (data.header.fullName || "CV").replace(/\s+/g, "");
  const company = (data.companyName || "Company").replace(/[^a-zA-Z0-9]/g, "");
  const now = new Date();
  saveAs(blob, `${namePart}_CV_${company}_${MONTHS[now.getMonth()]}${now.getFullYear()}.pdf`);
}