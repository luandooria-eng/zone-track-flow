-- Trigger: sync cart recovery sent messages → whatsapp_conversations + whatsapp_messages
-- This runs inside the DB so no Edge Function deployment is needed.

CREATE OR REPLACE FUNCTION sync_cart_recovery_to_whatsapp()
RETURNS TRIGGER AS $$
DECLARE
  v_conv_id uuid;
  v_phone   text;
  v_msg_id  text;
BEGIN
  -- Only when message_sent is populated and phone exists
  IF NEW.phone IS NULL OR NEW.phone = '' THEN RETURN NEW; END IF;
  IF NEW.message_sent IS NULL OR NEW.message_sent = '' THEN RETURN NEW; END IF;

  -- Normalize phone: strip non-digits, add 55 prefix for 10/11-digit numbers
  v_phone := regexp_replace(NEW.phone, '\D', '', 'g');
  IF length(v_phone) IN (10, 11) THEN
    v_phone := '55' || v_phone;
  END IF;
  IF v_phone = '' THEN RETURN NEW; END IF;

  -- Upsert conversation (unique per phone)
  INSERT INTO whatsapp_conversations (phone, contact_name, last_message, last_message_at, status, unread_count)
  VALUES (v_phone, NEW.customer_name, left(NEW.message_sent, 500), coalesce(NEW.sent_at, now()), 'open', 0)
  ON CONFLICT (phone) DO UPDATE SET
    contact_name    = coalesce(EXCLUDED.contact_name, whatsapp_conversations.contact_name),
    last_message    = EXCLUDED.last_message,
    last_message_at = EXCLUDED.last_message_at,
    updated_at      = now()
  RETURNING id INTO v_conv_id;

  IF v_conv_id IS NULL THEN
    SELECT id INTO v_conv_id FROM whatsapp_conversations WHERE phone = v_phone LIMIT 1;
  END IF;

  IF v_conv_id IS NULL THEN RETURN NEW; END IF;

  -- Unique message id so upsert is idempotent
  v_msg_id := 'cart-' || NEW.id::text;

  INSERT INTO whatsapp_messages (conversation_id, message_id, direction, content, type, status, created_at)
  VALUES (v_conv_id, v_msg_id, 'outbound', NEW.message_sent, 'text', 'sent', coalesce(NEW.sent_at, now()))
  ON CONFLICT (message_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire on INSERT or UPDATE whenever message_sent is set (covers both new carts and status updates)
DROP TRIGGER IF EXISTS cart_recovery_whatsapp_sync ON cart_recovery_logs;
CREATE TRIGGER cart_recovery_whatsapp_sync
  AFTER INSERT OR UPDATE OF message_sent, status
  ON cart_recovery_logs
  FOR EACH ROW
  WHEN (NEW.message_sent IS NOT NULL AND NEW.message_sent <> '' AND NEW.phone IS NOT NULL AND NEW.phone <> '')
  EXECUTE FUNCTION sync_cart_recovery_to_whatsapp();

-- Backfill: run the function for all existing sent/test logs that have message + phone
DO $$
DECLARE
  r record;
  v_conv_id uuid;
  v_phone   text;
  v_msg_id  text;
BEGIN
  FOR r IN
    SELECT id, phone, customer_name, message_sent, sent_at
    FROM cart_recovery_logs
    WHERE status IN ('sent', 'test')
      AND phone IS NOT NULL AND phone <> ''
      AND message_sent IS NOT NULL AND message_sent <> ''
  LOOP
    v_phone := regexp_replace(r.phone, '\D', '', 'g');
    IF length(v_phone) IN (10, 11) THEN
      v_phone := '55' || v_phone;
    END IF;
    IF v_phone = '' THEN CONTINUE; END IF;

    INSERT INTO whatsapp_conversations (phone, contact_name, last_message, last_message_at, status, unread_count)
    VALUES (v_phone, r.customer_name, left(r.message_sent, 500), coalesce(r.sent_at, now()), 'open', 0)
    ON CONFLICT (phone) DO UPDATE SET
      contact_name    = coalesce(EXCLUDED.contact_name, whatsapp_conversations.contact_name),
      last_message    = EXCLUDED.last_message,
      last_message_at = EXCLUDED.last_message_at,
      updated_at      = now()
    RETURNING id INTO v_conv_id;

    IF v_conv_id IS NULL THEN
      SELECT id INTO v_conv_id FROM whatsapp_conversations WHERE phone = v_phone LIMIT 1;
    END IF;
    IF v_conv_id IS NULL THEN CONTINUE; END IF;

    v_msg_id := 'cart-' || r.id::text;

    INSERT INTO whatsapp_messages (conversation_id, message_id, direction, content, type, status, created_at)
    VALUES (v_conv_id, v_msg_id, 'outbound', r.message_sent, 'text', 'sent', coalesce(r.sent_at, now()))
    ON CONFLICT (message_id) DO NOTHING;
  END LOOP;
END $$;
