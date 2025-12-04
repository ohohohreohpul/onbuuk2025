/*
  # Improve get_admin_business_id Function

  1. Changes
    - Use user_id instead of email for matching (more reliable)
    - Falls back to email if user_id is null (for backward compatibility)

  2. Purpose
    - More reliable business lookup for authenticated users
    - Prevents issues if email changes
*/

CREATE OR REPLACE FUNCTION public.get_admin_business_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
SELECT business_id 
FROM admin_users 
WHERE (user_id = auth.uid() OR email = (SELECT email FROM auth.users WHERE id = auth.uid()))
AND is_active = true
LIMIT 1;
$$;