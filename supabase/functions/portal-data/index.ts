// Portal data reader: replaces the direct browser queries that previously relied on
// permissive `anon` RLS policies. The caller proves identity with its portal session
// token; the customer is always derived from that token (never from client input).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { token, resource, limit } = await req.json();
    if (!token || typeof token !== "string") return json({ error: "Token required" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: session } = await supabase
      .from("loyalty_client_tokens")
      .select("customer_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!session?.customer_id) return json({ error: "Invalid or expired session" }, 401);
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return json({ error: "Session expired" }, 401);
    }
    const customerId = session.customer_id as string;

    switch (resource) {
      case "ledger": {
        const n = Math.min(Math.max(Number(limit) || 50, 1), 200);
        const { data, error } = await supabase
          .from("loyalty_ledger")
          .select("*")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false })
          .limit(n);
        if (error) throw error;
        return json({ success: true, data: data ?? [] });
      }
      case "vouchers": {
        const { data, error } = await supabase
          .from("loyalty_vouchers")
          .select("*, coupon:loyalty_coupons(title, description)")
          .eq("customer_id", customerId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return json({ success: true, data: data ?? [] });
      }
      case "coupons": {
        const { data, error } = await supabase
          .from("loyalty_coupons")
          .select("*")
          .eq("is_active", true)
          .order("points_cost", { ascending: true });
        if (error) throw error;
        return json({ success: true, data: data ?? [] });
      }
      default:
        return json({ error: "Unknown resource" }, 400);
    }
  } catch (err) {
    console.error("portal-data error:", err);
    return json({ error: "Internal error" }, 500);
  }
});
