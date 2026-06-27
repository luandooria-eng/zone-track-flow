// Receives abandoned cart webhooks from UoouShop and sends WhatsApp via Z-API
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

function buildMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Load config
  const { data: config, error: configErr } = await supabase
    .from("cart_recovery_config")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000098")
    .maybeSingle();

  if (configErr || !config) return json({ error: "Config not found" }, 500);
  if (!config.active) return json({ ok: true, skipped: "inactive" });
  const testMode: boolean = config.test_mode ?? false;

  // Validate webhook secret (optional but recommended)
  const incomingSecret = req.headers.get("x-webhook-secret") ?? req.headers.get("authorization");
  if (config.webhook_secret && incomingSecret !== config.webhook_secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Normalise UoouShop payload — they may send different shapes
  const cartId: string = body.id ?? body.cart_id ?? body.cartId ?? "";
  const customerName: string = body.name ?? body.customer?.name ?? body.contact?.name ?? "";
  const rawPhone: string = body.phone ?? body.contact?.phone ?? body.customer?.phone ?? body.celular ?? "";
  const email: string = body.email ?? body.contact?.email ?? body.customer?.email ?? "";
  const cartLink: string = body.cart_link ?? body.link ?? body.url ?? body.cart_url ?? "";
  const products: unknown[] = body.products ?? body.items ?? body.cart_items ?? [];

  if (!rawPhone) return json({ error: "No phone in payload" }, 400);

  // Avoid sending duplicate messages for the same cart
  const { count } = await supabase
    .from("cart_recovery_logs")
    .select("id", { count: "exact", head: true })
    .eq("cart_id", cartId)
    .eq("status", "sent");

  if ((count ?? 0) > 0) {
    return json({ ok: true, skipped: "already_sent", cart_id: cartId });
  }

  // Build message from template
  const productList = products
    .map((p: any) => `• ${p.name ?? p.title ?? p.description ?? "Produto"}`)
    .join("\n");

  const vars: Record<string, string> = {
    nome: customerName || "Cliente",
    link: cartLink,
    produtos: productList || "",
    email,
  };

  const message = buildMessage(config.message_template, vars);

  // Load Z-API config
  const { data: zapiConfig } = await supabase
    .from("whatsapp_config")
    .select("instance_id, token")
    .eq("id", "00000000-0000-0000-0000-000000000099")
    .maybeSingle();

  let status = "sent";
  let errorMessage: string | null = null;

  if (testMode) {
    // In test mode: just log, don't send
    status = "test";
    errorMessage = null;
  } else if (!zapiConfig?.instance_id || !zapiConfig?.token) {
    status = "failed";
    errorMessage = "Z-API not configured";
  } else {
    const phone = normalizePhone(rawPhone);
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
    const zapiUrl = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
    const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) zapiHeaders["Client-Token"] = clientToken;

    try {
      const res = await fetch(zapiUrl, {
        method: "POST",
        headers: zapiHeaders,
        body: JSON.stringify({ phone, message }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        status = "failed";
        errorMessage = JSON.stringify(err);
      }
    } catch (err) {
      status = "failed";
      errorMessage = String(err);
    }
  }

  // Log attempt
  await supabase.from("cart_recovery_logs").insert({
    cart_id: cartId,
    customer_name: customerName,
    phone: rawPhone,
    email,
    cart_link: cartLink,
    products: products as any,
    message_sent: message,
    status,
    error_message: errorMessage,
  });

  return json({ ok: true, status, test_mode: testMode, cart_id: cartId });
});
