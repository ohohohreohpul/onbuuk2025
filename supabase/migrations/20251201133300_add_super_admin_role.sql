/*
  # Add Super Admin Role Support

  1. Changes
    - Update admin_users role constraint to allow 'super_admin' role
    - This enables creating system-wide administrators with full access
  
  2. Security
    - Super admins can access all businesses and features
    - Maintains existing RLS policies while adding super_admin checks
*/

-- Drop the existing role check constraint
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Add new constraint that includes super_admin
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'super_admin'::text]));
