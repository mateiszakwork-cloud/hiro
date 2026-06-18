import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VERIFY_LINE =
  "- Verify these on the company's official website before your interview — values pages change.";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeWebsite(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  return `https://${trimmed.replace(/\/+$/, "")}`;
}

async function jinaFetch(url: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "text/plain" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().length < 80) return null;
    return text;
  } catch (_e) {
    return null;
  }
}

async function jinaSearch(query: string, apiKey: string): Promise<string | null> {
  try {
    const res = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "text/plain" },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.trim().length < 80) return null;
    return text;
  } catch (_e) {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ success: false, error: "unauthorized", message: "Not authenticated." }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return json({ success: false, error: "unauthorized", message: "Not authenticated." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const companyName = typeof body?.companyName === "string" ? body.companyName.trim() : "";
    const companyWebsite = normalizeWebsite(body?.companyWebsite);
    if (!companyName) {
      return json({ success: false, error: "missing_company", message: "Company name is required." }, 400);
    }

    const JINA_API_KEY = Deno.env.get("JINA_API_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!JINA_API_KEY || !OPENAI_API_KEY) {
      return json({ success: false, error: "config_error", message: "Service not configured." }, 500);
    }

    // Step 1: Gather source material, prioritizing the company's own domain.
    const sources: { label: string; text: string }[] = [];

    if (companyWebsite) {
      const candidatePaths = ["/values", "/about", "/about-us", "/careers", "/culture", ""];
      for (const path of candidatePaths) {
        const url = `${companyWebsite}${path}`;
        const text = await jinaFetch(url, JINA_API_KEY);
        if (text) sources.push({ label: url, text: text.substring(0, 6000) });
        if (sources.length >= 3) break;
      }
    }

    if (sources.length === 0) {
      const searchText = await jinaSearch(`${companyName} company values official site`, JINA_API_KEY);
      if (searchText) sources.push({ label: "web search", text: searchText.substring(0, 10000) });
    }

    // Fallback: LinkedIn About via search
    if (sources.length < 2) {
      const linkedinText = await jinaSearch(`${companyName} LinkedIn about page values`, JINA_API_KEY);
      if (linkedinText) sources.push({ label: "LinkedIn search", text: linkedinText.substring(0, 6000) });
    }

    if (sources.length === 0) {
      return json({
        success: true,
        answer:
          `- Could not retrieve ${companyName}'s stated values from public sources right now.\n` +
          VERIFY_LINE,
      });
    }

    const corpus = sources
      .map((s, i) => `--- SOURCE ${i + 1} (${s.label}) ---\n${s.text}`)
      .join("\n\n");

    // Step 2: Extract the actual stated values with GPT-4o.
    const systemPrompt = `You extract a company's officially stated values from source text the user provides. Rules:
- Only return values that are explicitly stated in the source text. Do NOT invent or infer values from general knowledge.
- Prefer values from the company's own domain over third-party sources.
- Return 4 to 8 bullets. Each bullet must start with the value name wrapped in markdown bold (e.g. **Customer Obsession**) followed by " — " and a single concise line describing what the value means at this company.
- If the source text does not contain explicit values, return a single bullet saying you could not find stated values.
- Output bullets only, one per line, each prefixed with "- ". No headings, intro, or commentary.`;

    const userPrompt = `Company: ${companyName}\n\nSource text:\n${corpus.substring(0, 16000)}`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!openaiRes.ok) {
      console.error("OpenAI error:", openaiRes.status, await openaiRes.text());
      return json({ success: false, error: "ai_failed", message: "Could not extract company values." }, 200);
    }

    const aiData = await openaiRes.json();
    let content: string = aiData?.choices?.[0]?.message?.content ?? "";
    content = content.trim();

    // Normalize: ensure every line begins with "- "
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => (l.startsWith("- ") ? l : l.startsWith("•") ? "- " + l.slice(1).trim() : "- " + l.replace(/^[-*]\s*/, "")));

    // Strip any model-supplied verification line so we always append the canonical one
    const filtered = lines.filter((l) => !/verify these on the company/i.test(l));
    const answer = [...filtered, VERIFY_LINE].join("\n");

    return json({ success: true, answer });
  } catch (e) {
    console.error("fetch-company-values error:", e);
    return json({ success: false, error: "unexpected", message: "Unexpected error." }, 500);
  }
});