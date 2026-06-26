
ALTER TABLE public.loyalty_coupons
ADD COLUMN whatsapp_phone text,
ADD COLUMN whatsapp_message text DEFAULT 'Olá! Resgatei o cupom *{codigo}* do programa de fidelidade. Gostaria de utilizar meu voucher!';
