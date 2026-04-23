import { useState, useMemo, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Download, RotateCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import { saveAs } from "file-saver";

type ExtraQ = { id: string; question: string; answer: string; insertAfter: string };
type RoleQ = { id: string; question: string; answer: string };

type Answers = {
  q1: string; q2: string; q3: string; q4: string; q5: string;
  q6: string; q7: string; q8: string;
  section1_extra: ExtraQ[];
  role_specific: RoleQ[];
};

const FIXED_QUESTIONS: { id: keyof Answers | "q1"|"q2"|"q3"|"q4"|"q5"|"q6"|"q7"|"q8"; label: string; newsDisclaimer?: boolean }[] = [
  { id: "q1", label: "Tell me about the company" },
  { id: "q2", label: "The role and its responsibilities, and how it fits in the big picture" },
  { id: "q3", label: "Tell me about yourself (2-minute pitch)" },
  { id: "q4", label: "Why are you applying for this role?" },
  { id: "q5", label: "Why are you applying to this company?" },
  { id: "q6", label: "Recent company news that interests you", newsDisclaimer: true },
  { id: "q7", label: "Recent industry news that interests you", newsDisclaimer: true },
  { id: "q8", label: "Questions to ask the interviewer" },
];

const REQUEST_QUESTIONS = [
  ...FIXED_QUESTIONS.map((q) => ({ id: q.id, label: q.label, ...(q.newsDisclaimer ? { newsDisclaimer: true } : {}) })),
  { id: "role_specific", label: "Generate role-specific questions and answers" },
];

interface Props {
  jobId: string;
  jobTitle: string;
  companyName: string;
  jobDescription: string;
  cvSummary: string;
  questionBank?: Array<{ question: string; category: string; suggested_answer_framework?: string }>;
}

/* ── Auto-growing textarea ── */
function AutoTextarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full resize-none border border-border/60 rounded-lg px-4 py-3 text-[15px] leading-relaxed bg-background focus:outline-none focus:ring-1 focus:ring-[#950606]/40 focus:border-[#950606]/50 font-normal text-foreground placeholder:text-muted-foreground/60 overflow-hidden"
      style={{ minHeight: "80px", fontFamily: "inherit" }}
    />
  );
}

/* ── Question block (used by Section 1, extras, and role-specific) ── */
function QuestionBlock({
  number,
  title,
  value,
  onChange,
  onRegenerate,
  regenerating,
  newsDisclaimer,
  hasGenerated,
}: {
  number: string;
  title: string;
  value: string;
  onChange: (v: string) => void;
  onRegenerate: () => void;
  regenerating: boolean;
  newsDisclaimer?: boolean;
  hasGenerated: boolean;
}) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-foreground text-[15px]">
        <span className="text-muted-foreground font-medium mr-2">{number}</span>
        {title}
      </h3>
      <AutoTextarea
        value={value}
        onChange={onChange}
        placeholder={hasGenerated ? "" : "Click Generate All to create your answer"}
      />
      {newsDisclaimer && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            <strong>AI knowledge may be outdated.</strong> Verify these before your interview and replace with current news you find.
          </span>
        </div>
      )}
      {hasGenerated && (
        <button
          onClick={onRegenerate}
          disabled={regenerating}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-[#950606] transition-colors disabled:opacity-50"
        >
          {regenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
          {regenerating ? "Regenerating..." : "Regenerate"}
        </button>
      )}
    </div>
  );
}

const CAT_COLORS: Record<string, string> = {
  Behavioral: "bg-blue-100 text-blue-700",
  Technical: "bg-purple-100 text-purple-700",
  Motivational: "bg-green-100 text-green-700",
  Situational: "bg-orange-100 text-orange-700",
};

export default function InterviewPrepTab({ jobId, jobTitle, companyName, jobDescription, cvSummary, questionBank = [] }: Props) {
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const userIdRef = useRef<string | null>(null);

  const hasGenerated = !!answers;

  /* ── Load saved answers on mount / jobId change ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid || !jobId) {
        setHydrated(true);
        return;
      }
      userIdRef.current = uid;
      const { data, error: loadErr } = await supabase
        .from("interview_prep_answers")
        .select("answers, section1_extra, role_specific")
        .eq("user_id", uid)
        .eq("job_id", jobId)
        .maybeSingle();
      if (cancelled) return;
      if (!loadErr && data && data.answers && Object.keys(data.answers as object).length > 0) {
        const a = (data.answers ?? {}) as Partial<Answers>;
        setAnswers({
          q1: a.q1 || "", q2: a.q2 || "", q3: a.q3 || "", q4: a.q4 || "",
          q5: a.q5 || "", q6: a.q6 || "", q7: a.q7 || "", q8: a.q8 || "",
          section1_extra: (data.section1_extra as ExtraQ[]) || [],
          role_specific: (data.role_specific as RoleQ[]) || [],
        });
      }
      setHydrated(true);
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  /* ── Persist answers (immediate after generate, debounced on edit) ── */
  const persistAnswers = async (a: Answers) => {
    const uid = userIdRef.current;
    if (!uid || !jobId) return;
    const { q1, q2, q3, q4, q5, q6, q7, q8, section1_extra, role_specific } = a;
    await supabase
      .from("interview_prep_answers")
      .upsert(
        {
          user_id: uid,
          job_id: jobId,
          answers: { q1, q2, q3, q4, q5, q6, q7, q8 },
          section1_extra,
          role_specific,
        },
        { onConflict: "user_id,job_id" }
      );
  };

  /* ── Debounced auto-save on edits ── */
  useEffect(() => {
    if (!hydrated || !answers) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      persistAnswers(answers);
    }, 1000);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, hydrated]);

  const callFn = async (body: any) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    return supabase.functions.invoke("generate-interview-prep", {
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  };

  const handleGenerateAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await callFn({
        jobTitle, companyName, jobDescription, cvSummary,
        questions: REQUEST_QUESTIONS,
      });
      if (fnErr || !data?.success) {
        setError("Generation failed. Please try again.");
        setLoading(false);
        return;
      }
      setAnswers(data.answers as Answers);
      toast.success("Interview prep generated");
    } catch {
      setError("Generation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (questionId: string, label: string, newsDisclaimer?: boolean) => {
    setRegenerating(questionId);
    try {
      const { data, error: fnErr } = await callFn({
        jobTitle, companyName, jobDescription, cvSummary,
        questions: [{ id: questionId, label, ...(newsDisclaimer ? { newsDisclaimer: true } : {}) }],
        regenerateOnly: questionId,
      });
      if (fnErr || !data?.success) {
        toast.error("Could not regenerate. Please try again.");
        return;
      }
      const newAnswer = data.answer || "";
      setAnswers((prev) => {
        if (!prev) return prev;
        if (questionId.startsWith("rs")) {
          return { ...prev, role_specific: prev.role_specific.map((r) => r.id === questionId ? { ...r, answer: newAnswer } : r) };
        }
        if (questionId.startsWith("extra")) {
          return { ...prev, section1_extra: prev.section1_extra.map((r) => r.id === questionId ? { ...r, answer: newAnswer } : r) };
        }
        return { ...prev, [questionId]: newAnswer } as Answers;
      });
    } catch {
      toast.error("Could not regenerate. Please try again.");
    } finally {
      setRegenerating(null);
    }
  };

  const updateAnswer = (questionId: string, val: string) => {
    setAnswers((prev) => {
      if (!prev) return prev;
      if (questionId.startsWith("rs")) {
        return { ...prev, role_specific: prev.role_specific.map((r) => r.id === questionId ? { ...r, answer: val } : r) };
      }
      if (questionId.startsWith("extra")) {
        return { ...prev, section1_extra: prev.section1_extra.map((r) => r.id === questionId ? { ...r, answer: val } : r) };
      }
      return { ...prev, [questionId]: val } as Answers;
    });
  };

  /* ── Build the visual order for Section 1 with extras inserted ── */
  const section1Items = useMemo(() => {
    const items: Array<
      | { kind: "fixed"; q: typeof FIXED_QUESTIONS[number]; idx: number }
      | { kind: "extra"; q: ExtraQ }
    > = [];
    FIXED_QUESTIONS.forEach((fq, i) => {
      items.push({ kind: "fixed", q: fq, idx: i });
      const extras = answers?.section1_extra?.filter((e) => e.insertAfter === fq.id) || [];
      extras.forEach((e) => items.push({ kind: "extra", q: e }));
    });
    return items;
  }, [answers]);

  /* ── Word export ── */
  const handleDownloadWord = async () => {
    if (!answers) return;

    const bulletParas = (text: string) =>
      text
        .split("\n")
        .map((l) => l.replace(/^[-•]\s*/, "").trim())
        .filter(Boolean)
        .map(
          (l) =>
            new Paragraph({
              text: l,
              bullet: { level: 0 },
            })
        );

    const blank = () => new Paragraph({ children: [new TextRun("")] });

    const sectionHeading = (text: string) =>
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 32 })], // 16pt
        spacing: { before: 320, after: 160 },
      });

    const questionHeading = (text: string) =>
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 24 })], // 12pt
        spacing: { before: 200, after: 100 },
      });

    const italicNote = (text: string) =>
      new Paragraph({
        children: [new TextRun({ text, italics: true, size: 20, color: "92400E" })],
        spacing: { after: 120 },
      });

    const children: Paragraph[] = [];

    // Title
    children.push(
      new Paragraph({
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: `Interview Prep — ${jobTitle} at ${companyName}`,
            bold: true,
            size: 40, // 20pt
          }),
        ],
        spacing: { after: 240 },
      })
    );

    // Section 1
    children.push(sectionHeading("Core Prep Questions"));
    let qNum = 1;
    section1Items.forEach((item) => {
      if (item.kind === "fixed") {
        const fq = item.q;
        const ans = (answers as any)[fq.id] as string;
        children.push(questionHeading(`Q${qNum}. ${fq.label}`));
        bulletParas(ans).forEach((p) => children.push(p));
        if (fq.newsDisclaimer) {
          children.push(italicNote("⚠️ AI knowledge may be outdated. Verify before your interview."));
        }
        children.push(blank());
        qNum++;
      } else {
        children.push(questionHeading(`Q${qNum}. ${item.q.question}`));
        bulletParas(item.q.answer).forEach((p) => children.push(p));
        children.push(blank());
        qNum++;
      }
    });

    // Section 2
    children.push(sectionHeading("Role-Specific Questions"));
    answers.role_specific.forEach((r, i) => {
      children.push(questionHeading(`${i + 1}. ${r.question}`));
      bulletParas(r.answer).forEach((p) => children.push(p));
      children.push(blank());
    });

    // Section 3
    if (questionBank.length > 0) {
      children.push(sectionHeading("Question Bank"));
      const grouped: Record<string, typeof questionBank> = {};
      questionBank.forEach((q) => {
        const cat = (q.category || "Other").toUpperCase();
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(q);
      });
      ["BEHAVIORAL", "SITUATIONAL", "TECHNICAL", "MOTIVATIONAL"].forEach((cat) => {
        if (!grouped[cat]?.length) return;
        children.push(
          new Paragraph({
            children: [new TextRun({ text: cat, bold: true, size: 24 })],
            spacing: { before: 200, after: 100 },
          })
        );
        grouped[cat].forEach((q) => {
          children.push(new Paragraph({ children: [new TextRun({ text: q.question, size: 22 })], spacing: { after: 80 } }));
        });
        children.push(blank());
      });
    }

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 12240, height: 15840 },
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
            },
          },
          children,
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const safeCompany = (companyName || "Company").replace(/\s+/g, "_").replace(/[^\w-]/g, "");
    const safeTitle = (jobTitle || "Role").replace(/\s+/g, "_").replace(/[^\w-]/g, "");
    saveAs(blob, `Interview_Prep_${safeCompany}_${safeTitle}.docx`);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Top action bar */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Button
            onClick={handleGenerateAll}
            disabled={loading}
            className="gap-2"
            style={{ backgroundColor: "#950606" }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {hasGenerated ? "Regenerate All" : "Generate All"}
          </Button>
          <Button
            onClick={handleDownloadWord}
            disabled={!hasGenerated || loading}
            variant="outline"
            className="gap-2"
          >
            <Download className="h-4 w-4" /> Download as Word
          </Button>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Generating your interview prep...</span>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Section 1 */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-foreground border-b pb-2">Core Prep Questions</h2>
        {(() => {
          let qNum = 0;
          return section1Items.map((item) => {
            qNum++;
            if (item.kind === "fixed") {
              const fq = item.q;
              const val = (answers as any)?.[fq.id] || "";
              return (
                <QuestionBlock
                  key={fq.id}
                  number={`Q${qNum}.`}
                  title={fq.label}
                  value={val}
                  onChange={(v) => updateAnswer(fq.id, v)}
                  onRegenerate={() => handleRegenerate(fq.id, fq.label, fq.newsDisclaimer)}
                  regenerating={regenerating === fq.id}
                  newsDisclaimer={fq.newsDisclaimer}
                  hasGenerated={hasGenerated}
                />
              );
            }
            return (
              <QuestionBlock
                key={item.q.id}
                number={`Q${qNum}.`}
                title={item.q.question}
                value={item.q.answer}
                onChange={(v) => updateAnswer(item.q.id, v)}
                onRegenerate={() => handleRegenerate(item.q.id, item.q.question)}
                regenerating={regenerating === item.q.id}
                hasGenerated={hasGenerated}
              />
            );
          });
        })()}
      </section>

      {/* Section 2 */}
      <section className="space-y-6">
        <div className="border-b pb-2">
          <h2 className="text-xl font-bold text-foreground">Role-Specific Questions</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generated based on your specific role at {companyName}
          </p>
        </div>
        {!hasGenerated && (
          <p className="text-sm text-muted-foreground italic">
            Click Generate All to create role-specific questions tailored to this position.
          </p>
        )}
        {hasGenerated &&
          answers!.role_specific.map((r, i) => (
            <QuestionBlock
              key={r.id}
              number={`${i + 1}.`}
              title={r.question}
              value={r.answer}
              onChange={(v) => updateAnswer(r.id, v)}
              onRegenerate={() => handleRegenerate(r.id, r.question)}
              regenerating={regenerating === r.id}
              hasGenerated={hasGenerated}
            />
          ))}
      </section>

      {/* Section 3 — Question Bank (preserved as-is) */}
      {questionBank.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-foreground border-b pb-2">Question Bank</h2>
          <div className="space-y-2">
            {questionBank.map((q, i) => (
              <details key={i} className="border rounded-lg px-4 py-2 group">
                <summary className="cursor-pointer flex items-center gap-3 py-1 list-none">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${
                      CAT_COLORS[q.category] || "bg-muted text-muted-foreground"
                    }`}
                  >
                    {q.category}
                  </span>
                  <span className="text-sm font-medium text-foreground">{q.question}</span>
                </summary>
                {q.suggested_answer_framework && (
                  <div className="pt-2 pb-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {q.suggested_answer_framework}
                  </div>
                )}
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
