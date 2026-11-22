import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getWhatsAppConfig, sendWhatsAppMessage } from "../_shared/whatsapp-send.ts";

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
    // Cryptographically secure code (uniform over 100000..999999).
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const code = String(100000 + (buf[0] % 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min TTL

    await supabase.from("portal_otp_codes").insert({
      phone: normalized,
      code,
      expires_at: expiresAt,
    });

    // Deliver the code over WhatsApp. It is NEVER returned to the caller or logged.
    const config = await getWhatsAppConfig(supabase);
    if (!config) {
      console.error("portal-send-otp: WhatsApp not configured");
      return new Response(JSON.stringify({ error: "Could not send code. Try again later." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sent = await sendWhatsAppMessage(supabase, config, {
      phone: normalized,
      message: `Seu código de verificação é ${code}. Ele expira em 5 minutos. Não compartilhe com ninguém.`,
    });
    if (!sent.ok) {
      console.error("portal-send-otp: send failed", sent.error);
      return new Response(JSON.stringify({ error: "Could not send code. Try again later." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Same response whether or not the phone belongs to a customer (no account enumeration).
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
