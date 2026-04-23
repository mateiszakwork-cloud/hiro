import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ success: false, error: "Missing OPENAI_API_KEY" }, 500);

    const body = await req.json();
    const { jobTitle, companyName, jobDescription, cvSummary, questions, regenerateOnly } = body || {};

    if (!jobTitle || !companyName) {
      return json({ success: false, error: "Missing required fields: jobTitle, companyName" }, 400);
    }

    const systemPrompt = `You are a brutally honest interview coach preparing a candidate for a real job interview. Your job is to write interview prep notes that are specific, credible, and human-sounding.

Rules you must follow without exception:
- NEVER use these phrases or anything like them: "I am passionate about", "I am excited by", "I am eager to", "aligns with my values", "I am driven by", "leverage", "dynamic", "innovative", "synergy", "I have always been fascinated by", "this opportunity resonates with me"
- Write in first person as the candidate, in a direct and natural tone — like someone who actually knows what they are talking about, not someone trying to impress
- Every bullet must be concrete and specific — name actual things from the job description, company, or CV. Never write a bullet that could apply to any candidate at any company
- For motivation questions: dig into what is genuinely interesting or relevant about this specific role and company based on the data provided. Reference specific responsibilities, specific products, specific business challenges, or specific aspects of the CV
- Bullet points should be dense with information — not padded, not vague
- Write like prep notes, not a cover letter
- Every bullet must start with "- " (hyphen + space). Never use em-dashes or en-dashes as bullet markers.
- Return only valid JSON, no text outside it`;

    // Build user prompt
    const isRegenerate = regenerateOnly && typeof regenerateOnly === "string";

    let userPrompt = `JOB TITLE: ${jobTitle}
COMPANY: ${companyName}

JOB DESCRIPTION:
${jobDescription || "(not provided)"}

APPLICANT CV SUMMARY:
${cvSummary || "(not provided)"}

`;

    if (isRegenerate) {
      // Regenerate a single answer — return { answer: "...bullets..." }
      const q = (questions || []).find((x: any) => x.id === regenerateOnly) || { id: regenerateOnly, label: regenerateOnly };
      userPrompt += `Regenerate ONLY the bullet-point answer for this question:
ID: ${q.id}
QUESTION: ${q.label || q.question || regenerateOnly}

Return JSON in this exact shape:
{ "answer": "- bullet\\n- bullet\\n- bullet" }

Each bullet starts with "- ". 3-7 bullets depending on the question type. Be specific to this job, company, and applicant.`;
      if (q.newsDisclaimer || regenerateOnly === "q6" || regenerateOnly === "q7") {
        userPrompt += `\nThe last bullet MUST be exactly: "- Note: verify with current sources before your interview"`;
      }
    } else {
      userPrompt += `Generate interview prep answers as a JSON object with this exact shape:

{
  "answers": {
    "q1": "- bullet\\n- bullet",
    "q2": "- bullet\\n- bullet",
    "q3": "- bullet\\n- bullet",
    "q4": "- bullet\\n- bullet",
    "q5": "- bullet\\n- bullet",
    "q6": "- bullet\\n- bullet\\n- Verify all of the above with current sources — this may be outdated.",
    "q7": "- bullet\\n- bullet\\n- Verify all of the above with current sources — this may be outdated.",
    "q8": "- bullet\\n- bullet",
    "section1_extra": [
      { "id": "extra1", "question": "...", "answer": "- bullet\\n- bullet", "insertAfter": "q3" }
    ],
    "role_specific": [
      { "id": "rs1", "question": "...", "answer": "- bullet\\n- bullet" }
    ]
  }
}

Per-question guidelines (follow exactly):

- q1 — Tell me about the company: 6-8 bullets. Name specific products, brands, revenue scale if known, market position, business model, key competitors, anything notable from the job posting. Factual and specific.

- q2 — The role and its responsibilities: 5-7 bullets drawn directly from the job description. What does this role actually do day to day? What team does it sit in? What does success look like? How does it connect to company strategy? Quote or closely paraphrase specific responsibilities from the job description.

- q3 — Tell me about yourself (2-minute pitch): 7-9 bullets structured as: (1) current degree, university, and what it covers that is relevant, (2-3) most relevant past experiences from CV with specific details — company name, what you actually did, concrete outcome if possible, (4) a specific skill or project that directly maps to something in this job description, (5) what stage you are at and what specifically you are looking for — name the type of work, not just a challenge. Long enough to fill 2 minutes when spoken.

- q4 — Why this role: 4-5 bullets. Each bullet must reference a specific responsibility or requirement from the job description and connect it to something specific in the CV. No generic motivation. Format: "The focus on [specific thing from JD] maps directly to my experience with [specific thing from CV]".

- q5 — Why this company: 4-5 bullets. Must reference specific things about this company — a specific product line, a specific market position, a specific strategic move, something about how they operate. At least one bullet must reference something that makes this company different from its direct competitors. No generic sustainability or innovation talking points unless the JD specifically names them concretely.

- q6 — Recent company news: 3 bullets of specific real or highly plausible news about this company up to training cutoff. Name actual events, product launches, leadership changes, or strategic moves. The LAST bullet MUST be exactly: "- Verify all of the above with current sources — this may be outdated."

- q7 — Recent industry news: 3 bullets of specific trends or developments in the relevant industry. Be specific about the trend, not vague. The LAST bullet MUST be exactly: "- Verify all of the above with current sources — this may be outdated."

- q8 — Questions to ask the interviewer: 6-7 questions, each specific to this exact role and company. Include: what does success look like in the first 6 months, how does this team interact with [specific other team mentioned in JD], what is the biggest challenge this team is currently facing, one strategic question about the company's direction that shows you understand their business.

- section1_extra: 0-3 role-relevant insertions. Each object has "insertAfter" set to the q-id it should come after (e.g. "q3" or "q5"). Return empty array if none needed.

- role_specific: 3-5 behavioral or situational questions the interviewer is likely to ask for this specific role type. For each, provide a STAR-structured answer (Situation/Task → Action → Result) in bullet format, using specific details from the CV where possible. Tailor questions to the role — brand management, consulting, finance, operations, etc. Examples: "Tell me about a time you had to analyze data to make a decision", "Walk me through a project where you worked cross-functionally", "Give me an example of when you managed competing priorities."

Bullet formatting: every bullet starts with "- " (hyphen + space). Never use em-dashes or en-dashes as bullet markers. Output ONLY the JSON object, nothing else.`;
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.6,
        max_tokens: 4000,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      return json({ success: false, error: `AI error (${openaiRes.status})` }, 500);
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content || "{}";
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      return json({ success: false, error: "AI returned invalid JSON. Please try again." }, 500);
    }

    if (isRegenerate) {
      return json({ success: true, answer: parsed.answer || "" });
    }

    // Normalize bullet symbols: ensure each line starts with "- "
    const normalize = (s: any): string => {
      if (typeof s !== "string") return "";
      return s
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => (l.startsWith("- ") ? l : l.startsWith("-") ? "- " + l.slice(1).trim() : l.startsWith("•") ? "- " + l.slice(1).trim() : "- " + l))
        .join("\n");
    };

    const answers = parsed.answers || {};
    const out: any = {
      q1: normalize(answers.q1),
      q2: normalize(answers.q2),
      q3: normalize(answers.q3),
      q4: normalize(answers.q4),
      q5: normalize(answers.q5),
      q6: normalize(answers.q6),
      q7: normalize(answers.q7),
      q8: normalize(answers.q8),
      section1_extra: Array.isArray(answers.section1_extra)
        ? answers.section1_extra.slice(0, 3).map((e: any, i: number) => ({
            id: e.id || `extra${i + 1}`,
            question: e.question || "",
            answer: normalize(e.answer),
            insertAfter: e.insertAfter || "q3",
          }))
        : [],
      role_specific: Array.isArray(answers.role_specific)
        ? answers.role_specific.slice(0, 5).map((r: any, i: number) => ({
            id: r.id || `rs${i + 1}`,
            question: r.question || "",
            answer: normalize(r.answer),
          }))
        : [],
    };

    return json({ success: true, answers: out });
  } catch (err: any) {
    console.error("generate-interview-prep error:", err);
    return json({ success: false, error: String(err?.message || err) }, 500);
  }
});
