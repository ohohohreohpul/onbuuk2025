/*
  # Fix Loyalty Trigger Functions RLS

  1. Changes
    - Update loyalty trigger functions to use SECURITY DEFINER
    - This allows triggers to bypass RLS when awarding points
    - Required because triggers need to update loyalty tables regardless of user permissions

  2. Functions Updated
    - `award_loyalty_points()` - Awards points when bookings are completed
    - `award_welcome_bonus()` - Awards welcome bonus when customer creates account
*/

-- Update award_loyalty_points to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION award_loyalty_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Update award_welcome_bonus to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION award_welcome_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;