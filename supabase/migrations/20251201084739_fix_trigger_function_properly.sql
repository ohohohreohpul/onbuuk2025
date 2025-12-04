/*
  # Fix Trigger Function Properly
  
  Drop the trigger first, then the functions, then recreate properly.
*/

-- Drop the trigger first
DROP TRIGGER IF EXISTS create_default_roles_on_business_insert ON public.businesses;

-- Now drop the functions
DROP FUNCTION IF EXISTS public.create_default_roles_for_business(uuid);
DROP FUNCTION IF EXISTS public.create_default_roles_for_business();
DROP FUNCTION IF EXISTS public.trigger_create_default_roles();

-- Create the main function that does the actual work (takes business_id parameter)
CREATE OR REPLACE FUNCTION public.create_default_roles_for_business(business_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_role_id uuid;
  manager_role_id uuid;
  staff_role_id uuid;
  reception_role_id uuid;
  perm record;
BEGIN
  -- Check if roles already exist for this business
  IF EXISTS (SELECT 1 FROM public.roles WHERE business_id = business_uuid LIMIT 1) THEN
    RETURN;
  END IF;

  -- Owner role (full access)
  INSERT INTO public.roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'owner', 'Owner', 'Full access to all features', true)
  RETURNING id INTO owner_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT owner_role_id, id FROM public.permissions;

  -- Manager role
  INSERT INTO public.roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'manager', 'Manager', 'Manage bookings, staff, and services', true)
  RETURNING id INTO manager_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT manager_role_id, p.id 
  FROM public.permissions p
  WHERE p.code IN (
    'view_dashboard', 'view_calendar', 'manage_bookings', 'view_bookings',
    'manage_services', 'view_services', 'manage_staff', 'view_staff',
    'view_customers', 'view_reports'
  );

  -- Staff role
  INSERT INTO public.roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'staff', 'Staff', 'View and manage own bookings', true)
  RETURNING id INTO staff_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT staff_role_id, p.id 
  FROM public.permissions p
  WHERE p.code IN (
    'view_calendar', 'view_bookings', 'view_customers'
  );

  -- Reception role
  INSERT INTO public.roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'reception', 'Reception', 'Manage bookings and customers', true)
  RETURNING id INTO reception_role_id;

  INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT reception_role_id, p.id 
  FROM public.permissions p
  WHERE p.code IN (
    'view_calendar', 'manage_bookings', 'view_bookings',
    'manage_customers', 'view_customers'
  );
END;
$$;

-- Create the trigger wrapper function
CREATE OR REPLACE FUNCTION public.trigger_create_default_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Call the actual function with NEW.id
  PERFORM public.create_default_roles_for_business(NEW.id);
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER create_default_roles_on_business_insert
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_default_roles();
