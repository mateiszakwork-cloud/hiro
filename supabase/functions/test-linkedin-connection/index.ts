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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) userId = user.id;
    }
    const body = await req.json().catch(() => ({}));
    if (!userId && body.user_id) userId = body.user_id;
    if (!userId) return json({ success: false, message: "Authentication failed." });

    const supabase = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("linkedin_cookie, linkedin_jsessionid")
      .eq("id", userId)
      .single();

    const cookie = profile?.linkedin_cookie;
    const jsessionid = (profile as any)?.linkedin_jsessionid;
    if (!cookie || !jsessionid) {
      return json({ success: false, message: "Cookies not configured." });
    }

    const headers: Record<string, string> = {
      Cookie: `li_at=${cookie}; JSESSIONID=${jsessionid}`,
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "csrf-token": jsessionid,
      Accept: "application/vnd.linkedin.normalized+json+2.1",
    };

    // Minimal test: fetch the "me" endpoint
    const res = await fetch("https://www.linkedin.com/voyager/api/me", {
      headers,
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      return json({ success: false, message: "LinkedIn redirected — session expired or blocked." });
    }
    if (res.status === 200) {
      return json({ success: true, message: "Connection working" });
    }
    return json({ success: false, message: `LinkedIn returned status ${res.status}` });
  } catch (e) {
    return json({ success: false, message: "Test failed: " + (e as Error).message });
  }
});
