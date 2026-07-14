// Shared CRM side-effects fired when a new inbound WhatsApp message arrives,
// regardless of which provider (Z-API or Meta Cloud API) delivered it.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function waitUntil(promise: Promise<unknown>): void {
  // @ts-ignore Deno Deploy provides EdgeRuntime.waitUntil to keep the isolate alive
  // long enough for fire-and-forget work after the response has been sent.
  const wait = (globalThis as any).EdgeRuntime?.waitUntil;
  if (wait) wait(promise);
  else promise.catch((e) => console.log("waitUntil task error:", e));
}

export async function autoCreateLeadFromWhatsApp(
  supabase: SupabaseClient,
  params: { phone: string; contactName: string | null; conversationId: string; customerId: string | null },
): Promise<void> {
  try {
    const { data: entryStage } = await supabase
      .from("crm_funnel_stages")
      .select("id")
      .eq("is_entry", true)
      .order("order_index", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!entryStage) return;

    const { data: existingLead } = await supabase
      .from("crm_leads")
      .select("id")
      .eq("phone", params.phone)
      .maybeSingle();
    if (existingLead) return;

    const { data: newLead } = await supabase
      .from("crm_leads")
      .insert({
        name: params.contactName || params.phone,
        phone: params.phone,
        source: "whatsapp",
        stage_id: entryStage.id,
        whatsapp_conversation_id: params.conversationId,
        customer_id: params.customerId,
      })
      .select("id")
      .single();

    if (newLead) {
      await supabase.from("crm_activities").insert({
        lead_id: newLead.id,
        type: "stage_change",
        content: "Lead criado automaticamente via WhatsApp",
        metadata: { source: "whatsapp", phone: params.phone, conversation_id: params.conversationId },
      });
    }
  } catch (e) {
    console.log("Auto CRM lead error:", e);
  }
}

export async function fireOnMessageReceivedTriggers(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<void> {
  try {
    const { data: lead } = await supabase
      .from("crm_leads")
      .select("id, stage_id")
      .eq("whatsapp_conversation_id", conversationId)
      .maybeSingle();
    if (!lead) return;

    const { data: triggers } = await supabase
      .from("crm_triggers")
      .select("*")
      .eq("stage_id", lead.stage_id)
      .eq("trigger_condition", "on_message_received")
      .eq("is_active", true);
    if (!triggers?.length) return;

    for (const trigger of triggers) {
      if (trigger.action_type === "move_stage" && trigger.target_stage_id) {
        await supabase
          .from("crm_leads")
          .update({ stage_id: trigger.target_stage_id, stage_changed_at: new Date().toISOString() })
          .eq("id", lead.id);
        await supabase.from("crm_activities").insert({
          lead_id: lead.id,
          type: "trigger_fired",
          content: `Gatilho disparado: "${trigger.name}" — lead avançou automaticamente`,
          metadata: { trigger_id: trigger.id, trigger_name: trigger.name, reason: "on_message_received" },
        });
      }
    }
  } catch (e) {
    console.log("on_message_received trigger error:", e);
  }
}

/** Find a customer by phone (primary or secondary contact) to link a new conversation. */
export async function findCustomerByPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<string | null> {
  const { data: customer } = await supabase
    .from("customers")
    .select("id")
    .or(`phone.eq.${phone},phone.eq.+${phone}`)
    .limit(1)
    .maybeSingle();
  if (customer) return customer.id;

  const digits = phone.replace(/\D/g, "");
  const { data: extraPhone } = await supabase
    .from("customer_phones")
    .select("customer_id")
    .or(`phone_number.eq.${phone},phone_number.eq.+${phone},phone_number.ilike.%${digits}%`)
    .limit(1)
    .maybeSingle();
  return extraPhone?.customer_id ?? null;
}
