-- Add tracking columns to cart_recovery_logs
alter table cart_recovery_logs
  add column if not exists message_id text,
  add column if not exists delivered_at timestamptz,
  add column if not exists read_at timestamptz,
  add column if not exists clicked_at timestamptz,
  add column if not exists order_id text,
  add column if not exists order_value numeric(10,2),
  add column if not exists recovered_at timestamptz;

create index if not exists cart_recovery_logs_message_id_idx on cart_recovery_logs(message_id);
create index if not exists cart_recovery_logs_phone_idx on cart_recovery_logs(phone);

-- Allow service_role to update logs (for tracking webhooks)
DO $pol$ BEGIN
create policy "service update cart_recovery_logs"
  on cart_recovery_logs for update to service_role using (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $pol$;
