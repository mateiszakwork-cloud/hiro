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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) return json({ success: false, error: "OpenAI API key not configured." });

    // Step 1 - Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "No authorization header." });

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ success: false, error: "Authentication failed." });

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { contact_id, job_id, message_type = "both" } = body;

    if (!contact_id || !job_id) return json({ success: false, error: "contact_id and job_id are required." });

    // Step 2 - Fetch data in parallel
    const [contactRes, jobRes, profileRes, workExpRes, skillsRes, eduRes] = await Promise.all([
      supabase.from("contacts").select("name, headline, current_title, connection_note_draft, inmail_draft, inmail_subject_draft, is_alumni").eq("id", contact_id).eq("user_id", user.id).single(),
      supabase.from("jobs").select("company_name, job_title, function").eq("id", job_id).eq("user_id", user.id).single(),
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase.from("work_experiences").select("company_name, job_title, bullet_points").eq("user_id", user.id).order("start_year", { ascending: false }).limit(3),
      supabase.from("skills").select("hard_skills, soft_skills").eq("user_id", user.id).single(),
      supabase.from("education").select("institution, degree, field_of_study").eq("user_id", user.id),
    ]);

    const contact = contactRes.data;
    const job = jobRes.data;
    const profile = profileRes.data;
    if (!contact || !job) return json({ success: false, error: "Contact or job not found." });

    const senderName = profile?.full_name ?? "the applicant";
    const experiences = (workExpRes.data ?? []).map((e: any) =>
      `${e.job_title} at ${e.company_name}: ${(e.bullet_points ?? []).slice(0, 3).join("; ")}`
    ).join("\n");
    const skills = skillsRes.data
      ? [...(skillsRes.data.hard_skills ?? []), ...(skillsRes.data.soft_skills ?? [])].slice(0, 10).join(", ")
      : "";
    const schools = (eduRes.data ?? []).map((e: any) => `${e.institution} (${e.degree} in ${e.field_of_study})`).join(", ");

    // Step 3 - Build prompt
    const systemPrompt = `You are an expert at writing highly personalised LinkedIn outreach for ambitious graduate students targeting competitive internships at top companies. You write in a confident, direct, human tone. Never corporate, never sycophantic, never generic.

Return ONLY valid JSON with these keys:

connection_note: string, MAXIMUM 300 characters, this is a hard limit. Structure: casual opening referencing something specific about the contact or their company, one sentence on genuine interest in the role or company, one low-friction ask for a quick call or their perspective. Personalisation priority: if is_alumni use shared school background as the opener. If connection_degree is 1st reference the existing connection. If 2nd reference shared connections. Always mention the specific role. Tone: like a smart peer reaching out, not a job seeker begging. Count characters precisely before returning.

inmail_subject: string, maximum 60 characters, specific and intriguing, references a challenge or opportunity relevant to their function

inmail: string, 130-160 words. This is for high-priority senior contacts only. Structure: (1) One sentence opening referencing something specific about their role, a challenge common in their function, or a recent company development. (2) Express genuine curiosity about a specific challenge their team likely faces — ask about it on a high level without being presumptuous. (3) Offer to come back with a concrete plan or framework for how you would approach that challenge — position the sender as someone who does the work not just talks about it. (4) One sentence on the sender's most relevant experience that makes this credible. (5) Clear ask for a 15-minute call. Tone: peer-to-peer, intellectually curious, consultative. Never use the phrase "I hope this message finds you well."`;

    const userPrompt = `Generate outreach messages for this context:

SENDER:
Name: ${senderName}
Education: ${schools || "Not specified"}
Recent experience:
${experiences || "Not specified"}
Key skills: ${skills || "Not specified"}

RECIPIENT:
Name: ${contact.name ?? "Unknown"}
Headline: ${contact.headline ?? ""}
Current title: ${contact.current_title ?? ""}
Is alumni: ${contact.is_alumni ? "Yes — shared school background" : "No"}

TARGET JOB:
Company: ${job.company_name ?? ""}
Role: ${job.job_title ?? ""}
Function: ${job.function ?? ""}

Generate ${message_type === "connection_note" ? "only the connection_note" : message_type === "inmail" ? "only the inmail_subject and inmail" : "all three: connection_note, inmail_subject, and inmail"}.`;

    console.log("Calling OpenAI for outreach drafts...");

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
    try {
      parsed = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI JSON:", content);
      return json({ success: false, error: "AI returned invalid format." });
    }

    const connectionNote = parsed.connection_note ?? null;
    const inmailSubject = parsed.inmail_subject ?? null;
    const inmail = parsed.inmail ?? null;

    // Step 4 - Save to contacts table
    const updatePayload: Record<string, any> = {};
    if (message_type === "connection_note" || message_type === "both") {
      updatePayload.connection_note_draft = connectionNote;
    }
    if (message_type === "inmail" || message_type === "both") {
      updatePayload.inmail_subject_draft = inmailSubject;
      updatePayload.inmail_draft = inmail;
    }

    const { error: updateErr } = await supabase
      .from("contacts")
      .update(updatePayload)
      .eq("id", contact_id)
      .eq("user_id", user.id);

    if (updateErr) {
      console.error("Failed to save drafts:", updateErr);
      return json({ success: false, error: "Failed to save drafts." });
    }

    // Step 5 - Return
    return json({
      success: true,
      connection_note: connectionNote,
      inmail_subject: inmailSubject,
      inmail,
    });
  } catch (err) {
    console.error("draft-outreach-messages error:", err);
    return json({ success: false, error: "An unexpected error occurred." });
  }
});
