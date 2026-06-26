import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  if (!digits.startsWith("55")) digits = "55" + digits;
  return "+" + digits;
}

// PBKDF2 password hashing using Web Crypto API
async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const useSalt = salt || crypto.randomUUID();
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(useSalt), iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(bits));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return { hash: hashHex, salt: useSalt };
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  // storedHash format: "salt:hash"
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const result = await hashPassword(password, salt);
  return result.hash === hash;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, phone, password, name } = await req.json();
    
    if (!phone) {
      return new Response(JSON.stringify({ error: "Phone is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalized = normalizePhone(phone);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ACTION: check — just check if phone exists
    if (action === "check") {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, name, portal_password_hash")
        .eq("phone", normalized)
        .maybeSingle();

      return new Response(JSON.stringify({
        exists: !!customer,
        has_password: !!customer?.portal_password_hash,
        customer_name: customer?.name || null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION: register — create new customer with password
    if (action === "register") {
      if (!password || password.length < 4) {
        return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 4 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!name?.trim()) {
        return new Response(JSON.stringify({ error: "Nome é obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check if customer already exists
      const { data: existing } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", normalized)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ error: "Este telefone já está cadastrado. Faça login." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { hash, salt } = await hashPassword(password);
      const passwordHash = `${salt}:${hash}`;

      const { data: newCustomer, error: insertErr } = await supabase
        .from("customers")
        .insert({ name: name.trim(), phone: normalized, points_balance: 0, portal_password_hash: passwordHash })
        .select("id, name, phone, points_balance")
        .single();
      if (insertErr) throw insertErr;

      // Generate session token
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("loyalty_client_tokens")
        .upsert(
          { customer_id: newCustomer.id, token, last_accessed_at: new Date().toISOString(), expires_at: expiresAt },
          { onConflict: "customer_id" }
        );

      return new Response(JSON.stringify({
        success: true,
        token,
        customer: { id: newCustomer.id, name: newCustomer.name, phone: newCustomer.phone, points_balance: newCustomer.points_balance },
        is_new: true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION: login — verify password
    if (action === "login") {
      if (!password) {
        return new Response(JSON.stringify({ error: "Senha é obrigatória" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("id, name, phone, points_balance, portal_password_hash")
        .eq("phone", normalized)
        .maybeSingle();

      if (!customer) {
        return new Response(JSON.stringify({ error: "Telefone não encontrado. Crie sua conta." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!customer.portal_password_hash) {
        // Legacy customer without password — let them set one
        return new Response(JSON.stringify({ error: "needs_password", customer_name: customer.name }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const valid = await verifyPassword(password, customer.portal_password_hash);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Senha incorreta" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Generate session token
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("loyalty_client_tokens")
        .upsert(
          { customer_id: customer.id, token, last_accessed_at: new Date().toISOString(), expires_at: expiresAt },
          { onConflict: "customer_id" }
        );

      return new Response(JSON.stringify({
        success: true,
        token,
        customer: { id: customer.id, name: customer.name, phone: customer.phone, points_balance: customer.points_balance },
        is_new: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ACTION: set_password — for legacy customers that don't have a password yet
    if (action === "set_password") {
      if (!password || password.length < 4) {
        return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 4 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: customer } = await supabase
        .from("customers")
        .select("id, name, phone, points_balance, portal_password_hash")
        .eq("phone", normalized)
        .maybeSingle();

      if (!customer) {
        return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { hash, salt } = await hashPassword(password);
      const passwordHash = `${salt}:${hash}`;

      await supabase
        .from("customers")
        .update({ portal_password_hash: passwordHash })
        .eq("id", customer.id);

      // Generate session token
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("loyalty_client_tokens")
        .upsert(
          { customer_id: customer.id, token, last_accessed_at: new Date().toISOString(), expires_at: expiresAt },
          { onConflict: "customer_id" }
        );

      return new Response(JSON.stringify({
        success: true,
        token,
        customer: { id: customer.id, name: customer.name, phone: customer.phone, points_balance: customer.points_balance },
        is_new: false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("portal-auth error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
