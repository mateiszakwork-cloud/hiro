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

    const systemPrompt = `You are an expert CV editor for competitive graduate and internship applications. You will receive a candidate's profile and a specific job description. Return ONLY a valid JSON object with these exact keys:

- tailored_summary: string. Generate the professional summary following these strict rules:
  - Always write in first person (never "Máté is..." always "CEMS student with...")
  - Never use flattery or filler phrases like "accomplished professional", "ideal candidate", "perfectly aligns", "invaluable", "passionate", "eager"
  - Open directly with your degree/current status and the most relevant functional experience for this role
  - Reference 2-3 specific, concrete things from the candidate's actual experience that are relevant to this job
  - End with exactly: "Looking to join [Company Name] in [Month/timing if known from job description]."
  - Maximum 3 sentences. Never 4.
  - Match the tone of these real examples:
    Example 1 (CRM/Sales role): "CEMS Master in International Management student graduating soon with experience across sales development, go to market execution, and solution focused analytics in SaaS and AI startups. Comfortable working with CRM tools, product and revenue KPIs, and cross functional teams across Europe and Asia. Looking to join Salesforce in August."
    Example 2 (Marketing role): "CEMS MSc student with experience in operational marketing and multi-market campaign execution. Proven track record managing product launches, creating marketing materials, and analyzing consumer engagement to drive activation and retention. Looking to join Estée Lauder Companies starting July."
    Example 3 (Analytics role): "CEMS MSc student with experience in performance analysis, consumer insights, and data-driven content strategy across startups in Paris, Singapore, and Hong Kong. Track record of turning data into clear recommendations and identifying market trends. Looking to join a role in [Company] combining analytics and consumer understanding."
    Example 4 (GTM/Strategy role): "CEMS MSc student with proven success in global go-to-market execution and performance-driven content strategy across international hubs. Experienced in building best practice libraries, creating playbooks and toolkits, and driving performance improvements through CRM insights and workflow automation. Looking to join [Company] starting [Month]."
  Use these examples as the tone and structure reference. Never deviate from this style.

- selected_bullets: array of objects, each with:
  - company: string (exact company name)
  - job_title: string
  - bullets: array of objects, each with:
    - original: string (exact text from the candidate's profile, completely unchanged)
    - tailored: string (a meaningfully rephrased version aligned to the target role)
    - use_tailored: boolean (default true)
    - origin: string, always exactly "original"

  Tailoring rules for the "tailored" field:
    - Rewrite freely to mirror the wording, priorities, and terminology of the job description.
    - You MAY change verbs, restructure the sentence, and reorder clauses to emphasise what the role values.
    - You MUST preserve every concrete fact present in the original: numbers, percentages, currencies, named tools/companies/products, scope, and ownership level.
    - You MUST NOT invent achievements, metrics, tools, ownership, or scope that are not in the original bullet.
    - Keep a human, concrete tone — no corporate filler ("leveraged synergies", "spearheaded", "results-driven").
    - If the bullet is already strongly aligned and any rewrite would weaken it, return the original text as "tailored".
    - Aim for visibly different wording when the original is generic or weakly related to the role.

- selected_hard_skills: object where keys are skill categories (preserve the candidate's existing categories exactly, e.g. "Data and Analytics", "Revenue Ops and CRM", "AI and Automation", "Design and Visual") and values are arrays of the most relevant skills from each category for this role. Remove irrelevant skills. Keep relevant ones exactly as written.

- selected_soft_skills: array of 4-5 strings, the most relevant soft skills for this role

- tailoring_notes: array of 3-5 short strings explaining the key tailoring decisions

Rules:
- For each work experience, select EXACTLY 3 bullet points that are most relevant to this specific role. Not 2, not 4 — exactly 3. The user can add or remove bullets after generation.
- If the experience has fewer than 3 original bullets, use all of them (do not invent new ones).
- Never invent experience or skills not present in the profile.
- Tailored wording must remain truthful and grounded in the original bullet's facts.
- The summary must always be rewritten specifically for this role following the strict rules above.
- Match the tone of the original CV: professional, concise, achievement-focused.`;

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

    // Validation: target exactly 3 bullets per experience (or all available if fewer).
    const selectedBullets = parsed.selected_bullets || [];
    for (const block of selectedBullets) {
      block.bullets = (block.bullets || []).map((b: any) => ({
        original: b.original || b.tailored || "",
        tailored: b.tailored || b.original || "",
        use_tailored: b.use_tailored !== false,
        origin: b.origin || "original",
      }));
      const match = workExperiences.find((w: any) =>
        w.company_name === block.company && w.job_title === block.job_title
      );
      const sourceBullets: string[] = (match && Array.isArray(match.bullet_points)) ? match.bullet_points : [];
      const target = Math.min(3, sourceBullets.length || block.bullets.length);
      // Pad up with unused originals
      if (block.bullets.length < target && sourceBullets.length) {
        const existing = new Set(block.bullets.map((b: any) => b.original));
        for (const bp of sourceBullets) {
          if (block.bullets.length >= target) break;
          if (!existing.has(bp)) {
            block.bullets.push({ original: bp, tailored: bp, use_tailored: true, origin: "original" });
            existing.add(bp);
          }
        }
      }
      // Trim down to 3
      if (block.bullets.length > 3) block.bullets = block.bullets.slice(0, 3);
    }
    parsed.selected_bullets = selectedBullets;

    const row = {
      job_id,
      user_id: userId,
      tailored_summary: parsed.tailored_summary || null,
      selected_bullets: parsed.selected_bullets || [],
      selected_hard_skills: parsed.selected_hard_skills || {},
      selected_soft_skills: parsed.selected_soft_skills || [],
      tailoring_notes: parsed.tailoring_notes || [],
      updated_at: new Date().toISOString(),
      profile_headline: null,
      selected_experiences: [],
      selected_education: [],
      selected_languages: [],
      selected_awards: [],
      selected_volunteering: [],
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
