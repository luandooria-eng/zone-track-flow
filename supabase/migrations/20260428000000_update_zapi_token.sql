-- Atualiza credenciais Z-API com token renovado da instância
UPDATE public.whatsapp_config
SET
  instance_id = '3F1C9A2066A332EA1692AAE399BC1248',
  token       = 'F4EAE948301EEC5650EA985D',
  status      = 'connected',
  updated_at  = now()
WHERE id = '00000000-0000-0000-0000-000000000099';
