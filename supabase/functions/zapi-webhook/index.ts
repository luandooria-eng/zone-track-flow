import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

function extractMedia(payload: Record<string, unknown>): { mediaUrl: string | null; msgType: string } {
  if (payload.image) { const img = payload.image as Record<string, unknown>; return { mediaUrl: (img.imageUrl || img.url) as string ?? null, msgType: "image" }; }
  if (payload.video) { const vid = payload.video as Record<string, unknown>; return { mediaUrl: (vid.videoUrl || vid.url) as string ?? null, msgType: "video" }; }
  if (payload.audio) { const aud = payload.audio as Record<string, unknown>; return { mediaUrl: (aud.audioUrl || aud.url) as string ?? null, msgType: "audio" }; }
  if (payload.document) { const doc = payload.document as Record<string, unknown>; return { mediaUrl: (doc.documentUrl || doc.url) as string ?? null, msgType: "document" }; }
  if (payload.sticker) { const stk = payload.sticker as Record<string, unknown>; return { mediaUrl: (stk.stickerUrl || stk.url) as string ?? null, msgType: "sticker" }; }
  return { mediaUrl: null, msgType: "text" };
}

function extractContent(payload: Record<string, unknown>): string {
  const text = payload.text as Record<string, unknown> | undefined;
  if (text?.message) return text.message as string;
  if (payload.message) return payload.message as string;
  if (payload.body) return payload.body as string;
  const img = payload.image as Record<string, unknown> | undefined;
  if (img?.caption) return img.caption as string;
  const vid = payload.video as Record<string, unknown> | undefined;
  if (vid?.caption) return vid.caption as string;
  const doc = payload.document as Record<string, unknown> | undefined;
  if (doc?.fileName) return `📄 ${doc.fileName}`;
  if (payload.audio) return "🎵 Áudio";
  if (payload.sticker) return "🎭 Sticker";
  return "[mídia]";
}

function extractReaction(payload: Record<string, unknown>): { emoji: string; referencedId: string | null } | null {
  const r = payload.reaction as Record<string, unknown> | undefined;
  if (r && (r.value || r.emoji)) {
    const ref = r.referencedMessage as Record<string, unknown> | undefined;
    return {
      emoji: (r.value || r.emoji) as string,
      referencedId: (ref?.messageId || ref?.id || r.msgId || null) as string | null,
    };
  }
  // Some Z-API events use type === "ReactionMessageCallback"
  const t = (payload.type || payload.event) as string | undefined;
  if (t && String(t).toLowerCase().includes("reaction")) {
    return {
      emoji: (payload.value || payload.emoji || payload.message || "👍") as string,
      referencedId: (payload.referencedMessageId || payload.msgId || null) as string | null,
    };
  }
  return null;
}

async function fetchAndStoreProfilePicture(instanceId: string, token: string, phone: string, conversationId: string): Promise<void> {
  try {
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || "";
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/profile-picture?phone=${phone}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;
    const res = await fetch(url, { headers });
    if (!res.ok) return;
    const data = await res.json();
    const pic = data.link || data.profilePictureUrl || data.url || null;
    if (pic) await supabase.from("whatsapp_conversations").update({ profile_picture_url: pic }).eq("id", conversationId);
  } catch (e) { console.log("Profile picture fetch error:", e); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const tokenParam = url.searchParams.get("token");

    const { data: config } = await supabase
      .from("whatsapp_config").select("webhook_token, instance_id, token")
      .eq("id", "00000000-0000-0000-0000-000000000099").maybeSingle();

    if (!config || !tokenParam || tokenParam !== config.webhook_token) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json() as Record<string, unknown>;
    const type = (payload.type || payload.event) as string;

    if (type === "ConnectedCallback" || type === "DisconnectedCallback") {
      await supabase.from("whatsapp_config").update({
        status: type === "ConnectedCallback" ? "connected" : "disconnected",
        phone: payload.phone || payload.connectedPhone || null,
        updated_at: new Date().toISOString(),
      }).eq("id", "00000000-0000-0000-0000-000000000099");
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (type === "MessageStatusCallback" || type === "ReadCallback" || type === "DeliveryCallback") {
      const messageId = payload.messageId || payload.id;
      // Z-API may send MessageStatusCallback with status field: "READ", "DELIVERED", "RECEIVED", etc.
      const statusField = String(payload.status || payload.deliveryStatus || "").toUpperCase();
      const isRead = type === "ReadCallback" || statusField === "READ" || statusField === "VISUALIZED";
      const isDelivered = type === "DeliveryCallback" || statusField === "DELIVERED" || statusField === "RECEIVED";
      const newStatus = isRead ? "read" : isDelivered ? "delivered" : null;
      if (messageId && newStatus) {
        const nowIso = new Date().toISOString();
        await Promise.all([
          supabase.from("whatsapp_messages").update({ status: newStatus }).eq("message_id", messageId),
          newStatus === "read"
            ? supabase.from("cart_recovery_logs").update({ read_at: nowIso }).eq("message_id", messageId).is("read_at", null)
            : supabase.from("cart_recovery_logs").update({ delivered_at: nowIso }).eq("message_id", messageId).is("delivered_at", null),
        ]);
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Call events (Z-API: CallReceivedCallback / CallRecivedCallback / etc.)
    if (type && String(type).toLowerCase().includes("call") && !["connectedcallback","disconnectedcallback","messagestatuscallback","readcallback","deliverycallback","receivedcallback"].includes(String(type).toLowerCase())) {
      console.log("Call event payload:", JSON.stringify(payload));
      const rawPhoneRaw = (payload.caller || payload.phone || payload.from || "") as string;
      const phone = normalizePhone(rawPhoneRaw);
      if (!phone) return new Response(JSON.stringify({ ok: true, skip: "no phone" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const isVideo = payload.isVideo === true || payload.video === true;
      const callIdRaw = (payload.callId || payload.id || payload.messageId || null) as string | null;
      const messageId = callIdRaw ? `call-${callIdRaw}` : null;
      const content = isVideo ? "Chamada de vídeo" : "Ligação de voz";
      const nowIso = new Date().toISOString();

      const { data: existingConv } = await supabase.from("whatsapp_conversations")
        .select("id, unread_count").eq("phone", phone).maybeSingle();
      let convId = existingConv?.id as string | undefined;
      if (!convId) {
        const { data: created } = await supabase.from("whatsapp_conversations")
          .insert({ phone, contact_name: rawPhoneRaw, last_message: content, last_message_at: nowIso, unread_count: 1, status: "open" })
          .select("id").single();
        convId = created?.id;
      } else {
        await supabase.from("whatsapp_conversations").update({
          last_message: content, last_message_at: nowIso,
          unread_count: (existingConv?.unread_count || 0) + 1, status: "open",
        }).eq("id", convId);
      }
      if (convId) {
        await supabase.from("whatsapp_messages").upsert(
          { conversation_id: convId, message_id: messageId, direction: "inbound", content, type: "call", media_url: null, status: "received" },
          { onConflict: "message_id", ignoreDuplicates: true },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reaction (emoji) — treat as a normal message so it shows up in the chat
    const reaction = extractReaction(payload);
    if (reaction) {
      console.log("Reaction payload:", JSON.stringify({ reaction, fromMe: payload.fromMe, phone: payload.phone, chatLid: payload.chatLid }));
      const rawPhoneRaw = (payload.phone || payload.from || payload.to || "") as string;
      const chatLidRaw = (payload.chatLid || (String(rawPhoneRaw).includes("@lid") ? rawPhoneRaw : null)) as string | null;
      const isGroup = payload.isGroup === true || payload.isGroupMsg === true || String(rawPhoneRaw).includes("@g.us");
      if (isGroup) return new Response(JSON.stringify({ ok: true, skip: "group reaction" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Find conversation
      let convRow: { id: string; unread_count: number | null } | null = null;
      if (chatLidRaw) {
        const { data } = await supabase.from("whatsapp_conversations").select("id, unread_count").eq("chat_lid", chatLidRaw).maybeSingle();
        convRow = data;
      }
      if (!convRow && rawPhoneRaw && !String(rawPhoneRaw).includes("@lid")) {
        const phone = normalizePhone(rawPhoneRaw);
        if (phone) {
          const { data } = await supabase.from("whatsapp_conversations").select("id, unread_count").eq("phone", phone).maybeSingle();
          convRow = data;
        }
      }
      if (!convRow) {
        console.log("Reaction: no conversation found");
        return new Response(JSON.stringify({ ok: true, skip: "no conv" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const isFromMe = payload.fromMe === true;
      const direction = isFromMe ? "outbound" : "inbound";
      const content = `${reaction.emoji} (reagiu à mensagem)`;
      const messageId = (payload.messageId || payload.id || null) as string | null;
      const nowIso = new Date().toISOString();

      await Promise.all([
        supabase.from("whatsapp_messages").upsert(
          { conversation_id: convRow.id, message_id: messageId, direction, content, type: "reaction", media_url: null, status: isFromMe ? "sent" : "received" },
          { onConflict: "message_id", ignoreDuplicates: true },
        ),
        supabase.from("whatsapp_conversations").update({
          last_message: content.slice(0, 500),
          last_message_at: nowIso,
          ...(isFromMe ? { unread_count: 0 } : { unread_count: (convRow.unread_count || 0) + 1, status: "open" }),
          ...(chatLidRaw ? { chat_lid: chatLidRaw } : {}),
        }).eq("id", convRow.id),
      ]);
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Message sent from phone (fromMe === true) — save as outbound
    if (payload.fromMe === true) {
      console.log("fromMe FULL payload:", JSON.stringify(payload));
      const rawPhoneRaw = (payload.phone || payload.to || "") as string;
      const chatLidRaw = (payload.chatLid || (String(rawPhoneRaw).includes("@lid") ? rawPhoneRaw : null)) as string | null;
      const isGroup = payload.isGroup === true || String(rawPhoneRaw).includes("@g.us");
      if (!isGroup) {
        const messageId = (payload.messageId || payload.id || null) as string | null;
        const content = extractContent(payload);
        const { mediaUrl, msgType } = extractMedia(payload);
        const nowIso = new Date().toISOString();
        // Try to find conversation: by chat_lid first, then by phone
        let existingConv: { id: string } | null = null;
        if (chatLidRaw) {
          const { data } = await supabase.from("whatsapp_conversations").select("id").eq("chat_lid", chatLidRaw).maybeSingle();
          existingConv = data;
        }
        if (!existingConv && rawPhoneRaw && !String(rawPhoneRaw).includes("@lid")) {
          const phone = normalizePhone(rawPhoneRaw);
          if (phone) {
            const { data } = await supabase.from("whatsapp_conversations").select("id").eq("phone", phone).maybeSingle();
            existingConv = data;
          }
        }
        if (existingConv?.id) {
          await Promise.all([
            supabase.from("whatsapp_messages").upsert(
              { conversation_id: existingConv.id, message_id: messageId, direction: "outbound", content, type: msgType, media_url: mediaUrl, status: "sent" },
              { onConflict: "message_id", ignoreDuplicates: true },
            ),
            supabase.from("whatsapp_conversations").update({
              last_message: content.slice(0, 500), last_message_at: nowIso, unread_count: 0,
              ...(chatLidRaw ? { chat_lid: chatLidRaw } : {}),
            }).eq("id", existingConv.id),
          ]);
        } else if (rawPhoneRaw && !String(rawPhoneRaw).includes("@g.us")) {
          // No conversation yet — create one so outbound messages appear in inbox
          const phone = normalizePhone(rawPhoneRaw);
          if (phone) {
            const { data: newConv } = await supabase.from("whatsapp_conversations").upsert(
              { phone, contact_name: null, last_message: content.slice(0, 500), last_message_at: nowIso, unread_count: 0, status: "open", ...(chatLidRaw ? { chat_lid: chatLidRaw } : {}) },
              { onConflict: "phone", ignoreDuplicates: false },
            ).select("id").single();
            if (newConv?.id) {
              await supabase.from("whatsapp_messages").upsert(
                { conversation_id: newConv.id, message_id: messageId, direction: "outbound", content, type: msgType, media_url: mediaUrl, status: "sent" },
                { onConflict: "message_id", ignoreDuplicates: true },
              );
            }
          }
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Incoming message
    if (payload.fromMe === false || type === "ReceivedCallback") {
      const rawPhone = (payload.phone || payload.from || "") as string;
      const isGroup = payload.isGroupMsg === true || rawPhone.includes("@g.us") || rawPhone.includes("-");
      if (isGroup) return new Response(JSON.stringify({ ok: true, skip: "group" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const phone = normalizePhone(rawPhone);
      if (!phone) return new Response(JSON.stringify({ ok: true, skip: "no phone" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const messageId = (payload.messageId || payload.id || null) as string | null;
      const contactName = (payload.senderName || payload.chatName || payload.notifyName || null) as string | null;
      const content = extractContent(payload);
      const { mediaUrl, msgType } = extractMedia(payload);
      const nowIso = new Date().toISOString();

      const { data: existingConv } = await supabase.from("whatsapp_conversations")
        .select("id, unread_count, customer_id, profile_picture_url").eq("phone", phone).maybeSingle();

      let convId: string;
      let needsPicture = false;

      const incomingChatLid = (payload.chatLid || null) as string | null;

      if (existingConv) {
        convId = existingConv.id;
        needsPicture = !existingConv.profile_picture_url;
        await supabase.from("whatsapp_conversations").update({
          contact_name: contactName, last_message: content.slice(0, 500),
          last_message_at: nowIso, status: "open",
          unread_count: (existingConv.unread_count || 0) + 1,
          ...(incomingChatLid ? { chat_lid: incomingChatLid } : {}),
        }).eq("id", convId);
      } else {
        // Try matching by primary phone first
        let { data: customer } = await supabase.from("customers").select("id")
          .or(`phone.eq.${phone},phone.eq.+${phone}`).limit(1).maybeSingle();
        // Fallback: search in customer_phones (contatos adicionais — esposa, filho etc.)
        if (!customer) {
          const digits = phone.replace(/\D/g, "");
          const { data: extraPhone } = await supabase.from("customer_phones")
            .select("customer_id")
            .or(`phone_number.eq.${phone},phone_number.eq.+${phone},phone_number.ilike.%${digits}%`)
            .limit(1).maybeSingle();
          if (extraPhone?.customer_id) customer = { id: extraPhone.customer_id };
        }
        const { data: conv, error: convErr } = await supabase.from("whatsapp_conversations").insert({
          phone, contact_name: contactName, customer_id: customer?.id || null,
          last_message: content.slice(0, 500), last_message_at: nowIso, status: "open", unread_count: 1,
          chat_lid: incomingChatLid,
        }).select("id").single();
        if (convErr || !conv) {
          console.error("Conversation insert error:", convErr);
          return new Response(JSON.stringify({ error: "conv error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        convId = conv.id;
        needsPicture = true;

        const autoLeadTask = (async () => {
          try {
            const { data: entryStage } = await supabase.from("crm_funnel_stages").select("id")
              .eq("is_entry", true).order("order_index", { ascending: true }).limit(1).maybeSingle();
            if (!entryStage) return;
            const { data: existingLead } = await supabase.from("crm_leads").select("id").eq("phone", phone).maybeSingle();
            if (existingLead) return;
            const { data: newLead } = await supabase.from("crm_leads").insert({
              name: contactName || phone, phone, source: "whatsapp",
              stage_id: entryStage.id, whatsapp_conversation_id: conv.id, customer_id: customer?.id || null,
            }).select("id").single();
            if (newLead) {
              await supabase.from("crm_activities").insert({
                lead_id: newLead.id, type: "stage_change",
                content: "Lead criado automaticamente via WhatsApp",
                metadata: { source: "whatsapp", phone, conversation_id: conv.id },
              });
            }
          } catch (e) { console.log("Auto CRM lead error:", e); }
        })();
        // @ts-ignore
        const wait = (globalThis as any).EdgeRuntime?.waitUntil;
        if (wait) wait(autoLeadTask); else autoLeadTask.catch(() => {});
      }

      if (messageId) {
        const { error: msgErr } = await supabase.from("whatsapp_messages").upsert(
          { conversation_id: convId, message_id: messageId, direction: "inbound", content, type: msgType, media_url: mediaUrl, status: "received" },
          { onConflict: "message_id", ignoreDuplicates: true },
        );
        if (msgErr) console.error("whatsapp_messages upsert error:", msgErr);
      } else {
        const { error: msgErr } = await supabase.from("whatsapp_messages").insert(
          { conversation_id: convId, message_id: null, direction: "inbound", content, type: msgType, media_url: mediaUrl, status: "received" },
        );
        if (msgErr) console.error("whatsapp_messages insert error:", msgErr);
      }

      // on_message_received triggers (fire-and-forget)
      const onMsgTask = (async () => {
        try {
          const { data: lead } = await supabase.from("crm_leads").select("id, stage_id")
            .eq("whatsapp_conversation_id", convId).maybeSingle();
          if (!lead) return;
          const { data: triggers } = await supabase.from("crm_triggers").select("*")
            .eq("stage_id", lead.stage_id).eq("trigger_condition", "on_message_received").eq("is_active", true);
          if (!triggers?.length) return;
          for (const trigger of triggers) {
            if (trigger.action_type === "move_stage" && trigger.target_stage_id) {
              await supabase.from("crm_leads")
                .update({ stage_id: trigger.target_stage_id, stage_changed_at: new Date().toISOString() })
                .eq("id", lead.id);
              await supabase.from("crm_activities").insert({
                lead_id: lead.id, type: "trigger_fired",
                content: `Gatilho disparado: "${trigger.name}" — lead avançou automaticamente`,
                metadata: { trigger_id: trigger.id, trigger_name: trigger.name, reason: "on_message_received" },
              });
            }
          }
        } catch (e) { console.log("on_message_received trigger error:", e); }
      })();
      // @ts-ignore
      { const w = (globalThis as any).EdgeRuntime?.waitUntil; if (w) w(onMsgTask); else onMsgTask.catch(() => {}); }

      if (needsPicture && config.instance_id && config.token) {
        // @ts-ignore
        const wait = (globalThis as any).EdgeRuntime?.waitUntil;
        const picTask = fetchAndStoreProfilePicture(config.instance_id as string, config.token as string, phone, convId);
        if (wait) wait(picTask); else picTask.catch(() => {});
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("zapi-webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
