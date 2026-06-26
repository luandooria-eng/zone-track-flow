ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS profile_picture_url text;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS media_url text;