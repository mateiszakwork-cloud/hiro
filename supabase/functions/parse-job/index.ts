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
      return new Response(JSON.stringify({ success: false, error: "unauthorized", message: "Not authenticated." }), {
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
      return new Response(JSON.stringify({ success: false, error: "unauthorized", message: "Not authenticated." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    if (!url) {
      return new Response(JSON.stringify({ success: false, error: "missing_url", message: "No URL provided." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Scrape with Jina
    const JINA_API_KEY = Deno.env.get("JINA_API_KEY");
    if (!JINA_API_KEY) {
      console.error("JINA_API_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "config_error", message: "Scraping service not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let jobPageText: string;
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          Authorization: `Bearer ${JINA_API_KEY}`,
          Accept: "text/plain",
        },
      });
      if (!jinaRes.ok) {
        console.error("Jina error:", jinaRes.status, await jinaRes.text());
        return new Response(JSON.stringify({ success: false, error: "scrape_failed", message: "Could not read the job page. Please check the URL and try again." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      jobPageText = await jinaRes.text();
      if (!jobPageText || jobPageText.trim().length < 50) {
        return new Response(JSON.stringify({ success: false, error: "scrape_failed", message: "Could not read the job page. Please check the URL and try again." }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch (e) {
      console.error("Jina fetch error:", e);
      return new Response(JSON.stringify({ success: false, error: "scrape_failed", message: "Could not read the job page. Please check the URL and try again." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Parse with OpenAI
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(JSON.stringify({ success: false, error: "config_error", message: "AI parsing service not configured." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert job description parser. Extract structured data from the following job posting text and return ONLY a valid JSON object with no additional text, markdown, or explanation. Use exactly these keys:
- company_name: string (the hiring company name)
- job_title: string (exact job title as written)
- function: string (must be exactly one of: Strategy, Finance, Marketing, Product, Operations, HR, Consulting, Other)
- location: string (city and country, e.g. "Paris, France")
- work_mode: string (must be exactly one of: Onsite, Hybrid, Remote)
- duration: string (e.g. "6 months", "12 months", "Permanent", "Fixed-term")
- hard_skills: array of strings (specific tools, software, methodologies, technical skills that are explicitly required, essential, or mandatory)
- soft_skills: array of strings (interpersonal and professional skills that are explicitly required, essential, or mandatory)
- skills_nice_to_have: array of strings (any skills — hard or soft — described as optional, a plus, bonus, preferred, advantageous, nice to have, or would be beneficial)
- languages_required: array of strings (languages explicitly marked as required, mandatory, or essential, e.g. ["English", "French"])
- languages_nice_to_have: array of strings (languages described as a plus, bonus, preferred, advantageous, nice to have, or would be beneficial)
- application_deadline: string in ISO 8601 format (YYYY-MM-DD) or null if not mentioned
- job_description_summary: string (a neutral 3-sentence summary of the role, responsibilities, and ideal candidate)

Pay close attention to language that signals optionality vs requirement. Words like required, essential, must have, and mandatory indicate required fields. Words like plus, bonus, preferred, advantageous, nice to have, ideally, and would be beneficial indicate optional fields. When in doubt, classify as nice to have rather than required.

If any field cannot be determined from the text, use null for strings and empty array [] for arrays. Never invent information not present in the text.`;

    let parsed: Record<string, unknown>;
    try {
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
            { role: "user", content: jobPageText.substring(0, 15000) },
          ],
          temperature: 0,
        }),
      });

      if (!openaiRes.ok) {
        console.error("OpenAI error:", openaiRes.status, await openaiRes.text());
        return new Response(JSON.stringify({ success: false, error: "parse_failed", message: "Could not extract job details. You can add the details manually." }), {
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
      parsed = JSON.parse(rawContent);
    } catch (e) {
      console.error("OpenAI parse error:", e);
      return new Response(JSON.stringify({ success: false, error: "parse_failed", message: "Could not extract job details. You can add the details manually." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Insert into jobs table
    const { data: job, error: insertError } = await supabase
      .from("jobs")
      .insert({
        user_id: user.id,
        url,
        status: "Saved",
        company_name: parsed.company_name as string | null,
        job_title: parsed.job_title as string | null,
        function: parsed.function as string | null,
        location: parsed.location as string | null,
        work_mode: parsed.work_mode as string | null,
        duration: parsed.duration as string | null,
        hard_skills: (parsed.hard_skills as string[]) || [],
        soft_skills: (parsed.soft_skills as string[]) || [],
        skills_nice_to_have: (parsed.skills_nice_to_have as string[]) || [],
        languages_required: (parsed.languages_required as string[]) || [],
        languages_nice_to_have: (parsed.languages_nice_to_have as string[]) || [],
        application_deadline: parsed.application_deadline as string | null,
      })
      .select("id, url, company_name, job_title, function, location, work_mode, duration, status, match_score, created_at, hard_skills, soft_skills, skills_nice_to_have, languages_required, languages_nice_to_have, application_deadline")
      .single();

    if (insertError || !job) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ success: false, error: "save_failed", message: "Job was parsed but could not be saved. Please try again." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, job }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-job error:", e);
    return new Response(JSON.stringify({ success: false, error: "unknown", message: "An unexpected error occurred." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
