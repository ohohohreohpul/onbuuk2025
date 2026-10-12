/*
  resolve_tenant also returns the shop language, so the booking page needs one
  round-trip less before it can render (was: lookup, then a language query).
*/
BEGIN;
DROP FUNCTION public.resolve_tenant(text);
CREATE OR REPLACE FUNCTION public.resolve_tenant(p_host text)
 RETURNS TABLE(business_id uuid, business_name text, permalink text, plan_type text, match_type text, primary_host text, is_primary_host boolean, language text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_host text := rtrim(lower(split_part(btrim(coalesce(p_host, '')), ':', 1)), '.');
  v_business public.businesses%ROWTYPE;
  v_match text;
  v_base text;
  v_label text;
  v_primary text;
BEGIN
  IF v_host = '' OR length(v_host) > 253 THEN
    RETURN;
  END IF;

  -- a) A verified custom domain.
  SELECT b.* INTO v_business
  FROM public.custom_domains cd
  JOIN public.businesses b ON b.id = cd.business_id
  WHERE lower(cd.domain) = v_host AND cd.status = 'verified'
    AND b.is_active = true AND b.custom_domain_enabled = true;

  IF FOUND THEN
    v_match := 'custom_domain';
  ELSE
    -- b) <permalink>.<shop base>, exactly one label deep.
    SELECT ph.host INTO v_base
    FROM public.platform_hosts ph
    WHERE ph.purpose = 'shop_base' AND v_host LIKE '%.' || ph.host
    ORDER BY length(ph.host) DESC
    LIMIT 1;

    IF v_base IS NULL THEN
      RETURN;
    END IF;

    v_label := left(v_host, length(v_host) - length(v_base) - 1);
    IF v_label = '' OR position('.' IN v_label) > 0 THEN
      RETURN;
    END IF;

    SELECT b.* INTO v_business
    FROM public.businesses b
    WHERE b.permalink = v_label AND b.is_active = true;

    IF NOT FOUND THEN
      RETURN;
    END IF;
    v_match := 'platform_subdomain';
  END IF;

  -- Primary address: a verified primary custom domain (while entitled),
  -- else the platform subdomain. Losing the entitlement falls back gracefully.
  IF v_business.custom_domain_enabled THEN
    SELECT lower(cd.domain) INTO v_primary
    FROM public.custom_domains cd
    WHERE cd.business_id = v_business.id AND cd.status = 'verified' AND cd.is_primary
    LIMIT 1;
  END IF;

  IF v_primary IS NULL THEN
    v_primary := v_business.permalink || '.' || COALESCE(
      v_base,
      (SELECT host FROM public.platform_hosts WHERE purpose = 'shop_base' AND is_primary LIMIT 1)
    );
  END IF;

  RETURN QUERY SELECT
    v_business.id,
    v_business.name,
    v_business.permalink,
    v_business.plan_type::text,
    v_match,
    v_primary,
    v_primary = v_host,
    v_business.language::text;
END;
$function$
;
REVOKE ALL ON FUNCTION public.resolve_tenant(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_tenant(text) TO anon, authenticated, service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
