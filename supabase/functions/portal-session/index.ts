import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token) {
      return new Response(JSON.stringify({ error: "Token required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: session } = await supabase
      .from("loyalty_client_tokens")
      .select("*, customer:customers(id, name, phone, points_balance, email)")
      .eq("token", token)
      .maybeSingle();

    if (!session || !session.customer) {
      return new Response(JSON.stringify({ error: "Invalid or expired session" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check expiration
    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Session expired" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Update last accessed
    await supabase
      .from("loyalty_client_tokens")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", session.id);

    return new Response(
      JSON.stringify({
        success: true,
        customer: session.customer,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
