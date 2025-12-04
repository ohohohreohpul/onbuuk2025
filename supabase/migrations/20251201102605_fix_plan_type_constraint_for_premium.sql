/*
  # Fix Plan Type Constraint to Support Premium
  
  1. Changes
     - Drop old plan_type check constraint
     - Add new constraint allowing 'starter' and 'premium'
     - Keep 'professional' and 'enterprise' for backward compatibility
  
  2. Notes
     - Moving forward: use 'starter' (free) and 'premium' (paid)
     - Old values kept for existing data
*/

-- Drop the old constraint
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_plan_type_check;

-- Add new constraint supporting starter and premium
ALTER TABLE businesses ADD CONSTRAINT businesses_plan_type_check 
  CHECK (plan_type IN ('starter', 'premium', 'professional', 'enterprise'));
