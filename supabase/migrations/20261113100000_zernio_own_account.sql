/*
  # Own Zernio account per shop ("bring your own Zernio")

  A shop can connect its own Zernio account instead of using Zenno's, so the Zernio
  bill (connected accounts, messages) is theirs. Needed for the Agency plan, which is
  sold as a lifetime deal: Zenno must not carry recurring per-client costs.

  1. private.zernio_connections: one per shop; the API key and the webhook secret
     are Vault secrets (never plain columns). zernio_webhook_id is the webhook Zenno
     created in that Zernio account (deleted again on disconnect).
  2. Service-role RPCs used by the edge functions: read credentials for a shop,
     read the webhook secret for a connection, save and delete a connection.
     Nothing here is callable by signed-in users or the public.

  Phase 3 (agencies) adds agency-level connections that client shops point to.
*/

CREATE TABLE IF NOT EXISTS private.zernio_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
  api_key_secret_id uuid NOT NULL,
  webhook_secret_id uuid NOT NULL,
  zernio_webhook_id text CHECK (zernio_webhook_id IS NULL OR char_length(zernio_webhook_id) <= 64),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.zernio_connections FROM PUBLIC, anon, authenticated;

/** The shop's own Zernio key, or no row when it uses Zenno's. */
CREATE OR REPLACE FUNCTION public.zernio_credentials(p_business_id uuid)
 RETURNS TABLE (connection_id uuid, api_key text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT c.id, s.decrypted_secret
  FROM private.zernio_connections c
  JOIN vault.decrypted_secrets s ON s.id = c.api_key_secret_id
  WHERE c.business_id = p_business_id;
$function$;

/** Webhook secret and shop of one connection (social-webhook?c=…). */
CREATE OR REPLACE FUNCTION public.zernio_connection_secret(p_connection_id uuid)
 RETURNS TABLE (business_id uuid, webhook_secret text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT c.business_id, s.decrypted_secret
  FROM private.zernio_connections c
  JOIN vault.decrypted_secrets s ON s.id = c.webhook_secret_id
  WHERE c.id = p_connection_id;
$function$;

/** Creates or replaces the shop's connection; returns its id. */
CREATE OR REPLACE FUNCTION public.save_zernio_connection(p_business_id uuid, p_api_key text, p_webhook_secret text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_existing private.zernio_connections;
  v_id uuid;
BEGIN
  IF coalesce(char_length(p_api_key), 0) < 20 OR coalesce(char_length(p_webhook_secret), 0) < 32 THEN
    RAISE EXCEPTION 'invalid Zernio credentials' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_existing FROM private.zernio_connections WHERE business_id = p_business_id FOR UPDATE;
  IF v_existing.id IS NOT NULL THEN
    PERFORM vault.update_secret(v_existing.api_key_secret_id, p_api_key);
    PERFORM vault.update_secret(v_existing.webhook_secret_id, p_webhook_secret);
    UPDATE private.zernio_connections SET zernio_webhook_id = NULL, updated_at = now() WHERE id = v_existing.id;
    RETURN v_existing.id;
  END IF;
  INSERT INTO private.zernio_connections (business_id, api_key_secret_id, webhook_secret_id)
  VALUES (
    p_business_id,
    vault.create_secret(p_api_key, 'zernio_api_key_' || p_business_id, 'Own Zernio API key of a Zenno shop'),
    vault.create_secret(p_webhook_secret, 'zernio_webhook_secret_' || p_business_id, 'Webhook secret for a shop''s own Zernio')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_zernio_webhook_id(p_connection_id uuid, p_webhook_id text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
  UPDATE private.zernio_connections SET zernio_webhook_id = left(p_webhook_id, 64), updated_at = now() WHERE id = p_connection_id;
$function$;

/** Removes the connection and its Vault secrets; returns the Zernio webhook id to delete there. */
CREATE OR REPLACE FUNCTION public.delete_zernio_connection(p_business_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_row private.zernio_connections;
BEGIN
  DELETE FROM private.zernio_connections WHERE business_id = p_business_id RETURNING * INTO v_row;
  IF v_row.id IS NULL THEN
    RETURN NULL;
  END IF;
  DELETE FROM vault.secrets WHERE id IN (v_row.api_key_secret_id, v_row.webhook_secret_id);
  RETURN v_row.zernio_webhook_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.zernio_credentials(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.zernio_connection_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_zernio_connection(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_zernio_webhook_id(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_zernio_connection(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.zernio_credentials(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.zernio_connection_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_zernio_connection(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_zernio_webhook_id(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_zernio_connection(uuid) TO service_role;

NOTIFY pgrst, 'reload schema';
