-- SQL script to fix potentially corrupted Stripe/PayPal keys in site_settings
-- Run this in the Supabase SQL Editor if you're experiencing "Invalid API Key" errors

-- First, let's see what the current values look like (masked for security)
SELECT 
  business_id,
  key,
  CASE 
    WHEN length(value) > 20 THEN 
      concat(left(value, 10), '...', right(value, 5), ' (length: ', length(value), ')')
    ELSE 
      concat(value, ' (length: ', length(value), ')')
  END as masked_value,
  -- Check for common issues
  CASE 
    WHEN value LIKE '"%"' THEN 'HAS WRAPPER QUOTES'
    WHEN value LIKE '" %' OR value LIKE '% "' THEN 'HAS SPACES WITH QUOTES'
    WHEN value LIKE ' %' OR value LIKE '% ' THEN 'HAS LEADING/TRAILING SPACES'
    WHEN value LIKE '"""%"""' THEN 'TRIPLE QUOTED'
    ELSE 'OK'
  END as potential_issue
FROM site_settings
WHERE key IN ('stripe_secret_key', 'paypal_client_id', 'paypal_secret')
ORDER BY business_id, key;

-- Fix wrapper quotes (e.g., "sk_live_xxx" -> sk_live_xxx)
UPDATE site_settings
SET value = trim(both '"' from value)
WHERE key IN ('stripe_secret_key', 'paypal_client_id', 'paypal_secret')
  AND value LIKE '"%"';

-- Fix leading/trailing whitespace
UPDATE site_settings
SET value = trim(value)
WHERE key IN ('stripe_secret_key', 'paypal_client_id', 'paypal_secret');

-- Fix double-encoded JSON strings (e.g., "\"sk_live_xxx\"" -> sk_live_xxx)
UPDATE site_settings
SET value = trim(both '"' from trim(both '\' from value))
WHERE key IN ('stripe_secret_key', 'paypal_client_id', 'paypal_secret')
  AND (value LIKE '\"%\"' OR value LIKE '\"%\"');

-- Verify the fix
SELECT 
  business_id,
  key,
  CASE 
    WHEN length(value) > 20 THEN 
      concat(left(value, 10), '...', right(value, 5), ' (length: ', length(value), ')')
    ELSE 
      concat(value, ' (length: ', length(value), ')')
  END as masked_value_after_fix
FROM site_settings
WHERE key IN ('stripe_secret_key', 'paypal_client_id', 'paypal_secret')
ORDER BY business_id, key;
