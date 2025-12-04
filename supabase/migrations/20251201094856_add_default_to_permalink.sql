/*
  # Add default value to permalink column

  1. Changes
    - Add a default value generator for permalink column
    - This ensures new businesses always get a permalink even if not explicitly provided

  2. Security
    - Uses md5 hash of random value for secure random string generation
*/

-- Add default value to permalink column
ALTER TABLE businesses 
ALTER COLUMN permalink SET DEFAULT 'biz-' || substring(md5(random()::text) from 1 for 8);
