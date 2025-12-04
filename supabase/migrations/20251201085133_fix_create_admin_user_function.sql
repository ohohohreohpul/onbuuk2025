/*
  # Fix create_admin_user function
  
  Remove password hashing since we're using Supabase Auth for passwords.
  The function should only create the admin_users record.
*/

DROP FUNCTION IF EXISTS public.create_admin_user(text, text, text, uuid, boolean);

CREATE OR REPLACE FUNCTION public.create_admin_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_business_id uuid,
  p_is_owner boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_owner_role_id uuid;
BEGIN
  -- Insert admin user (password not stored here, handled by Supabase Auth)
  INSERT INTO public.admin_users (
    email,
    full_name,
    role,
    business_id,
    is_active,
    is_owner,
    user_id
  )
  VALUES (
    p_email,
    p_full_name,
    'admin',
    p_business_id,
    true,
    p_is_owner,
    auth.uid()
  )
  RETURNING id INTO v_admin_id;

  -- Assign owner role if is_owner
  IF p_is_owner THEN
    SELECT id INTO v_owner_role_id
    FROM public.roles
    WHERE business_id = p_business_id
      AND name = 'owner'
    LIMIT 1;

    IF v_owner_role_id IS NOT NULL THEN
      INSERT INTO public.admin_user_roles (admin_user_id, role_id)
      VALUES (v_admin_id, v_owner_role_id);
    END IF;
  END IF;

  RETURN v_admin_id;
END;
$$;
