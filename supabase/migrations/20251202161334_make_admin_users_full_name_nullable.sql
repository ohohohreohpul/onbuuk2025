/*
  # Make admin_users.full_name Nullable for OAuth Support

  1. Changes
    - Make full_name column nullable in admin_users table
    - Allows OAuth users who don't provide name metadata to sign up
    - Similar to how password_hash was made nullable for OAuth

  2. Reasoning
    - Google OAuth doesn't always provide full_name in user_metadata
    - NOT NULL constraint causes setup_failed errors during OAuth signup
    - Application code will provide sensible defaults (email username)
*/

ALTER TABLE public.admin_users
  ALTER COLUMN full_name DROP NOT NULL;
