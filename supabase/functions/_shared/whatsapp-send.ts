// Shared, provider-aware WhatsApp sender used by every edge function that dispatches
// outbound messages (manual replies, CRM triggers, campaigns, auto-reactivation, cart recovery).
//
// Two providers are supported side by side:
//  - "zapi": unofficial provider (personal WhatsApp connection), free text always allowed.
//  - "meta_cloud": official WhatsApp Cloud API. Free text is only allowed inside the 24h
//    customer service window (time since the contact's last inbound message); outside that
//    window Meta requires a pre-approved message template.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const WHATSAPP_CONFIG_ID = "00000000-0000-0000-0000-000000000099";
const META_OUTSIDE_WINDOW_CODE = 131047;

export interface WhatsAppConfigRow {
  provider: "zapi" | "meta_cloud";
  instance_id: string | null;
  token: string | null;
  meta_phone_number_id: string | null;
  meta_access_token: string | null;
  meta_api_version: string | null;
}

export interface SendResult {
  ok: boolean;
  provider: "zapi" | "meta_cloud";
  messageId?: string | null;
  usedTemplate?: boolean;
  error?: string;
  details?: unknown;
}

export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
}

export async function getWhatsAppConfig(
  supabase: SupabaseClient,
): Promise<WhatsAppConfigRow | null> {
  const { data } = await supabase
    .from("whatsapp_config")
    .select("provider, instance_id, token, meta_phone_number_id, meta_access_token, meta_api_version")
    .eq("id", WHATSAPP_CONFIG_ID)
    .maybeSingle();
  return (data as WhatsAppConfigRow) ?? null;
}

async function loadTemplate(supabase: SupabaseClient, templateId: string) {
  const { data } = await supabase
    .from("whatsapp_templates")
    .select("name, language")
    .eq("id", templateId)
    .maybeSingle();
  return data as { name: string; language: string } | null;
}

async function isWithinSessionWindow(supabase: SupabaseClient, phone: string): Promise<boolean> {
  const { data } = await supabase
    .from("whatsapp_conversations")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (!data?.id) return false;

  const { data: lastInbound } = await supabase
    .from("whatsapp_messages")
    .select("created_at")
    .eq("conversation_id", data.id)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!lastInbound?.created_at) return false;

  const ageMs = Date.now() - new Date(lastInbound.created_at as string).getTime();
  return ageMs < 24 * 60 * 60 * 1000;
}

async function sendViaZApi(
  config: WhatsAppConfigRow,
  phone: string,
  message: string,
): Promise<SendResult> {
  if (!config.instance_id || !config.token) {
    return { ok: false, provider: "zapi", error: "Z-API not configured" };
  }
  const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
  const url = `https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify({ phone, message }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, provider: "zapi", error: "Z-API send failed", details: data };
  }
  return { ok: true, provider: "zapi", messageId: data.messageId || data.id || null };
}

async function sendMetaText(
  config: WhatsAppConfigRow,
  phone: string,
  message: string,
): Promise<{ res: Response; data: any }> {
  const apiVersion = config.meta_api_version || "v21.0";
  const url = `https://graph.facebook.com/${apiVersion}/${config.meta_phone_number_id}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.meta_access_token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: message },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

async function sendMetaTemplate(
  config: WhatsAppConfigRow,
  phone: string,
  templateName: string,
  templateLanguage: string,
  variables: string[],
): Promise<{ res: Response; data: any }> {
  const apiVersion = config.meta_api_version || "v21.0";
  const url = `https://graph.facebook.com/${apiVersion}/${config.meta_phone_number_id}/messages`;
  const components = variables.length
    ? [{ type: "body", parameters: variables.map((v) => ({ type: "text", text: v })) }]
    : undefined;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.meta_access_token}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: templateLanguage },
        ...(components ? { components } : {}),
      },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export interface SendWhatsAppMessageOptions {
  phone: string;
  message: string;
  /** Explicit template to use (skips 24h-window detection). */
  templateId?: string | null;
  /** Template used only if the contact is outside the 24h session window. */
  fallbackTemplateId?: string | null;
  /** Positional {{1}}, {{2}}... values for the template body, in order. */
  templateVariables?: string[];
}

export async function sendWhatsAppMessage(
  supabase: SupabaseClient,
  config: WhatsAppConfigRow,
  opts: SendWhatsAppMessageOptions,
): Promise<SendResult> {
  const phone = normalizePhone(opts.phone);
  const variables = opts.templateVariables || [];

  if (config.provider === "zapi") {
    return sendViaZApi(config, phone, opts.message);
  }

  if (!config.meta_phone_number_id || !config.meta_access_token) {
    return { ok: false, provider: "meta_cloud", error: "Meta Cloud API not configured" };
  }

  // Explicit template requested by the caller.
  if (opts.templateId) {
    const template = await loadTemplate(supabase, opts.templateId);
    if (!template) return { ok: false, provider: "meta_cloud", error: "Template not found" };
    const { res, data } = await sendMetaTemplate(config, phone, template.name, template.language, variables);
    if (!res.ok) return { ok: false, provider: "meta_cloud", error: "Meta send failed", details: data };
    return { ok: true, provider: "meta_cloud", messageId: data?.messages?.[0]?.id ?? null, usedTemplate: true };
  }

  const withinWindow = await isWithinSessionWindow(supabase, phone);
  if (withinWindow) {
    const { res, data } = await sendMetaText(config, phone, opts.message);
    if (res.ok) {
      return { ok: true, provider: "meta_cloud", messageId: data?.messages?.[0]?.id ?? null, usedTemplate: false };
    }
    // Meta can still reject as "outside window" if our local session tracking is stale.
    const code = data?.error?.code;
    if (code !== META_OUTSIDE_WINDOW_CODE || !opts.fallbackTemplateId) {
      return { ok: false, provider: "meta_cloud", error: "Meta send failed", details: data };
    }
    // fall through to template fallback below
  } else if (!opts.fallbackTemplateId) {
    return {
      ok: false,
      provider: "meta_cloud",
      error: "outside_24h_window_no_template",
    };
  }

  const template = await loadTemplate(supabase, opts.fallbackTemplateId!);
  if (!template) return { ok: false, provider: "meta_cloud", error: "Fallback template not found" };
  const { res, data } = await sendMetaTemplate(config, phone, template.name, template.language, variables);
  if (!res.ok) return { ok: false, provider: "meta_cloud", error: "Meta send failed", details: data };
  return { ok: true, provider: "meta_cloud", messageId: data?.messages?.[0]?.id ?? null, usedTemplate: true };
}
