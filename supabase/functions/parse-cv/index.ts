import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const fail = (step: string, message: string) =>
  ok({ success: false, step, message });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // GET health check
  if (req.method === "GET") {
    return ok({ status: "ok" });
  }

  try {
    // --- Step 1: Read multipart form data with the PDF ---
    let pdfBytes: Uint8Array;
    try {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!file || !(file instanceof File)) {
        return fail("upload", "No PDF file was provided. Please try again.");
      }
      if (file.size > 10 * 1024 * 1024) {
        return fail("upload", "Your CV is too large. Please use a version under 10 MB.");
      }
      pdfBytes = new Uint8Array(await file.arrayBuffer());
    } catch (e) {
      console.error("Upload read error:", e);
      return fail("upload", "Could not read the uploaded file. Please try again.");
    }

    // --- Step 2: Convert PDF to base64 and extract text via OpenAI Vision ---
    let cvText: string;
    try {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) {
        return fail("extraction", "AI text extraction is not configured on the server.");
      }

      // Build base64 in chunks to avoid stack overflow
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < pdfBytes.length; i += chunkSize) {
        const chunk = pdfBytes.subarray(i, i + chunkSize);
        binary += String.fromCharCode(...chunk);
      }
      const base64 = btoa(binary);

      console.log("Step 2: Sending PDF to OpenAI for text extraction");
      const extractRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: `data:application/pdf;base64,${base64}` },
                },
                {
                  type: "text",
                  text: "Extract all text content from this PDF CV and return it as plain text preserving all information and structure. Return ONLY the extracted text, nothing else.",
                },
              ],
            },
          ],
          max_tokens: 4096,
        }),
      });

      if (!extractRes.ok) {
        const errBody = await extractRes.text();
        console.error("OpenAI extraction error:", extractRes.status, errBody);
        return fail("extraction", "Could not read your PDF. Make sure it is a text-based PDF, not a scanned image.");
      }

      const extractData = await extractRes.json();
      cvText = extractData.choices?.[0]?.message?.content || "";
      if (!cvText.trim()) {
        return fail("extraction", "No text could be extracted from your PDF. Please try a different file.");
      }
      console.log("Step 2 done: extracted", cvText.length, "chars");
    } catch (e) {
      console.error("Extraction error:", e);
      return fail("extraction", "Could not read your PDF. Please try again.");
    }

    // --- Step 3: Parse extracted text into structured data via OpenAI ---
    try {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

      const systemPrompt = `You are a CV/resume parser. Parse the following CV text and return ONLY valid JSON (no markdown, no code fences) with these exact keys:

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
- Extract bullet points from descriptions. If no bullets exist, create them from paragraph text.
- Separate hard skills (tools, software, technical) from soft skills (interpersonal, management).
- Map language proficiency to the closest option from: Basic, Conversational, Professional Working, Fluent, Native.
- Return ONLY valid JSON. No markdown, no code fences, no extra text.`;

      console.log("Step 3: Parsing CV text with OpenAI");
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

      console.log("Parse-cv completed successfully");
      return ok({ success: true, ...parsed });
    } catch (e) {
      console.error("Parsing error:", e);
      return fail("parsing", "Could not parse your CV content. Please try again or build your profile manually.");
    }
  } catch (e) {
    console.error("parse-cv unexpected error:", e);
    return fail("upload", e instanceof Error ? e.message : "An unexpected error occurred. Please try again.");
  }
});
