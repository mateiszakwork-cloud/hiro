import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type MessageType = "connection_note" | "cold_message";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ success: false, error: "OpenAI API key not configured." });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "No authorization header." });

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: "Authentication failed." });

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const {
      contact_id,
      job_id,
      message_type,
      vary = false,
    }: {
      contact_id?: string;
      job_id?: string;
      message_type?: MessageType;
      vary?: boolean;
    } = body || {};

    if (!contact_id || !job_id || !message_type) {
      return json({ success: false, error: "contact_id, job_id and message_type are required." });
    }
    if (message_type !== "connection_note" && message_type !== "cold_message") {
      return json({ success: false, error: "Invalid message_type." });
    }

    // Fetch context in parallel
    const [contactRes, jobRes, profileRes, workExpRes, skillsRes, eduRes] = await Promise.all([
      supabase.from("outreach_contacts").select("name, title, company, category, connection_degree, notes")
        .eq("id", contact_id).eq("user_id", user.id).single(),
      supabase.from("jobs").select("company_name, job_title, function").eq("id", job_id).eq("user_id", user.id).single(),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("work_experiences").select("company_name, job_title, bullet_points")
        .eq("user_id", user.id).order("start_year", { ascending: false }).limit(3),
      supabase.from("skills").select("hard_skills, soft_skills").eq("user_id", user.id).maybeSingle(),
      supabase.from("education").select("institution, degree, field_of_study")
        .eq("user_id", user.id).order("start_year", { ascending: false }).limit(3),
    ]);

    const contact = contactRes.data;
    const job = jobRes.data;
    if (!contact) return json({ success: false, error: "Contact not found." });
    if (!job) return json({ success: false, error: "Job not found." });

    const senderName = profileRes.data?.full_name ?? "the applicant";
    const experiences = (workExpRes.data ?? []).map((e: any) =>
      `- ${e.job_title} at ${e.company_name}: ${(e.bullet_points ?? []).slice(0, 2).join("; ")}`
    ).join("\n");
    const skillsArr = skillsRes.data
      ? [...(skillsRes.data.hard_skills ?? []), ...(skillsRes.data.soft_skills ?? [])].slice(0, 8)
      : [];
    const skills = skillsArr.join(", ");
    const schools = (eduRes.data ?? []).map((e: any) =>
      `${e.institution} (${e.degree}${e.field_of_study ? `, ${e.field_of_study}` : ""})`
    ).join("; ");

    const isConnectionNote = message_type === "connection_note";

    const systemPrompt = isConnectionNote
      ? `You write LinkedIn connection-request notes for ambitious candidates reaching out about specific roles.

HARD RULES:
- First person, written by ${senderName}.
- Maximum 280 characters. Count carefully — going over is a failure.
- Reference the recipient's actual role or company specifically. Generic openers like "I came across your profile", "I hope this finds you well", "I wanted to reach out" are banned.
- Sound like a smart peer, not a job seeker pleading. Warm, direct, human.
- One concrete reason for reaching out tied to ${job.company_name ?? "the target company"}, then a low-friction ask (a quick chat, their perspective, etc.).
- No emojis, no hashtags, no sign-off names — LinkedIn already shows the sender's name.

Return ONLY valid JSON: { "message": string }`
      : `You write longform LinkedIn cold messages / InMails for ambitious candidates reaching out about specific roles.

HARD RULES:
- First person, written by ${senderName}.
- 130-180 words. No more.
- Reference the recipient's specific role/company. No generic openers ("I came across your profile", "I hope this finds you well", etc.).
- Structure: (1) one sentence hook tied to their work or the company, (2) why ${senderName} is reaching out about this specific role, (3) one credible sentence on the most relevant experience, (4) clear, low-friction ask (15-min call or their perspective).
- Peer-to-peer tone, intellectually curious, never sycophantic.
- No emojis, no hashtags.

Return ONLY valid JSON: { "message": string }`;

    const varyInstruction = vary
      ? "\n\nIMPORTANT: Vary the approach significantly from a typical draft — use a different angle, hook, or structure than the obvious one. Surprise the reader without losing professionalism."
      : "";

    const userPrompt = `RECIPIENT
Name: ${contact.name ?? "Unknown"}
Title: ${contact.title ?? "Unknown"}
Company: ${contact.company ?? job.company_name ?? "Unknown"}
Category: ${contact.category ?? "unknown"} (in_role = peer in target role, hiring_manager = likely decision maker, recruiter = HR/talent)
Connection: ${contact.connection_degree ?? "unknown"}
Notes from ${senderName}: ${contact.notes || "none"}

TARGET ROLE
Company: ${job.company_name ?? ""}
Role: ${job.job_title ?? ""}
Function: ${job.function ?? ""}

SENDER (${senderName})
Education: ${schools || "Not specified"}
Recent experience:
${experiences || "Not specified"}
Key skills: ${skills || "Not specified"}

Write the ${isConnectionNote ? "connection-request note (≤280 chars)" : "cold message (130-180 words)"}.${varyInstruction}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: vary ? 0.95 : 0.8,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI error:", aiRes.status, errText);
      return json({ success: false, error: "AI generation failed." });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) return json({ success: false, error: "No AI response received." });

    let parsed: any;
    try { parsed = JSON.parse(content); }
    catch {
      console.error("Failed to parse AI JSON:", content);
      return json({ success: false, error: "AI returned invalid format." });
    }

    let message: string = (parsed.message ?? "").toString().trim();
    if (isConnectionNote && message.length > 300) {
      // Hard truncate to LinkedIn's 300-char limit if model overshoots
      message = message.slice(0, 297).trimEnd() + "…";
    }

    return json({ success: true, message });
  } catch (err) {
    console.error("draft-tracker-message error:", err);
    return json({ success: false, error: "An unexpected error occurred." });
  }
});