import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface WebhookPayload {
  event: string;
  data: Record<string, unknown>;
  timestamp: string;
}

interface WebhookConfig {
  id: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
}

// In-memory webhook registry (in production, this would be in the database)
const webhookRegistry: WebhookConfig[] = [];

async function sendWebhook(config: WebhookConfig, payload: WebhookPayload): Promise<boolean> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.secret) {
      // Create HMAC signature
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(config.secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const signature = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(JSON.stringify(payload))
      );
      const signatureHex = Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      headers["X-Webhook-Signature"] = `sha256=${signatureHex}`;
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    return response.ok;
  } catch (error) {
    console.error(`Failed to send webhook to ${config.url}:`, error);
    return false;
  }
}

async function processEvent(event: string, data: Record<string, unknown>): Promise<void> {
  const payload: WebhookPayload = {
    event,
    data,
    timestamp: new Date().toISOString(),
  };

  const relevantWebhooks = webhookRegistry.filter(
    (w) => w.active && w.events.includes(event)
  );

  await Promise.all(relevantWebhooks.map((webhook) => sendWebhook(webhook, payload)));
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname.split("/").filter(Boolean);
    const action = path[path.length - 1];

    // Register a new webhook
    if (action === "register" && req.method === "POST") {
      const body = await req.json();
      const { url: webhookUrl, secret, events } = body;

      if (!webhookUrl || !events || !Array.isArray(events)) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: url, events" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const newWebhook: WebhookConfig = {
        id: crypto.randomUUID(),
        url: webhookUrl,
        secret,
        events,
        active: true,
      };

      webhookRegistry.push(newWebhook);

      return new Response(
        JSON.stringify({ 
          success: true, 
          webhook: { id: newWebhook.id, events: newWebhook.events } 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trigger a webhook event (internal use)
    if (action === "trigger" && req.method === "POST") {
      const body = await req.json();
      const { event, data } = body;

      if (!event || !data) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: event, data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await processEvent(event, data);

      return new Response(
        JSON.stringify({ success: true, event }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // List registered webhooks
    if (action === "list" && req.method === "GET") {
      const webhooks = webhookRegistry.map((w) => ({
        id: w.id,
        url: w.url,
        events: w.events,
        active: w.active,
      }));

      return new Response(
        JSON.stringify({ webhooks }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deactivate a webhook
    if (action === "deactivate" && req.method === "POST") {
      const body = await req.json();
      const { id } = body;

      const webhook = webhookRegistry.find((w) => w.id === id);
      if (webhook) {
        webhook.active = false;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Inbound webhook receiver (for external integrations)
    if (action === "inbound" && req.method === "POST") {
      const webhookSecret = req.headers.get("x-webhook-secret");
      const expectedSecret = Deno.env.get("WEBHOOK_SECRET");

      if (expectedSecret && webhookSecret !== expectedSecret) {
        return new Response(
          JSON.stringify({ error: "Invalid webhook secret" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const body = await req.json();
      const { source, event_type, payload } = body;

      console.log(`Received inbound webhook from ${source}: ${event_type}`);

      // Process based on source
      switch (source) {
        case "payment_gateway":
          // Handle payment confirmations
          if (event_type === "payment.confirmed") {
            const { order_id, amount, transaction_id } = payload;
            
            // Update order payment status
            await supabase
              .from("orders")
              .update({ 
                paid_at: new Date().toISOString(),
                notes: `Pagamento confirmado - TX: ${transaction_id}`
              })
              .eq("id", order_id);

            // Update credit entry if exists
            await supabase
              .from("credit_entries")
              .update({ 
                status: "paid",
                paid_at: new Date().toISOString(),
                paid_amount: amount
              })
              .eq("order_id", order_id);
          }
          break;

        case "delivery_partner":
          // Handle delivery status updates
          if (event_type === "delivery.status_update") {
            const { order_id, status, delivered_at } = payload;
            
            const statusMap: Record<string, string> = {
              picked_up: "sent",
              in_transit: "sent",
              delivered: "delivered",
              failed: "cancelled",
            };

            const newStatus = statusMap[status];
            if (newStatus) {
              const updates: Record<string, unknown> = { status: newStatus };
              if (newStatus === "delivered" && delivered_at) {
                updates.delivered_at = delivered_at;
              }
              
              await supabase
                .from("orders")
                .update(updates)
                .eq("id", order_id);
            }
          }
          break;

        case "erp":
          // Handle ERP sync events
          if (event_type === "product.stock_update") {
            const { sku, quantity } = payload;
            
            const { data: product } = await supabase
              .from("products")
              .select("id, current_stock")
              .eq("sku", sku)
              .single();

            if (product) {
              await supabase
                .from("products")
                .update({ current_stock: quantity })
                .eq("id", product.id);

              // Log the movement
              await supabase
                .from("stock_movements")
                .insert({
                  product_id: product.id,
                  quantity: quantity - (product.current_stock || 0),
                  type: "adjustment",
                  reason: "Sincronização ERP",
                  previous_stock: product.current_stock,
                  new_stock: quantity,
                });
            }
          }
          break;

        default:
          console.log(`Unknown webhook source: ${source}`);
      }

      return new Response(
        JSON.stringify({ success: true, received: event_type }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
