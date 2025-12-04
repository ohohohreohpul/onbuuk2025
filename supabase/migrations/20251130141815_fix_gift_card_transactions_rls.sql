/*
  # Fix Gift Card Transactions RLS Policies

  ## Changes
  1. Drop existing restrictive RLS policies that rely on Supabase auth
  2. Create new policies allowing anonymous access
    - Allow anyone to SELECT gift card transactions
    - Allow anyone to INSERT gift card transactions (redemptions/purchases)

  ## Security Notes
  - The admin panel uses localStorage authentication, not Supabase auth
  - This allows gift card redemptions to show in transaction history
  - In production, implement proper Supabase authentication
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Customers can view transactions for their cards" ON gift_card_transactions;
DROP POLICY IF EXISTS "System can insert gift card transactions" ON gift_card_transactions;

-- Create new permissive policies for admin panel functionality
CREATE POLICY "Anyone can view gift card transactions"
  ON gift_card_transactions
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can insert gift card transactions"
  ON gift_card_transactions
  FOR INSERT
  TO public
  WITH CHECK (true);
