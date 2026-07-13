// CRM Campaign Dispatcher — processes scheduled campaigns, respects rate limit & send window
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    return v != null ? String(v) : "";
  });
}

function getNowInSaoPaulo(): { hhmm: string; minutesOfDay: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return { hhmm: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, minutesOfDay: h * 60 + m };
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Promote scheduled -> sending
    const { data: toStart } = await supabase
      .from("crm_campaigns")
      .select("id")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (toStart && toStart.length > 0) {
      await supabase
        .from("crm_campaigns")
        .update({ status: "sending", started_at: new Date().toISOString() })
        .in("id", toStart.map((c) => c.id));
    }

    // 2) Load Z-API config
    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("instance_id, token")
      .eq("id", "00000000-0000-0000-0000-000000000099")
      .maybeSingle();

    if (!config?.instance_id || !config?.token) {
      return new Response(JSON.stringify({ ok: false, error: "Z-API not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

    // 3) Fetch active sending campaigns
    const { data: campaigns } = await supabase
      .from("crm_campaigns")
      .select("*")
      .eq("status", "sending");

    if (!campaigns || campaigns.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If invoked directly with a campaign_id, bypass window check (send-now flow)
    let forceCampaignId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json().catch(() => ({}));
        forceCampaignId = body?.campaign_id ?? null;
      } catch (_) { /* ignore */ }
    }

    const { minutesOfDay } = getNowInSaoPaulo();
    let totalProcessed = 0;
    const reports: any[] = [];

    for (const c of campaigns) {
      const isForcedCampaign = forceCampaignId === c.id;
      const winStart = timeToMin(String(c.send_window_start).slice(0, 5));
      const winEnd = timeToMin(String(c.send_window_end).slice(0, 5));
      if (!isForcedCampaign && (minutesOfDay < winStart || minutesOfDay >= winEnd)) {
        reports.push({ campaign_id: c.id, skipped: "outside_window" });
        continue;
      }

      // Each cron tick = 1 minute → process up to rate_limit_per_min recipients
      const batchSize = Math.max(1, c.rate_limit_per_min || 25);

      const { data: templates } = await supabase
        .from("crm_campaign_templates")
        .select("id, label, body, weight, sent_count")
        .eq("campaign_id", c.id);

      if (!templates || templates.length === 0) {
        reports.push({ campaign_id: c.id, skipped: "no_templates" });
        continue;
      }

      const { data: pending } = await supabase
        .from("crm_campaign_recipients")
        .select("*")
        .eq("campaign_id", c.id)
        .eq("status", "pending")
        .limit(batchSize);

      if (!pending || pending.length === 0) {
        // Check if all done
        const { count: stillPending } = await supabase
          .from("crm_campaign_recipients")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", c.id)
          .eq("status", "pending");
        if ((stillPending ?? 0) === 0) {
          await supabase
            .from("crm_campaigns")
            .update({ status: "done", finished_at: new Date().toISOString() })
            .eq("id", c.id);
        }
        reports.push({ campaign_id: c.id, processed: 0, finished: (stillPending ?? 0) === 0 });
        continue;
      }

      let processed = 0;
      for (const r of pending) {
        try {
          // Pick template (use assigned, fallback to round-robin by index)
          let tpl = templates.find((t) => t.id === r.template_id);
          if (!tpl) tpl = templates[processed % templates.length];

          const firstName = (r.name || "").split(" ")[0] || "";
          const vars: Record<string, string> = {
            nome: r.name || "",
            primeiro_nome: firstName,
            name: r.name || "",
            ...((r.variables as Record<string, string>) || {}),
          };
          const message = applyTemplate(tpl.body, vars);
          const phone = normalizePhone(r.phone);

          // upsert conversation
          const { data: conv } = await supabase
            .from("whatsapp_conversations")
            .upsert(
              { phone, status: "open", last_message: message.slice(0, 500), last_message_at: new Date().toISOString() },
              { onConflict: "phone" },
            )
            .select("id")
            .single();

          // Send Z-API
          const zapiUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`;
          const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (clientToken) zapiHeaders["Client-Token"] = clientToken;
          const zapiRes = await fetch(zapiUrl, {
            method: "POST",
            headers: zapiHeaders,
            body: JSON.stringify({ phone, message }),
          });
          const zapiData = await zapiRes.json().catch(() => ({} as any));

          if (!zapiRes.ok) {
            await supabase
              .from("crm_campaign_recipients")
              .update({ status: "failed", error_message: JSON.stringify(zapiData).slice(0, 500) })
              .eq("id", r.id);
            continue;
          }

          const messageId = zapiData.messageId || zapiData.id || null;
          const nowIso = new Date().toISOString();

          // Log message
          await supabase.from("whatsapp_messages").insert({
            conversation_id: conv?.id ?? null,
            message_id: messageId,
            direction: "outbound",
            content: message,
            type: "text",
            status: "sent",
          });

          // Activity for tracking
          if (r.lead_id) {
            await supabase.from("crm_activities").insert({
              lead_id: r.lead_id,
              type: "campaign_sent",
              content: `Campanha "${c.name}" enviada (variante ${tpl.label})`,
              metadata: { campaign_id: c.id, template_id: tpl.id, recipient_id: r.id },
            });
          }

          await supabase
            .from("crm_campaign_recipients")
            .update({
              status: "sent",
              sent_at: nowIso,
              message_id: messageId,
              conversation_id: conv?.id ?? null,
              template_id: tpl.id,
            })
            .eq("id", r.id);

          await supabase
            .from("crm_campaign_templates")
            .update({ sent_count: (tpl.sent_count || 0) + 1 })
            .eq("id", tpl.id);

          processed++;
        } catch (e) {
          console.error("recipient error", r.id, e);
          await supabase
            .from("crm_campaign_recipients")
            .update({ status: "failed", error_message: String(e).slice(0, 500) })
            .eq("id", r.id);
        }
      }

      totalProcessed += processed;
      reports.push({ campaign_id: c.id, processed });
    }

    return new Response(
      JSON.stringify({ ok: true, totalProcessed, reports }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("crm-campaign-dispatcher error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
