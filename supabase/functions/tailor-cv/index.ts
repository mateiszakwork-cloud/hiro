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

    // Fetch all data in parallel
    const [profileRes, jobRes, workRes, eduRes, skillsRes, langRes, awardsRes, volRes] = await Promise.all([
      supabase.from("profiles").select("base_cv_text, full_name, email").eq("id", userId).single(),
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

    const profile = profileRes.data;
    const job = jobRes.data;
    const workExperiences = workRes.data || [];
    const education = eduRes.data || [];
    const skills = skillsRes.data;
    const languages = langRes.data || [];
    const awards = awardsRes.data || [];
    const volunteering = volRes.data || [];

    const baseCvText = profile?.base_cv_text || null;
    const hasBaseCv = !!baseCvText;

    // Build candidate profile data
    const candidateProfile = {
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
    };

    const jobData = {
      title: job.job_title,
      company: job.company_name,
      function: job.function,
      location: job.location,
      work_mode: job.work_mode,
      job_description_summary: job.job_description_summary,
      hard_skills: job.hard_skills,
      soft_skills: job.soft_skills,
      skills_nice_to_have: job.skills_nice_to_have,
      languages_required: job.languages_required,
    };

    let systemPrompt: string;
    let userPrompt: string;

    if (hasBaseCv) {
      // New base-CV-first approach
      systemPrompt = `You are an expert CV editor for competitive graduate and internship applications. You will receive a candidate's existing CV text, their full profile data, and a specific job description. Your task is to make minimal, targeted edits to the CV to tailor it for this role.

You must return ONLY a valid JSON object with these exact keys:

- tailored_summary: string (rewrite the candidate's summary section specifically for this role and company. 3-4 sentences. Match the tone and language of the job description. Reference the company by name if appropriate. Keep it first-person and confident.)

- selected_bullets: object where each key is the exact company name (e.g. "Aircall", "Hypotenuse AI") and each value is an array of 2-4 strings representing the best bullet points for this role from that experience. Choose from the bullet points in the candidate's profile data. Lightly rephrase to mirror the job description language only if it improves relevance. Never invent new bullets.

- selected_hard_skills: object with keys matching the skill categories in the base CV (e.g. "Data and Analytics", "Revenue Ops and CRM", "AI and Automation", "Design and Visual") and values as arrays of strings. Only keep skills relevant to this role. Keep the same category structure as the original CV.

- tailoring_notes: array of 3-5 strings briefly explaining key decisions made.

Rules:
- Never change company names, job titles, locations, dates, education, awards, languages, or contact information
- Keep all experiences in chronological order, most recent first
- Make the minimum changes necessary. If a section is already well-suited to the role, leave it unchanged.
- The summary must always be rewritten as it is the most important tailored element.
- Match the tone of the original CV: professional, concise, achievement-focused with numbers where they exist.`;

      userPrompt = JSON.stringify({
        base_cv_text: baseCvText,
        profile_data: candidateProfile,
        job: jobData,
      });
    } else {
      // Fallback: existing profile-based generation
      systemPrompt = `You are an expert CV writer and career coach specialising in competitive graduate and internship applications at top companies. You will receive a candidate's complete professional profile and a specific job description. Your task is to build the optimal tailored CV for this exact role.

Return ONLY a valid JSON object with these exact keys:

- profile_headline: string (a 1-sentence professional headline tailored to this role)

- selected_experiences: array of objects, each containing:
  - company: string
  - job_title: string
  - location: string
  - start_date: string
  - end_date: string
  - selected_bullets: array of strings (choose the 2-4 most relevant bullet points for THIS specific job)
  - relevance_score: integer 0-100

- selected_hard_skills: array of strings (only skills relevant to this job, maximum 10)
- selected_soft_skills: array of strings (maximum 5)
- selected_education: array of objects with institution, degree, field, grade, activities
- selected_languages: array of objects with language and proficiency
- selected_awards: array of objects (only if relevant, otherwise empty array)
- selected_volunteering: array of objects (only if relevant, otherwise empty array)
- tailoring_notes: array of strings (3-5 short notes explaining key tailoring decisions)

Rules: Never invent experience or skills not present in the profile. Never remove entire experiences, only de-prioritise them. Keep bullet points truthful.`;

      userPrompt = JSON.stringify({
        job: jobData,
        candidate: candidateProfile,
      });
    }

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

    // Build the row based on which mode was used
    const row: any = {
      job_id,
      user_id: userId,
      tailoring_notes: parsed.tailoring_notes || [],
      updated_at: new Date().toISOString(),
    };

    if (hasBaseCv) {
      // New mode: store tailored_summary, selected_bullets (object), selected_hard_skills (object)
      row.tailored_summary = parsed.tailored_summary || null;
      row.selected_bullets = parsed.selected_bullets || {};
      row.selected_hard_skills = parsed.selected_hard_skills || {};
      row.profile_headline = null;
      row.selected_experiences = [];
      row.selected_soft_skills = [];
      row.selected_education = [];
      row.selected_languages = [];
      row.selected_awards = [];
      row.selected_volunteering = [];
    } else {
      // Legacy mode
      row.profile_headline = parsed.profile_headline || null;
      row.selected_experiences = parsed.selected_experiences || [];
      row.selected_hard_skills = parsed.selected_hard_skills || [];
      row.selected_soft_skills = parsed.selected_soft_skills || [];
      row.selected_education = parsed.selected_education || [];
      row.selected_languages = parsed.selected_languages || [];
      row.selected_awards = parsed.selected_awards || [];
      row.selected_volunteering = parsed.selected_volunteering || [];
      row.tailored_summary = null;
      row.selected_bullets = {};
    }

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
