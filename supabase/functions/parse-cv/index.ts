import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized", step: "auth" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create user-scoped client for storage (respects RLS)
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Validate the user session
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Auth error:", userError);
      return jsonResponse({ error: "Invalid or expired session. Please log in again.", step: "auth" }, 401);
    }

    let body: { filePath?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid request body", step: "request" }, 400);
    }

    const { filePath } = body;
    if (!filePath) {
      return jsonResponse({ error: "filePath is required", step: "request" }, 400);
    }

    // Step 1: Download the PDF from storage
    console.log("Step 1: Downloading file:", filePath);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("cv-uploads")
      .download(filePath);

    if (downloadError || !fileData) {
      console.error("Storage download error:", downloadError);
      return jsonResponse({
        error: `Failed to download CV file: ${downloadError?.message || "File not found"}`,
        step: "storage_download",
      }, 400);
    }

    // Step 2: Convert PDF to base64
    console.log("Step 2: Converting PDF to base64");
    let base64: string;
    try {
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      // Process in chunks to avoid stack overflow on large files
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      base64 = btoa(binary);
    } catch (convErr) {
      console.error("PDF conversion error:", convErr);
      return jsonResponse({
        error: `Failed to process PDF file: ${convErr instanceof Error ? convErr.message : "Unknown conversion error"}`,
        step: "text_extraction",
      }, 500);
    }

    // Step 3: Call AI to parse
    console.log("Step 3: Calling AI for parsing");
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI not configured on the server", step: "ai_config" }, 500);
    }

    const systemPrompt = `You are a CV/resume parser. Extract structured information from the provided PDF document. Return a JSON object with the following structure. Be thorough and extract ALL information present.

{
  "work_experiences": [
    {
      "company_name": "string",
      "job_title": "string",
      "location": "string or null",
      "start_month": "month name e.g. January, or null",
      "start_year": "number",
      "end_month": "month name or null if current",
      "end_year": "number or null if current",
      "is_current": false,
      "bullet_points": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field_of_study": "string",
      "start_year": "number",
      "end_year": "number or null",
      "grade": "string or null",
      "activities": "string or null",
      "description": "string or null"
    }
  ],
  "hard_skills": ["string"],
  "soft_skills": ["string"],
  "languages": [
    {
      "name": "string",
      "proficiency": "one of: Basic, Conversational, Professional Working, Fluent, Native"
    }
  ]
}

Rules:
- For work experiences, extract bullet points from descriptions. If no bullets, create them from paragraph text.
- For skills, separate hard skills (tools, software, technical) from soft skills (interpersonal, management).
- For languages, map proficiency to the closest option from: Basic, Conversational, Professional Working, Fluent, Native.
- Return ONLY valid JSON, no markdown or extra text.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "file",
                file: {
                  filename: "cv.pdf",
                  data: base64,
                  mime_type: "application/pdf",
                },
              },
              {
                type: "text",
                text: "Parse this CV/resume and extract all structured information.",
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return jsonResponse({ error: "Rate limited. Please try again in a moment.", step: "ai_parsing" }, 429);
      }
      if (aiResponse.status === 402) {
        return jsonResponse({ error: "AI credits exhausted. Please contact support.", step: "ai_parsing" }, 402);
      }
      return jsonResponse({
        error: `AI parsing failed (status ${aiResponse.status}): ${errText.substring(0, 200)}`,
        step: "ai_parsing",
      }, 500);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Strip markdown code fences if present
    let jsonStr = rawContent.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI JSON response:", jsonStr.substring(0, 500));
      return jsonResponse({
        error: "Failed to parse the AI response. The CV may have an unusual format. Please try building your profile manually.",
        step: "ai_parsing",
      }, 500);
    }

    console.log("Parse-cv completed successfully");
    return jsonResponse(parsed);
  } catch (e) {
    console.error("parse-cv unexpected error:", e);
    return jsonResponse({
      error: e instanceof Error ? e.message : "Unknown error",
      step: "unknown",
    }, 500);
  }
});
