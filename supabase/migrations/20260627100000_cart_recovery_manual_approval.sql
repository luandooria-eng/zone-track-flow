alter table cart_recovery_config add column if not exists manual_approval boolean not null default false;
