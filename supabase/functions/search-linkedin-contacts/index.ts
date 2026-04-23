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
const COMPANY_BY_DOMAIN_URL = `https://${RAPIDAPI_HOST}/get-company-by-domain`;
const SEARCH_COMPANIES_URL = `https://${RAPIDAPI_HOST}/search-companies`;
const SEARCH_EMPLOYEES_URL = `https://${RAPIDAPI_HOST}/search-employees`;
const EXTRA_PROFILE_URL = `https://${RAPIDAPI_HOST}/get-extra-profile-data`;

interface Contact {
  full_name: string;
  headline: string;
  current_title: string;
  current_company: string;
  profile_url: string;
  profile_urn: string;
  connection_degree: string;
  profile_picture_url: string;
  shared_connections_count: number;
  is_alumni: boolean;
  category: string;
  priority_score: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function deriveDomain(companyName: string): string {
  const cleaned = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return `${cleaned}.com`;
}

function pick(obj: any, ...keys: string[]): string {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

function normalizeProfileUrl(url: string): string {
  if (!url) return "";
  return url.split("?")[0].replace(/\/+$/, "");
}

async function getCompanyIdByDomain(
  apiKey: string,
  domain: string,
): Promise<string | null> {
  try {
    const url = `${COMPANY_BY_DOMAIN_URL}?domain=${encodeURIComponent(domain)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });
    if (!res.ok) {
      console.log(`[CompanyByDomain] status ${res.status}`);
      return null;
    }
    const data = await res.json();
    const root = data?.data ?? data;
    const id = pick(root, "id", "company_id", "linkedin_id", "companyId");
    return id || null;
  } catch (e) {
    console.log("[CompanyByDomain] threw:", (e as Error).message);
    return null;
  }
}

async function getCompanyIdBySearch(
  apiKey: string,
  companyName: string,
): Promise<string | null> {
  try {
    const res = await fetch(SEARCH_COMPANIES_URL, {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keywords: companyName, limit: 1 }),
    });
    if (!res.ok) {
      console.log(`[SearchCompanies] status ${res.status}`);
      return null;
    }
    const data = await res.json();
    let arr: any[] = [];
    if (Array.isArray(data)) arr = data;
    else if (Array.isArray(data?.data)) arr = data.data;
    else if (Array.isArray(data?.companies)) arr = data.companies;
    else if (Array.isArray(data?.results)) arr = data.results;
    if (arr.length === 0) return null;
    const id = pick(arr[0], "id", "company_id", "linkedin_id", "companyId");
    return id || null;
  } catch (e) {
    console.log("[SearchCompanies] threw:", (e as Error).message);
    return null;
  }
}

async function searchEmployees(
  apiKey: string,
  companyId: string,
  titleKeywords: string[],
  limit: number,
): Promise<any[]> {
  try {
    const res = await fetch(SEARCH_EMPLOYEES_URL, {
      method: "POST",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        current_company_ids: [companyId],
        title_keywords: titleKeywords,
        limit,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.log(
        `[SearchEmployees] keywords=${JSON.stringify(titleKeywords)} status ${res.status}: ${text.substring(0, 200)}`,
      );
      return [];
    }
    const data = await res.json();
    let profiles: any[] = [];
    if (Array.isArray(data)) profiles = data;
    else if (Array.isArray(data?.data)) profiles = data.data;
    else if (Array.isArray(data?.profiles)) profiles = data.profiles;
    else if (Array.isArray(data?.results)) profiles = data.results;
    else if (Array.isArray(data?.employees)) profiles = data.employees;
    return profiles;
  } catch (e) {
    console.log("[SearchEmployees] threw:", (e as Error).message);
    return [];
  }
}

function mapProfile(p: any): Contact | null {
  const profileUrl = normalizeProfileUrl(
    pick(p, "linkedin_url", "profile_url", "linkedinUrl", "profileUrl", "url"),
  );
  if (!profileUrl || !profileUrl.includes("linkedin.com/in/")) return null;
  const fullName = pick(p, "full_name", "fullName", "name") ||
    `${pick(p, "first_name", "firstName")} ${pick(p, "last_name", "lastName")}`.trim();
  if (!fullName) return null;
  const headline = pick(p, "headline", "sub_title", "subTitle");
  const currentTitle = pick(
    p,
    "current_job_title",
    "currentJobTitle",
    "job_title",
    "title",
  ) || headline;
  const currentCompany = pick(
    p,
    "current_company_name",
    "currentCompanyName",
    "company_name",
    "company",
  );
  const profilePic = pick(
    p,
    "profile_image_url",
    "profileImageUrl",
    "profile_picture_url",
    "profilePictureUrl",
    "image_url",
  );
  const urn = pick(p, "urn", "profile_urn", "profileUrn", "id");

  return {
    full_name: fullName,
    headline,
    current_title: currentTitle,
    current_company: currentCompany,
    profile_url: profileUrl,
    profile_urn: urn,
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

async function fetchExtraProfile(
  apiKey: string,
  urn: string,
  profileUrl: string,
): Promise<string[]> {
  try {
    const params = new URLSearchParams({
      include_languages: "false",
      include_certifications: "false",
      include_publications: "false",
      include_honors: "false",
      include_patents: "false",
      include_courses: "false",
      include_projects: "false",
      include_volunteers: "false",
      include_organizations: "false",
    });
    if (urn) params.set("urn", urn);
    else if (profileUrl) params.set("linkedin_url", profileUrl);
    const url = `${EXTRA_PROFILE_URL}?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": RAPIDAPI_HOST,
      },
    });
    if (!res.ok) {
      console.log(`[ExtraProfile] urn=${urn} status ${res.status}`);
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
    console.log("[ExtraProfile] threw:", (e as Error).message);
    return [];
  }
}

function categorizeAndScore(
  contacts: Contact[],
  jobFunction: string,
): Contact[] {
  const hmRegex = /manager|lead|head|director|vp|vice president|principal/i;
  const hrRegex = /recruiter|talent|hr\b|people|human resources/i;
  const internRegex = /intern\b|graduate|junior|trainee|associate/i;

  for (const c of contacts) {
    const t = (c.current_title + " " + c.headline).toLowerCase();
    let score = 0;
    let cat = "Your Network";
    if (hrRegex.test(t)) {
      cat = "HR and Recruiter";
      score += 3;
    } else if (hmRegex.test(t)) {
      cat = "Hiring Manager";
      score += 4;
    } else if (internRegex.test(t)) {
      cat = "In the Role";
      score += 5;
    } else if (jobFunction && t.includes(jobFunction.toLowerCase())) {
      cat = "In the Role";
      score += 3;
    }
    c.category = cat;
    c.priority_score = score;
  }

  contacts.sort((a, b) => b.priority_score - a.priority_score);
  return contacts.slice(0, 6);
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

    // STEP 1: Get company LinkedIn ID
    const domain = deriveDomain(company_name);
    console.log(`[Step 1] Looking up company '${company_name}' via domain '${domain}'`);
    let companyId = await getCompanyIdByDomain(rapidApiKey, domain);
    console.log(`Company ID lookup for ${company_name}: ${companyId}`);

    if (!companyId) {
      console.log(`[Step 1] Domain lookup failed, trying search-companies fallback`);
      companyId = await getCompanyIdBySearch(rapidApiKey, company_name);
      console.log(`Company ID search fallback for ${company_name}: ${companyId}`);
    }

    if (!companyId) {
      return json({
        success: false,
        step: "company_lookup",
        message: "Could not find this company on LinkedIn. Try searching manually.",
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

    // STEP 2: Three parallel employee searches
    const search1Keywords = ["intern", "associate", job_function ?? ""].filter(Boolean);
    const search2Keywords = ["manager", "lead", "head", "director"];
    const search3Keywords = ["recruiter", "talent acquisition", "HR"];

    const runWithDelay = async (delay: number, fn: () => Promise<any[]>) => {
      await sleep(delay);
      return fn();
    };

    const results = await Promise.allSettled([
      runWithDelay(0, () => searchEmployees(rapidApiKey, companyId!, search1Keywords, 5)),
      runWithDelay(500, () => searchEmployees(rapidApiKey, companyId!, search2Keywords, 3)),
      runWithDelay(1000, () => searchEmployees(rapidApiKey, companyId!, search3Keywords, 3)),
    ]);

    const allRaw: any[] = [];
    let firstLogged = false;
    for (const r of results) {
      if (r.status === "fulfilled" && Array.isArray(r.value)) {
        if (!firstLogged && r.value.length > 0) {
          console.log(`[First result sample]: ${JSON.stringify(r.value[0]).substring(0, 500)}`);
          firstLogged = true;
        }
        allRaw.push(...r.value);
      }
    }

    if (allRaw.length === 0) {
      return json({
        success: false,
        step: "employee_search",
        message: "No contacts found for this company.",
      });
    }

    // STEP 3: Map and dedupe
    let allContacts: Contact[] = [];
    for (const raw of allRaw) {
      const c = mapProfile(raw);
      if (c) allContacts.push(c);
    }
    allContacts = deduplicate(allContacts);
    console.log(`Mapped ${allContacts.length} unique contacts after dedup`);

    // Categorize and pick top 6
    const topContacts = categorizeAndScore(allContacts, job_function ?? "");

    // STEP 4: Alumni check for top 6 only
    if (userSchools.length > 0 && topContacts.length > 0) {
      for (let i = 0; i < topContacts.length; i++) {
        if (i > 0) await sleep(500);
        const c = topContacts[i];
        const schools = await fetchExtraProfile(rapidApiKey, c.profile_urn, c.profile_url);
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

    // Persist contacts
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
