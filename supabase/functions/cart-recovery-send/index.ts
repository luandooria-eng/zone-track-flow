import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getWhatsAppConfig, normalizePhone, sendWhatsAppMessage } from "../_shared/whatsapp-send.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: authErr } = await supabaseAuth.auth.getUser();
  if (authErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const { log_id } = body;
  if (!log_id) return json({ error: "log_id required" }, 400);

  const { data: log, error: logErr } = await supabase
    .from("cart_recovery_logs")
    .select("*")
    .eq("id", log_id)
    .maybeSingle();

  if (logErr || !log) return json({ error: "Log not found" }, 404);
  if (!["pending", "failed"].includes(log.status)) return json({ error: "Cannot send log with status: " + log.status }, 400);
  if (!log.phone) return json({ error: "No phone in log" }, 400);

  const waConfig = await getWhatsAppConfig(supabase);
  if (!waConfig) {
    return json({ error: "WhatsApp not configured" }, 400);
  }

  const { data: cartConfig } = await supabase
    .from("cart_recovery_config")
    .select("whatsapp_template_id")
    .eq("id", "00000000-0000-0000-0000-000000000098")
    .maybeSingle();

  const phone = normalizePhone(log.phone);

  let status = "sent";
  let errorMessage: string | null = null;
  let messageId: string | null = null;

  try {
    const result = await sendWhatsAppMessage(supabase, waConfig, {
      phone,
      message: log.message_sent,
      fallbackTemplateId: cartConfig?.whatsapp_template_id,
      templateVariables: [log.customer_name || "Cliente"],
    });
    if (result.ok) messageId = result.messageId ?? null;
    else { status = "failed"; errorMessage = result.error ?? "send failed"; }
  } catch (err) {
    status = "failed";
    errorMessage = String(err);
  }

  await supabase
    .from("cart_recovery_logs")
    .update({ status, error_message: errorMessage, message_id: messageId })
    .eq("id", log_id);

  // Create/update WhatsApp conversation so message appears in CRM inbox
  if (status === "sent") {
    const nowIso = new Date().toISOString();
    const { data: conv } = await supabase
      .from("whatsapp_conversations")
      .upsert(
        {
          phone,
          contact_name: log.customer_name ?? undefined,
          status: "open",
          last_message: log.message_sent?.slice(0, 500),
          last_message_at: nowIso,
        },
        { onConflict: "phone" },
      )
      .select("id")
      .single();

    if (conv?.id) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: conv.id,
        direction: "outbound",
        content: log.message_sent,
        type: "text",
        status: "sent",
        sent_by: userData.user.id,
      });
    }
  }

  return json({ ok: true, status, log_id });
});
