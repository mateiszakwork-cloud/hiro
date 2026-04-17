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

const LINKEDIN_GRAPHQL_URL = "https://www.linkedin.com/voyager/api/graphql";
const LINKEDIN_DASH_URL =
  "https://www.linkedin.com/voyager/api/search/dash/clusters";

function buildHeaders(cookie: string, jsessionid: string) {
  const headers: Record<string, string> = {
    Cookie: `li_at=${cookie}; JSESSIONID=${jsessionid}`,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "x-li-lang": "en_US",
    "x-restli-protocol-version": "2.0.0",
    "x-li-track": JSON.stringify({
      clientVersion: "1.13.1",
      mpVersion: "1.13.1",
      osName: "web",
      timezoneOffset: 1,
      timezone: "Europe/Lisbon",
      deviceFormFactor: "DESKTOP",
      mpName: "voyager-web",
      displayDensity: 1,
      displayWidth: 1920,
      displayHeight: 1080,
    }),
    Accept: "application/vnd.linkedin.normalized+json+2.1",
    "csrf-token": jsessionid,
  };
  return headers;
}

async function searchLinkedIn(
  cookie: string,
  jsessionid: string,
  keywords: string,
): Promise<{ raw: any; status: number; error?: string }> {
  const headers = buildHeaders(cookie, jsessionid);
  const encodedKeywords = encodeURIComponent(keywords);

  // --- Attempt 1: GraphQL endpoint ---
  const graphqlUrl =
    `${LINKEDIN_GRAPHQL_URL}?variables=(start:0,origin:SWITCH_SEARCH_VERTICAL,query:(keywords:${encodedKeywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE))),includeFiltersInResponse:false))&queryId=voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0`;

  console.log(`[LinkedIn Attempt 1] URL: ${graphqlUrl}`);
  let res = await fetch(graphqlUrl, { headers, redirect: 'manual' });
  if (res.status >= 300 && res.status < 400 || res.type === 'opaqueredirect') {
    return { raw: null, status: res.status, error: "LinkedIn redirected — session may be expired or IP blocked" };
  }
  let responseBody = await res.text();
  console.log(`[LinkedIn Attempt 1] Status: ${res.status}`);
  console.log(
    `[LinkedIn Attempt 1] Body (first 200): ${responseBody.substring(0, 200)}`,
  );

  // If 404, try fallback
  if (res.status === 404) {
    const dashUrl =
      `${LINKEDIN_DASH_URL}?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-175&origin=SWITCH_SEARCH_VERTICAL&q=all&query=(keywords:${encodedKeywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE)))&start=0&count=10`;

    console.log(`[LinkedIn Attempt 2 Fallback] URL: ${dashUrl}`);
    res = await fetch(dashUrl, { headers, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 || res.type === 'opaqueredirect') {
      return { raw: null, status: res.status, error: "LinkedIn redirected — session may be expired or IP blocked" };
    }
    responseBody = await res.text();
    console.log(`[LinkedIn Attempt 2 Fallback] Status: ${res.status}`);
    console.log(
      `[LinkedIn Attempt 2 Fallback] Body (first 200): ${
        responseBody.substring(0, 200)
      }`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    return { raw: null, status: res.status, error: "cookie_expired" };
  }
  if (res.status === 429) {
    return { raw: null, status: res.status, error: "rate_limited" };
  }
  if (res.status !== 200) {
    return {
      raw: null,
      status: res.status,
      error: `linkedin_error_${res.status}`,
    };
  }

  try {
    const data = JSON.parse(responseBody);
    console.log(
      "RAW RESPONSE SAMPLE:",
      JSON.stringify(data).substring(0, 2000),
    );
    return { raw: data, status: res.status };
  } catch {
    console.log(`[LinkedIn] Failed to parse JSON`);
    return { raw: null, status: res.status, error: "parse_error" };
  }
}

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

function extractProfileUrls(responseData: any): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  try {
    const jsonStr = JSON.stringify(responseData);
    const regex = /"navigationUrl":"(https:\/\/www\.linkedin\.com\/in\/[^"]+)"/g;
    const urlMatches = [...jsonStr.matchAll(regex)];
    console.log('Profile URLs found in search:', urlMatches.length);

    for (const match of urlMatches) {
      // Clean the URL — remove query params
      const rawUrl = match[1];
      const cleanUrl = rawUrl.split('?')[0].replace(/\/+$/, '');
      if (seen.has(cleanUrl)) continue;
      seen.add(cleanUrl);
      urls.push(cleanUrl);
    }
  } catch (e) {
    console.log('URL extraction error:', (e as Error).message);
  }

  console.log('Unique profile URLs extracted:', urls.length);
  return urls;
}

const LINKEDIN_PROFILE_API = "https://www.linkedin.com/voyager/api/identity/dash/profiles";

async function lookupProfile(
  publicIdentifier: string,
  cookie: string,
  jsessionid: string,
  isFirst: boolean,
): Promise<Contact | null> {
  try {
    const headers = buildHeaders(cookie, jsessionid);
    const url = `${LINKEDIN_PROFILE_API}?q=memberIdentity&memberIdentity=${encodeURIComponent(publicIdentifier)}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-88`;

    const res = await fetch(url, { headers, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400 || res.type === 'opaqueredirect') {
      console.log(`Profile lookup ${publicIdentifier}: LinkedIn redirected — session may be expired`);
      return null;
    }
    if (res.status !== 200) {
      console.log(`Profile lookup ${publicIdentifier}: status ${res.status}`);
      return null;
    }

    const data = await res.json();

    if (isFirst) {
      console.log('First profile lookup response keys:', Object.keys(data));
      // Log keys of first element if present
      if (data.elements && data.elements.length > 0) {
        console.log('First element keys:', Object.keys(data.elements[0]));
      }
      if (data.included && data.included.length > 0) {
        console.log('First included keys:', Object.keys(data.included[0]));
      }
    }

    // Try to find profile data in elements or top-level
    let firstName = '';
    let lastName = '';
    let headline = '';

    // Check elements array first
    if (data.elements && data.elements.length > 0) {
      const el = data.elements[0];
      firstName = el.firstName || '';
      lastName = el.lastName || '';
      headline = el.headline || '';
    }

    // Fallback: scan included array for profile with firstName
    if (!firstName && data.included) {
      const profileEntry = data.included.find((entry: any) => entry.firstName);
      if (profileEntry) {
        firstName = profileEntry.firstName || '';
        lastName = profileEntry.lastName || '';
        headline = profileEntry.headline || '';
      }
    }

    // Fallback: top-level fields
    if (!firstName) {
      firstName = data.firstName || '';
      lastName = data.lastName || '';
      headline = data.headline || '';
    }

    const fullName = `${firstName} ${lastName}`.trim();
    if (!fullName || fullName.length < 2) {
      console.log(`Profile lookup ${publicIdentifier}: no name found`);
      return null;
    }

    let currentTitle = headline;
    let currentCompany = '';
    if (headline.includes(' at ')) {
      const parts = headline.split(' at ');
      currentTitle = parts[0].trim();
      currentCompany = parts.slice(1).join(' at ').trim();
    } else if (headline.includes(' @ ')) {
      const parts = headline.split(' @ ');
      currentTitle = parts[0].trim();
      currentCompany = parts.slice(1).join(' @ ').trim();
    }

    return {
      full_name: fullName,
      headline,
      current_title: currentTitle,
      current_company: currentCompany,
      profile_url: `https://www.linkedin.com/in/${publicIdentifier}`,
      connection_degree: '3rd+',
      profile_picture_url: '',
      shared_connections_count: 0,
      is_alumni: false,
      category: '',
      priority_score: 0,
    };
  } catch (e) {
    console.log(`Profile lookup ${publicIdentifier} error:`, (e as Error).message);
    return null;
  }
}

async function extractProfiles(
  responseData: any,
  cookie: string,
  jsessionid: string,
  maxLookups: number = 5,
): Promise<Contact[]> {
  const urls = extractProfileUrls(responseData);

  // Extract public identifiers from URLs and limit
  const identifiers = urls
    .map((u) => {
      const parts = u.split('/in/');
      return parts.length > 1 ? parts[1] : null;
    })
    .filter(Boolean)
    .slice(0, maxLookups) as string[];

  console.log(`Looking up ${identifiers.length} profiles:`, identifiers);

  // Run lookups in parallel
  const results = await Promise.all(
    identifiers.map((id, i) => lookupProfile(id, cookie, jsessionid, i === 0)),
  );

  const profiles = results.filter(Boolean) as Contact[];
  console.log(`Profile lookups returned ${profiles.length} contacts`);
  return profiles;
}

function deduplicate(contacts: Contact[]): Contact[] {
  const seen = new Set<string>();
  return contacts.filter((c) => {
    if (seen.has(c.profile_url)) return false;
    seen.add(c.profile_url);
    return true;
  });
}

function titleMatchesKeywords(title: string, keywords: string): boolean {
  const t = title.toLowerCase();
  const words = keywords
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  let matched = 0;
  for (const w of words) {
    if (t.includes(w)) matched++;
  }
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

    // +5 intern / recent joiner
    if (internRegex.test(t)) score += 5;

    // +4 1st-degree connection (+2 for 2nd)
    if (c.connection_degree === "1st") score += 4;
    else if (c.connection_degree === "2nd") score += 2;

    // +3 hiring manager in relevant function
    if (
      hmRegex.test(t) &&
      titleMatchesKeywords(c.current_title + " " + c.headline, jobFunction)
    ) score += 3;

    // +2 HR / recruiter
    if (hrRegex.test(t)) score += 2;

    // small bonus when title matches job title
    if (titleMatchesKeywords(c.current_title, jobTitle)) score += 2;

    // +3 alumni
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

function categorize(
  contacts: Contact[],
  _jobTitle: string,
  _jobFunction: string,
): Contact[] {
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

  // Sort by score descending
  contacts.sort((a, b) => b.priority_score - a.priority_score);

  const result: Contact[] = [];

  // First pass: respect each contact's pre-assigned (AI) category, enforce per-category limits
  for (const c of contacts) {
    if (result.length >= 6) break;
    const cat = c.category && limits[c.category] !== undefined ? c.category : "Your Network";
    if (counts[cat] < limits[cat]) {
      c.category = cat;
      counts[cat]++;
      result.push(c);
    }
  }

  // Second pass: fill remaining slots, preferring each contact's AI category
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

  // Third pass: if still under 6, fall back to Your Network
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

    // Auth check with logging
    const authHeader = req.headers.get("Authorization");
    console.log(
      "Auth header received:",
      authHeader ? authHeader.substring(0, 20) + "..." : "None",
    );

    let userId: string | null = null;

    // Try token-based auth first
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      console.log(
        "getUser() succeeded:",
        !!user,
        "error:",
        error?.message ?? "none",
      );
      if (user) userId = user.id;
    }

    // Fallback: read user_id from request body (parsed later, so we peek)
    const body = await req.json();

    if (!userId) {
      console.log("Token auth failed, falling back to user_id from body");
      // Accept user_id from frontend as fallback
      if (body.user_id) {
        userId = body.user_id;
      }
    }

    if (!userId) {
      return json({
        success: false,
        step: "auth",
        message:
          "Authentication failed. Please refresh the page and try again.",
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

    // Step 1: Fetch cookie, jsessionid, and education
    const [profileRes, eduRes] = await Promise.all([
      supabase.from("profiles").select("linkedin_cookie, linkedin_jsessionid")
        .eq("id", userId).single(),
      supabase.from("education").select("institution").eq("user_id", userId),
    ]);

    const cookie = profileRes.data?.linkedin_cookie;
    if (!cookie) {
      return json({
        success: false,
        step: "no_cookie",
        message: "Please add your LinkedIn session cookie in Settings first.",
      });
    }

    const jsessionid = profileRes.data?.linkedin_jsessionid;
    if (!jsessionid) {
      return json({
        success: false,
        step: "no_jsessionid",
        message:
          "Please add your JSESSIONID cookie in Settings to enable LinkedIn search.",
      });
    }

    const userSchools: string[] = (eduRes.data ?? []).map((e: any) =>
      e.institution
    ).filter(Boolean);

    // Step 2: Run three targeted searches in parallel
    // Search 1: interns and recent joiners first
    // Search 2: hiring manager
    // Search 3: HR / recruiter
    const searchKeywords = [
      `${company_name} intern ${job_function ?? ""}`.trim(),
      `${job_function ?? ""} manager lead head director ${company_name}`.trim(),
      `talent acquisition recruiter HR ${company_name}`.trim(),
    ];

    console.log(
      "Running LinkedIn searches for:",
      searchKeywords.map((k, i) => `Search ${i + 1}: ${k}`),
    );

    // Run sequentially with 1500ms delay between requests to reduce rate limiting
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const successfulResults: { raw: any }[] = [];
    let cookieExpired = false;
    let rateLimited = false;

    for (let i = 0; i < searchKeywords.length; i++) {
      if (i > 0) await sleep(1500);
      try {
        const r = await searchLinkedIn(cookie, jsessionid, searchKeywords[i]);
        if (r.error === "cookie_expired") {
          console.log(`Search ${i + 1} failed: cookie_expired`);
          cookieExpired = true;
          continue;
        }
        if (r.error === "rate_limited") {
          console.log(`Search ${i + 1} failed: rate_limited`);
          rateLimited = true;
          continue;
        }
        if (r.error) {
          console.log(`Search ${i + 1} failed: ${r.error}`);
          continue;
        }
        successfulResults.push({ raw: r.raw });
      } catch (err) {
        console.log(`Search ${i + 1} threw an exception:`, (err as Error).message);
        continue;
      }
    }

    // If ALL searches failed, return the most relevant error
    if (successfulResults.length === 0) {
      if (cookieExpired) {
        return json({
          success: false,
          step: "cookie_expired",
          message:
            "Your LinkedIn session has expired. Please update your cookie in Settings.",
        });
      }
      if (rateLimited) {
        return json({
          success: false,
          step: "rate_limited",
          message:
            "LinkedIn rate limit reached. Please wait a few minutes and try again.",
        });
      }
      return json({
        success: false,
        step: "all_searches_failed",
        message: "All LinkedIn searches failed. Please try again.",
      });
    }

    console.log(
      `${successfulResults.length} of ${searchKeywords.length} searches succeeded`,
    );

    // Step 3: Parse and combine successful results (with individual profile lookups)
    let allContacts: Contact[] = [];
    for (const r of successfulResults) {
      const contacts = await extractProfiles(r.raw, cookie, jsessionid, 5);
      allContacts = allContacts.concat(contacts);
    }
    allContacts = deduplicate(allContacts);

    console.log(
      `Found ${allContacts.length} unique profiles after deduplication`,
    );

    // Step 3.5: AI classification of profiles into categories
    if (allContacts.length > 0) {
      try {
        const openaiKey = Deno.env.get("OPENAI_API_KEY");
        if (!openaiKey) {
          console.log("OPENAI_API_KEY not set — skipping AI classification");
        } else {
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

Be decisive. Every profile must have a category. When in doubt between In the Role and Hiring Manager, use seniority signals in the title to decide.`;

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

          if (!aiRes.ok) {
            console.error("AI classification failed:", aiRes.status, await aiRes.text());
          } else {
            const aiData = await aiRes.json();
            const content = aiData?.choices?.[0]?.message?.content ?? "";
            let parsed: any;
            try {
              parsed = JSON.parse(content);
            } catch (e) {
              console.error("AI response JSON parse failed:", e);
            }

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
              const breakdown: Record<string, number> = {
                "In the Role": 0,
                "Hiring Manager": 0,
                "HR and Recruiter": 0,
                "Your Network": 0,
              };
              for (const c of allContacts) {
                const m = byUrl.get(c.profile_url);
                c.category = m ? m.category : "Your Network";
                breakdown[c.category] = (breakdown[c.category] ?? 0) + 1;
              }
              console.log(
                `AI classified ${byUrl.size} profiles: ${Object.entries(breakdown).map(([k, v]) => `${k}=${v}`).join(", ")}`,
              );
            } else {
              console.error("AI classification: no array in response");
            }
          }
        }
      } catch (aiErr) {
        console.error("AI classification error:", aiErr);
      }
    }

    // Step 4: Score (uses AI-assigned categories where available)
    scoreContacts(
      allContacts,
      job_title ?? "",
      job_function ?? "",
      userSchools,
    );

    // Step 5 & 6: Categorize and take top 6 (respects AI categories already on contacts)
    const topContacts = categorize(
      allContacts,
      job_title ?? "",
      job_function ?? "",
    );

    console.log(`Returning ${topContacts.length} categorized contacts`);

    // Step 6.5: Persist contacts to database (upsert by linkedin_url + job_id)
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
            connection_degree: c.connection_degree,
            is_alumni: c.is_alumni,
            category: c.category,
            profile_picture_url: c.profile_picture_url,
            shared_connections_count: c.shared_connections_count,
            priority_score: c.priority_score,
          };
          const existingId = existingByUrl.get(c.profile_url);
          if (existingId) {
            // Update only enrichment fields, never overwrite outreach_status / drafts
            toUpdate.push({
              id: existingId,
              patch: {
                name: row.name,
                headline: row.headline,
                current_title: row.current_title,
                current_company: row.current_company,
                connection_degree: row.connection_degree,
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
          else console.log(`Inserted ${toInsert.length} new contacts`);
        }
        for (const u of toUpdate) {
          const { error: updErr } = await supabase
            .from("contacts")
            .update(u.patch)
            .eq("id", u.id);
          if (updErr) console.error(`Contact update error (${u.id}):`, updErr);
        }
        if (toUpdate.length > 0) console.log(`Updated ${toUpdate.length} existing contacts`);
      } catch (persistErr) {
        console.error("Contact persistence failed:", persistErr);
      }
    }

    // Step 7: Return
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
      message: "An unexpected error occurred. Please try again.",
    });
  }
});
