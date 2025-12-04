/*
  # Create Business Initialization Function
  
  Creates a function that initializes all default settings for a new business.
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
    (business_uuid, 'payInPersonEnabled', 'false', 'payment')
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

  -- Insert default currency settings
  INSERT INTO public.currency_settings (business_id, currency_code, currency_symbol, decimal_places)
  VALUES (business_uuid, 'USD', '$', 2)
  ON CONFLICT (business_id) DO NOTHING;

  -- Insert default gift card settings
  INSERT INTO public.gift_card_settings (
    business_id,
    enabled,
    allow_custom_amounts,
    preset_amounts,
    min_amount,
    max_amount,
    expiry_months,
    terms_and_conditions,
    email_design_template,
    show_qr_code
  ) VALUES (
    business_uuid,
    false,
    true,
    ARRAY[25.00, 50.00, 100.00, 200.00],
    10.00,
    1000.00,
    12,
    'Gift cards are non-refundable and cannot be exchanged for cash.',
    'default',
    true
  )
  ON CONFLICT (business_id) DO NOTHING;
END;
$$;

-- Create trigger wrapper
CREATE OR REPLACE FUNCTION public.initialize_new_business_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.initialize_new_business(NEW.id);
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS initialize_business_on_insert ON public.businesses;

-- Create trigger
CREATE TRIGGER initialize_business_on_insert
  AFTER INSERT ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_new_business_trigger();
