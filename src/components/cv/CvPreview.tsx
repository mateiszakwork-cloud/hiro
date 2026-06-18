import type { CvData, CvSection } from "@/lib/buildCvData";

// HTML preview matching the canonical export layout (monochrome, A4 proportions).
// Visual rules kept in lockstep with generateCvDocx / generateCvPdf.

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-5 mb-1.5 pb-1 border-b border-neutral-300 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-900">
      {children}
    </h3>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="list-disc pl-4 mt-1 space-y-0.5 text-[10px] leading-[1.45] text-neutral-900 marker:text-neutral-500">
      {items.map((b, i) => <li key={i}>{b}</li>)}
    </ul>
  );
}

function EntryHeader({ left, right, leftBold = true }: { left: string; right?: string | null; leftBold?: boolean }) {
  return (
    <div className="flex justify-between items-baseline gap-3 mt-2.5">
      <span className={`text-[10px] ${leftBold ? "font-bold" : ""} text-neutral-900`}>{left}</span>
      {right ? <span className="text-[9.5px] text-neutral-600 whitespace-nowrap">{right}</span> : null}
    </div>
  );
}

function renderSection(s: CvSection) {
  if (!s.visible || s.isEmpty) return null;
  const d = s.data;
  return (
    <section key={s.id}>
      <Heading>{s.label}</Heading>
      {d.kind === "experience" && d.entries.map((e, i) => (
        <div key={i} className="mb-1.5">
          <EntryHeader
            left={[e.jobTitle, e.company].filter(Boolean).join(" | ")}
            right={e.dateRange || null}
          />
          {e.location && (
            <div className="flex justify-end mt-0.5">
              <span className="text-[9px] uppercase tracking-wider text-neutral-500">{e.location}</span>
            </div>
          )}
          <Bullets items={e.bullets} />
        </div>
      ))}
      {d.kind === "education" && d.entries.map((e, i) => {
        const line2 = [e.fieldOfStudy, e.grade ? `GPA: ${e.grade}` : null].filter(Boolean).join(" | ");
        const leftHead = [e.degree, e.institution].filter(Boolean).join(" at ");
        return (
          <div key={i} className="mb-1.5">
            <EntryHeader
              left={leftHead}
              right={e.dateRange || null}
            />
            {(line2 || e.location) && (
              <div className="flex justify-between items-baseline gap-3">
                <span className="text-[10px] text-neutral-900">{line2}</span>
                {e.location && <span className="text-[9px] uppercase tracking-wider text-neutral-500 whitespace-nowrap">{e.location}</span>}
              </div>
            )}
            {(e.activities || e.description) && (
              <Bullets items={[e.activities, e.description].filter(Boolean) as string[]} />
            )}
          </div>
        );
      })}
      {d.kind === "languages" && (
        <p className="text-[10px] mt-1.5 text-neutral-900">
          {d.entries.map(l => `${l.name}: ${l.proficiency}`).join(" | ")}
        </p>
      )}
      {d.kind === "hardSkills" && d.data.length > 0 && (
        <p className="text-[10px] mt-1.5 leading-[1.5] text-neutral-900">
          {d.data.join(", ")}.
        </p>
      )}
      {d.kind === "softSkills" && d.items.length > 0 && (
        <p className="text-[10px] mt-1.5 leading-[1.5] text-neutral-900">{d.items.join(", ")}.</p>
      )}
    </section>
  );
}

export default function CvPreview({ data }: { data: CvData }) {
  const { header, sections } = data;
  // Canonical header: name on top, then a single muted line of
  // location · phone · email · linkedin. Falsy values collapse cleanly so the
  // line never shows double separators or trailing pipes.
  const contactBits = [header.location, header.phone, header.email, header.linkedin]
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  return (
    <div className="mx-auto bg-white text-neutral-900" style={{ width: "210mm", minHeight: "297mm", padding: "18mm 20mm", fontFamily: "Helvetica, Arial, sans-serif" }}>
      <h1 className="text-center font-bold text-[22px] tracking-tight mb-1">{header.fullName}</h1>
      {contactBits.length > 0 && (
        <p className="text-center text-[9.5px] text-neutral-600 mb-4">{contactBits.join("  ·  ")}</p>
      )}
      {sections.map(renderSection)}
    </div>
  );
}