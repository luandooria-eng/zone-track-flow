// Auto Reactivation Dispatcher
// Sends WhatsApp reminders to customers based on their personal avg_days frequency per product type.
// Runs every 15 min via pg_cron.
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
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

function getNowInSaoPauloMinutes(): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const parts = fmt.formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")!.value, 10);
  const m = parseInt(parts.find((p) => p.type === "minute")!.value, 10);
  return h * 60 + m;
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

// product matching + avg_days computation now done inside SQL RPC get_reactivation_candidates

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Load Z-API config
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

    // 2) Load active rules
    const { data: rules } = await supabase
      .from("auto_reactivation_rules")
      .select("*")
      .eq("is_active", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0, reason: "no active rules" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nowMin = getNowInSaoPauloMinutes();
    const nowIso = new Date().toISOString();
    const reports: any[] = [];
    let totalSent = 0;

    for (const rule of rules) {
      const ws = timeToMin(String(rule.send_window_start).slice(0, 5));
      const we = timeToMin(String(rule.send_window_end).slice(0, 5));
      if (nowMin < ws || nowMin >= we) {
        reports.push({ product_type: rule.product_type, skipped: "outside_window" });
        continue;
      }

      // 2a) Process existing cycles whose next_due_at is past and still needing send
      const { data: dueCycles } = await supabase
        .from("auto_reactivation_cycles")
        .select("*")
        .eq("product_type", rule.product_type)
        .in("status", ["waiting", "sent"])
        .lte("next_due_at", nowIso)
        .limit(rule.rate_limit_per_run);

      let processed = 0;

      for (const cyc of (dueCycles || [])) {
        // sent cycles need follow-up: only if no response and attempts < max
        if (cyc.status === "sent") {
          // Per business rule: a reply without a purchase still counts as "no order",
          // so we keep following up until max_attempts. The cycle is only auto-completed
          // when a new delivered order arrives (handled by a DB trigger).
          if ((cyc.attempt_count || 0) >= rule.max_attempts) {
            await supabase.from("auto_reactivation_cycles")
              .update({ status: "exhausted", updated_at: nowIso }).eq("id", cyc.id);
            continue;
          }
        }

        // Load customer
        const { data: customer } = await supabase
          .from("customers")
          .select("id, name, phone, is_active")
          .eq("id", cyc.customer_id)
          .maybeSingle();

        if (!customer || !customer.is_active || !customer.phone) {
          await supabase.from("auto_reactivation_cycles")
            .update({ status: "paused", updated_at: nowIso }).eq("id", cyc.id);
          continue;
        }

        const attemptNum = (cyc.attempt_count || 0) + 1;
        const tplBody = attemptNum > 1 && rule.followup_message_template
          ? rule.followup_message_template
          : rule.message_template;

        const firstName = (customer.name || "").split(" ")[0] || "";
        const daysSince = cyc.cycle_anchor_at
          ? Math.floor((Date.now() - new Date(cyc.cycle_anchor_at).getTime()) / 86400000)
          : 0;

        const message = applyTemplate(tplBody, {
          nome: customer.name || "",
          primeiro_nome: firstName,
          dias_sem_comprar: String(daysSince),
        });
        const phone = normalizePhone(customer.phone);

        // upsert conversation
        const { data: conv } = await supabase
          .from("whatsapp_conversations")
          .upsert(
            { phone, status: "open", last_message: message.slice(0, 500), last_message_at: nowIso },
            { onConflict: "phone" },
          )
          .select("id").single();

        // Send via Z-API
        const zapiUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`;
        const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (clientToken) zapiHeaders["Client-Token"] = clientToken;
        const zapiRes = await fetch(zapiUrl, {
          method: "POST", headers: zapiHeaders,
          body: JSON.stringify({ phone, message }),
        });
        const zapiData = await zapiRes.json().catch(() => ({} as any));

        if (!zapiRes.ok) {
          await supabase.from("auto_reactivation_log").insert({
            cycle_id: cyc.id, customer_id: customer.id, product_type: rule.product_type,
            attempt_number: attemptNum, phone, message_content: message,
            status: "failed", error_message: JSON.stringify(zapiData).slice(0, 500),
          });
          continue;
        }

        const messageId = zapiData.messageId || zapiData.id || null;

        await supabase.from("whatsapp_messages").insert({
          conversation_id: conv?.id ?? null, message_id: messageId,
          direction: "outbound", content: message, type: "text", status: "sent",
        });

        await supabase.from("auto_reactivation_log").insert({
          cycle_id: cyc.id, customer_id: customer.id, product_type: rule.product_type,
          attempt_number: attemptNum, phone, message_content: message,
          message_id: messageId, conversation_id: conv?.id ?? null, status: "sent",
        });

        // Schedule next_due_at = now + followup_interval_days (only matters if no response)
        const nextDue = new Date(Date.now() + rule.followup_interval_days * 86400000).toISOString();
        await supabase.from("auto_reactivation_cycles").update({
          status: "sent",
          attempt_count: attemptNum,
          last_sent_at: nowIso,
          last_message_id: messageId,
          next_due_at: nextDue,
          updated_at: nowIso,
        }).eq("id", cyc.id);

        processed++;
        totalSent++;
      }

      // 2b) Discover NEW candidates: customers without an active cycle whose last delivered order
      //     of this product type is older than (avg_days + tolerance) days
      const remaining = Math.max(0, rule.rate_limit_per_run - processed);
      if (remaining > 0) {
        const minSamples = rule.product_type === "gas" ? 3 : 2;
        const { data: candidates, error: candErr } = await supabase.rpc(
          "get_reactivation_candidates",
          {
            p_product_type: rule.product_type,
            p_min_avg: rule.min_avg_days,
            p_max_avg: rule.max_avg_days,
            p_tolerance: rule.tolerance_days,
            p_min_samples: minSamples,
            p_limit: remaining,
          },
        );
        if (candErr) {
          reports.push({ product_type: rule.product_type, rpc_error: candErr.message });
        }

        let newlyQueued = 0;
        for (const cust of (candidates || [])) {
          if (newlyQueued >= remaining) break;

          const lastDate = new Date(cust.last_order_at);
          const avgDays = cust.avg_days as number;
          const daysSince = cust.days_since as number;
          const customerId = cust.customer_id as string;
          const customerName = (cust.customer_name as string) || "";
          const customerPhone = (cust.customer_phone as string) || "";

          // Upsert cycle as waiting, set next_due_at = now so the next tick sends it.
          // To send right away (within this same run), insert and immediately try to send.
          const { data: newCyc, error: insErr } = await supabase
            .from("auto_reactivation_cycles")
            .upsert({
              customer_id: customerId,
              product_type: rule.product_type,
              cycle_anchor_at: lastDate.toISOString(),
              avg_days_at_cycle: avgDays,
              next_due_at: nowIso,
              attempt_count: 0,
              status: "waiting",
            }, { onConflict: "customer_id,product_type" })
            .select()
            .single();

          if (insErr || !newCyc) continue;

          // Send first message inline
          const firstName = customerName.split(" ")[0] || "";
          const message = applyTemplate(rule.message_template, {
            nome: customerName,
            primeiro_nome: firstName,
            dias_sem_comprar: String(daysSince),
          });
          const phone = normalizePhone(customerPhone);

          const { data: conv } = await supabase
            .from("whatsapp_conversations")
            .upsert(
              { phone, status: "open", last_message: message.slice(0, 500), last_message_at: nowIso },
              { onConflict: "phone" },
            )
            .select("id").single();

          const zapiUrl = `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`;
          const zapiHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (clientToken) zapiHeaders["Client-Token"] = clientToken;
          const zapiRes = await fetch(zapiUrl, {
            method: "POST", headers: zapiHeaders,
            body: JSON.stringify({ phone, message }),
          });
          const zapiData = await zapiRes.json().catch(() => ({} as any));

          if (!zapiRes.ok) {
            await supabase.from("auto_reactivation_log").insert({
              cycle_id: newCyc.id, customer_id: customerId, product_type: rule.product_type,
              attempt_number: 1, phone, message_content: message,
              status: "failed", error_message: JSON.stringify(zapiData).slice(0, 500),
            });
            continue;
          }

          const messageId = zapiData.messageId || zapiData.id || null;
          await supabase.from("whatsapp_messages").insert({
            conversation_id: conv?.id ?? null, message_id: messageId,
            direction: "outbound", content: message, type: "text", status: "sent",
          });
          await supabase.from("auto_reactivation_log").insert({
            cycle_id: newCyc.id, customer_id: customerId, product_type: rule.product_type,
            attempt_number: 1, phone, message_content: message,
            message_id: messageId, conversation_id: conv?.id ?? null, status: "sent",
          });

          const nextDue = new Date(Date.now() + rule.followup_interval_days * 86400000).toISOString();
          await supabase.from("auto_reactivation_cycles").update({
            status: "sent", attempt_count: 1, last_sent_at: nowIso,
            last_message_id: messageId, next_due_at: nextDue, updated_at: nowIso,
          }).eq("id", newCyc.id);

          newlyQueued++;
          totalSent++;
        }

        reports.push({ product_type: rule.product_type, processed_due: processed, new_sent: newlyQueued });
      } else {
        reports.push({ product_type: rule.product_type, processed_due: processed });
      }
    }

    return new Response(JSON.stringify({ ok: true, totalSent, reports }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-reactivation-dispatcher error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});