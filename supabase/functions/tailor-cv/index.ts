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

    // Step 1 - Fetch all data in parallel
    const [jobRes, workRes, eduRes, skillsRes, langRes, awardsRes, volRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", job_id).eq("user_id", userId).single(),
      supabase.from("work_experiences").select("*").eq("user_id", userId).order("start_year", { ascending: false }),
      supabase.from("education").select("*").eq("user_id", userId).order("start_year", { ascending: false }),
      supabase.from("skills").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("languages").select("*").eq("user_id", userId),
      supabase.from("awards").select("*").eq("user_id", userId),
      supabase.from("volunteering").select("*").eq("user_id", userId),
    ]);

    if (jobRes.error || !jobRes.data) {
      return new Response(JSON.stringify({ success: false, error: "Job not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = jobRes.data;
    const workExperiences = workRes.data || [];
    const education = eduRes.data || [];
    const skills = skillsRes.data;
    const languages = langRes.data || [];
    const awards = awardsRes.data || [];
    const volunteering = volRes.data || [];

    // Step 2 - Build prompt
    const userPrompt = JSON.stringify({
      job: {
        title: job.job_title,
        company: job.company_name,
        function: job.function,
        location: job.location,
        work_mode: job.work_mode,
        hard_skills: job.hard_skills,
        soft_skills: job.soft_skills,
        skills_nice_to_have: job.skills_nice_to_have,
        languages_required: job.languages_required,
        languages_nice_to_have: job.languages_nice_to_have,
      },
      candidate: {
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
        education: education.map((e: any) => ({
          institution: e.institution,
          degree: e.degree,
          field_of_study: e.field_of_study,
          start_year: e.start_year,
          end_year: e.end_year,
          grade: e.grade,
          activities: e.activities,
          description: e.description,
        })),
        hard_skills: skills?.hard_skills || [],
        soft_skills: skills?.soft_skills || [],
        languages: languages.map((l: any) => ({ language: l.language_name, proficiency: l.proficiency })),
        awards: awards.map((a: any) => ({ award_name: a.award_name, organization: a.issuing_organization, year: a.year, description: a.description })),
        volunteering: volunteering.map((v: any) => ({ organization: v.organization, role: v.role, start_year: v.start_year, end_year: v.end_year, is_ongoing: v.is_ongoing, description: v.description })),
      },
    });

    const systemPrompt = `You are an expert CV writer and career coach specialising in competitive graduate and internship applications at top companies. You will receive a candidate's complete professional profile and a specific job description. Your task is to build the optimal tailored CV for this exact role.

Return ONLY a valid JSON object with these exact keys:

- profile_headline: string (a 1-sentence professional headline tailored to this role, e.g. "Strategy & Business Development graduate with experience in GTM execution and market analytics")

- selected_experiences: array of objects, each containing:
  - company: string
  - job_title: string
  - location: string
  - start_date: string
  - end_date: string
  - selected_bullets: array of strings (choose the 2-4 most relevant bullet points for THIS specific job. Lightly rewrite each bullet if needed to mirror the job description language without changing the facts. Prioritise impact, numbers, and relevance.)
  - relevance_score: integer 0-100 (how relevant this experience is to the role)
Order experiences by relevance_score descending, not chronologically.

- selected_hard_skills: array of strings (only skills from the candidate profile that are relevant to this job, maximum 10)

- selected_soft_skills: array of strings (only the most relevant, maximum 5)

- selected_education: array of objects with institution, degree, field, grade (if exists), activities (if exists)

- selected_languages: array of objects with language and proficiency (prioritise languages required or preferred by the job)

- selected_awards: array of objects (only include if genuinely relevant to the role, otherwise return empty array)

- selected_volunteering: array of objects (only include if relevant, otherwise empty array)

- tailoring_notes: array of strings (3-5 short notes explaining key tailoring decisions you made, e.g. "Moved internship X to top position due to direct strategy relevance" or "Rewrote bullet 3 to emphasise market analysis over operations")

Rules: Never invent experience or skills not present in the profile. Never remove entire experiences, only de-prioritise them. Keep bullet points truthful and grounded in the original. The goal is selection and emphasis, not fabrication.`;

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
      console.error("OpenAI error:", openaiRes.status, await openaiRes.text());
      return new Response(JSON.stringify({ success: false, message: "CV generation failed. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiRes.json();
    let parsed: any;
    try {
      const content = openaiData.choices?.[0]?.message?.content;
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse OpenAI response");
      return new Response(JSON.stringify({ success: false, message: "CV generation failed. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3 - Upsert into cv_outputs
    const row = {
      job_id,
      user_id: userId,
      profile_headline: parsed.profile_headline || null,
      selected_experiences: parsed.selected_experiences || [],
      selected_hard_skills: parsed.selected_hard_skills || [],
      selected_soft_skills: parsed.selected_soft_skills || [],
      selected_education: parsed.selected_education || [],
      selected_languages: parsed.selected_languages || [],
      selected_awards: parsed.selected_awards || [],
      selected_volunteering: parsed.selected_volunteering || [],
      tailoring_notes: parsed.tailoring_notes || [],
      updated_at: new Date().toISOString(),
    };

    // Use service role for upsert to avoid RLS issues with the insert+conflict
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
      return new Response(JSON.stringify({ success: false, message: "CV generation failed. Please try again." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: cvOutput }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("tailor-cv error:", err);
    return new Response(JSON.stringify({ success: false, message: "CV generation failed. Please try again." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
