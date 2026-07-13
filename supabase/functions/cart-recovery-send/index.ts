import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
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

  const { data: zapiConfig } = await supabase
    .from("whatsapp_config")
    .select("instance_id, token")
    .eq("id", "00000000-0000-0000-0000-000000000099")
    .maybeSingle();

  if (!zapiConfig?.instance_id || !zapiConfig?.token) {
    return json({ error: "Z-API not configured" }, 400);
  }

  const phone = normalizePhone(log.phone);
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
  const zapiUrl = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
  const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) zapiHeaders["Client-Token"] = clientToken;

  let status = "sent";
  let errorMessage: string | null = null;
  let messageId: string | null = null;

  try {
    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: zapiHeaders,
      body: JSON.stringify({ phone, message: log.message_sent }),
    });
    if (res.ok) {
      const zapiData = await res.json().catch(() => ({}));
      messageId = zapiData.messageId ?? zapiData.id ?? null;
    } else {
      const err = await res.json().catch(() => ({}));
      status = "failed";
      errorMessage = JSON.stringify(err);
    }
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
