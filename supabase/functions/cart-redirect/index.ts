import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const logId = url.searchParams.get("id");

  if (!logId) {
    return Response.redirect("https://www.ladonnafit.com.br/cart/", 302);
  }

  const { data: log } = await supabase
    .from("cart_recovery_logs")
    .select("cart_link, clicked_at")
    .eq("id", logId)
    .maybeSingle();

  // Register click only once
  if (log && !log.clicked_at) {
    await supabase
      .from("cart_recovery_logs")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", logId);
  }

  const destination = log?.cart_link ?? "https://www.ladonnafit.com.br/cart/";
  return Response.redirect(destination, 302);
});
