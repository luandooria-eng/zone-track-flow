// Provider-aware outbound send for manual replies (WhatsApp Inbox).
// Routes to Z-API or the Meta Cloud API depending on whatsapp_config.provider.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getWhatsAppConfig, normalizePhone, sendWhatsAppMessage } from "../_shared/whatsapp-send.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const userPromise = supabaseAuth.auth.getUser(authHeader.replace("Bearer ", ""));
    const configPromise = getWhatsAppConfig(supabase);
    const convPromise = conversation_id
      ? supabase
          .from("whatsapp_conversations")
          .select("id, phone")
          .eq("id", conversation_id)
          .maybeSingle()
      : Promise.resolve({ data: null });

    const [userResult, config, convResult] = await Promise.all([userPromise, configPromise, convPromise]);

    const userData = userResult.data;
    if (userResult.error || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    if (!config) {
      return new Response(JSON.stringify({ error: "WhatsApp not configured" }), {
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

    const result = await sendWhatsAppMessage(supabase, config, { phone: phone!, message });

    if (!result.ok) {
      const status = result.error === "outside_24h_window_no_template" ? 409 : 502;
      return new Response(JSON.stringify({ error: result.error, details: result.details }), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowIso = new Date().toISOString();

    await Promise.all([
      supabase.from("whatsapp_messages").insert({
        conversation_id: convId,
        message_id: result.messageId,
        direction: "outbound",
        content: message,
        type: "text",
        status: "sent",
        sent_by: userId,
      }),
      supabase
        .from("whatsapp_conversations")
        .update({ last_message: message.slice(0, 500), last_message_at: nowIso })
        .eq("id", convId),
    ]);

    return new Response(
      JSON.stringify({ ok: true, message_id: result.messageId, conversation_id: convId, provider: result.provider }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("whatsapp-send error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
