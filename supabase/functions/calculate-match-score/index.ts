import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ success: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ success: false, error: "missing_job_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the job
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", user.id)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ success: false, error: "job_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Fetch user profile data
    const [workRes, eduRes, skillsRes, langRes] = await Promise.all([
      supabase.from("work_experiences").select("*").eq("user_id", user.id).order("start_year", { ascending: false }),
      supabase.from("education").select("*").eq("user_id", user.id).order("start_year", { ascending: false }),
      supabase.from("skills").select("*").eq("user_id", user.id).single(),
      supabase.from("languages").select("*").eq("user_id", user.id),
    ]);

    const profileSummary = {
      work_experiences: (workRes.data || []).map((w: any) => ({
        company: w.company_name,
        title: w.job_title,
        start: `${w.start_month}/${w.start_year}`,
        end: w.is_current ? "Present" : `${w.end_month}/${w.end_year}`,
        bullets: w.bullet_points || [],
      })),
      education: (eduRes.data || []).map((e: any) => ({
        institution: e.institution,
        degree: e.degree,
        field: e.field_of_study,
        years: `${e.start_year}-${e.end_year || "Present"}`,
      })),
      hard_skills: skillsRes.data?.hard_skills || [],
      soft_skills: skillsRes.data?.soft_skills || [],
      languages: (langRes.data || []).map((l: any) => `${l.language_name} (${l.proficiency})`),
    };

    const jobSummary = {
      title: job.job_title,
      company: job.company_name,
      function: job.function,
      location: job.location,
      work_mode: job.work_mode,
      duration: job.duration,
      hard_skills: job.hard_skills || [],
      soft_skills: job.soft_skills || [],
      languages_required: job.languages_required || [],
    };

    // Step 2: Score with OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "config_error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert recruiter and career coach. You will receive a candidate's professional profile and a job description. Your task is to assess how well the candidate matches this specific role. Return ONLY a valid JSON object with these exact keys:
- score: integer between 0 and 100 representing overall match quality
- hard_skills_match: integer 0-100 (how well their hard skills match the requirements)
- soft_skills_match: integer 0-100 (how well their soft skills match)
- experience_match: integer 0-100 (how relevant their experience is)
- language_match: integer 0-100 (whether they meet language requirements)
- match_summary: string (exactly 2 sentences explaining the score, what matches well and what is missing)
- missing_skills: array of strings (key requirements from the job that the candidate does not have)
- strengths: array of strings (the candidate's strongest matching points for this role)
Be honest and precise. A score above 80 means genuinely strong fit. Do not inflate scores.`;

    const userMessage = `CANDIDATE PROFILE:\n${JSON.stringify(profileSummary, null, 2)}\n\nJOB DESCRIPTION:\n${JSON.stringify(jobSummary, null, 2)}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0,
      }),
    });

    if (!openaiRes.ok) {
      console.error("OpenAI error:", openaiRes.status, await openaiRes.text());
      return new Response(JSON.stringify({ success: false, error: "scoring_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await openaiRes.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "";
    rawContent = rawContent.trim();
    if (rawContent.startsWith("```")) {
      rawContent = rawContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let scoreData: any;
    try {
      scoreData = JSON.parse(rawContent);
    } catch {
      console.error("Failed to parse score JSON:", rawContent);
      return new Response(JSON.stringify({ success: false, error: "scoring_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const score = typeof scoreData.score === "number" ? Math.min(100, Math.max(0, Math.round(scoreData.score))) : null;

    // Step 3: Update the job row
    const matchDetails = {
      hard_skills_match: scoreData.hard_skills_match ?? null,
      soft_skills_match: scoreData.soft_skills_match ?? null,
      experience_match: scoreData.experience_match ?? null,
      language_match: scoreData.language_match ?? null,
      match_summary: scoreData.match_summary ?? null,
      missing_skills: scoreData.missing_skills ?? [],
      strengths: scoreData.strengths ?? [],
    };

    const { error: updateError } = await supabase
      .from("jobs")
      .update({ match_score: score, match_details: matchDetails })
      .eq("id", job_id);

    if (updateError) {
      console.error("Update error:", updateError);
      return new Response(JSON.stringify({ success: false, error: "update_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, score, match_details: matchDetails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("calculate-match-score error:", e);
    return new Response(JSON.stringify({ success: false, error: "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
