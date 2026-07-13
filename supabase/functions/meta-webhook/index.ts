// WhatsApp Cloud API (Meta oficial) — verificação do webhook (GET) e eventos
// recebidos (POST): mensagens novas e atualizações de status de entrega/leitura.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { WHATSAPP_CONFIG_ID, normalizePhone } from "../_shared/whatsapp-send.ts";
import {
  autoCreateLeadFromWhatsApp,
  fireOnMessageReceivedTriggers,
  findCustomerByPhone,
  waitUntil,
} from "../_shared/crm-hooks.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): Promise<boolean> {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expectedHex = signatureHeader.slice("sha256=".length);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (computedHex.length !== expectedHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) diff |= computedHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  return diff === 0;
}

const MEDIA_TYPES = new Set(["image", "video", "audio", "document", "sticker"]);

function extExtFromMime(mime: string | undefined): string {
  if (!mime) return "bin";
  const sub = mime.split("/")[1]?.split(";")[0];
  return sub || "bin";
}

async function downloadAndStoreMedia(
  mediaId: string,
  accessToken: string,
  apiVersion: string,
): Promise<string | null> {
  try {
    const metaRes = await fetch(`https://graph.facebook.com/${apiVersion}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();
    if (!meta.url) return null;

    const fileRes = await fetch(meta.url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!fileRes.ok) return null;
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    const ext = extExtFromMime(meta.mime_type);
    const path = `${mediaId}.${ext}`;

    const { error } = await supabase.storage
      .from("whatsapp-media")
      .upload(path, bytes, { contentType: meta.mime_type || "application/octet-stream", upsert: true });
    if (error) {
      console.error("Media upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error("downloadAndStoreMedia error:", e);
    return null;
  }
}

function extractContent(msg: Record<string, any>): string {
  switch (msg.type) {
    case "text":
      return msg.text?.body ?? "";
    case "image":
      return msg.image?.caption || "[imagem]";
    case "video":
      return msg.video?.caption || "[vídeo]";
    case "document":
      return msg.document?.caption || `📄 ${msg.document?.filename || "documento"}`;
    case "audio":
      return "🎵 Áudio";
    case "sticker":
      return "🎭 Sticker";
    case "location":
      return "📍 Localização compartilhada";
    case "button":
      return msg.button?.text || "[botão]";
    case "interactive":
      return msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || "[interativo]";
    case "reaction":
      return `${msg.reaction?.emoji ?? "👍"} (reagiu à mensagem)`;
    default:
      return "[mídia]";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { data: config } = await supabase
    .from("whatsapp_config")
    .select("meta_verify_token, meta_app_secret, meta_access_token, meta_api_version")
    .eq("id", WHATSAPP_CONFIG_ID)
    .maybeSingle();

  // --- Webhook verification handshake (Meta App dashboard "Verify and save") ---
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token && config?.meta_verify_token && token === config.meta_verify_token) {
      return new Response(challenge ?? "", { status: 200, headers: corsHeaders });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();

    if (config?.meta_app_secret) {
      const signature = req.headers.get("x-hub-signature-256");
      const valid = await verifySignature(rawBody, signature, config.meta_app_secret);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const payload = JSON.parse(rawBody);
    const apiVersion = config?.meta_api_version || "v21.0";

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};

        // --- Delivery / read status updates ---
        for (const status of value.statuses ?? []) {
          const newStatus = status.status === "read" ? "read" : status.status === "delivered" ? "delivered" : status.status === "failed" ? "failed" : null;
          if (newStatus && status.id) {
            await supabase.from("whatsapp_messages").update({ status: newStatus }).eq("message_id", status.id);
          }
        }

        // --- Inbound messages ---
        for (const msg of value.messages ?? []) {
          const phone = normalizePhone(msg.from ?? "");
          if (!phone) continue;

          const contactName = (value.contacts?.[0]?.profile?.name as string) || null;
          const messageId = msg.id ?? null;
          const content = extractContent(msg);
          let mediaUrl: string | null = null;
          let msgType = msg.type ?? "text";

          if (MEDIA_TYPES.has(msg.type) && config?.meta_access_token) {
            const media = msg[msg.type];
            if (media?.id) {
              mediaUrl = await downloadAndStoreMedia(media.id, config.meta_access_token, apiVersion);
            }
          }

          const nowIso = new Date().toISOString();
          const { data: existingConv } = await supabase
            .from("whatsapp_conversations")
            .select("id, unread_count")
            .eq("phone", phone)
            .maybeSingle();

          let convId: string;
          if (existingConv) {
            convId = existingConv.id;
            await supabase
              .from("whatsapp_conversations")
              .update({
                contact_name: contactName,
                last_message: content.slice(0, 500),
                last_message_at: nowIso,
                status: "open",
                unread_count: (existingConv.unread_count || 0) + 1,
              })
              .eq("id", convId);
          } else {
            const customerId = await findCustomerByPhone(supabase, phone);
            const { data: conv, error: convErr } = await supabase
              .from("whatsapp_conversations")
              .insert({
                phone,
                contact_name: contactName,
                customer_id: customerId,
                last_message: content.slice(0, 500),
                last_message_at: nowIso,
                status: "open",
                unread_count: 1,
              })
              .select("id")
              .single();
            if (convErr || !conv) {
              console.error("Conversation insert error:", convErr);
              continue;
            }
            convId = conv.id;
            waitUntil(autoCreateLeadFromWhatsApp(supabase, { phone, contactName, conversationId: convId, customerId }));
          }

          await supabase.from("whatsapp_messages").upsert(
            { conversation_id: convId, message_id: messageId, direction: "inbound", content, type: msgType, media_url: mediaUrl, status: "received" },
            { onConflict: "message_id", ignoreDuplicates: true },
          );

          waitUntil(fireOnMessageReceivedTriggers(supabase, convId));
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("meta-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
