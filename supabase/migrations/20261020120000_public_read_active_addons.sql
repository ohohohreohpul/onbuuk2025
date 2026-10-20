/*
  Booking pages could not show add-ons (2026-10-20).

  The public read policy on products was dropped on 2025-11-30 as a "duplicate"
  and never replaced, so only logged-in admins could read products and the
  "Noch etwas dazu?" step was always empty for guests. Products hold only
  public catalogue data (name, description, price, image), so guests may read
  active ones. Writes stay admin-only.
*/
DROP POLICY IF EXISTS "Public can view active products" ON public.products;
CREATE POLICY "Public can view active products"
  ON public.products FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
