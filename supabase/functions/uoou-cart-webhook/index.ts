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

  const { data: config, error: configErr } = await supabase
    .from("cart_recovery_config")
    .select("*")
    .eq("id", "00000000-0000-0000-0000-000000000098")
    .maybeSingle();

  if (configErr || !config) return json({ error: "Config not found" }, 500);
  if (!config.active) return json({ ok: true, skipped: "inactive" });
  const testMode: boolean = config.test_mode ?? false;
  const manualApproval: boolean = config.manual_approval ?? false;

  const incomingSecret = req.headers.get("x-webhook-secret") ?? req.headers.get("authorization");
  if (config.webhook_secret && incomingSecret !== config.webhook_secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const cartId: string = body.id ?? body.cart_id ?? String(Date.now());
  const firstName: string = body.customer?.first_name ?? body.name ?? "";
  const lastName: string = body.customer?.last_name ?? "";
  const customerName: string = `${firstName} ${lastName}`.trim() || "Cliente";
  const email: string = body.customer?.email ?? body.email ?? "";

  const rawPhone: string = body.customer?.cellphone ?? body.customer?.telephone ?? body.customer?.phone ?? body.phone ?? "";

  const reviewLink: string = body.review_link ?? "";
  const storeUrl: string = body.channel?.code ? `https://www.${body.channel.code}.com.br` : "https://www.ladonnafit.com.br";
  const cartLink: string = reviewLink !== "" ? reviewLink : `${storeUrl}/cart/`;

  const items: any[] = body.items ?? body.products ?? [];
  const products = items.map((i: any) => ({
    name: i.variant?.name ?? i.name ?? "Produto",
    quantity: i.quantity ?? 1,
    price: (i.unit_price ?? 0) / 100,
  }));
  const productList = products.map((p: any) => `• ${p.name}`).join("\n");

  const { count } = await supabase
    .from("cart_recovery_logs")
    .select("id", { count: "exact", head: true })
    .eq("cart_id", cartId)
    .in("status", ["sent", "pending"]);

  if ((count ?? 0) > 0) return json({ ok: true, skipped: "already_sent", cart_id: cartId });

  // Insert log first to get the ID for the tracking link
  const { data: logRow } = await supabase.from("cart_recovery_logs").insert({
    cart_id: cartId, customer_name: customerName, phone: rawPhone || "", email,
    cart_link: cartLink, products: products as any,
    message_sent: "", status: "pending", error_message: null
  }).select("id").single();

  const logId = logRow?.id;

  // Build tracking link using the log ID
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const trackingLink = logId
    ? `${supabaseUrl}/functions/v1/cart-redirect?id=${logId}`
    : cartLink;

  const vars: Record<string, string> = { nome: customerName, link: trackingLink, produtos: productList, email };
  const message = buildMessage(config.message_template, vars);

  // Update message with tracking link
  await supabase.from("cart_recovery_logs").update({ message_sent: message }).eq("id", logId);

  if (!rawPhone) {
    await supabase.from("cart_recovery_logs").update({
      status: "failed", error_message: "Sem telefone cadastrado no UoouShop"
    }).eq("id", logId);
    return json({ ok: true, status: "failed", reason: "no_phone", cart_id: cartId });
  }

  if (manualApproval) {
    return json({ ok: true, status: "pending", cart_id: cartId });
  }

  const { data: zapiConfig } = await supabase
    .from("whatsapp_config")
    .select("instance_id, token")
    .eq("id", "00000000-0000-0000-0000-000000000099")
    .maybeSingle();

  let status = "sent";
  let errorMessage: string | null = null;
  let messageId: string | null = null;

  if (testMode) {
    status = "test";
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
      const res = await fetch(zapiUrl, { method: "POST", headers: zapiHeaders, body: JSON.stringify({ phone, message }) });
      if (res.ok) {
        const zapiData = await res.json().catch(() => ({}));
        messageId = zapiData.messageId ?? zapiData.id ?? null;
      } else {
        const err = await res.json().catch(() => ({}));
        status = "failed";
        errorMessage = JSON.stringify(err);
      }
    } catch (err) { status = "failed"; errorMessage = String(err); }
  }

  await supabase.from("cart_recovery_logs").update({
    status, error_message: errorMessage, message_id: messageId
  }).eq("id", logId);

  // Mirror sent messages into WhatsApp inbox
  if (status === "sent" || status === "test") {
    const phone = normalizePhone(rawPhone);
    const now = new Date().toISOString();

    // Upsert conversation (unique per phone)
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        { phone, contact_name: customerName || null, last_message: message, last_message_at: now, status: "open", updated_at: now },
        { onConflict: "phone", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (conv?.id) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conv.id,
        message_id: messageId ?? `cart-${logId}`,
        direction: "outbound",
        content: message,
        type: "text",
        status: status === "test" ? "test" : "sent",
        created_at: now,
      });
    }
  }

  return json({ ok: true, status, test_mode: testMode, cart_id: cartId });
});
