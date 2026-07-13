-- CRM Campaign Engine: schema fixes + processor + triggers + pg_cron
-- Run this in: Supabase Dashboard → SQL Editor

-- ─── 1. SCHEMA ──────────────────────────────────────────────────────────────

-- Add missing columns to crm_campaigns
ALTER TABLE public.crm_campaigns
  ADD COLUMN IF NOT EXISTS started_at   timestamptz,
  ADD COLUMN IF NOT EXISTS finished_at  timestamptz,
  ADD COLUMN IF NOT EXISTS paused_at    timestamptz;

-- Add missing columns to crm_campaign_templates
ALTER TABLE public.crm_campaign_templates
  ADD COLUMN IF NOT EXISTS sent_count       int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_count   int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS conversion_count int NOT NULL DEFAULT 0;

-- Add missing columns to crm_campaign_recipients
ALTER TABLE public.crm_campaign_recipients
  ADD COLUMN IF NOT EXISTS phone_normalized  text,
  ADD COLUMN IF NOT EXISTS responded_at      timestamptz,
  ADD COLUMN IF NOT EXISTS converted_at      timestamptz,
  ADD COLUMN IF NOT EXISTS converted_order_id uuid,
  ADD COLUMN IF NOT EXISTS message_id        text,
  ADD COLUMN IF NOT EXISTS conversation_id   uuid,
  ADD COLUMN IF NOT EXISTS error_message     text,
  ADD COLUMN IF NOT EXISTS sent_at           timestamptz;

-- Backfill phone_normalized for existing rows
UPDATE public.crm_campaign_recipients
SET phone_normalized = regexp_replace(phone, '\D', '', 'g')
WHERE phone_normalized IS NULL AND phone IS NOT NULL;

-- Dedup constraint (safe: only add if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'crm_campaign_recipients_campaign_phone_key'
  ) THEN
    ALTER TABLE public.crm_campaign_recipients
      ADD CONSTRAINT crm_campaign_recipients_campaign_phone_key
      UNIQUE (campaign_id, phone_normalized);
  END IF;
END $$;

-- Add client_token to whatsapp_config so pg_net can read it
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS client_token text NOT NULL DEFAULT '';

-- ─── 2. get_campaign_metrics(p_campaign_id) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_campaign_metrics(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_totals  jsonb;
  v_by_tpl  jsonb;
  v_daily   jsonb;
BEGIN
  -- Totals
  SELECT jsonb_build_object(
    'total',     COUNT(*),
    'sent',      COUNT(*) FILTER (WHERE status = 'sent'),
    'pending',   COUNT(*) FILTER (WHERE status = 'pending'),
    'failed',    COUNT(*) FILTER (WHERE status = 'failed'),
    'skipped',   COUNT(*) FILTER (WHERE status = 'skipped'),
    'responded', COUNT(*) FILTER (WHERE responded_at IS NOT NULL),
    'converted', COUNT(*) FILTER (WHERE converted_at IS NOT NULL)
  ) INTO v_totals
  FROM crm_campaign_recipients
  WHERE campaign_id = p_campaign_id;

  -- By template
  SELECT jsonb_agg(row_to_json(t))
  INTO v_by_tpl
  FROM (
    SELECT
      r.template_id,
      tpl.label,
      COUNT(*) FILTER (WHERE r.status = 'sent')            AS sent,
      COUNT(*) FILTER (WHERE r.responded_at IS NOT NULL)    AS responded,
      COUNT(*) FILTER (WHERE r.converted_at IS NOT NULL)    AS converted
    FROM crm_campaign_recipients r
    LEFT JOIN crm_campaign_templates tpl ON tpl.id = r.template_id
    WHERE r.campaign_id = p_campaign_id
    GROUP BY r.template_id, tpl.label
  ) t;

  -- Daily series (last 30 days)
  SELECT jsonb_agg(row_to_json(d))
  INTO v_daily
  FROM (
    SELECT
      date_trunc('day', sent_at)::date AS day,
      COUNT(*) FILTER (WHERE status = 'sent')          AS sent,
      COUNT(*) FILTER (WHERE responded_at IS NOT NULL) AS responded,
      COUNT(*) FILTER (WHERE converted_at IS NOT NULL) AS converted
    FROM crm_campaign_recipients
    WHERE campaign_id = p_campaign_id
      AND sent_at IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  ) d;

  RETURN jsonb_build_object(
    'totals',     v_totals,
    'byTemplate', coalesce(v_by_tpl, '[]'::jsonb),
    'daily',      coalesce(v_daily,  '[]'::jsonb)
  );
END;
$$;

-- ─── 3. RESPONSE TRIGGER ────────────────────────────────────────────────────
-- When an inbound WhatsApp message arrives, mark the campaign recipient as responded

CREATE OR REPLACE FUNCTION public.campaign_mark_responded()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_phone text;
BEGIN
  IF NEW.direction <> 'inbound' THEN RETURN NEW; END IF;

  -- Get phone from conversation
  SELECT phone INTO v_phone
  FROM whatsapp_conversations
  WHERE id = NEW.conversation_id;

  IF v_phone IS NULL THEN RETURN NEW; END IF;

  -- Normalize phone
  v_phone := regexp_replace(v_phone, '\D', '', 'g');

  -- Mark the most recent unresponded sent recipient for this phone
  UPDATE crm_campaign_recipients r
  SET responded_at = NEW.created_at
  FROM crm_campaign_templates t
  WHERE r.phone_normalized = v_phone
    AND r.status = 'sent'
    AND r.responded_at IS NULL
    AND r.sent_at < NEW.created_at
    AND t.id = r.template_id
  RETURNING r.template_id;

  -- Increment response_count on template (best effort)
  UPDATE crm_campaign_templates
  SET response_count = response_count + 1
  WHERE campaign_id IN (
    SELECT campaign_id FROM crm_campaign_recipients
    WHERE phone_normalized = v_phone AND responded_at = NEW.created_at
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_respond_trigger ON public.whatsapp_messages;
CREATE TRIGGER campaign_respond_trigger
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.campaign_mark_responded();

-- ─── 4. PROCESS CAMPAIGN BATCH (pg_net dispatcher) ──────────────────────────

CREATE OR REPLACE FUNCTION public.process_campaign_batch()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_cfg       record;
  v_campaign  record;
  v_recipient record;
  v_template  record;
  v_message   text;
  v_phone     text;
  v_conv_id   uuid;
  v_now       timestamptz := now();
  v_sp_hhmm   text;
  v_processed int := 0;
  v_errors    int := 0;
  v_url       text;
  v_headers   jsonb;
BEGIN
  -- Load Z-API config
  SELECT instance_id, token, client_token
  INTO v_cfg
  FROM whatsapp_config
  WHERE id = '00000000-0000-0000-0000-000000000099';

  IF v_cfg IS NULL OR v_cfg.instance_id = '' OR v_cfg.token = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Z-API not configured');
  END IF;

  v_url := 'https://api.z-api.io/instances/' || v_cfg.instance_id
        || '/token/' || v_cfg.token || '/send-text';

  v_headers := jsonb_build_object('Content-Type', 'application/json');
  IF v_cfg.client_token <> '' THEN
    v_headers := v_headers || jsonb_build_object('Client-Token', v_cfg.client_token);
  END IF;

  -- Promote scheduled → sending
  UPDATE crm_campaigns
  SET status = 'sending', started_at = v_now
  WHERE status = 'scheduled' AND scheduled_at <= v_now;

  -- Current São Paulo time (HH:MM)
  v_sp_hhmm := to_char(v_now AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');

  FOR v_campaign IN
    SELECT * FROM crm_campaigns WHERE status = 'sending'
  LOOP
    -- Respect send window (skip if outside hours, unless forced by send-now = scheduled_at very recent)
    IF v_sp_hhmm < left(v_campaign.send_window_start::text, 5) OR
       v_sp_hhmm >= left(v_campaign.send_window_end::text, 5) THEN
      -- Allow if campaign was just started (within last 5 min) → send-now bypass
      IF v_campaign.started_at IS NULL OR v_campaign.started_at < v_now - interval '5 minutes' THEN
        CONTINUE;
      END IF;
    END IF;

    FOR v_recipient IN
      SELECT r.*, tpl.body AS tpl_body, tpl.id AS tpl_id, tpl.label AS tpl_label
      FROM crm_campaign_recipients r
      LEFT JOIN crm_campaign_templates tpl ON tpl.id = r.template_id
      WHERE r.campaign_id = v_campaign.id
        AND r.status = 'pending'
      LIMIT greatest(1, v_campaign.rate_limit_per_min)
      FOR UPDATE OF r SKIP LOCKED
    LOOP
      -- Resolve template body if not joined (fallback)
      IF v_recipient.tpl_body IS NULL THEN
        SELECT body INTO v_recipient.tpl_body
        FROM crm_campaign_templates
        WHERE campaign_id = v_campaign.id
        ORDER BY label
        LIMIT 1;
      END IF;

      IF v_recipient.tpl_body IS NULL THEN
        UPDATE crm_campaign_recipients
        SET status = 'failed', error_message = 'no template found'
        WHERE id = v_recipient.id;
        v_errors := v_errors + 1;
        CONTINUE;
      END IF;

      -- Apply {{variables}}
      v_message := v_recipient.tpl_body;
      v_message := replace(v_message, '{{nome}}',          coalesce(v_recipient.name, ''));
      v_message := replace(v_message, '{{name}}',          coalesce(v_recipient.name, ''));
      v_message := replace(v_message, '{{primeiro_nome}}', split_part(coalesce(v_recipient.name, ''), ' ', 1));

      -- Normalize phone
      v_phone := regexp_replace(coalesce(v_recipient.phone, ''), '\D', '', 'g');
      IF length(v_phone) IN (10, 11) THEN
        v_phone := '55' || v_phone;
      END IF;
      IF length(v_phone) < 12 THEN
        UPDATE crm_campaign_recipients
        SET status = 'failed', error_message = 'invalid phone: ' || v_recipient.phone
        WHERE id = v_recipient.id;
        v_errors := v_errors + 1;
        CONTINUE;
      END IF;

      -- Upsert whatsapp_conversation
      INSERT INTO whatsapp_conversations (phone, contact_name, last_message, last_message_at, status, unread_count)
      VALUES (v_phone, v_recipient.name, left(v_message, 500), v_now, 'open', 0)
      ON CONFLICT (phone) DO UPDATE SET
        last_message    = EXCLUDED.last_message,
        last_message_at = EXCLUDED.last_message_at,
        updated_at      = v_now
      RETURNING id INTO v_conv_id;

      IF v_conv_id IS NULL THEN
        SELECT id INTO v_conv_id FROM whatsapp_conversations WHERE phone = v_phone;
      END IF;

      -- Fire Z-API via pg_net (async, non-blocking)
      PERFORM net.http_post(
        url     := v_url,
        body    := jsonb_build_object('phone', v_phone, 'message', v_message)::text,
        headers := v_headers
      );

      -- Mark sent optimistically
      UPDATE crm_campaign_recipients
      SET status          = 'sent',
          sent_at         = v_now,
          conversation_id = v_conv_id,
          phone_normalized = v_phone
      WHERE id = v_recipient.id;

      -- Log outbound message
      IF v_conv_id IS NOT NULL THEN
        INSERT INTO whatsapp_messages
          (conversation_id, message_id, direction, content, type, status, created_at)
        VALUES
          (v_conv_id, 'campaign-' || v_recipient.id::text, 'outbound', v_message, 'text', 'sent', v_now)
        ON CONFLICT (message_id) DO NOTHING;
      END IF;

      -- Increment template sent_count
      UPDATE crm_campaign_templates
      SET sent_count = sent_count + 1
      WHERE id = v_recipient.tpl_id;

      v_processed := v_processed + 1;
    END LOOP;

    -- Mark campaign done if no more pending
    IF NOT EXISTS (
      SELECT 1 FROM crm_campaign_recipients
      WHERE campaign_id = v_campaign.id AND status = 'pending'
    ) THEN
      UPDATE crm_campaigns
      SET status = 'done', finished_at = v_now
      WHERE id = v_campaign.id AND status = 'sending';
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'processed', v_processed, 'errors', v_errors);
END;
$$;

-- ─── 5. pg_cron — 1 tick por minuto ─────────────────────────────────────────

-- Requires pg_cron extension (enabled by default on Supabase)
SELECT cron.unschedule('crm-campaign-dispatcher') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'crm-campaign-dispatcher'
);

SELECT cron.schedule(
  'crm-campaign-dispatcher',
  '* * * * *',
  $$ SELECT process_campaign_batch(); $$
);
