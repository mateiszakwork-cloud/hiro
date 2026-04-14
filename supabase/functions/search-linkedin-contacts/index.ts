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
const LINKEDIN_DASH_URL = "https://www.linkedin.com/voyager/api/search/dash/clusters";

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
  keywords: string
): Promise<{ raw: any; status: number; error?: string }> {
  const headers = buildHeaders(cookie, jsessionid);
  const encodedKeywords = encodeURIComponent(keywords);

  // --- Attempt 1: GraphQL endpoint ---
  const graphqlUrl = `${LINKEDIN_GRAPHQL_URL}?variables=(start:0,origin:SWITCH_SEARCH_VERTICAL,query:(keywords:${encodedKeywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:List((key:resultType,value:List(PEOPLE))),includeFiltersInResponse:false))&queryId=voyagerSearchDashClusters.b0928897b71bd00a5a7291755dcd64f0`;

  console.log(`[LinkedIn Attempt 1] URL: ${graphqlUrl}`);
  let res = await fetch(graphqlUrl, { headers });
  let responseBody = await res.text();
  console.log(`[LinkedIn Attempt 1] Status: ${res.status}`);
  console.log(`[LinkedIn Attempt 1] Body (first 200): ${responseBody.substring(0, 200)}`);

  // If 404, try fallback
  if (res.status === 404) {
    const dashUrl = `${LINKEDIN_DASH_URL}?decorationId=com.linkedin.voyager.dash.deco.search.SearchClusterCollection-175&origin=SWITCH_SEARCH_VERTICAL&q=all&query=(keywords:${encodedKeywords},flagshipSearchIntent:SEARCH_SRP,queryParameters:(resultType:List(PEOPLE)))&start=0&count=10`;

    console.log(`[LinkedIn Attempt 2 Fallback] URL: ${dashUrl}`);
    res = await fetch(dashUrl, { headers });
    responseBody = await res.text();
    console.log(`[LinkedIn Attempt 2 Fallback] Status: ${res.status}`);
    console.log(`[LinkedIn Attempt 2 Fallback] Body (first 200): ${responseBody.substring(0, 200)}`);
  }

  if (res.status === 401 || res.status === 403) {
    return { raw: null, status: res.status, error: "cookie_expired" };
  }
  if (res.status === 429) {
    return { raw: null, status: res.status, error: "rate_limited" };
  }
  if (res.status !== 200) {
    return { raw: null, status: res.status, error: `linkedin_error_${res.status}` };
  }

  try {
    const data = JSON.parse(responseBody);
    console.log('RAW RESPONSE SAMPLE:', JSON.stringify(data).substring(0, 2000));
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

function extractProfiles(responseData: any): Contact[] {
  const profiles: Contact[] = [];
  try {
    const searchData = responseData?.data?.data?.searchDashClustersByAll || responseData?.data?.searchDashClustersByAll || responseData;
    const elements = searchData?.elements || [];
    const included = responseData?.included || responseData?.data?.included || [];
    console.log('Elements found:', elements.length, '| Included entries:', included.length);

    if (elements.length > 0) {
      console.log('RAW ELEMENT SAMPLE:', JSON.stringify(elements[0]).substring(0, 1500));
    }
    if (included.length > 0) {
      const firstIncluded = included[0];
      const urnLikeValues = Object.entries(firstIncluded)
        .filter(([key]) => {
          const lowerKey = key.toLowerCase();
          return lowerKey.includes('urn') || key === '$id' || key === 'entityUrn';
        })
        .map(([key, value]) => [key, value]);
      console.log('First included entry keys:', Object.keys(firstIncluded));
      console.log('First included URN-like values:', urnLikeValues);
    }

    let loggedLookup = false;

    for (const cluster of elements) {
      const items = cluster?.items || [];
      for (const itemWrapper of items) {
        const item = itemWrapper?.item;
        if (!item) continue;

        if (!loggedLookup) {
          console.log('First item keys:', Object.keys(item));
        }

        const entityResultUrn = item['*entityResult'];
        if (!entityResultUrn) continue;

        const innerUrnMatch = entityResultUrn.match(/\((urn:li:fsd_profile:[^,]+),/);
        const profileUrn = innerUrnMatch?.[1];
        if (!profileUrn) continue;

        const profile =
          included.find((entry: any) => entry?.entityUrn === profileUrn) ||
          included.find((entry: any) => entry?.$id === profileUrn) ||
          included.find((entry: any) => entry?.trackingUrn === profileUrn) ||
          included.find((entry: any) => entry?.objectUrn === profileUrn);

        if (!loggedLookup) {
          console.log(
            'First extracted inner URN:',
            profileUrn,
            '| Matching included entry keys:',
            profile ? Object.keys(profile).slice(0, 10) : 'no match'
          );
          loggedLookup = true;
        }

        if (!profile) continue;

        const firstName = profile.firstName || '';
        const lastName = profile.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const headline = profile.headline || '';
        const publicIdentifier = profile.publicIdentifier || '';
        const profileUrl = publicIdentifier ? `https://www.linkedin.com/in/${publicIdentifier}` : '';

        if (!fullName || !publicIdentifier) continue;

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

        profiles.push({
          full_name: fullName,
          headline,
          current_title: currentTitle,
          current_company: currentCompany,
          profile_url: profileUrl,
          connection_degree: '3rd',
          profile_picture_url: '',
          shared_connections_count: 0,
          is_alumni: false,
          category: '',
          priority_score: 0,
        });
      }
    }
  } catch (e) {
    console.log('Extraction error:', (e as Error).message);
  }
  console.log('Extracted profiles count:', profiles.length);
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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth check with logging
    const authHeader = req.headers.get("Authorization");
    console.log("Auth header received:", authHeader ? authHeader.substring(0, 20) + "..." : "None");

    let userId: string | null = null;

    // Try token-based auth first
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      console.log("getUser() succeeded:", !!user, "error:", error?.message ?? "none");
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
      return json({ success: false, step: "auth", message: "Authentication failed. Please refresh the page and try again." });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { company_name, job_title, job_function, job_id } = body;

    if (!company_name) {
      return json({ success: false, step: "validation", message: "Company name is required." });
    }

    // Step 1: Fetch cookie, jsessionid, and education
    const [profileRes, eduRes] = await Promise.all([
      supabase.from("profiles").select("linkedin_cookie, linkedin_jsessionid").eq("id", userId).single(),
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
        message: "Please add your JSESSIONID cookie in Settings to enable LinkedIn search.",
      });
    }

    const userSchools: string[] = (eduRes.data ?? []).map((e: any) => e.institution).filter(Boolean);

    // Step 2: Run three targeted searches in parallel
    const searchKeywords = [
      `${job_title ?? ""} ${company_name}`.trim(),
      `${job_function ?? ""} manager lead head director ${company_name}`.trim(),
      `talent acquisition recruiter HR ${company_name}`.trim(),
    ];

    console.log("Running LinkedIn searches for:", searchKeywords.map((k, i) => `Search ${i + 1}: ${k}`));

    const settled = await Promise.allSettled(
      searchKeywords.map((kw) => searchLinkedIn(cookie, jsessionid, kw))
    );

    // Process results individually — failures don't block successes
    const successfulResults: { raw: any }[] = [];
    let cookieExpired = false;
    let rateLimited = false;

    for (let i = 0; i < settled.length; i++) {
      const outcome = settled[i];
      if (outcome.status === "rejected") {
        console.log(`Search ${i + 1} threw an exception:`, outcome.reason);
        continue;
      }
      const r = outcome.value;
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
      // Success
      successfulResults.push({ raw: r.raw });
    }

    // If ALL searches failed, return the most relevant error
    if (successfulResults.length === 0) {
      if (cookieExpired) {
        return json({
          success: false,
          step: "cookie_expired",
          message: "Your LinkedIn session has expired. Please update your cookie in Settings.",
        });
      }
      if (rateLimited) {
        return json({
          success: false,
          step: "rate_limited",
          message: "LinkedIn rate limit reached. Please wait a few minutes and try again.",
        });
      }
      return json({
        success: false,
        step: "all_searches_failed",
        message: "All LinkedIn searches failed. Please try again.",
      });
    }

    console.log(`${successfulResults.length} of ${searchKeywords.length} searches succeeded`);

    // Step 3: Parse and combine successful results
    let allContacts: Contact[] = [];
    for (const r of successfulResults) {
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
