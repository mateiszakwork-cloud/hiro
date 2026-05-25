import React from "react";
import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import { saveAs } from "file-saver";
import type { CvData } from "./buildCvData";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (m: number, y: number) => `${MONTHS[m - 1] || ""} ${y}`;
const RED = "#950606";
const MUTED = "#555555";

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#000",
    lineHeight: 1.35,
  },
  name: { fontSize: 20, fontWeight: 700, textAlign: "center" },
  contact: { fontSize: 9.5, textAlign: "center", color: MUTED, marginTop: 2, marginBottom: 8 },
  sectionHeading: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 4,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: RED,
    borderBottomStyle: "solid",
  },
  body: { fontSize: 10 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  jobTitle: { fontSize: 10.5, fontWeight: 700 },
  meta: { fontSize: 10, color: "#000" },
  metaMuted: { fontSize: 9.5, color: MUTED },
  expHeader: { marginTop: 6 },
  bulletRow: { flexDirection: "row", marginTop: 2, paddingLeft: 4 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1, fontSize: 10 },
  footerSection: { marginTop: 8 },
  footerLabel: { fontSize: 9, fontWeight: 700, color: MUTED },
});

const T = Text as any;
const V = View as any;
const P = Page as any;
const D = Document as any;

function bullet(text: string, key: string | number) {
  return React.createElement(V, { style: styles.bulletRow, key },
    React.createElement(T, { style: styles.bulletDot }, "\u2022"),
    React.createElement(T, { style: styles.bulletText }, text),
  );
}

function section(title: string) {
  return React.createElement(T, { style: styles.sectionHeading }, title);
}

function CvDoc({ data }: { data: CvData }) {
  const {
    fullName, email, location, summary,
    workExperiences, volunteering, education, languages,
    interests, awards, selectedBullets, selectedHardSkills,
  } = data;

  const contactParts = [email, location].filter(Boolean).join("  •  ");
  const children: any[] = [];

  children.push(React.createElement(T, { style: styles.name, key: "name" }, fullName || "Your Name"));
  if (contactParts) {
    children.push(React.createElement(T, { style: styles.contact, key: "contact" }, contactParts));
  }

  if (summary) {
    children.push(React.createElement(React.Fragment, { key: "sum" },
      section("Summary"),
      React.createElement(T, { style: styles.body }, summary),
    ));
  }

  if (workExperiences?.length) {
    const items: any[] = [section("Professional Experience")];
    workExperiences.forEach((exp, i) => {
      const bullets = (selectedBullets && selectedBullets[exp.company_name]) || exp.bullet_points || [];
      const dateStr = `${fmtDate(exp.start_month, exp.start_year)} – ${exp.is_current ? "Present" : exp.end_month && exp.end_year ? fmtDate(exp.end_month, exp.end_year) : ""}`;
      items.push(React.createElement(V, { style: styles.expHeader, key: `e${i}` },
        React.createElement(V, { style: styles.row },
          React.createElement(T, { style: styles.jobTitle }, exp.job_title),
          React.createElement(T, { style: styles.meta }, dateStr),
        ),
        React.createElement(V, { style: styles.row },
          React.createElement(T, { style: styles.meta }, exp.company_name),
          exp.location ? React.createElement(T, { style: styles.metaMuted }, exp.location) : null,
        ),
        ...bullets.map((b: string, j: number) => bullet(b, `e${i}b${j}`)),
      ));
    });
    children.push(React.createElement(React.Fragment, { key: "exp" }, ...items));
  }

  if (volunteering?.length) {
    const items: any[] = [section("Entrepreneurial & Volunteer Experience")];
    volunteering.forEach((v, i) => {
      const dateStr = v.start_year ? `${v.start_year} – ${v.is_ongoing ? "Present" : v.end_year || ""}` : "";
      const title = v.role || v.organization;
      const org = v.role ? v.organization : "";
      items.push(React.createElement(V, { style: styles.expHeader, key: `v${i}` },
        React.createElement(V, { style: styles.row },
          React.createElement(T, { style: styles.jobTitle }, title),
          dateStr ? React.createElement(T, { style: styles.meta }, dateStr) : null,
        ),
        org ? React.createElement(T, { style: styles.meta }, org) : null,
        v.description ? React.createElement(T, { style: styles.body }, v.description) : null,
      ));
    });
    children.push(React.createElement(React.Fragment, { key: "vol" }, ...items));
  }

  if (education?.length) {
    const items: any[] = [section("Education")];
    education.forEach((edu, i) => {
      const dateStr = `${edu.start_year} – ${edu.is_expected ? "Expected" : edu.end_year || ""}`;
      items.push(React.createElement(V, { style: styles.expHeader, key: `ed${i}` },
        React.createElement(V, { style: styles.row },
          React.createElement(T, { style: styles.jobTitle }, edu.institution),
          React.createElement(T, { style: styles.meta }, dateStr),
        ),
        React.createElement(T, { style: styles.meta }, `${edu.degree} in ${edu.field_of_study}`),
        edu.grade ? React.createElement(T, { style: styles.metaMuted }, `GPA: ${edu.grade}`) : null,
        edu.activities ? React.createElement(T, { style: styles.body }, edu.activities) : null,
        edu.description ? React.createElement(T, { style: styles.body }, edu.description) : null,
      ));
    });
    children.push(React.createElement(React.Fragment, { key: "edu" }, ...items));
  }

  if (awards?.length) {
    const items: any[] = [section("Awards & Honours")];
    awards.forEach((a, i) => {
      const text = `${a.award_name}${a.issuing_organization ? ` — ${a.issuing_organization}` : ""}${a.year ? ` (${a.year})` : ""}`;
      items.push(React.createElement(T, { key: `a${i}`, style: styles.body }, text));
    });
    children.push(React.createElement(React.Fragment, { key: "aw" }, ...items));
  }

  // Footer block: languages, skills, interests
  if (languages?.length) {
    children.push(React.createElement(V, { style: styles.footerSection, key: "lang" },
      section("Languages"),
      ...languages.map((l: any, i: number) => React.createElement(T, { key: i, style: styles.body },
        `${l.language_name} `,
        React.createElement(T, { style: { color: MUTED } }, `(${l.proficiency})`),
      )),
    ));
  }

  if (selectedHardSkills) {
    const skillItems: any[] = [section("Software & Skills")];
    if (!Array.isArray(selectedHardSkills)) {
      Object.entries(selectedHardSkills).forEach(([cat, skills], i) => {
        skillItems.push(React.createElement(T, { key: `s${i}`, style: styles.body },
          React.createElement(T, { style: styles.footerLabel }, `${cat}: `),
          (skills as string[]).join(", "),
        ));
      });
    } else {
      skillItems.push(React.createElement(T, { key: "sa", style: styles.body }, selectedHardSkills.join(", ")));
    }
    children.push(React.createElement(V, { style: styles.footerSection, key: "skills" }, ...skillItems));
  }

  if (interests?.length) {
    children.push(React.createElement(V, { style: styles.footerSection, key: "int" },
      section("Personal Interests"),
      React.createElement(T, { style: styles.body }, interests.join(", ")),
    ));
  }

  return React.createElement(D, null, React.createElement(P, { size: "A4", style: styles.page }, ...children));
}

export async function generateCvPdf(data: CvData) {
  const doc = React.createElement(CvDoc, { data });
  const blob = await pdf(doc as any).toBlob();

  const namePart = (data.fullName || "CV").replace(/\s+/g, "");
  const company = (data.companyName || "Company").replace(/[^a-zA-Z0-9]/g, "");
  const now = new Date();
  const monthStr = MONTHS[now.getMonth()];
  const yearStr = now.getFullYear();
  saveAs(blob, `${namePart}_CV_${company}_${monthStr}${yearStr}.pdf`);
}