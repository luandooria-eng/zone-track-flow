import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9";

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
    const { phone, code, name } = await req.json();
    if (!phone || !code) {
      return new Response(JSON.stringify({ error: "Phone and code required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const normalized = normalizePhone(phone);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find the latest OTP for this phone (unverified first, then recently verified for name registration flow)
    let { data: otpRecord } = await supabase
      .from("portal_otp_codes")
      .select("*")
      .eq("phone", normalized)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no unverified OTP found but name is provided, check for recently verified OTP (registration flow)
    if (!otpRecord && name) {
      const { data: verifiedRecord } = await supabase
        .from("portal_otp_codes")
        .select("*")
        .eq("phone", normalized)
        .eq("verified", true)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (verifiedRecord && verifiedRecord.code === code) {
        // Skip OTP re-validation, go straight to customer creation
        let { data: customer } = await supabase
          .from("customers")
          .select("id, name, phone, points_balance, email")
          .eq("phone", normalized)
          .maybeSingle();

        if (!customer) {
          const { data: newCustomer, error: insertErr } = await supabase
            .from("customers")
            .insert({ name: name.trim(), phone: normalized, points_balance: 0 })
            .select("id, name, phone, points_balance, email")
            .single();
          if (insertErr) throw insertErr;
          customer = newCustomer;
        }

        const token = uuidv4();
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("loyalty_client_tokens")
          .upsert(
            { customer_id: customer!.id, token, last_accessed_at: new Date().toISOString(), expires_at: expiresAt },
            { onConflict: "customer_id" }
          );

        return new Response(
          JSON.stringify({
            success: true,
            token,
            customer: { id: customer!.id, name: customer!.name, phone: customer!.phone, points_balance: customer!.points_balance },
            is_new: true,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!otpRecord) {
      return new Response(JSON.stringify({ error: "Code expired or not found. Request a new one." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check max attempts
    if (otpRecord.attempts >= 5) {
      return new Response(JSON.stringify({ error: "Too many verification attempts. Request a new code." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Increment attempts
    await supabase
      .from("portal_otp_codes")
      .update({ attempts: otpRecord.attempts + 1 })
      .eq("id", otpRecord.id);

    if (otpRecord.code !== code) {
      return new Response(JSON.stringify({ error: "Invalid code", attempts_left: 4 - otpRecord.attempts }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Mark as verified
    await supabase
      .from("portal_otp_codes")
      .update({ verified: true })
      .eq("id", otpRecord.id);

    // Find or create customer
    let { data: customer } = await supabase
      .from("customers")
      .select("id, name, phone, points_balance, email")
      .eq("phone", normalized)
      .maybeSingle();

    let isNewCustomer = false;

    if (!customer) {
      if (!name || !name.trim()) {
        return new Response(JSON.stringify({ error: "Name required for new customers", needs_name: true }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Create new customer
      const { data: newCustomer, error: insertErr } = await supabase
        .from("customers")
        .insert({ name: name.trim(), phone: normalized, points_balance: 0 })
        .select("id, name, phone, points_balance, email")
        .single();
      if (insertErr) throw insertErr;
      customer = newCustomer;
      isNewCustomer = true;
    }

    // Generate session token
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

    await supabase
      .from("loyalty_client_tokens")
      .upsert(
        { customer_id: customer!.id, token, last_accessed_at: new Date().toISOString(), expires_at: expiresAt },
        { onConflict: "customer_id" }
      );

    return new Response(
      JSON.stringify({
        success: true,
        token,
        customer: {
          id: customer!.id,
          name: customer!.name,
          phone: customer!.phone,
          points_balance: customer!.points_balance,
        },
        is_new: isNewCustomer,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
