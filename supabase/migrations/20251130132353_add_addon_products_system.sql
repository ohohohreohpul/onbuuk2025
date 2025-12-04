/*
  # Add-On Products System

  ## Overview
  This migration creates a system for add-on products that can be sold with services.
  Business owners can create products and assign them to specific services or all services.

  ## New Tables
  
  ### products
  - id (uuid, primary key)
  - business_id (uuid, references businesses)
  - name (text) - product name
  - description (text) - product description
  - price_cents (integer) - product price
  - image_url (text, nullable) - product image
  - is_active (boolean) - whether product is available
  - display_order (integer) - sort order
  - created_at, updated_at (timestamptz)

  ### product_service_assignments
  - id (uuid, primary key)
  - product_id (uuid, references products)
  - service_id (uuid, nullable, references services)
  - business_id (uuid, references businesses)
  - created_at (timestamptz)
  
  Note: If service_id is NULL, the product is available for ALL services

  ### booking_products
  - id (uuid, primary key)
  - booking_id (uuid, references bookings)
  - product_id (uuid, references products)
  - quantity (integer) - number of units
  - price_cents (integer) - price at time of purchase
  - created_at (timestamptz)

  ## Security
  - Enable RLS on all new tables
  - Allow public read access
  - Allow authenticated users full access
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  image_url text,
  is_active boolean DEFAULT true,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create product-service assignments table
CREATE TABLE IF NOT EXISTS product_service_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create booking products table
CREATE TABLE IF NOT EXISTS booking_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE NOT NULL,
  product_id uuid REFERENCES products(id) ON DELETE RESTRICT NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_business ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_product_assignments_product ON product_service_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_assignments_service ON product_service_assignments(service_id);
CREATE INDEX IF NOT EXISTS idx_booking_products_booking ON booking_products(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_products_product ON booking_products(product_id);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_service_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies for products
CREATE POLICY "Allow read access to products"
  ON products FOR SELECT
  USING (true);

CREATE POLICY "Allow full access to products for authenticated"
  ON products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to products for anon"
  ON products FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for product_service_assignments
CREATE POLICY "Allow read access to product assignments"
  ON product_service_assignments FOR SELECT
  USING (true);

CREATE POLICY "Allow full access to product assignments for authenticated"
  ON product_service_assignments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to product assignments for anon"
  ON product_service_assignments FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for booking_products
CREATE POLICY "Allow read access to booking products"
  ON booking_products FOR SELECT
  USING (true);

CREATE POLICY "Allow full access to booking products for authenticated"
  ON booking_products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow full access to booking products for anon"
  ON booking_products FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_products_updated_at();
