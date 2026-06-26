-- Z-API WhatsApp Integration

-- Configuration (single row, stores Z-API credentials)
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id text NOT NULL DEFAULT '',
  token text NOT NULL DEFAULT '',
  phone text,
  status text NOT NULL DEFAULT 'disconnected',
  webhook_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

DO $pol$ BEGIN
CREATE POLICY "whatsapp_config_rw" ON public.whatsapp_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $pol$;

INSERT INTO public.whatsapp_config (id, instance_id, token)
VALUES ('00000000-0000-0000-0000-000000000099', '', '')
ON CONFLICT (id) DO NOTHING;

-- Conversations (one row per phone number)
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  phone text NOT NULL,
  contact_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conversations_phone_key UNIQUE (phone)
);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DO $pol$ BEGIN
CREATE POLICY "whatsapp_conversations_rw" ON public.whatsapp_conversations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $pol$;

-- Messages (individual messages per conversation)
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content text NOT NULL,
  type text NOT NULL DEFAULT 'text',
  status text NOT NULL DEFAULT 'sent',
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_messages_message_id_key UNIQUE (message_id)
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DO $pol$ BEGIN
CREATE POLICY "whatsapp_messages_rw" ON public.whatsapp_messages
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $pol$;

-- Enable realtime for live updates in the inbox
DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations;
EXCEPTION WHEN duplicate_object THEN NULL;
END $rt$;

DO $rt$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $rt$;

-- Configure Z-API credentials
UPDATE public.whatsapp_config
SET
  instance_id = '3F1C9A2066A332EA1692AAE399BC1248',
  token       = '146608482446638C50ADB77E',
  status      = 'disconnected',
  updated_at  = now()
WHERE id = '00000000-0000-0000-0000-000000000099';