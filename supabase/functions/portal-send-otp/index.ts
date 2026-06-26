import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (!digits.startsWith("55")) digits = "55" + digits;
  return "+" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { phone } = await req.json();
    if (!phone) return new Response(JSON.stringify({ error: "Phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const normalized = normalizePhone(phone);
    if (normalized.length < 13 || normalized.length > 14) {
      return new Response(JSON.stringify({ error: "Invalid phone number" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limiting: max 5 OTPs per phone per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("portal_otp_codes")
      .select("*", { count: "exact", head: true })
      .eq("phone", normalized)
      .gte("created_at", oneHourAgo);

    if ((count || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Too many attempts. Try again later." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min TTL

    await supabase.from("portal_otp_codes").insert({
      phone: normalized,
      code,
      expires_at: expiresAt,
    });

    // Check if customer exists
    const { data: customer } = await supabase
      .from("customers")
      .select("id, name")
      .eq("phone", normalized)
      .maybeSingle();

    // In dev mode, return the code. In production, send via SMS/WhatsApp.
    console.log(`[DEV] OTP for ${normalized}: ${code}`);

    return new Response(
      JSON.stringify({
        success: true,
        phone: normalized,
        is_new: !customer,
        customer_name: customer?.name || null,
        // DEV ONLY: remove in production
        dev_code: code,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
