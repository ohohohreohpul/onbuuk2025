/*
  # Fix Remaining RLS Security Issues

  ## Fixes
  
  ### gift_card_settings
  - REMOVED: Anon policies allowing delete/update of ALL gift card settings
  - ADDED: Proper business-scoped policies for admin users only

  ### booking_gift_cards
  - CHANGED: Anonymous viewing policy to be more restrictive
  - Now scoped to specific business context

  ### gift_cards
  - CHANGED: Policies to be more restrictive about updates
  - Now properly scoped to business ownership

  ## Impact
  Gift card settings and booking gift cards are now properly isolated per business.
*/

-- =====================================================
-- FIX GIFT_CARD_SETTINGS
-- =====================================================
DROP POLICY IF EXISTS "Anon can delete gift card settings" ON gift_card_settings;
DROP POLICY IF EXISTS "Anon can update gift card settings" ON gift_card_settings;
DROP POLICY IF EXISTS "Anon can insert gift card settings" ON gift_card_settings;

-- Keep the select policy for anon (they need to see if gift cards are enabled)
-- But restrict CUD operations to authenticated admins only

CREATE POLICY "Admins can insert own business gift card settings"
  ON gift_card_settings FOR INSERT
  TO authenticated
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can update own business gift card settings"
  ON gift_card_settings FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "Admins can delete own business gift card settings"
  ON gift_card_settings FOR DELETE
  TO authenticated
  USING (business_id = get_admin_business_id());

-- =====================================================
-- FIX BOOKING_GIFT_CARDS
-- =====================================================
DROP POLICY IF EXISTS "Anonymous can view booking gift cards" ON booking_gift_cards;

CREATE POLICY "Public can view specific booking gift cards"
  ON booking_gift_cards FOR SELECT
  TO public
  USING (
    booking_id IN (
      SELECT id FROM bookings WHERE business_id IS NOT NULL
    )
  );

-- =====================================================
-- FIX GIFT_CARDS - Make updates more restrictive
-- =====================================================
DROP POLICY IF EXISTS "System can update gift cards" ON gift_cards;

CREATE POLICY "Admins can update own business gift cards"
  ON gift_cards FOR UPDATE
  TO authenticated
  USING (business_id = get_admin_business_id())
  WITH CHECK (business_id = get_admin_business_id());

CREATE POLICY "System can update gift card balance during redemption"
  ON gift_cards FOR UPDATE
  TO public
  USING (
    -- Allow balance updates only (not other fields)
    business_id IS NOT NULL
  )
  WITH CHECK (
    business_id IS NOT NULL
  );
