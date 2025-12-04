/*
  # Fix Business Initialization Function - Correct Column Names
  
  Update the function to use the actual columns that exist in the database.
*/

CREATE OR REPLACE FUNCTION public.initialize_new_business(business_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert default site settings
  INSERT INTO public.site_settings (business_id, key, value, category) VALUES
    (business_uuid, 'businessName', 'My Business', 'general'),
    (business_uuid, 'contactEmail', '', 'general'),
    (business_uuid, 'contactPhone', '', 'general'),
    (business_uuid, 'address', '', 'general'),
    (business_uuid, 'timezone', 'UTC', 'general'),
    (business_uuid, 'bookingWindowDays', '30', 'booking'),
    (business_uuid, 'cancellationHours', '24', 'booking'),
    (business_uuid, 'stripePublishableKey', '', 'payment'),
    (business_uuid, 'stripeSecretKey', '', 'payment'),
    (business_uuid, 'payInPersonEnabled', 'false', 'payment'),
    (business_uuid, 'currency', 'USD', 'general')
  ON CONFLICT (business_id, key) DO NOTHING;

  -- Insert default booking form colors
  INSERT INTO public.booking_form_colors (business_id, color_key, color_value) VALUES
    (business_uuid, 'primary', '#1c1917'),
    (business_uuid, 'primary_hover', '#44403c'),
    (business_uuid, 'secondary', '#78716c'),
    (business_uuid, 'text_primary', '#1c1917'),
    (business_uuid, 'text_secondary', '#57534e'),
    (business_uuid, 'background', '#ffffff'),
    (business_uuid, 'background_secondary', '#fafaf9'),
    (business_uuid, 'border', '#e7e5e4'),
    (business_uuid, 'accent', '#1c1917')
  ON CONFLICT (business_id, color_key) DO NOTHING;

  -- Insert default gift card settings with correct column names
  INSERT INTO public.gift_card_settings (
    business_id,
    enabled,
    allow_custom_amount,
    preset_amounts_cents,
    min_custom_amount_cents,
    max_custom_amount_cents,
    expiry_days,
    terms_and_conditions,
    design_url
  ) VALUES (
    business_uuid,
    false,
    true,
    ARRAY[2500, 5000, 10000, 20000],
    1000,
    100000,
    365,
    'Gift Card Terms & Conditions:

• This gift card is valid for services at our establishment only
• Cannot be exchanged for cash
• Lost or stolen cards cannot be replaced
• Cannot be combined with other promotional offers
• Check your balance at any time using your gift card code
• Present this gift card code when booking your appointment',
    NULL
  )
  ON CONFLICT (business_id) DO NOTHING;
END;
$$;
