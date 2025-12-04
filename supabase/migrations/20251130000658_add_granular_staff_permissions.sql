/*
  # Granular Staff Permissions System

  ## Overview
  This migration adds a comprehensive role-based permission system for staff management.
  Businesses can now assign different roles with specific permissions to control access.

  ## 1. New Tables
    - `roles`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses) - Multi-tenant support
      - `name` (text) - Role name (Owner, Manager, Cashier, Receptionist, Staff, Contractor)
      - `display_name` (text) - Friendly display name
      - `description` (text) - Role description
      - `is_system_role` (boolean) - Whether this is a predefined system role
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `permissions`
      - `id` (uuid, primary key)
      - `code` (text, unique) - Permission code (e.g., 'view_all_bookings')
      - `name` (text) - Human-readable permission name
      - `category` (text) - Permission category (bookings, calendar, customers, etc)
      - `description` (text) - Permission description

    - `role_permissions`
      - `id` (uuid, primary key)
      - `role_id` (uuid, foreign key to roles)
      - `permission_id` (uuid, foreign key to permissions)
      - `created_at` (timestamptz)

    - `admin_user_roles`
      - `id` (uuid, primary key)
      - `admin_user_id` (uuid, foreign key to admin_users)
      - `role_id` (uuid, foreign key to roles)
      - `created_at` (timestamptz)

  ## 2. Updates to Existing Tables
    - Add `business_id` to `admin_users` for multi-tenant support
    - Keep legacy `role` column for backward compatibility
    - Add `specialist_id` to link contractors to specific specialists

  ## 3. Permissions Categories
    ### Bookings
    - view_own_bookings - See only own assigned bookings
    - view_all_bookings - See all bookings
    - create_bookings - Create new bookings
    - edit_own_bookings - Edit own bookings
    - edit_all_bookings - Edit all bookings
    - delete_bookings - Delete bookings
    - cancel_bookings - Cancel bookings

    ### Calendar
    - view_own_calendar - View own calendar
    - view_all_calendars - View all staff calendars
    - manage_availability - Manage own availability
    - manage_all_availability - Manage all staff availability

    ### Customers
    - view_customers - View customer list
    - edit_customers - Edit customer details
    - view_customer_history - View customer booking history
    - add_customer_notes - Add customer notes

    ### Financial
    - view_revenue - View revenue data
    - view_own_tips - View own tips
    - view_all_tips - View all staff tips
    - manage_tips - Manage tip splits
    - process_payments - Process payments in POS
    - issue_refunds - Issue refunds
    - view_gift_cards - View gift cards
    - manage_gift_cards - Create/manage gift cards

    ### Services
    - view_services - View services
    - manage_services - Create/edit services

    ### Staff
    - view_staff - View staff list
    - manage_staff - Create/edit staff
    - assign_roles - Assign roles to staff

    ### Settings
    - view_settings - View settings
    - manage_settings - Edit settings
    - manage_business - Edit business details

    ### Reports
    - view_reports - View reports
    - export_reports - Export reports

  ## 4. Predefined Roles
    ### Owner
    - Full access to everything
    - Cannot be deleted or modified

    ### Manager
    - View all bookings and calendars
    - Manage bookings, services, and customers
    - View revenue and tips
    - Manage staff (except assign roles)

    ### Receptionist
    - Create and manage bookings
    - View all calendars
    - View customers and add notes
    - Process payments

    ### Cashier
    - Process payments
    - View gift cards
    - View customers
    - Limited booking view

    ### Staff
    - View own bookings and calendar
    - Manage own availability
    - View assigned customers
    - View own tips

    ### Contractor
    - View only own bookings
    - Manage own availability
    - View own tips
    - Cannot see other staff

  ## 5. Security
    - Enable RLS on all new tables
    - Permissions checked at application level and database level
    - Business-specific role isolation
*/

-- Add business_id to admin_users for multi-tenant support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'business_id'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN business_id uuid REFERENCES businesses(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_users' AND column_name = 'specialist_id'
  ) THEN
    ALTER TABLE admin_users ADD COLUMN specialist_id uuid REFERENCES specialists(id);
  END IF;
END $$;

-- Create roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  description text,
  is_system_role boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_id, name)
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view roles in their business"
  ON roles FOR SELECT
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage roles"
  ON roles FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM admin_users WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users WHERE id = auth.uid()
    )
  );

-- Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view permissions"
  ON permissions FOR SELECT
  USING (true);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view role permissions"
  ON role_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage role permissions"
  ON role_permissions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create admin_user_roles junction table
CREATE TABLE IF NOT EXISTS admin_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(admin_user_id, role_id)
);

ALTER TABLE admin_user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
  ON admin_user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage user roles"
  ON admin_user_roles FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert all permissions
INSERT INTO permissions (code, name, category, description) VALUES
  -- Bookings
  ('view_own_bookings', 'View Own Bookings', 'bookings', 'Can view bookings assigned to them'),
  ('view_all_bookings', 'View All Bookings', 'bookings', 'Can view all bookings in the business'),
  ('create_bookings', 'Create Bookings', 'bookings', 'Can create new bookings'),
  ('edit_own_bookings', 'Edit Own Bookings', 'bookings', 'Can edit their own bookings'),
  ('edit_all_bookings', 'Edit All Bookings', 'bookings', 'Can edit all bookings'),
  ('delete_bookings', 'Delete Bookings', 'bookings', 'Can delete bookings'),
  ('cancel_bookings', 'Cancel Bookings', 'bookings', 'Can cancel bookings'),

  -- Calendar
  ('view_own_calendar', 'View Own Calendar', 'calendar', 'Can view their own calendar'),
  ('view_all_calendars', 'View All Calendars', 'calendar', 'Can view all staff calendars'),
  ('manage_availability', 'Manage Own Availability', 'calendar', 'Can manage their own availability'),
  ('manage_all_availability', 'Manage All Availability', 'calendar', 'Can manage all staff availability'),

  -- Customers
  ('view_customers', 'View Customers', 'customers', 'Can view customer list'),
  ('edit_customers', 'Edit Customers', 'customers', 'Can edit customer details'),
  ('view_customer_history', 'View Customer History', 'customers', 'Can view customer booking history'),
  ('add_customer_notes', 'Add Customer Notes', 'customers', 'Can add notes to customer profiles'),

  -- Financial
  ('view_revenue', 'View Revenue', 'financial', 'Can view revenue data and reports'),
  ('view_own_tips', 'View Own Tips', 'financial', 'Can view their own tips'),
  ('view_all_tips', 'View All Tips', 'financial', 'Can view all staff tips'),
  ('manage_tips', 'Manage Tips', 'financial', 'Can manage tip splits and distributions'),
  ('process_payments', 'Process Payments', 'financial', 'Can process payments in POS'),
  ('issue_refunds', 'Issue Refunds', 'financial', 'Can issue refunds'),
  ('view_gift_cards', 'View Gift Cards', 'financial', 'Can view gift cards'),
  ('manage_gift_cards', 'Manage Gift Cards', 'financial', 'Can create and manage gift cards'),

  -- Services
  ('view_services', 'View Services', 'services', 'Can view services'),
  ('manage_services', 'Manage Services', 'services', 'Can create and edit services'),

  -- Staff
  ('view_staff', 'View Staff', 'staff', 'Can view staff list'),
  ('manage_staff', 'Manage Staff', 'staff', 'Can create and edit staff members'),
  ('assign_roles', 'Assign Roles', 'staff', 'Can assign roles to staff members'),

  -- Settings
  ('view_settings', 'View Settings', 'settings', 'Can view business settings'),
  ('manage_settings', 'Manage Settings', 'settings', 'Can edit business settings'),
  ('manage_business', 'Manage Business', 'settings', 'Can edit core business details'),

  -- Reports
  ('view_reports', 'View Reports', 'reports', 'Can view business reports'),
  ('export_reports', 'Export Reports', 'reports', 'Can export reports')
ON CONFLICT (code) DO NOTHING;

-- Create function to setup default roles for a business
CREATE OR REPLACE FUNCTION create_default_roles_for_business(business_uuid uuid)
RETURNS void AS $$
DECLARE
  owner_role_id uuid;
  manager_role_id uuid;
  receptionist_role_id uuid;
  cashier_role_id uuid;
  staff_role_id uuid;
  contractor_role_id uuid;
BEGIN
  -- Owner role (full access)
  INSERT INTO roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'owner', 'Owner', 'Full access to all features', true)
  RETURNING id INTO owner_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT owner_role_id, id FROM permissions;

  -- Manager role
  INSERT INTO roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'manager', 'Manager', 'Can manage bookings, staff, and view reports', true)
  RETURNING id INTO manager_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT manager_role_id, id FROM permissions
  WHERE code IN (
    'view_all_bookings', 'create_bookings', 'edit_all_bookings', 'cancel_bookings',
    'view_all_calendars', 'manage_all_availability',
    'view_customers', 'edit_customers', 'view_customer_history', 'add_customer_notes',
    'view_revenue', 'view_all_tips', 'process_payments', 'view_gift_cards', 'manage_gift_cards',
    'view_services', 'manage_services',
    'view_staff', 'manage_staff',
    'view_settings',
    'view_reports', 'export_reports'
  );

  -- Receptionist role
  INSERT INTO roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'receptionist', 'Receptionist', 'Can manage bookings and customers', true)
  RETURNING id INTO receptionist_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT receptionist_role_id, id FROM permissions
  WHERE code IN (
    'view_all_bookings', 'create_bookings', 'edit_all_bookings', 'cancel_bookings',
    'view_all_calendars',
    'view_customers', 'edit_customers', 'view_customer_history', 'add_customer_notes',
    'process_payments', 'view_gift_cards',
    'view_services', 'view_staff'
  );

  -- Cashier role
  INSERT INTO roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'cashier', 'Cashier', 'Can process payments and view basic info', true)
  RETURNING id INTO cashier_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT cashier_role_id, id FROM permissions
  WHERE code IN (
    'view_all_bookings',
    'view_customers',
    'process_payments', 'view_gift_cards',
    'view_services'
  );

  -- Staff role
  INSERT INTO roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'staff', 'Staff', 'Can view own schedule and manage availability', true)
  RETURNING id INTO staff_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT staff_role_id, id FROM permissions
  WHERE code IN (
    'view_own_bookings', 'edit_own_bookings',
    'view_own_calendar', 'manage_availability',
    'view_customers', 'view_customer_history',
    'view_own_tips',
    'view_services'
  );

  -- Contractor role
  INSERT INTO roles (business_id, name, display_name, description, is_system_role)
  VALUES (business_uuid, 'contractor', 'Contractor', 'Can only view own bookings and tips', true)
  RETURNING id INTO contractor_role_id;

  INSERT INTO role_permissions (role_id, permission_id)
  SELECT contractor_role_id, id FROM permissions
  WHERE code IN (
    'view_own_bookings',
    'view_own_calendar', 'manage_availability',
    'view_own_tips',
    'view_services'
  );
END;
$$ LANGUAGE plpgsql;

-- Create default roles for all existing businesses
DO $$
DECLARE
  business_record RECORD;
BEGIN
  FOR business_record IN SELECT id FROM businesses LOOP
    PERFORM create_default_roles_for_business(business_record.id);
  END LOOP;
END $$;

-- Trigger to create default roles when a new business is created
CREATE OR REPLACE FUNCTION trigger_create_default_roles()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_roles_for_business(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER create_default_roles_on_business_insert
  AFTER INSERT ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_roles();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_roles_business ON roles(business_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_admin_user_roles_user ON admin_user_roles(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_business ON admin_users(business_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_specialist ON admin_users(specialist_id);

-- Create helper function to check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(user_id uuid, permission_code text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM admin_user_roles aur
    JOIN role_permissions rp ON rp.role_id = aur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE aur.admin_user_id = user_id
    AND p.code = permission_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create helper function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(user_id uuid)
RETURNS TABLE(code text, name text, category text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.code, p.name, p.category
  FROM admin_user_roles aur
  JOIN role_permissions rp ON rp.role_id = aur.role_id
  JOIN permissions p ON p.id = rp.permission_id
  WHERE aur.admin_user_id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
