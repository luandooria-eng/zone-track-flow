-- Cart recovery config: stores UoouShop credentials + message template
create table if not exists cart_recovery_config (
  id uuid primary key default gen_random_uuid(),
  token text not null default '',
  channel_code text not null default '',
  webhook_secret text not null default gen_random_uuid()::text,
  message_template text not null default 'Olá {nome}! 👋 Você deixou produtos no carrinho e gostaríamos de te ajudar a finalizar sua compra. Acesse aqui: {link}',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- Seed one row so the UI always has something to load/update
insert into cart_recovery_config (id)
values ('00000000-0000-0000-0000-000000000098')
on conflict (id) do nothing;

-- Log of every cart recovery attempt
create table if not exists cart_recovery_logs (
  id uuid primary key default gen_random_uuid(),
  cart_id text not null,
  customer_name text,
  phone text,
  email text,
  cart_link text,
  products jsonb,
  message_sent text,
  status text not null default 'sent', -- sent | failed
  error_message text,
  sent_at timestamptz not null default now()
);

create index if not exists cart_recovery_logs_cart_id_idx on cart_recovery_logs(cart_id);
create index if not exists cart_recovery_logs_sent_at_idx on cart_recovery_logs(sent_at desc);

-- RLS: authenticated users can read/write
alter table cart_recovery_config enable row level security;
alter table cart_recovery_logs enable row level security;

create policy "auth read cart_recovery_config" on cart_recovery_config for select to authenticated using (true);
create policy "auth update cart_recovery_config" on cart_recovery_config for update to authenticated using (true);
create policy "auth read cart_recovery_logs" on cart_recovery_logs for select to authenticated using (true);
create policy "service insert cart_recovery_logs" on cart_recovery_logs for insert to service_role with check (true);
