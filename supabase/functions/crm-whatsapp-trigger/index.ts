import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getWhatsAppConfig, normalizePhone, sendWhatsAppMessage } from "../_shared/whatsapp-send.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabaseAuth.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { lead_id, stage_id } = body;

    if (!lead_id || !stage_id) {
      return new Response(JSON.stringify({ error: "lead_id and stage_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [leadRes, triggersRes, config] = await Promise.all([
      supabase.from("crm_leads").select("id, name, phone, whatsapp_conversation_id").eq("id", lead_id).single(),
      supabase.from("crm_triggers").select("*").eq("stage_id", stage_id).eq("trigger_condition", "on_enter").eq("is_active", true),
      getWhatsAppConfig(supabase),
    ]);

    if (leadRes.error || !leadRes.data) {
      return new Response(JSON.stringify({ error: "Lead not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lead = leadRes.data;
    const triggers = triggersRes.data ?? [];

    if (triggers.length === 0 || !lead.phone || !config) {
      return new Response(JSON.stringify({ ok: true, fired: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(lead.phone);
    const templateVars = { name: lead.name || "Cliente" };
    let fired = 0;

    for (const trigger of triggers) {
      if (trigger.action_type !== "whatsapp_message" || !trigger.message_template) continue;

      const message = applyTemplate(trigger.message_template, templateVars);

      const { data: conv } = await supabase
        .from("whatsapp_conversations")
        .upsert(
          { phone, status: "open", last_message: message.slice(0, 500), last_message_at: new Date().toISOString() },
          { onConflict: "phone" },
        )
        .select("id").single();

      const convId = conv?.id ?? lead.whatsapp_conversation_id;

      const result = await sendWhatsAppMessage(supabase, config, {
        phone,
        message,
        fallbackTemplateId: trigger.whatsapp_template_id,
        templateVariables: [lead.name || "Cliente"],
      });

      if (result.ok && convId) {
        await supabase.from("whatsapp_messages").insert({
          conversation_id: convId,
          message_id: result.messageId,
          direction: "outbound", content: message, type: "text", status: "sent",
          sent_by: user.id,
        });
      }

      await supabase.from("crm_activities").insert({
        lead_id, type: "trigger_fired",
        content: result.ok
          ? `Mensagem automática enviada: "${trigger.name}"`
          : `Falha ao enviar mensagem automática "${trigger.name}": ${result.error}`,
        metadata: { trigger_id: trigger.id, trigger_name: trigger.name, message_sent: message, phone, send_ok: result.ok },
        created_by: user.id,
      });

      if (result.ok) fired++;
    }

    return new Response(JSON.stringify({ ok: true, fired }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("crm-whatsapp-trigger error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});