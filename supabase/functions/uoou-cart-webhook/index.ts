// Receives abandoned cart webhooks from UoouShop and sends a WhatsApp reminder
// (Z-API or Meta Cloud API, whichever is the active provider)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getWhatsAppConfig, normalizePhone, sendWhatsAppMessage } from "../_shared/whatsapp-send.ts";

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

  const { data: config, error: configErr } = await supabase
    .from("cart_recovery_config")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000098")
    .maybeSingle();

  if (configErr || !config) return json({ error: "Config not found" }, 500);
  if (!config.active) return json({ ok: true, skipped: "inactive" });
  const testMode: boolean = config.test_mode ?? false;

  const incomingSecret = req.headers.get("x-webhook-secret") ?? req.headers.get("authorization");
  if (config.webhook_secret && incomingSecret !== config.webhook_secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const cartId: string = body.id ?? body.cart_id ?? body.cartId ?? "";
  const customerName: string = body.name ?? body.customer?.name ?? body.contact?.name ?? "";
  const rawPhone: string = body.phone ?? body.contact?.phone ?? body.customer?.phone ?? body.celular ?? "";
  const email: string = body.email ?? body.contact?.email ?? body.customer?.email ?? "";
  const cartLink: string = body.cart_link ?? body.link ?? body.url ?? body.cart_url ?? "";
  const products: unknown[] = body.products ?? body.items ?? body.cart_items ?? [];

  if (!rawPhone) return json({ error: "No phone in payload" }, 400);

  const { count } = await supabase
    .from("cart_recovery_logs")
    .select("id", { count: "exact", head: true })
    .eq("cart_id", cartId)
    .eq("status", "sent");

  if ((count ?? 0) > 0) return json({ ok: true, skipped: "already_sent", cart_id: cartId });

  const productList = products.map((p: any) => `• ${p.name ?? p.title ?? "Produto"}`).join("\n");
  const vars: Record<string, string> = { nome: customerName || "Cliente", link: cartLink, produtos: productList || "", email };
  const message = buildMessage(config.message_template, vars);

  const waConfig = await getWhatsAppConfig(supabase);

  let status = "sent";
  let errorMessage: string | null = null;

  if (testMode) {
    status = "test";
  } else if (!waConfig) {
    status = "failed";
    errorMessage = "WhatsApp not configured";
  } else {
    const phone = normalizePhone(rawPhone);
    try {
      const result = await sendWhatsAppMessage(supabase, waConfig, {
        phone,
        message,
        fallbackTemplateId: config.whatsapp_template_id,
        templateVariables: [customerName || "Cliente"],
      });
      if (!result.ok) { status = "failed"; errorMessage = result.error ?? "send failed"; }
    } catch (err) { status = "failed"; errorMessage = String(err); }
  }

  await supabase.from("cart_recovery_logs").insert({ cart_id: cartId, customer_name: customerName, phone: rawPhone, email, cart_link: cartLink, products: products as any, message_sent: message, status, error_message: errorMessage });

  return json({ ok: true, status, test_mode: testMode, cart_id: cartId });
});
