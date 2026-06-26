// Z-API Send message — sends outbound WhatsApp text messages
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const body = await req.json();
    const { conversation_id, phone: rawPhone, message } = body;

    if (!message || (!conversation_id && !rawPhone)) {
      return new Response(
        JSON.stringify({ error: "message and (conversation_id or phone) required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Service role for DB writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parallelize: auth check + config load + (conversation lookup if id given)
    const userPromise = supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    const configPromise = supabase
      .from("whatsapp_config")
      .select("instance_id, token")
      .eq("id", "00000000-0000-0000-0000-000000000099")
      .maybeSingle();
    const convPromise = conversation_id
      ? supabase
          .from("whatsapp_conversations")
          .select("id, phone")
          .eq("id", conversation_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const [userResult, configResult, convResult] = await Promise.all([
      userPromise,
      configPromise,
      convPromise,
    ]);

    const userData = userResult.data;
    const authErr = userResult.error;
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const config = configResult.data;
    if (!config?.instance_id || !config?.token) {
      return new Response(JSON.stringify({ error: "Z-API not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let convId = conversation_id;
    let phone: string | null = rawPhone ? normalizePhone(rawPhone) : null;

    if (conversation_id) {
      const conv = (convResult as any).data;
      if (!conv) {
        return new Response(JSON.stringify({ error: "Conversation not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      phone = normalizePhone(conv.phone);
    } else if (phone) {
      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .upsert(
          { phone, status: "open", last_message: message.slice(0, 500), last_message_at: new Date().toISOString() },
          { onConflict: "phone" },
        )
        .select("id")
        .single();
      convId = conv!.id;
    }

    // Send via Z-API
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
    const zapiUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`;
    const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) zapiHeaders["Client-Token"] = clientToken;
    const zapiRes = await fetch(zapiUrl, {
      method: "POST",
      headers: zapiHeaders,
      body: JSON.stringify({ phone, message }),
    });

    const zapiData = await zapiRes.json().catch(() => ({}));

    if (!zapiRes.ok) {
      return new Response(
        JSON.stringify({ error: "Z-API send failed", details: zapiData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messageId = zapiData.messageId || zapiData.id || null;
    const nowIso = new Date().toISOString();

    // Fire DB writes in parallel (we don't need to wait for both before responding,
    // but awaiting Promise.all keeps them in same edge invocation lifetime)
    await Promise.all([
      supabase.from("whatsapp_messages").insert({
        conversation_id: convId,
        message_id: messageId,
        direction: "outbound",
        content: message,
        type: "text",
        status: "sent",
        sent_by: userId,
      }),
      supabase
        .from("whatsapp_conversations")
        .update({
          last_message: message.slice(0, 500),
          last_message_at: nowIso,
        })
        .eq("id", convId),
    ]);

    return new Response(
      JSON.stringify({ ok: true, message_id: messageId, conversation_id: convId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("zapi-send error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
