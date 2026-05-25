import type { CvData, CvSection } from "@/lib/buildCvData";

// HTML preview matching the canonical export layout (monochrome, A4 proportions).
// Visual rules kept in lockstep with generateCvDocx / generateCvPdf.

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 mb-1 pb-1 border-b border-neutral-300 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-900">
      {children}
    </h3>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-[10px] leading-[1.4] text-neutral-900">
      {items.map((b, i) => <li key={i}>{b}</li>)}
    </ul>
  );
}

function EntryHeader({ left, right, leftBold = true }: { left: string; right?: string | null; leftBold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-2 mt-2">
      <span className={`text-[10px] ${leftBold ? "font-bold" : ""} text-neutral-900`}>{left}</span>
      {right ? <span className="text-[9.5px] text-neutral-700 whitespace-nowrap">{right}</span> : null}
    </div>
  );
}

function renderSection(s: CvSection) {
  if (!s.visible || s.isEmpty) return null;
  const d = s.data;
  return (
    <section key={s.id}>
      <Heading>{s.label}</Heading>
      {d.kind === "summary" && (
        <p className="text-[10px] leading-[1.45] text-neutral-900">{d.text}</p>
      )}
      {(d.kind === "experience" || d.kind === "entrepreneurial") && d.entries.map((e, i) => (
        <div key={i} className="mb-1">
          <EntryHeader left={e.company ? `${e.jobTitle} | ${e.company}` : e.jobTitle} right={e.dateRange} />
          {e.location && (
            <div className="flex justify-end">
              <span className="text-[9px] uppercase text-neutral-500">{e.location}</span>
            </div>
          )}
          <Bullets items={e.bullets} />
        </div>
      ))}
      {d.kind === "education" && d.entries.map((e, i) => {
        const line2 = [e.fieldOfStudy, e.grade ? `GPA: ${e.grade}` : null].filter(Boolean).join(" | ");
        return (
          <div key={i} className="mb-1">
            <EntryHeader
              left={`${e.degree}${e.institution ? " at " + e.institution : ""}`}
              right={e.dateRange}
            />
            <div className="flex justify-between items-baseline gap-2">
              <span className="text-[10px] text-neutral-900">{line2}</span>
              {e.location && <span className="text-[9px] uppercase text-neutral-500 whitespace-nowrap">{e.location}</span>}
            </div>
            {(e.activities || e.description) && (
              <Bullets items={[e.activities, e.description].filter(Boolean) as string[]} />
            )}
          </div>
        );
      })}
      {d.kind === "footer" && (
        <div className="space-y-1 mt-1">
          {d.data.languages.length > 0 && (
            <p className="text-[10px]">
              {d.data.languages.map(l => `${l.name}: ${l.proficiency}`).join(" | ")}
            </p>
          )}
          {d.data.interests?.length > 0 && (
            <p className="text-[10px]"><span className="font-bold">Personal Interests:</span> {d.data.interests.join(", ")}</p>
          )}
          {d.data.hardSkills && (
            <p className="text-[10px]">
              <span className="font-bold">Software Skills:</span>{" "}
              {Array.isArray(d.data.hardSkills)
                ? d.data.hardSkills.join(", ") + "."
                : Object.entries(d.data.hardSkills)
                    .filter(([, v]) => Array.isArray(v) && v.length)
                    .map(([cat, skills]) => `${cat}: ${(skills as string[]).join(", ")}`)
                    .join("; ") + "."}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export default function CvPreview({ data }: { data: CvData }) {
  const { header, sections } = data;
  const contactBits = [header.phone, header.email, header.linkedin].filter(Boolean) as string[];
  return (
    <div className="mx-auto bg-white text-neutral-900" style={{ width: "210mm", minHeight: "297mm", padding: "18mm 20mm", fontFamily: "Helvetica, Arial, sans-serif" }}>
      <h1 className="text-center font-bold text-[22px] mb-0.5">{header.fullName}</h1>
      {contactBits.length > 0 && (
        <p className="text-center text-[9.5px] text-neutral-600 mb-3">{contactBits.join("  |  ")}</p>
      )}
      {sections.map(renderSection)}
    </div>
  );
}