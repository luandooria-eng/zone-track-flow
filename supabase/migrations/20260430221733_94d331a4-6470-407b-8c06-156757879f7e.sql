
-- Adiciona o campo "pedido feito por" para registrar qual contato da família/conta solicitou
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS requested_by_label text;

COMMENT ON COLUMN public.orders.requested_by_label IS
  'Label livre indicando qual contato da conta fez o pedido (ex: "Esposa Amanda", "Filho João"). Útil para famílias/empresas com múltiplos solicitantes em um único cadastro.';
