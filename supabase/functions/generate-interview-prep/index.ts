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
    "q1": "- bullet\\n- bullet\\n- bullet\\n- bullet\\n- bullet",
    "q2": "- bullet\\n- bullet\\n- bullet\\n- bullet",
    "q3": "- bullet\\n- bullet\\n- bullet\\n- bullet",
    "q4": "- bullet\\n- bullet\\n- bullet",
    "q5": "- bullet\\n- bullet\\n- bullet",
    "q6": "- bullet\\n- bullet\\n- Note: verify with current sources before your interview",
    "q7": "- bullet\\n- bullet\\n- Note: verify with current sources before your interview",
    "q8": "- bullet\\n- bullet\\n- bullet\\n- bullet\\n- bullet",
    "section1_extra": [
      { "id": "extra1", "question": "...", "answer": "- bullet\\n- bullet", "insertAfter": "q3" }
    ],
    "role_specific": [
      { "id": "rs1", "question": "...", "answer": "- bullet\\n- bullet\\n- bullet" }
    ]
  }
}

Field instructions:
- q1 (Tell me about the company): 5-7 bullets covering company overview, business model, key products or brands, market position, scale, notable facts from the job posting.
- q2 (The role and its responsibilities, and how it fits in the big picture): 4-6 bullets on day-to-day responsibilities, team or department context, how the role connects to company strategy. Pull from the job description.
- q3 (Tell me about yourself - 2-minute pitch): 4 bullets structured as: (1) who you are academically (degree, university, field of study), (2) most relevant past experience from CV (1-2 roles or projects), (3) key skill or achievement matching this role, (4) what you are looking for now.
- q4 (Why are you applying for this role): 3-4 bullets specific to this role's responsibilities matched to the applicant's background. Never generic.
- q5 (Why are you applying to this company): 3-4 bullets specific to this company — its mission, culture, product, or market position. Never generic.
- q6 (Recent company news): 2 bullets on real or plausible company news up to your training cutoff, then the verify note bullet exactly as shown above.
- q7 (Recent industry news): 2 bullets on real or plausible industry trends up to your training cutoff, then the verify note bullet exactly as shown above.
- q8 (Questions to ask the interviewer): 5-7 specific questions covering role clarity, team culture, success metrics, and one strategic question about company direction. Never generic.
- section1_extra: 0 to 3 objects ONLY if the role type warrants extra fixed questions (consulting → "structured problem", startup → "funding/growth stage", technical → relevant deep-dive). Each object has "insertAfter" set to the q-id it should come after (e.g. "q3" or "q5"). If none needed, return an empty array [].
- role_specific: EXACTLY 3-5 objects with questions and answers specific to this job title and industry. Never generic. Each answer is 3-5 bullets.

Every bullet starts with "- " (hyphen + space). Output ONLY the JSON object, nothing else.`;
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
