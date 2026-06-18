import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ success: false, error: "job_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [profileRes, jobRes, workRes, skillsRes] = await Promise.all([
      supabase.from("profiles").select("base_cv_text, full_name, email").eq("id", userId).single(),
      supabase.from("jobs").select("*").eq("id", job_id).eq("user_id", userId).single(),
      supabase.from("work_experiences").select("*").eq("user_id", userId).order("start_year", { ascending: false }),
      supabase.from("skills").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    if (jobRes.error || !jobRes.data) {
      return new Response(JSON.stringify({ success: false, error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profile = profileRes.data;
    const job = jobRes.data;
    const workExperiences = workRes.data || [];
    const skills = skillsRes.data;

    const candidateProfile = {
      full_name: profile?.full_name || null,
      base_cv_text: profile?.base_cv_text || null,
      work_experiences: workExperiences.map((w: any) => ({
        company: w.company_name,
        job_title: w.job_title,
        location: w.location,
        start_month: w.start_month,
        start_year: w.start_year,
        end_month: w.end_month,
        end_year: w.end_year,
        is_current: w.is_current,
        bullet_points: w.bullet_points,
      })),
      hard_skills: skills?.hard_skills || [],
      soft_skills: skills?.soft_skills || [],
    };

    const jobData = {
      title: job.job_title,
      company: job.company_name,
      function: job.function,
      location: job.location,
      job_description_summary: job.job_description_summary,
      hard_skills: job.hard_skills,
      soft_skills: job.soft_skills,
    };

    const systemPrompt = `You are an expert CV reviewer for competitive graduate and internship applications. You DO NOT rewrite bullets. You help the candidate select the strongest evidence they already have for a specific role, and you flag what is missing.

Return ONLY a valid JSON object with these exact keys:

- tailored_summary: string. Professional summary following these strict rules:
  - Always first person (never "Máté is..."; e.g. "CEMS student with...")
  - No flattery or filler ("accomplished", "ideal candidate", "passionate", "eager", "results-driven")
  - Open with degree/current status and the most relevant functional experience for this role
  - Reference 2-3 specific, concrete facts from the candidate's actual experience that connect to this job
  - End with exactly: "Looking to join [Company Name] in [Month/timing if known from job description]."
  - Max 3 sentences. Truthful, grounded in the profile.

- selected_bullets: array of objects, one per relevant experience. Each:
  - company: string (exact company name from profile)
  - job_title: string (exact)
  - bullets: array of objects, each with:
    - original: string — VERBATIM text of a bullet from that experience. Never alter, never invent.
    - tailored: string — MUST equal "original" exactly. You are not rewriting bullets.
    - use_tailored: boolean — always false.
    - origin: string — always "original".
    - relevance: "high" | "medium" | "low" — how directly this bullet supports the target role.
    - why: string (max 90 chars) — short, concrete reason the bullet matters for this role. No filler.

  Bullet selection rules:
    - Pick the MOST RELEVANT existing bullets for the role, in order of relevance.
    - Include up to 4 bullets per experience, fewer if the experience genuinely has fewer relevant ones. Never pad with weak bullets to hit a quota.
    - If an experience has no relevant bullets at all, omit that experience block entirely.
    - Never invent, paraphrase, or merge bullets. The "original" string must appear verbatim in the candidate's profile.

- selected_hard_skills: flat array of strings — the candidate's existing hard skills most relevant to this role, in priority order. Keep them written exactly as in the profile. Never add skills the candidate does not have.

- selected_soft_skills: array of 4-5 strings — most relevant soft skills the candidate already has.

- keyword_coverage: array of objects describing how the job description maps to the candidate's profile. Aim for 8-14 entries covering the JD's most important hard skills, tools, and capability themes. Each:
    - keyword: string (a concrete skill, tool, methodology, or capability the JD calls out — e.g. "SQL", "stakeholder management", "GTM playbooks")
    - status: "covered" | "partial" | "missing"
        - "covered": clearly present in selected bullets, skills, or summary with concrete evidence
        - "partial": adjacent experience exists but the keyword itself is not stated in profile language
        - "missing": no supporting evidence in the candidate's profile
    - evidence: string (max 120 chars) — for "covered"/"partial", quote or paraphrase the supporting profile fact; for "missing", leave empty string ""
    - source: "hard_skill" | "soft_skill" | "experience" | "theme"

- tailoring_notes: array of 3-5 short strings explaining the key selection decisions (which bullets you picked and why, which JD themes are well covered, which gaps the user should address).

Hard rules:
- Never invent experience, skills, metrics, tools, scope, or ownership not present in the profile.
- Never rewrite bullets. "tailored" MUST equal "original" verbatim.
- The summary must be grounded only in the candidate's real experience.
- Truthfulness over polish. If you are unsure, mark a keyword as "partial" or "missing" rather than overclaiming.`;

    const userPrompt = JSON.stringify({ job: jobData, candidate: candidateProfile });

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "OpenAI API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      return new Response(JSON.stringify({ success: false, error: `OpenAI API error (${openaiRes.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiRes.json();
    let parsed: any;
    try {
      const content = openaiData.choices?.[0]?.message?.content;
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("Failed to parse OpenAI response:", e);
      return new Response(JSON.stringify({ success: false, error: "AI returned invalid JSON. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validation: enforce that every selected bullet is verbatim from the profile.
    // Drop bullets the AI did not lift cleanly from the candidate's real experience.
    const allowRelevance = (r: any): "high" | "medium" | "low" => {
      const s = String(r || "").toLowerCase();
      if (s === "high" || s === "medium" || s === "low") return s as any;
      return "medium";
    };
    const selectedBullets = (parsed.selected_bullets || []).map((block: any) => {
      const match = workExperiences.find((w: any) =>
        w.company_name === block.company && w.job_title === block.job_title
      );
      const sourceBullets: string[] = (match && Array.isArray(match.bullet_points)) ? match.bullet_points : [];
      const sourceSet = new Set(sourceBullets);
      const seen = new Set<string>();
      const bullets = (block.bullets || [])
        .map((b: any) => {
          // Only trust the original text. Ignore any "tailored" rewrite the AI tried to slip in.
          const original = String(b.original || b.tailored || "").trim();
          if (!original || seen.has(original)) return null;
          // Must be a real bullet from this experience (defensive against hallucinated bullets).
          if (sourceSet.size && !sourceSet.has(original)) return null;
          seen.add(original);
          return {
            original,
            tailored: original,
            use_tailored: false,
            origin: "original",
            relevance: allowRelevance(b.relevance),
            why: String(b.why || "").trim().slice(0, 140),
          };
        })
        .filter(Boolean)
        .slice(0, 4);
      return { company: block.company, job_title: block.job_title, bullets };
    }).filter((b: any) => b.bullets.length > 0);
    parsed.selected_bullets = selectedBullets;

    // Normalise keyword_coverage to a safe shape.
    const coverage = Array.isArray(parsed.keyword_coverage) ? parsed.keyword_coverage : [];
    const normalisedCoverage = coverage
      .map((c: any) => {
        const keyword = String(c?.keyword || "").trim();
        if (!keyword) return null;
        const status = ["covered", "partial", "missing"].includes(c?.status) ? c.status : "missing";
        const source = ["hard_skill", "soft_skill", "experience", "theme"].includes(c?.source) ? c.source : "theme";
        return {
          keyword,
          status,
          source,
          evidence: String(c?.evidence || "").trim().slice(0, 160),
        };
      })
      .filter(Boolean)
      .slice(0, 16);

    const row = {
      job_id,
      user_id: userId,
      tailored_summary: parsed.tailored_summary || null,
      selected_bullets: parsed.selected_bullets || [],
      selected_hard_skills: parsed.selected_hard_skills || {},
      selected_soft_skills: parsed.selected_soft_skills || [],
      tailoring_notes: parsed.tailoring_notes || [],
      keyword_coverage: normalisedCoverage,
      updated_at: new Date().toISOString(),
      profile_headline: null,
      selected_experiences: [],
      selected_education: [],
      selected_languages: [],
    };

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cvOutput, error: upsertError } = await serviceClient
      .from("cv_outputs")
      .upsert(row, { onConflict: "job_id,user_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ success: false, error: `Database error: ${upsertError.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: cvOutput }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("tailor-cv error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
