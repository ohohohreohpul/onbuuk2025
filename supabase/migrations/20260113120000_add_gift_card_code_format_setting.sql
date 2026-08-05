/*
  # Add Gift Card Code Format Setting

  ## Changes
  1. Add `code_format` and `code_prefix` to `gift_card_settings`
     - `code_format`: 'standard' | 'numeric_6' | 'alphanumeric_6' | 'prefix_numeric'
       Defaults to 'standard', which reproduces the existing 16-character
       dash-grouped code exactly (no behavior change for businesses that don't
       opt in).
     - `code_prefix`: optional custom prefix, used only by 'prefix_numeric'.
  2. Update `generate_gift_card_code` to accept an optional `p_business_id`.
     When provided, the business's configured format is used; when omitted
     (existing call sites that don't pass it), behavior is unchanged.

  ## Notes
  - Existing gift cards keep their original codes. This only affects codes
    generated after this migration.

  ## Security
  - No RLS changes needed; existing gift_card_settings policies already cover
    these columns.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_card_settings' AND column_name = 'code_format'
  ) THEN
    ALTER TABLE gift_card_settings ADD COLUMN code_format text NOT NULL DEFAULT 'standard'
      CHECK (code_format IN ('standard', 'numeric_6', 'alphanumeric_6', 'prefix_numeric'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gift_card_settings' AND column_name = 'code_prefix'
  ) THEN
    ALTER TABLE gift_card_settings ADD COLUMN code_prefix text;
  END IF;
END $$;

-- Drop the previous zero-argument version. Adding a new (uuid DEFAULT NULL)
-- overload alongside it would leave two functions, making a no-argument call
-- ambiguous ("function is not unique"). All call sites now pass p_business_id.
DROP FUNCTION IF EXISTS public.generate_gift_card_code();

CREATE OR REPLACE FUNCTION public.generate_gift_card_code(p_business_id uuid DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  characters TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_format TEXT := 'standard';
  v_prefix TEXT := '';
  new_code TEXT;
  code_exists boolean;
  i INTEGER;
BEGIN
  IF p_business_id IS NOT NULL THEN
    SELECT code_format, COALESCE(code_prefix, '')
    INTO v_format, v_prefix
    FROM gift_card_settings
    WHERE business_id = p_business_id;

    v_format := COALESCE(v_format, 'standard');
  END IF;

  LOOP
    IF v_format = 'numeric_6' THEN
      new_code := lpad(floor(random() * 1000000)::text, 6, '0');
    ELSIF v_format = 'alphanumeric_6' THEN
      new_code := '';
      FOR i IN 1..6 LOOP
        new_code := new_code || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
      END LOOP;
    ELSIF v_format = 'prefix_numeric' THEN
      new_code := upper(COALESCE(NULLIF(v_prefix, ''), 'GC')) || '-' || lpad(floor(random() * 1000000)::text, 6, '0');
    ELSE
      new_code := '';
      FOR i IN 1..16 LOOP
        new_code := new_code || substr(characters, floor(random() * length(characters) + 1)::integer, 1);
        IF i % 4 = 0 AND i < 16 THEN
          new_code := new_code || '-';
        END IF;
      END LOOP;
    END IF;

    SELECT EXISTS(SELECT 1 FROM gift_cards WHERE code = new_code) INTO code_exists;

    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$;
