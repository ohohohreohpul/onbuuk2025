/*
  # Make subdomain nullable for custom domain support

  1. Changes
    - Make subdomain column nullable in businesses table
    - This allows businesses to use custom domains without requiring a subdomain
  
  2. Security
    - No changes to RLS policies
*/

ALTER TABLE businesses ALTER COLUMN subdomain DROP NOT NULL;
