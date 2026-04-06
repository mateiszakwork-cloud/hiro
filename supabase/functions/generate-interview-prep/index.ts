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
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Session expired. Please log in again." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ success: false, error: "job_id is required" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [jobRes, profileRes, workRes, skillsRes, eduRes, langRes] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", job_id).eq("user_id", userId).single(),
      supabase.from("profiles").select("full_name, email").eq("id", userId).single(),
      supabase.from("work_experiences").select("*").eq("user_id", userId).order("start_year", { ascending: false }),
      supabase.from("skills").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("education").select("*").eq("user_id", userId).order("start_year", { ascending: false }),
      supabase.from("languages").select("*").eq("user_id", userId),
    ]);

    if (jobRes.error || !jobRes.data) {
      return new Response(JSON.stringify({ success: false, error: "Job not found" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = jobRes.data;
    const profile = profileRes.data;
    const workExperiences = workRes.data || [];
    const skills = skillsRes.data;
    const education = eduRes.data || [];
    const languages = langRes.data || [];

    const candidateProfile = {
      full_name: profile?.full_name || null,
      work_experiences: workExperiences.map((w: any) => ({
        company: w.company_name,
        job_title: w.job_title,
        location: w.location,
        start_year: w.start_year,
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
      })),
      hard_skills: skills?.hard_skills || [],
      soft_skills: skills?.soft_skills || [],
      languages: languages.map((l: any) => ({ language: l.language_name, proficiency: l.proficiency })),
    };

    const jobData = {
      title: job.job_title,
      company: job.company_name,
      function: job.function,
      location: job.location,
      work_mode: job.work_mode,
      duration: job.duration,
      hard_skills: job.hard_skills,
      soft_skills: job.soft_skills,
      languages_required: job.languages_required,
    };

    const systemPrompt = `You are an expert interview coach and career advisor. You will receive a candidate's profile and a specific job description. Return ONLY valid JSON with these exact keys:
- company_overview: string (3-4 sentences on what the company does and their current strategic positioning)
- role_intelligence: string (why this role likely exists, what success looks like in the first 90 days, likely interview format for this function and seniority level)
- your_pitch: array of 3 strings (specific talking points for this candidate for this role, grounded in their actual experience)
- preparation_gaps: array of objects each with gap (string) and suggested_response (string explaining how to address it in interview)
- interview_questions: array of 10 objects each with: question (string), category (exactly one of: Behavioral, Technical, Motivational, Situational), suggested_answer_framework (string using the candidate's real experience structured in STAR format)`;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "OpenAI API key not configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify({ job: jobData, candidate: candidateProfile }) },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, errText);
      return new Response(JSON.stringify({ success: false, error: `AI error (${openaiRes.status})` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiData = await openaiRes.json();
    let parsed: any;
    try {
      parsed = JSON.parse(openaiData.choices?.[0]?.message?.content);
    } catch {
      return new Response(JSON.stringify({ success: false, error: "AI returned invalid response. Please try again." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const row = {
      job_id,
      user_id: userId,
      company_overview: parsed.company_overview || null,
      role_intelligence: parsed.role_intelligence || null,
      your_pitch: parsed.your_pitch || [],
      preparation_gaps: parsed.preparation_gaps || [],
      interview_questions: parsed.interview_questions || [],
      updated_at: new Date().toISOString(),
    };

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: prepData, error: upsertError } = await serviceClient
      .from("interview_prep")
      .upsert(row, { onConflict: "job_id,user_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ success: false, error: `Database error: ${upsertError.message}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: prepData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-interview-prep error:", err);
    return new Response(JSON.stringify({ success: false, error: String(err) }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
