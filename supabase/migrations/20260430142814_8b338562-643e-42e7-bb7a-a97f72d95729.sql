ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS chat_lid TEXT;
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_chat_lid ON public.whatsapp_conversations(chat_lid);