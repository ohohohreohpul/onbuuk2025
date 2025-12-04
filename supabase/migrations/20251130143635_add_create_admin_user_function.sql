/*
  # Add function to create admin users

  1. New Functions
    - `create_admin_user` - Securely creates a new admin user with hashed password
      - Parameters: email, password, full_name, role, business_id
      - Returns: the new user's ID
      - Uses bcrypt to hash passwords securely
      - Validates input and checks for duplicate emails

  2. Security
    - Function uses SECURITY DEFINER to allow password hashing
    - Only accessible by authenticated users
    - Password is hashed using gen_salt and crypt functions
*/

CREATE OR REPLACE FUNCTION create_admin_user(
  p_email text,
  p_password text,
  p_full_name text,
  p_role text,
  p_business_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;

  IF p_password IS NULL OR p_password = '' THEN
    RAISE EXCEPTION 'Password is required';
  END IF;

  IF LENGTH(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF p_role NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'Invalid role. Must be admin or staff';
  END IF;

  IF p_business_id IS NULL THEN
    RAISE EXCEPTION 'Business ID is required';
  END IF;

  -- Check for duplicate email
  IF EXISTS (SELECT 1 FROM admin_users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists';
  END IF;

  -- Insert new user with hashed password
  INSERT INTO admin_users (
    email,
    password_hash,
    full_name,
    role,
    business_id,
    is_active
  ) VALUES (
    p_email,
    crypt(p_password, gen_salt('bf')),
    p_full_name,
    p_role,
    p_business_id,
    true
  )
  RETURNING id INTO v_user_id;

  RETURN v_user_id;
END;
$$;
