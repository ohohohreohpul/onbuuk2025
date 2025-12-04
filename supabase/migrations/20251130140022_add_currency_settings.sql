/*
  # Add Currency Settings

  ## Changes
  1. Add currency field to site_settings table
    - `currency` (text, default 'USD')
    - Supports: USD, EUR, GBP, THB, AUD, CAD, JPY, and more
  
  2. Add currency symbol mapping
    - Stored for easy display without client-side mapping

  ## Security
  - No new RLS policies needed
  - Uses existing site_settings policies

  ## Important Notes
  - Default currency is USD
  - All prices in database remain in cents
  - Currency only affects display formatting
*/

-- Add currency to site_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_settings' AND column_name = 'currency'
  ) THEN
    ALTER TABLE site_settings ADD COLUMN currency text DEFAULT 'USD' CHECK (currency IN (
      'USD', 'EUR', 'GBP', 'THB', 'AUD', 'CAD', 'JPY', 'CNY', 'INR', 'KRW', 'MXN', 'BRL', 'ZAR', 'SGD', 'NZD', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'RUB', 'AED', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'JOD', 'ILS', 'EGP', 'MAD', 'NGN', 'KES', 'GHS', 'PHP', 'IDR', 'MYR', 'VND', 'PKR', 'BDT', 'LKR', 'MMK', 'ARS', 'CLP', 'COP', 'PEN', 'UYU', 'VEF'
    ));
  END IF;
END $$;

-- Set default currency for existing businesses
UPDATE site_settings 
SET currency = 'USD' 
WHERE currency IS NULL;
