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

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

async function leadHasAnyTag(
  supabase: any,
  leadId: string,
  customerId: string | null,
  filterTags: string[] | null | undefined,
): Promise<boolean> {
  if (!filterTags || filterTags.length === 0) return true;
  const wanted = filterTags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (wanted.length === 0) return true;

  // Check lead-level tags
  const { data: leadTags } = await supabase
    .from("crm_lead_tags").select("tag").eq("lead_id", leadId);
  if ((leadTags ?? []).some((r: any) => wanted.includes(String(r.tag).toLowerCase()))) return true;

  // Check customer-level tags
  if (customerId) {
    const { data: cTags } = await supabase
      .from("customer_tag_assignments")
      .select("tag:customer_tags(name)")
      .eq("customer_id", customerId);
    if ((cTags ?? []).some((r: any) => wanted.includes(String(r.tag?.name ?? "").toLowerCase()))) return true;
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try to identify caller (optional — cron runs without user)
    let callerId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user } } = await supabaseAuth.auth.getUser();
      callerId = user?.id ?? null;
    }

    const { data: pendingRows, error: pendingErr } = await supabase.rpc("crm_get_pending_timer_leads");
    if (pendingErr) {
      return new Response(JSON.stringify({ error: pendingErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Business-hours gate (Brasília) ───────────────────────────────────────
    // Seg-Sáb: 08:00–18:00  |  Dom: 08:00–11:00
    // Fora desses horários, envios são bloqueados (e o lead NÃO é marcado como
    // disparado, então tenta de novo na próxima execução dentro da janela).
    const fmtNow = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Sao_Paulo",
      weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const nowParts = Object.fromEntries(fmtNow.formatToParts(new Date()).map(p => [p.type, p.value]));
    const currentHourBR = parseInt(nowParts.hour ?? "0", 10);
    const weekdayBR = (nowParts.weekday ?? "").toLowerCase(); // sun, mon, tue...
    const isSunday = weekdayBR.startsWith("sun");
    const startHour = 8;
    const endHour = isSunday ? 11 : 18; // exclusive
    const withinBusinessHours = currentHourBR >= startHour && currentHourBR < endHour;
    console.log(`[business-hours] BR ${weekdayBR} ${currentHourBR}h → window ${startHour}–${endHour} → ${withinBusinessHours ? "OPEN" : "BLOCKED"}`);

    const { data: config } = await supabase
      .from("whatsapp_config").select("instance_id, token")
      .eq("id", "00000000-0000-0000-0000-000000000099").maybeSingle();

    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
    let processed = 0;

    async function sendWhatsApp(phone: string, message: string, convId: string | null, leadId: string, triggerId: string, triggerName: string) {
      if (!config?.instance_id || !config?.token) return;
      if (!withinBusinessHours) {
        console.log(`[business-hours] BLOCKED send for trigger "${triggerName}" (${weekdayBR} ${currentHourBR}h, janela ${startHour}–${endHour})`);
        return;
      }
      const zapiUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`;
      const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (clientToken) zapiHeaders["Client-Token"] = clientToken;
      const zapiRes = await fetch(zapiUrl, { method: "POST", headers: zapiHeaders, body: JSON.stringify({ phone, message }) });
      if (zapiRes.ok && convId) {
        const zapiData = await zapiRes.json().catch(() => ({}));
        await supabase.from("whatsapp_messages").insert({
          conversation_id: convId, message_id: zapiData.messageId || zapiData.id || null,
          direction: "outbound", content: message, type: "text", status: "sent", sent_by: callerId,
        });
      }
      await supabase.from("crm_activities").insert({
        lead_id: leadId, type: "trigger_fired",
        content: `⏱ Gatilho disparado: "${triggerName}"`,
        metadata: { trigger_id: triggerId, trigger_name: triggerName, message_sent: message, phone },
        created_by: callerId,
      });
    }

    // ── time_in_stage triggers ────────────────────────────────────────────────
    for (const row of (pendingRows ?? [])) {
      const { lead_id, lead_name, lead_phone, stage_id, trigger_id, trigger_name, action_type, message_template, target_stage_id, tags } = row;

      let actionOk = false;

      if (action_type === "whatsapp_message" && message_template && lead_phone) {
        if (!withinBusinessHours) { continue; }
        const phone = normalizePhone(lead_phone);
        const message = applyTemplate(message_template, { name: lead_name || "Cliente" });
        const { data: conv } = await supabase.from("whatsapp_conversations")
          .upsert({ phone, status: "open", last_message: message.slice(0, 500), last_message_at: new Date().toISOString() }, { onConflict: "phone" })
          .select("id").single();
        await sendWhatsApp(phone, message, conv?.id ?? null, lead_id, trigger_id, trigger_name);
        actionOk = true;
      }
      if (action_type === "move_stage" && target_stage_id) {
        const { error: updErr } = await supabase
          .from("crm_leads")
          .update({ stage_id: target_stage_id, stage_changed_at: new Date().toISOString() })
          .eq("id", lead_id);
        actionOk = !updErr;
      }
      if (action_type === "add_tag" && tags?.length > 0) {
        const { error: tagErr } = await supabase.from("crm_lead_tags").upsert(tags.map((tag: string) => ({ lead_id, tag })), { onConflict: "lead_id,tag", ignoreDuplicates: true });
        actionOk = !tagErr;
      }

      if (actionOk) {
        const { error: lockErr } = await supabase.from("crm_timer_executions")
          .insert({ lead_id, trigger_id, stage_id, fired_at: new Date().toISOString() });
        if (!lockErr) processed++;
      }
    }

    // ── daily_at_time triggers ────────────────────────────────────────────────
    // Use Intl to get correct Brasília time (handles DST properly)
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date()).map(p => [p.type, p.value]));
    const todayStr = `${parts.year}-${parts.month}-${parts.day}`;
    const currentMinutes = parseInt(parts.hour) * 60 + parseInt(parts.minute);
    console.log(`[daily_at_time] now BR: ${todayStr} ${parts.hour}:${parts.minute} (${currentMinutes} min)`);

    const { data: dailyTriggers } = await supabase
      .from("crm_triggers").select("*")
      .eq("trigger_condition", "daily_at_time").eq("is_active", true)
      .lte("delay_minutes", currentMinutes);
    console.log(`[daily_at_time] eligible triggers: ${dailyTriggers?.length ?? 0}`);

    for (const trigger of (dailyTriggers ?? [])) {
      const { data: leads } = await supabase.from("crm_leads")
        .select("id, name, phone, customer_id, whatsapp_conversation_id, stage_changed_at")
        .eq("stage_id", trigger.stage_id);
      console.log(`[trigger ${trigger.name}] target stage=${trigger.target_stage_id} action=${trigger.action_type} delay=${trigger.delay_minutes} leads=${leads?.length ?? 0}`);

      for (const lead of (leads ?? [])) {
        // Filter by required tags (if configured)
        const matches = await leadHasAnyTag(supabase, lead.id, lead.customer_id, trigger.filter_tags);
        if (!matches) {
          console.log(`[lead ${lead.id}] skipped — does not match filter_tags`, trigger.filter_tags);
          continue;
        }

        const { data: prevExec } = await supabase.from("crm_timer_executions")
          .select("id, fired_at").eq("lead_id", lead.id).eq("trigger_id", trigger.id).maybeSingle();

        // Convert prevExec.fired_at (UTC) to Brasília date string
        if (prevExec) {
          const prevParts = Object.fromEntries(
            fmt.formatToParts(new Date(prevExec.fired_at)).map(p => [p.type, p.value])
          );
          const prevDay = `${prevParts.year}-${prevParts.month}-${prevParts.day}`;
          const firedAt = new Date(prevExec.fired_at).getTime();
          const enteredStageAt = lead.stage_changed_at ? new Date(lead.stage_changed_at).getTime() : 0;
          if (prevDay === todayStr && firedAt >= enteredStageAt) {
            console.log(`[lead ${lead.id}] already fired for current stage entry today (${prevDay}) — skipping`);
            continue;
          }
        }

        let actionOk = false;

        if (trigger.action_type === "whatsapp_message" && trigger.message_template && lead.phone) {
          if (!withinBusinessHours) { continue; }
          const phone = normalizePhone(lead.phone);
          const message = applyTemplate(trigger.message_template, { name: lead.name || "Cliente" });
          const { data: conv } = await supabase.from("whatsapp_conversations")
            .upsert({ phone, status: "open", last_message: message.slice(0, 500), last_message_at: new Date().toISOString() }, { onConflict: "phone" })
            .select("id").single();
          await sendWhatsApp(phone, message, conv?.id ?? lead.whatsapp_conversation_id, lead.id, trigger.id, trigger.name);
          actionOk = true;
        }
        if (trigger.action_type === "move_stage" && trigger.target_stage_id) {
          const { error: updErr, data: updData } = await supabase
            .from("crm_leads")
            .update({ stage_id: trigger.target_stage_id, stage_changed_at: new Date().toISOString() })
            .eq("id", lead.id)
            .select("id, stage_id");
          if (updErr) {
            console.error(`[lead ${lead.id}] move_stage FAILED:`, updErr);
          } else {
            console.log(`[lead ${lead.id}] moved to ${trigger.target_stage_id}`, updData);
            actionOk = true;
            await supabase.from("crm_activities").insert({
              lead_id: lead.id, type: "stage_changed",
              content: `⏱ Movido automaticamente para nova etapa pelo gatilho "${trigger.name}"`,
              metadata: { trigger_id: trigger.id, target_stage_id: trigger.target_stage_id },
              created_by: callerId,
            });

            // Fire on_enter triggers for the NEW stage (same as manual move)
            const { data: enterTriggers } = await supabase
              .from("crm_triggers").select("*")
              .eq("stage_id", trigger.target_stage_id)
              .eq("trigger_condition", "on_enter")
              .eq("is_active", true);
            console.log(`[lead ${lead.id}] on_enter triggers in new stage: ${enterTriggers?.length ?? 0}`);

            for (const et of (enterTriggers ?? [])) {
              if (et.action_type === "whatsapp_message" && et.message_template && lead.phone) {
                if (!withinBusinessHours) { continue; }
                const phone = normalizePhone(lead.phone);
                const message = applyTemplate(et.message_template, { name: lead.name || "Cliente" });
                const { data: conv } = await supabase.from("whatsapp_conversations")
                  .upsert({ phone, status: "open", last_message: message.slice(0, 500), last_message_at: new Date().toISOString() }, { onConflict: "phone" })
                  .select("id").single();
                await sendWhatsApp(phone, message, conv?.id ?? lead.whatsapp_conversation_id, lead.id, et.id, et.name);
                console.log(`[lead ${lead.id}] on_enter whatsapp sent for trigger "${et.name}"`);
              } else if (et.action_type === "add_tag" && et.tags?.length > 0) {
                await supabase.from("crm_lead_tags").upsert(
                  et.tags.map((tag: string) => ({ lead_id: lead.id, tag })),
                  { onConflict: "lead_id,tag", ignoreDuplicates: true },
                );
              }
            }
          }
        }

        // Only register execution if action succeeded — otherwise allow retry
        if (actionOk) {
          if (prevExec) {
            await supabase.from("crm_timer_executions").update({ fired_at: new Date().toISOString() }).eq("id", prevExec.id);
          } else {
            await supabase.from("crm_timer_executions").insert({ lead_id: lead.id, trigger_id: trigger.id, stage_id: trigger.stage_id, fired_at: new Date().toISOString() });
          }
          processed++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, processed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("crm-timer-processor error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});