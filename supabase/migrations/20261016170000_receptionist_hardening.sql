-- AI receptionist hardening after the security review (2026-10-16).
-- Atomic fixed-window rate limiter for public chat, inbound senders and
-- voucher lookups. Keys look like 'chat-ip:<shop>:<ip>' or 'sender:whatsapp:<shop>:<phone>'.

CREATE TABLE IF NOT EXISTS private.receptionist_rate (
  key text NOT NULL CHECK (char_length(key) <= 300),
  window_start timestamptz NOT NULL,
  hits integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
REVOKE ALL ON private.receptionist_rate FROM PUBLIC, anon, authenticated;

-- Counts one hit and returns true while the key is still within p_limit for the current window.
CREATE OR REPLACE FUNCTION public.receptionist_rate_hit(p_key text, p_window_seconds integer, p_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_window timestamptz := to_timestamp(floor(extract(epoch FROM now()) / greatest(p_window_seconds, 1)) * greatest(p_window_seconds, 1));
  v_hits integer;
BEGIN
  INSERT INTO private.receptionist_rate (key, window_start, hits)
  VALUES (left(p_key, 300), v_window, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = private.receptionist_rate.hits + 1
  RETURNING hits INTO v_hits;
  -- Opportunistic cleanup of old windows (cheap, indexed by primary key prefix scan is not needed).
  IF random() < 0.01 THEN
    DELETE FROM private.receptionist_rate WHERE window_start < now() - interval '2 days';
  END IF;
  RETURN v_hits <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION public.receptionist_rate_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.receptionist_rate_hit(text, integer, integer) TO service_role;

NOTIFY pgrst, 'reload schema';
