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

type MessageType = "connection_request" | "outreach";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return json({ success: false, error: "Missing API key" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "No authorization header." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: "Authentication failed." }, 401);

    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const {
      job_id,
      message_type,
    }: {
      job_id?: string;
      message_type?: MessageType;
    } = body || {};

    if (!job_id || !message_type) {
      return json({ success: false, error: "job_id and message_type are required." }, 400);
    }
    if (message_type !== "connection_request" && message_type !== "outreach") {
      return json({ success: false, error: "Invalid message_type." }, 400);
    }

    // Fetch ONLY user CV data + job posting (no contact-specific data)
    const [jobRes, profileRes, workExpRes, skillsRes, eduRes] = await Promise.all([
      supabase
        .from("jobs")
        .select("company_name, job_title, function, hard_skills, soft_skills, notes")
        .eq("id", job_id)
        .eq("user_id", user.id)
        .single(),
      supabase.from("profiles").select("full_name, base_cv_text").eq("id", user.id).single(),
      supabase
        .from("work_experiences")
        .select("company_name, job_title, bullet_points")
        .eq("user_id", user.id)
        .order("start_year", { ascending: false })
        .limit(3),
      supabase.from("skills").select("hard_skills, soft_skills").eq("user_id", user.id).maybeSingle(),
      supabase
        .from("education")
        .select("institution, degree, field_of_study")
        .eq("user_id", user.id)
        .order("start_year", { ascending: false })
        .limit(3),
    ]);

    const job = jobRes.data;
    if (!job) return json({ success: false, error: "Job not found." }, 404);

    const senderName = profileRes.data?.full_name ?? "the applicant";

    // Build a compact CV summary the model can lean on
    const experiences = (workExpRes.data ?? [])
      .map(
        (e: any) =>
          `- ${e.job_title} at ${e.company_name}: ${(e.bullet_points ?? []).slice(0, 2).join("; ")}`
      )
      .join("\n");
    const skillsArr = skillsRes.data
      ? [...(skillsRes.data.hard_skills ?? []), ...(skillsRes.data.soft_skills ?? [])].slice(0, 10)
      : [];
    const skillsLine = skillsArr.join(", ");
    const schools = (eduRes.data ?? [])
      .map(
        (e: any) =>
          `${e.institution} (${e.degree}${e.field_of_study ? `, ${e.field_of_study}` : ""})`
      )
      .join("; ");

    const cvSummary = [
      `Name: ${senderName}`,
      schools ? `Education: ${schools}` : null,
      experiences ? `Recent experience:\n${experiences}` : null,
      skillsLine ? `Key skills: ${skillsLine}` : null,
      profileRes.data?.base_cv_text
        ? `Additional CV context: ${profileRes.data.base_cv_text.slice(0, 1500)}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const hasCv =
      !!(workExpRes.data && workExpRes.data.length) ||
      !!(eduRes.data && eduRes.data.length) ||
      !!profileRes.data?.base_cv_text;

    if (!hasCv) {
      return json(
        {
          success: false,
          error: "Add your CV in Settings to enable AI-drafted messages",
        },
        400
      );
    }

    // Build job requirements string from structured fields + notes
    const jobReqBits = [
      ...((job.hard_skills as string[] | null) ?? []),
      ...((job.soft_skills as string[] | null) ?? []),
    ];
    const jobRequirements =
      (jobReqBits.length ? jobReqBits.join(", ") : "") +
      (job.notes ? `\nJob description excerpt: ${String(job.notes).slice(0, 1500)}` : "");

    const isConnection = message_type === "connection_request";

    const systemPrompt = `You are an expert at writing professional LinkedIn outreach messages for job seekers.

Write a message of type: ${message_type}
- "connection_request": max 300 characters, no greeting line
- "outreach": max 800 characters, no greeting line

Use ONLY this data:
- Applicant CV summary: ${cvSummary}
- Job title: ${job.job_title ?? ""}
- Company: ${job.company_name ?? ""}
- Key job requirements extracted from posting: ${jobRequirements || "Not specified"}

Rules:
- Do NOT invent anything about the recipient — no data on them is available
- Reference something specific from the job description or company
- Highlight 1-2 points from the CV that match the job requirements
- Sound natural and human, not like a template
- Never open with flattery ("I came across your profile and was really impressed...")
- Output ONLY the message text, nothing else`;

    const userPrompt = `Write the ${
      isConnection
        ? "connection request (≤300 characters)"
        : "outreach message (≤800 characters)"
    } now. Output only the message text.`;

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
        temperature: 0.8,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenAI error:", aiRes.status, errText);
      return json(
        { success: false, error: "Could not generate draft. Please try again." },
        502
      );
    }

    const aiData = await aiRes.json();
    let message: string = (aiData.choices?.[0]?.message?.content ?? "").toString().trim();

    if (!message) {
      return json(
        { success: false, error: "Could not generate draft. Please try again." },
        502
      );
    }

    // Strip stray surrounding quotes if the model adds them
    if (
      (message.startsWith('"') && message.endsWith('"')) ||
      (message.startsWith("\u201C") && message.endsWith("\u201D"))
    ) {
      message = message.slice(1, -1).trim();
    }

    // Hard-enforce length caps
    const cap = isConnection ? 300 : 800;
    if (message.length > cap) {
      message = message.slice(0, cap - 1).trimEnd() + "\u2026";
    }

    return json({ success: true, message });
  } catch (err: any) {
    console.error("draft-tracker-message error:", err);
    return json(
      { success: false, error: "Could not generate draft. Please try again." },
      500
    );
  }
});