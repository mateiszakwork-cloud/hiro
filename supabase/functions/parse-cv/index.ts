import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import pdfParse from "https://esm.sh/pdf-parse@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json200 = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (step: string, message: string) =>
  json200({ success: false, step, message });

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check
  if (req.method === "GET") {
    return json200({ status: "ok" });
  }

  try {
    // ── Step A: Auth ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await sb.auth.getUser();
    if (userErr || !user) {
      return fail("auth", "Session expired. Please log in again.");
    }

    // ── Determine input mode: PDF file or raw text ──
    let cvText: string;
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // ── Text paste mode: skip Steps B & C ──
      try {
        const body = await req.json();
        cvText = (body.text || "").trim();
        if (!cvText || cvText.length < 50) {
          return fail("upload", "The pasted text is too short. Please paste your full CV.");
        }
        console.log("Text paste mode: received", cvText.length, "chars");
      } catch (e) {
        console.error("JSON body read error:", e);
        return fail("upload", "Could not read the pasted text. Please try again.");
      }
    } else {
      // ── Step B: Read PDF file ──
      let pdfBytes: Uint8Array;
      try {
        const formData = await req.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) {
          return fail("upload", "No PDF file provided.");
        }
        if (file.size > 10 * 1024 * 1024) {
          return fail("upload", "File too large. Please use a CV under 10MB.");
        }
        pdfBytes = new Uint8Array(await file.arrayBuffer());
      } catch (e) {
        console.error("Upload read error:", e);
        return fail("upload", "Could not read the uploaded file. Please try again.");
      }

      // ── Step C: Extract text using pdf-parse ──
      try {
        console.log("Step C: Extracting text with pdf-parse");
        const pdfData = await pdfParse(Buffer.from(pdfBytes));
        cvText = pdfData.text || "";
        if (!cvText.trim() || cvText.trim().length < 100) {
          return fail("extraction", "Could not extract text from your PDF. Please try copy-pasting your CV as text instead.");
        }
        console.log("Step C done: extracted", cvText.length, "chars");
      } catch (e) {
        console.error("pdf-parse error:", e);
        return fail("extraction", "Could not extract text from your PDF. Please try copy-pasting your CV as text instead.");
      }
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return fail("parsing", "AI parsing is not configured on the server.");
    }

    // ── Step D: Parse extracted text into structured data ──
    try {
      console.log("Step D: Parsing CV text with OpenAI");
      const systemPrompt = `You are a CV parser. Extract all information from the CV text and return ONLY valid JSON with exactly these keys:
{
  "work_experiences": [
    {
      "company_name": "string",
      "job_title": "string",
      "location": "string or null",
      "start_month": "month name e.g. January, or null",
      "start_year": number,
      "end_month": "month name or null if current",
      "end_year": number or null,
      "is_current": boolean,
      "bullet_points": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field_of_study": "string",
      "start_year": number,
      "end_year": number or null,
      "grade": "string or null",
      "activities": "string or null"
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
- Extract ALL work experiences and ALL bullet points. Never return empty arrays if the CV contains this information.
- Extract bullet points from descriptions. If no bullets exist, create them from paragraph text.
- Separate hard skills (tools, software, technical) from soft skills (interpersonal, management).
- Map language proficiency to the closest option from: Basic, Conversational, Professional Working, Fluent, Native.
- Return ONLY valid JSON. No markdown, no code fences, no extra text.`;

      const parseRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: cvText },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (!parseRes.ok) {
        const errBody = await parseRes.text();
        console.error("OpenAI parse error:", parseRes.status, errBody);
        return fail("parsing", "Could not parse your CV content. Please try again or build your profile manually.");
      }

      const parseData = await parseRes.json();
      let rawContent = parseData.choices?.[0]?.message?.content || "";

      // Strip code fences if present
      rawContent = rawContent.trim();
      if (rawContent.startsWith("```")) {
        rawContent = rawContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      let parsed;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        console.error("JSON parse failed:", rawContent.substring(0, 500));
        return fail("parsing", "The AI returned an unexpected format. Please try again or build your profile manually.");
      }

      // ── Step E: Return success ──
      console.log("parse-cv completed successfully");
      return json200({ success: true, ...parsed });
    } catch (e) {
      console.error("Parsing error:", e);
      return fail("parsing", "Could not parse your CV content. Please try again or build your profile manually.");
    }
  } catch (e) {
    console.error("parse-cv unexpected error:", e);
    return fail("unknown", "An unexpected error occurred. Please try again.");
  }
});
