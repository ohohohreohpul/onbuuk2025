/*
  # Add Loyalty Points System

  1. New Tables
    - `loyalty_settings`
      - `business_id` (uuid, primary key, references businesses)
      - `enabled` (boolean, default false)
      - `points_per_dollar_spent` (integer, e.g., 10 = 10 points per $1)
      - `points_redemption_value` (integer, e.g., 100 = 100 points = $1 off)
      - `points_expiry_days` (integer, nullable - null means no expiry)
      - `welcome_bonus_points` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `loyalty_points`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `points_balance` (integer, default 0)
      - `points_earned_total` (integer, default 0)
      - `points_redeemed_total` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - UNIQUE(customer_id)

    - `loyalty_transactions`
      - `id` (uuid, primary key)
      - `customer_id` (uuid, references customers)
      - `points` (integer - positive for earned, negative for redeemed)
      - `transaction_type` (text: 'earned_from_booking', 'redeemed', 'welcome_bonus', 'manual_adjustment', 'expired')
      - `booking_id` (uuid, references bookings, nullable)
      - `description` (text)
      - `created_at` (timestamptz)
      - `created_by` (text, nullable - for manual adjustments)

  2. Security
    - Enable RLS on all tables
    - Admins can manage settings and view all transactions
    - Customers can view their own points and transactions
    - Anonymous users cannot access loyalty data

  3. Important Notes
    - Points are awarded automatically when booking status becomes 'completed'
    - Points calculation: floor(price_cents / 100 * points_per_dollar_spent)
    - Points can only be redeemed if balance is sufficient
    - Settings are per-business and can be toggled on/off
*/

-- Create loyalty_settings table
CREATE TABLE IF NOT EXISTS loyalty_settings (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  enabled boolean DEFAULT false,
  points_per_dollar_spent integer DEFAULT 10 CHECK (points_per_dollar_spent >= 0),
  points_redemption_value integer DEFAULT 100 CHECK (points_redemption_value > 0),
  points_expiry_days integer CHECK (points_expiry_days IS NULL OR points_expiry_days > 0),
  welcome_bonus_points integer DEFAULT 0 CHECK (welcome_bonus_points >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create loyalty_points table
CREATE TABLE IF NOT EXISTS loyalty_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid UNIQUE NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points_balance integer DEFAULT 0 CHECK (points_balance >= 0),
  points_earned_total integer DEFAULT 0 CHECK (points_earned_total >= 0),
  points_redeemed_total integer DEFAULT 0 CHECK (points_redeemed_total >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create loyalty_transactions table
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earned_from_booking', 'redeemed', 'welcome_bonus', 'manual_adjustment', 'expired')),
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text
);

-- Enable RLS
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for loyalty_settings (admin only)
CREATE POLICY "Admins can view loyalty settings"
  ON loyalty_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = loyalty_settings.business_id
      AND admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update loyalty settings"
  ON loyalty_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = loyalty_settings.business_id
      AND admin_users.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = loyalty_settings.business_id
      AND admin_users.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert loyalty settings"
  ON loyalty_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.business_id = loyalty_settings.business_id
      AND admin_users.id = auth.uid()
    )
  );

-- RLS Policies for loyalty_points
CREATE POLICY "Customers can view own points"
  ON loyalty_points FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM customers c
      JOIN admin_users a ON a.business_id = c.business_id
      WHERE c.id = loyalty_points.customer_id
      AND a.id = auth.uid()
    )
  );

CREATE POLICY "System can insert loyalty points"
  ON loyalty_points FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update loyalty points"
  ON loyalty_points FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for loyalty_transactions
CREATE POLICY "Customers can view own transactions"
  ON loyalty_transactions FOR SELECT
  TO authenticated
  USING (
    customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM customers c
      JOIN admin_users a ON a.business_id = c.business_id
      WHERE c.id = loyalty_transactions.customer_id
      AND a.id = auth.uid()
    )
  );

CREATE POLICY "System can insert transactions"
  ON loyalty_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer_id ON loyalty_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer_id ON loyalty_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_booking_id ON loyalty_transactions(booking_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_created_at ON loyalty_transactions(created_at);

-- Function to award points for completed booking
CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  business_settings loyalty_settings%ROWTYPE;
  points_to_award integer;
  booking_price integer;
  customer_record customers%ROWTYPE;
  points_record loyalty_points%ROWTYPE;
BEGIN
  -- Only award points when booking status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    
    -- Get loyalty settings for this business
    SELECT * INTO business_settings
    FROM loyalty_settings
    WHERE business_id = NEW.business_id AND enabled = true;

    -- If loyalty is not enabled, skip
    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Get booking price
    SELECT d.price_cents INTO booking_price
    FROM service_durations d
    WHERE d.id = NEW.duration_id;

    -- Calculate points to award
    points_to_award := floor((booking_price / 100.0) * business_settings.points_per_dollar_spent);

    -- Skip if no points to award
    IF points_to_award <= 0 THEN
      RETURN NEW;
    END IF;

    -- Get customer record
    SELECT * INTO customer_record
    FROM customers
    WHERE business_id = NEW.business_id
    AND email = NEW.customer_email;

    IF NOT FOUND THEN
      RETURN NEW;
    END IF;

    -- Create or get loyalty_points record
    SELECT * INTO points_record
    FROM loyalty_points
    WHERE customer_id = customer_record.id;

    IF NOT FOUND THEN
      INSERT INTO loyalty_points (customer_id, points_balance, points_earned_total)
      VALUES (customer_record.id, points_to_award, points_to_award);
    ELSE
      UPDATE loyalty_points
      SET 
        points_balance = points_balance + points_to_award,
        points_earned_total = points_earned_total + points_to_award,
        updated_at = now()
      WHERE customer_id = customer_record.id;
    END IF;

    -- Record transaction
    INSERT INTO loyalty_transactions (
      customer_id,
      points,
      transaction_type,
      booking_id,
      description
    ) VALUES (
      customer_record.id,
      points_to_award,
      'earned_from_booking',
      NEW.id,
      format('Earned %s points from booking', points_to_award)
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for awarding points
DROP TRIGGER IF EXISTS trigger_award_loyalty_points ON bookings;
CREATE TRIGGER trigger_award_loyalty_points
  AFTER INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points();

-- Function to award welcome bonus when customer creates account
CREATE OR REPLACE FUNCTION award_welcome_bonus()
RETURNS TRIGGER AS $$
DECLARE
  business_settings loyalty_settings%ROWTYPE;
  customer_record customers%ROWTYPE;
BEGIN
  -- When user_id is set (account created), award welcome bonus
  IF NEW.user_id IS NOT NULL AND (OLD.user_id IS NULL OR OLD.user_id != NEW.user_id) THEN
    
    -- Get loyalty settings
    SELECT * INTO business_settings
    FROM loyalty_settings
    WHERE business_id = NEW.business_id AND enabled = true;

    -- If loyalty is not enabled or no welcome bonus, skip
    IF NOT FOUND OR business_settings.welcome_bonus_points <= 0 THEN
      RETURN NEW;
    END IF;

    -- Create loyalty_points record with welcome bonus
    INSERT INTO loyalty_points (
      customer_id,
      points_balance,
      points_earned_total
    ) VALUES (
      NEW.id,
      business_settings.welcome_bonus_points,
      business_settings.welcome_bonus_points
    )
    ON CONFLICT (customer_id) DO UPDATE SET
      points_balance = loyalty_points.points_balance + business_settings.welcome_bonus_points,
      points_earned_total = loyalty_points.points_earned_total + business_settings.welcome_bonus_points,
      updated_at = now();

    -- Record transaction
    INSERT INTO loyalty_transactions (
      customer_id,
      points,
      transaction_type,
      description
    ) VALUES (
      NEW.id,
      business_settings.welcome_bonus_points,
      'welcome_bonus',
      format('Welcome bonus: %s points', business_settings.welcome_bonus_points)
    );

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for welcome bonus
DROP TRIGGER IF EXISTS trigger_award_welcome_bonus ON customers;
CREATE TRIGGER trigger_award_welcome_bonus
  AFTER UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION award_welcome_bonus();