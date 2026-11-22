// Backfill profile pictures for existing WhatsApp conversations
import { authenticateCaller } from "../_shared/auth.ts";
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

async function fetchProfilePicture(instanceId: string, token: string, clientToken: string, phone: string): Promise<string | null> {
  try {
    const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/profile-picture?phone=${phone}`;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (clientToken) headers["Client-Token"] = clientToken;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.log(`Pic fetch ${phone} -> ${res.status}: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    return data.link || data.profilePictureUrl || data.url || null;
  } catch (e) {
    console.log("Pic error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = await authenticateCaller(req, {
      corsHeaders,
      allowedRoles: ["admin"],
    });
    if (auth.response) return auth.response;

    const { data: config } = await supabase
      .from("whatsapp_config")
      .select("instance_id, token")
      .eq("id", "00000000-0000-0000-0000-000000000099")
      .maybeSingle();

    if (!config?.instance_id || !config?.token) {
      return new Response(JSON.stringify({ error: "Z-API not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || "";

    const { data: convs } = await supabase
      .from("whatsapp_conversations")
      .select("id, phone")
      .limit(200);

    let updated = 0;
    let failed = 0;
    for (const c of convs || []) {
      const pic = await fetchProfilePicture(config.instance_id, config.token, clientToken, c.phone);
      if (pic) {
        await supabase.from("whatsapp_conversations").update({ profile_picture_url: pic }).eq("id", c.id);
        updated++;
      } else {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 150));
    }

    return new Response(JSON.stringify({ ok: true, updated, failed, total: convs?.length || 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
