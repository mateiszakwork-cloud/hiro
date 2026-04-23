import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const RAPIDAPI_HOST = "fresh-linkedin-profile-data.p.rapidapi.com";
const SEARCH_URL = `https://${RAPIDAPI_HOST}/search-employees`;
const PROFILE_URL = `https://${RAPIDAPI_HOST}/get-linkedin-profile`;

interface Contact {
  full_name: string;
  headline: string;
  current_title: string;
  current_company: string;
  profile_url: string;
  connection_degree: string;
  profile_picture_url: string;
  shared_connections_count: number;
  is_alumni: boolean;
  category: string;
  priority_score: number;
}

type SearchOutcome =
  | { ok: true; profiles: any[] }
  | { ok: false; status: number; error: string };

async function rapidSearch(
  apiKey: string,
  companyName: string,
  keyword: string,
): Promise<SearchOutcome> {
  const params = new URLSearchParams({
    company_name: companyName,
    keyword,
  });
  const url = `${SEARCH_URL}?${params.toString()}`;
  console.log(`[RapidAPI Search] ${url}`);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });
    if (res.status === 429) return { ok: false, status: 429, error: "rate_limited" };
    if (res.status === 402) return { ok: false, status: 402, error: "out_of_credits" };
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log(`[RapidAPI Search] status ${res.status}: ${text.substring(0, 200)}`);
      return { ok: false, status: res.status, error: `rapidapi_${res.status}` };
    }
    const data = await res.json();
    // Response shape can vary: try common fields
    let profiles: any[] = [];
    if (Array.isArray(data)) profiles = data;
    else if (Array.isArray(data?.data)) profiles = data.data;
    else if (Array.isArray(data?.profiles)) profiles = data.profiles;
    else if (Array.isArray(data?.results)) profiles = data.results;
    else if (Array.isArray(data?.employees)) profiles = data.employees;
    console.log(`[RapidAPI Search] returned ${profiles.length} profiles`);
    return { ok: true, profiles };
  } catch (e) {
    console.log("[RapidAPI Search] threw:", (e as Error).message);
    return { ok: false, status: 0, error: "fetch_error" };
  }
}

function pick(obj: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function normalizeProfileUrl(url: string): string {
  if (!url) return "";
  const clean = url.split("?")[0].replace(/\/+$/, "");
  return clean;
}

function mapSearchProfile(p: any): Contact | null {
  const profileUrl = normalizeProfileUrl(
    pick(p, "profile_url", "profileUrl", "linkedin_url", "linkedinUrl", "url"),
  );
  if (!profileUrl || !profileUrl.includes("linkedin.com/in/")) return null;
  const fullName = pick(p, "full_name", "fullName", "name") ||
    `${pick(p, "first_name", "firstName")} ${pick(p, "last_name", "lastName")}`.trim();
  if (!fullName) return null;
  const headline = pick(p, "headline", "sub_title", "subTitle");
  const currentTitle = pick(p, "current_job_title", "currentJobTitle", "job_title", "title") || headline;
  const currentCompany = pick(p, "current_company_name", "currentCompanyName", "company_name", "company");
  const profilePic = pick(p, "profile_image_url", "profileImageUrl", "profile_picture_url", "profilePictureUrl", "image_url");

  return {
    full_name: fullName,
    headline,
    current_title: currentTitle,
    current_company: currentCompany,
    profile_url: profileUrl,
    connection_degree: "3rd+",
    profile_picture_url: profilePic,
    shared_connections_count: 0,
    is_alumni: false,
    category: "",
    priority_score: 0,
  };
}

function deduplicate(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  return contacts.filter((c) => {
    if (seen.has(c.profile_url)) return false;
    seen.add(c.profile_url);
    return true;
  });
}

async function fetchEducation(
  apiKey: string,
  profileUrl: string,
): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      linkedin_url: profileUrl,
      include_skills: "false",
    });
    const url = `${PROFILE_URL}?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });
    if (!res.ok) {
      console.log(`[RapidAPI Profile] ${profileUrl} status ${res.status}`);
      return [];
    }
    const data = await res.json();
    const root = data?.data ?? data;
    const eduArr: any[] = Array.isArray(root?.educations)
      ? root.educations
      : Array.isArray(root?.education)
        ? root.education
        : [];
    const schools: string[] = [];
    for (const e of eduArr) {
      const s = pick(e, "school", "school_name", "institution", "name");
      if (s) schools.push(s);
    }
    return schools;
  } catch (e) {
    console.log("[RapidAPI Profile] threw:", (e as Error).message);
    return [];
  }
}

function titleMatchesKeywords(title: string, keywords: string): boolean {
  const t = title.toLowerCase();
  const words = keywords.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  let matched = 0;
  for (const w of words) if (t.includes(w)) matched++;
  return matched >= Math.ceil(words.length * 0.4);
}

function scoreContacts(
  contacts: Contact[],
  jobTitle: string,
  jobFunction: string,
  userSchools: string[],
): Contact[] {
  const hmRegex = /manager|lead|head|director|vp|vice president/i;
  const hrRegex = /recruiter|talent|hr\b|people/i;
  const internRegex = /intern\b|graduate|junior|trainee|associate/i;

  for (const c of contacts) {
    let score = 0;
    const t = c.current_title.toLowerCase();
    if (internRegex.test(t)) score += 5;
    if (c.connection_degree === "1st") score += 4;
    else if (c.connection_degree === "2nd") score += 2;
    if (hmRegex.test(t) && titleMatchesKeywords(c.current_title + " " + c.headline, jobFunction)) score += 3;
    if (hrRegex.test(t)) score += 2;
    if (titleMatchesKeywords(c.current_title, jobTitle)) score += 2;
    const isAlumni = userSchools.some((school) =>
      c.headline.toLowerCase().includes(school.toLowerCase()) ||
      c.current_title.toLowerCase().includes(school.toLowerCase())
    );
    if (isAlumni) {
      score += 3;
      c.is_alumni = true;
    }
    c.priority_score = score;
  }
  return contacts;
}

function categorize(contacts: Contact[]): Contact[] {
  const limits: Record<string, number> = {
    "In the Role": 2,
    "Hiring Manager": 1,
    "HR and Recruiter": 1,
    "Your Network": 2,
  };
  const counts: Record<string, number> = {
    "In the Role": 0,
    "Hiring Manager": 0,
    "HR and Recruiter": 0,
    "Your Network": 0,
  };
  contacts.sort((a, b) => b.priority_score - a.priority_score);
  const result: Contact[] = [];

  for (const c of contacts) {
    if (result.length >= 6) break;
    const cat = c.category && limits[c.category] !== undefined ? c.category : "Your Network";
    if (counts[cat] < limits[cat]) {
      c.category = cat;
      counts[cat]++;
      result.push(c);
    }
  }
  if (result.length < 6) {
    const usedUrls = new Set(result.map((r) => r.profile_url));
    for (const c of contacts) {
      if (result.length >= 6) break;
      if (usedUrls.has(c.profile_url)) continue;
      const preferred = c.category && limits[c.category] !== undefined ? c.category : null;
      if (preferred && counts[preferred] < limits[preferred]) {
        counts[preferred]++;
        result.push(c);
        usedUrls.add(c.profile_url);
        continue;
      }
      for (const cat of Object.keys(limits)) {
        if (counts[cat] < limits[cat]) {
          c.category = cat;
          counts[cat]++;
          result.push(c);
          usedUrls.add(c.profile_url);
          break;
        }
      }
    }
  }
  if (result.length < 6) {
    const usedUrls = new Set(result.map((r) => r.profile_url));
    for (const c of contacts) {
      if (result.length >= 6) break;
      if (usedUrls.has(c.profile_url)) continue;
      if (!c.category || limits[c.category] === undefined) c.category = "Your Network";
      result.push(c);
    }
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const rapidApiKey = Deno.env.get("RAPIDAPI_KEY");

    if (!rapidApiKey) {
      return json({
        success: false,
        step: "config",
        message: "Search unavailable. Please try again.",
      });
    }

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) userId = user.id;
    }
    const body = await req.json();
    if (!userId && body.user_id) userId = body.user_id;
    if (!userId) {
      return json({
        success: false,
        step: "auth",
        message: "Authentication failed. Please refresh the page and try again.",
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const { company_name, job_title, job_function, job_id } = body;

    if (!company_name) {
      return json({
        success: false,
        step: "validation",
        message: "Company name is required.",
      });
    }

    // Fetch user education for alumni detection
    const { data: eduData } = await supabase
      .from("education")
      .select("institution")
      .eq("user_id", userId);
    const userSchools: string[] = (eduData ?? [])
      .map((e: any) => e.institution)
      .filter(Boolean);

    // Run three searches in sequence with 1000ms delay
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const searches = [
      { keyword: job_title ?? "" },
      { keyword: `manager director head lead ${job_function ?? ""}`.trim() },
      { keyword: "recruiter talent acquisition HR" },
    ];

    const allRaw: any[] = [];
    let rateLimited = false;
    let outOfCredits = false;
    let otherError = false;

    for (let i = 0; i < searches.length; i++) {
      if (i > 0) await sleep(1000);
      const r = await rapidSearch(rapidApiKey, company_name, searches[i].keyword);
      if (r.ok) {
        allRaw.push(...r.profiles);
      } else {
        if (r.status === 429) rateLimited = true;
        else if (r.status === 402) outOfCredits = true;
        else otherError = true;
      }
    }

    if (allRaw.length === 0) {
      if (rateLimited) {
        return json({
          success: false,
          step: "rate_limited",
          message: "Search limit reached. Try again in a few minutes.",
        });
      }
      if (outOfCredits) {
        return json({
          success: false,
          step: "out_of_credits",
          message: "Monthly search credits used up. Resets next month or upgrade your RapidAPI plan.",
        });
      }
      if (otherError) {
        return json({
          success: false,
          step: "search_failed",
          message: "Search unavailable. Please try again.",
        });
      }
      return json({
        success: false,
        step: "no_results",
        message: "No matching profiles found.",
      });
    }

    // Map and deduplicate
    let allContacts: Contact[] = [];
    for (const raw of allRaw) {
      const c = mapSearchProfile(raw);
      if (c) allContacts.push(c);
    }
    allContacts = deduplicate(allContacts);
    console.log(`Mapped ${allContacts.length} unique contacts after dedup`);

    // AI classification (unchanged)
    if (allContacts.length > 0) {
      try {
        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        if (openaiKey) {
          const systemPrompt = `You are an expert recruiter assistant helping a job applicant identify who to reach out to at a target company. You will receive a list of LinkedIn profiles and details about the job being applied for. Classify each profile into exactly one category.

Category definitions:
- In the Role: this person currently does the same or very similar work to the job being applied for. They would be a peer or colleague of the applicant if hired. Use the job function and title as reference.
- Hiring Manager: this person is senior in the same function and would likely manage or oversee someone in this role. Signals include: Manager, Lead, Senior Manager, Head of, Director, VP, Principal in the relevant function.
- HR and Recruiter: this person works in talent acquisition, recruiting, HR business partnering, people operations, or similar. Signals include: Recruiter, Talent Acquisition, HR, People Partner, Talent Partner, TA.
- Your Network: does not clearly fit the above three but is still at the company and may be worth contacting.

Return ONLY a valid JSON array. Each element must have exactly these keys:
- profile_url: the exact URL string provided, unchanged
- category: exactly one of the four category names as written above
- confidence: integer 0 to 100 representing how confident you are in this classification
- reasoning: one short sentence explaining the classification

Be decisive. Every profile must have a category.`;

          const profilesPayload = allContacts.map((c) => ({
            profile_url: c.profile_url,
            full_name: c.full_name,
            current_title: c.current_title,
            headline: c.headline,
          }));

          const userMessage = `Job being applied for: ${job_title ?? ""} at ${company_name}, function: ${job_function ?? ""}
Profiles to classify: ${JSON.stringify(profilesPayload)}`;

          const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              temperature: 0,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
              ],
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const content = aiData?.choices?.[0]?.message?.content ?? "";
            let parsed: any;
            try { parsed = JSON.parse(content); } catch {}

            let arr: any[] | null = null;
            if (Array.isArray(parsed)) arr = parsed;
            else if (parsed && typeof parsed === "object") {
              for (const v of Object.values(parsed)) {
                if (Array.isArray(v)) { arr = v as any[]; break; }
              }
            }

            if (arr) {
              const validCats = new Set([
                "In the Role",
                "Hiring Manager",
                "HR and Recruiter",
                "Your Network",
              ]);
              const byUrl = new Map<string, { category: string; confidence: number }>();
              for (const item of arr) {
                if (!item || typeof item !== "object") continue;
                const url = String(item.profile_url || "");
                let cat = String(item.category || "");
                const conf = Number(item.confidence ?? 0);
                if (!validCats.has(cat)) cat = "Your Network";
                if (conf < 35) cat = "Your Network";
                if (url) byUrl.set(url, { category: cat, confidence: conf });
              }
              for (const c of allContacts) {
                const m = byUrl.get(c.profile_url);
                c.category = m ? m.category : "Your Network";
              }
            }
          }
        }
      } catch (aiErr) {
        console.error("AI classification error:", aiErr);
      }
    }

    // Score
    scoreContacts(allContacts, job_title ?? "", job_function ?? "", userSchools);

    // Categorize and pick top 6
    const topContacts = categorize(allContacts);

    // Alumni detection: only fetch full profile data for top 6 to conserve credits
    if (userSchools.length > 0 && topContacts.length > 0) {
      for (let i = 0; i < topContacts.length; i++) {
        if (i > 0) await sleep(500);
        const c = topContacts[i];
        const schools = await fetchEducation(rapidApiKey, c.profile_url);
        const isAlumni = schools.some((s) =>
          userSchools.some(
            (us) =>
              s.toLowerCase().includes(us.toLowerCase()) ||
              us.toLowerCase().includes(s.toLowerCase()),
          ),
        );
        if (isAlumni) c.is_alumni = true;
      }
    }

    console.log(`Returning ${topContacts.length} categorized contacts`);

    // Persist contacts (unchanged)
    if (job_id && topContacts.length > 0) {
      try {
        const { data: existing } = await supabase
          .from("contacts")
          .select("id, linkedin_url")
          .eq("job_id", job_id)
          .eq("user_id", userId);

        const existingByUrl = new Map<string, string>();
        for (const row of existing ?? []) {
          if (row.linkedin_url) existingByUrl.set(row.linkedin_url, row.id);
        }

        const toInsert: any[] = [];
        const toUpdate: { id: string; patch: any }[] = [];

        for (const c of topContacts) {
          const row = {
            job_id,
            user_id: userId,
            linkedin_url: c.profile_url,
            name: c.full_name,
            headline: c.headline,
            current_title: c.current_title,
            current_company: c.current_company,
            is_alumni: c.is_alumni,
            category: c.category,
            profile_picture_url: c.profile_picture_url,
            shared_connections_count: c.shared_connections_count,
            priority_score: c.priority_score,
          };
          const existingId = existingByUrl.get(c.profile_url);
          if (existingId) {
            toUpdate.push({
              id: existingId,
              patch: {
                name: row.name,
                headline: row.headline,
                current_title: row.current_title,
                current_company: row.current_company,
                is_alumni: row.is_alumni,
                category: row.category,
                profile_picture_url: row.profile_picture_url,
                shared_connections_count: row.shared_connections_count,
                priority_score: row.priority_score,
              },
            });
          } else {
            toInsert.push(row);
          }
        }

        if (toInsert.length > 0) {
          const { error: insErr } = await supabase.from("contacts").insert(toInsert);
          if (insErr) console.error("Contact insert error:", insErr);
        }
        for (const u of toUpdate) {
          const { error: updErr } = await supabase
            .from("contacts")
            .update(u.patch)
            .eq("id", u.id);
          if (updErr) console.error(`Contact update error (${u.id}):`, updErr);
        }
      } catch (persistErr) {
        console.error("Contact persistence failed:", persistErr);
      }
    }

    return json({
      success: true,
      contacts: topContacts.map((c) => ({
        full_name: c.full_name,
        headline: c.headline,
        current_title: c.current_title,
        profile_url: c.profile_url,
        connection_degree: c.connection_degree,
        profile_picture_url: c.profile_picture_url,
        shared_connections_count: c.shared_connections_count,
        is_alumni: c.is_alumni,
        category: c.category,
        priority_score: c.priority_score,
      })),
    });
  } catch (err) {
    console.error("search-linkedin-contacts error:", err);
    return json({
      success: false,
      step: "unknown",
      message: "Search unavailable. Please try again.",
    });
  }
});
