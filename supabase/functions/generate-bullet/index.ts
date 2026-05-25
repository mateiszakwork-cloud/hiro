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
    const { data: claimsData } = await supabase.auth.getClaims(token);
    if (!claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { job_id, company, job_title, existing_bullets } = await req.json();
    if (!job_id || !company || !job_title) {
      return new Response(JSON.stringify({ success: false, error: "Missing parameters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [jobRes, workRes] = await Promise.all([
      supabase.from("jobs").select("job_title, company_name, function, hard_skills, soft_skills, notes").eq("id", job_id).eq("user_id", userId).single(),
      supabase.from("work_experiences").select("*").eq("user_id", userId).eq("company_name", company).eq("job_title", job_title).maybeSingle(),
    ]);

    if (!jobRes.data || !workRes.data) {
      return new Response(JSON.stringify({ success: false, error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const job = jobRes.data;
    const exp = workRes.data;
    const originalBullets: string[] = exp.bullet_points || [];
    const existing: string[] = Array.isArray(existing_bullets) ? existing_bullets : [];

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "OpenAI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You generate ONE additional CV bullet point for a specific work experience, tailored to a target role.

STRICT RULES:
- The bullet MUST be grounded in the facts present in the candidate's existing bullets for THIS experience. Do not invent new achievements, metrics, ownership, scope, or tools.
- You may surface a different angle of the SAME work that the existing bullets describe (e.g. a process aspect already implied, or rephrasing a known outcome through the lens of what the target role values).
- Preserve numbers, percentages, named tools, and scope exactly when you reuse them.
- The wording should align with the target role's priorities and terminology.
- Human, concrete tone. No corporate filler.
- Do not duplicate an existing bullet's main point.
- Return ONLY a JSON object: { "bullet": string }`;

    const userPrompt = JSON.stringify({
      target_role: { title: job.job_title, company: job.company_name, function: job.function, hard_skills: job.hard_skills, soft_skills: job.soft_skills },
      experience: { company, job_title, all_original_bullets: originalBullets },
      bullets_currently_shown: existing,
    });

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiRes.ok) {
      const t = await openaiRes.text();
      console.error("OpenAI error:", openaiRes.status, t);
      return new Response(JSON.stringify({ success: false, error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await openaiRes.json();
    let parsed: any;
    try {
      parsed = JSON.parse(aiData.choices?.[0]?.message?.content || "{}");
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Invalid AI JSON" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bullet = (parsed.bullet || "").trim();
    if (!bullet) {
      return new Response(JSON.stringify({ success: false, error: "Empty bullet" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, bullet }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-bullet error:", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});