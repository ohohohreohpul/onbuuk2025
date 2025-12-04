/*
  # Fix Admin Users Role Constraint - Add Owner Role

  1. Issue
    - The role constraint was missing 'owner' role
    - This prevented business owners from being created during signup
    - Caused "Invalid credentials" errors after signup

  2. Fix
    - Re-add 'owner' to the allowed roles in the constraint
    - Allows: 'admin', 'staff', 'super_admin', 'owner'

  3. Impact
    - Fixes signup flow
    - Allows business owners to be created
    - Maintains all other role restrictions
*/

-- Drop the existing constraint
ALTER TABLE admin_users DROP CONSTRAINT IF EXISTS admin_users_role_check;

-- Add the corrected constraint with owner included
ALTER TABLE admin_users ADD CONSTRAINT admin_users_role_check 
  CHECK (role = ANY (ARRAY['admin'::text, 'staff'::text, 'super_admin'::text, 'owner'::text]));
