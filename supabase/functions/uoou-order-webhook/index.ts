import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: config } = await supabase
    .from("cart_recovery_config")
    .select("webhook_secret")
    .eq("id", "00000000-0000-0000-0000-000000000098")
    .maybeSingle();

  const incomingSecret = req.headers.get("x-webhook-secret") ?? req.headers.get("authorization");
  if (config?.webhook_secret && incomingSecret !== config.webhook_secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const orderId: string = String(body.id ?? body.order_id ?? "");
  const orderValue: number = (body.total ?? body.total_price ?? 0) / 100;

  const rawPhone: string =
    body.customer?.cellphone ?? body.customer?.telephone ?? body.customer?.phone ?? body.phone ?? "";

  if (!rawPhone) return json({ ok: true, skipped: "no_phone" });

  const phone = normalizePhone(rawPhone);
  const rawDigits = rawPhone.replace(/\D/g, "");

  // Search by normalized phone OR raw digits (logs may store phone without country code)
  const { data: log } = await supabase
    .from("cart_recovery_logs")
    .select("id")
    .or(`phone.eq.${phone},phone.eq.${rawDigits}`)
    .in("status", ["sent", "test"])
    .is("recovered_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return json({ ok: true, skipped: "no_matching_cart_log", phone });

  await supabase
    .from("cart_recovery_logs")
    .update({
      order_id: orderId || null,
      order_value: orderValue,
      recovered_at: new Date().toISOString(),
    })
    .eq("id", log.id);

  return json({ ok: true, recovered: true, log_id: log.id, order_id: orderId, order_value: orderValue });
});
