// Shared caller authentication for edge functions that act with the service role
// (dispatchers, backfills, AI). A caller is accepted if it is either:
//   - a trusted scheduler: `Authorization: Bearer <SERVICE_ROLE_KEY>` or header
//     `x-cron-secret: <CRON_SECRET>` (pg_cron / pg_net / external scheduler), or
//   - a signed-in user whose role is in `allowedRoles`.
// The public anon key alone is NOT enough.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AppRole = "admin" | "manager" | "operator" | "finance" | "deliverer";

export interface Caller {
  kind: "scheduler" | "user";
  userId: string | null;
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function deny(status: number, error: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export interface AuthOptions {
  corsHeaders: Record<string, string>;
  /** Roles accepted for signed-in users. */
  allowedRoles: AppRole[];
  /** Accept service-role bearer / x-cron-secret (default true). */
  allowScheduler?: boolean;
}

/** Returns `{ caller }` when authorised, or `{ response }` with a 401/403 to return as-is. */
export async function authenticateCaller(
  req: Request,
  opts: AuthOptions,
): Promise<{ caller: Caller; response?: undefined } | { caller?: undefined; response: Response }> {
  const { corsHeaders, allowedRoles, allowScheduler = true } = opts;
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (allowScheduler) {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const cronSecret = Deno.env.get("CRON_SECRET") ?? "";
    const headerSecret = req.headers.get("x-cron-secret") ?? "";
    if (bearer && serviceKey && safeEqual(bearer, serviceKey)) {
      return { caller: { kind: "scheduler", userId: null } };
    }
    if (headerSecret && cronSecret && safeEqual(headerSecret, cronSecret)) {
      return { caller: { kind: "scheduler", userId: null } };
    }
  }

  if (!bearer) return { response: deny(401, "Unauthorized", corsHeaders) };

  const supabaseAuth = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${bearer}` } } },
  );
  const { data, error } = await supabaseAuth.auth.getUser();
  // The anon key is a valid JWT but has no user: getUser() fails, so it is rejected here.
  if (error || !data?.user) return { response: deny(401, "Unauthorized", corsHeaders) };

  for (const role of allowedRoles) {
    const { data: ok } = await supabaseAuth.rpc("has_role", { _user_id: data.user.id, _role: role });
    if (ok) return { caller: { kind: "user", userId: data.user.id } };
  }
  return { response: deny(403, "Forbidden", corsHeaders) };
}
