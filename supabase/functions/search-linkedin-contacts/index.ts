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

const LINKEDIN_SEARCH_URL =
  "https://www.linkedin.com/voyager/api/search/blended";

function buildHeaders(cookie: string) {
  return {
    Cookie: `li_at=${cookie}`,
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "X-Li-Lang": "en_US",
    "X-Restli-Protocol-Version": "2.0.0",
    Accept: "application/json",
  };
}

async function searchLinkedIn(
  cookie: string,
  keywords: string
): Promise<{ raw: any; status: number }> {
  const url = new URL(LINKEDIN_SEARCH_URL);
  url.searchParams.set("keywords", keywords);
  url.searchParams.set("origin", "GLOBAL_SEARCH_HEADER");
  url.searchParams.set("count", "10");

  const res = await fetch(url.toString(), { headers: buildHeaders(cookie) });
  if (res.status === 401 || res.status === 403) {
    return { raw: null, status: res.status };
  }
  const data = await res.json();
  return { raw: data, status: res.status };
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

function extractProfiles(data: any): Contact[] {
  const contacts: Contact[] = [];
  if (!data || !data.elements) return contacts;

  for (const element of data.elements) {
    const entities = element?.elements ?? [];
    for (const entity of entities) {
      try {
        const title = entity?.title?.text ?? "";
        const headline = entity?.headline?.text ?? "";
        const subline = entity?.subline?.text ?? "";
        const image =
          entity?.image?.attributes?.[0]?.detailData?.nonEntityProfilePicture
            ?.vectorImage?.rootUrl ?? "";
        const navUrl = entity?.navigationUrl ?? "";

        // Extract connection degree
        let degree = "3rd";
        const badges = entity?.badgeText?.text ?? entity?.memberBadges?.text ?? "";
        if (
          badges.includes("1st") ||
          headline.includes("1st") ||
          subline.includes("1st")
        )
          degree = "1st";
        else if (
          badges.includes("2nd") ||
          headline.includes("2nd") ||
          subline.includes("2nd")
        )
          degree = "2nd";

        // Extract shared connections
        const sharedText = entity?.socialProofText ?? "";
        const sharedMatch = sharedText.match?.(/(\d+)\s*(shared|mutual)/i);
        const sharedCount = sharedMatch ? parseInt(sharedMatch[1], 10) : 0;

        // Parse profile URL
        let profileUrl = "";
        if (navUrl.includes("linkedin.com/in/")) {
          profileUrl = navUrl.split("?")[0];
        } else if (entity?.publicIdentifier) {
          profileUrl = `https://www.linkedin.com/in/${entity.publicIdentifier}`;
        }

        if (!title || !profileUrl) continue;

        // Try to split "Title at Company"
        let currentTitle = headline;
        let currentCompany = "";
        if (headline.includes(" at ")) {
          const parts = headline.split(" at ");
          currentTitle = parts[0].trim();
          currentCompany = parts.slice(1).join(" at ").trim();
        } else if (headline.includes(" @ ")) {
          const parts = headline.split(" @ ");
          currentTitle = parts[0].trim();
          currentCompany = parts.slice(1).join(" @ ").trim();
        }

        contacts.push({
          full_name: title,
          headline,
          current_title: currentTitle,
          current_company: currentCompany,
          profile_url: profileUrl,
          connection_degree: degree,
          profile_picture_url: image,
          shared_connections_count: sharedCount,
          is_alumni: false,
          category: "",
          priority_score: 0,
        });
      } catch {
        // skip malformed entries
      }
    }
  }
  return contacts;
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
  userSchools: string[]
): Contact[] {
  const hmRegex = /manager|lead|head|director|vp|vice president/i;
  const hrRegex = /recruiter|talent|hr\b|people/i;
  const internRegex = /intern\b/i;

  for (const c of contacts) {
    let score = 0;
    const t = c.current_title.toLowerCase();

    // +5 title matches job_title
    if (titleMatchesKeywords(c.current_title, jobTitle)) score += 5;

    // +4 hiring manager in relevant function
    if (hmRegex.test(t) && titleMatchesKeywords(c.current_title + " " + c.headline, jobFunction)) score += 4;

    // +3 HR/recruiter
    if (hrRegex.test(t)) score += 3;

    // +3 intern
    if (internRegex.test(t)) score += 3;

    // connection degree
    if (c.connection_degree === "1st") score += 4;
    else if (c.connection_degree === "2nd") score += 2;

    // alumni check
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

function categorize(contacts: Contact[], jobTitle: string, jobFunction: string): Contact[] {
  const hmRegex = /manager|lead|head|director|vp|vice president/i;
  const hrRegex = /recruiter|talent|hr\b|people/i;

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

  // First pass: assign primary categories
  for (const c of contacts) {
    if (result.length >= 6) break;
    const t = c.current_title.toLowerCase();

    let assigned = false;

    if (
      counts["In the Role"] < limits["In the Role"] &&
      titleMatchesKeywords(c.current_title, jobTitle)
    ) {
      c.category = "In the Role";
      counts["In the Role"]++;
      assigned = true;
    } else if (
      counts["Hiring Manager"] < limits["Hiring Manager"] &&
      hmRegex.test(t) &&
      titleMatchesKeywords(c.current_title + " " + c.headline, jobFunction)
    ) {
      c.category = "Hiring Manager";
      counts["Hiring Manager"]++;
      assigned = true;
    } else if (
      counts["HR and Recruiter"] < limits["HR and Recruiter"] &&
      hrRegex.test(t)
    ) {
      c.category = "HR and Recruiter";
      counts["HR and Recruiter"]++;
      assigned = true;
    } else if (
      counts["Your Network"] < limits["Your Network"] &&
      (c.connection_degree === "1st" || c.connection_degree === "2nd" || c.is_alumni)
    ) {
      c.category = "Your Network";
      counts["Your Network"]++;
      assigned = true;
    }

    if (assigned) result.push(c);
  }

  // Second pass: fill remaining slots from unused contacts
  if (result.length < 6) {
    const usedUrls = new Set(result.map((r) => r.profile_url));
    for (const c of contacts) {
      if (result.length >= 6) break;
      if (usedUrls.has(c.profile_url)) continue;

      // Find a category with remaining slots
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

  // Third pass: if still under 6, expand limits
  if (result.length < 6) {
    const usedUrls = new Set(result.map((r) => r.profile_url));
    for (const c of contacts) {
      if (result.length >= 6) break;
      if (usedUrls.has(c.profile_url)) continue;
      c.category = "Your Network";
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

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, serviceKey);
    let userId: string;

    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) {
        return json({ success: false, step: "auth", message: "Authentication failed. Please refresh and try again." });
      }
      userId = user.id;
    } else {
      return json({ success: false, step: "auth", message: "No authorization header provided." });
    }

    const body = await req.json();
    const { company_name, job_title, job_function, job_id } = body;

    if (!company_name) {
      return json({ success: false, step: "validation", message: "Company name is required." });
    }

    // Step 1: Fetch cookie and education
    const [profileRes, eduRes] = await Promise.all([
      supabase.from("profiles").select("linkedin_cookie").eq("id", userId).single(),
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

    const userSchools: string[] = (eduRes.data ?? []).map((e: any) => e.institution).filter(Boolean);

    // Step 2: Run four searches in parallel
    const searchKeywords = [
      `${job_title ?? ""} ${company_name}`.trim(),
      `${job_function ?? ""} manager lead head director ${company_name}`.trim(),
      `talent acquisition recruiter HR ${company_name}`.trim(),
      company_name,
    ];

    console.log("Running LinkedIn searches for:", searchKeywords.map((k, i) => `Search ${i + 1}: ${k}`));

    const results = await Promise.all(
      searchKeywords.map((kw) => searchLinkedIn(cookie, kw))
    );

    // Check for auth failures
    for (const r of results) {
      if (r.status === 401 || r.status === 403) {
        return json({
          success: false,
          step: "cookie_expired",
          message: "Your LinkedIn session has expired. Please update your cookie in Settings.",
        });
      }
    }

    // Step 3: Parse and combine
    let allContacts: Contact[] = [];
    for (const r of results) {
      allContacts = allContacts.concat(extractProfiles(r.raw));
    }
    allContacts = deduplicate(allContacts);

    console.log(`Found ${allContacts.length} unique profiles after deduplication`);

    // Step 4: Score
    scoreContacts(allContacts, job_title ?? "", job_function ?? "", userSchools);

    // Step 5 & 6: Categorize and take top 6
    const topContacts = categorize(allContacts, job_title ?? "", job_function ?? "");

    console.log(`Returning ${topContacts.length} categorized contacts`);

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
