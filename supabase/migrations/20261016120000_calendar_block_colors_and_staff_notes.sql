-- Calendar workspace (2026-10-16)
-- 1. Blocked times get a colour, so shops can use them as quick phone
--    reservations ("Fr. Kopelke, Rücken/Nacken, 0157…") the way they did in EasyWeek.
-- 2. Staff notes on appointments: internal only, never visible to customers,
--    so they live in their own admin-only table instead of bookings.notes
--    (the customer's own note from the booking form).

ALTER TABLE public.time_blocks ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.time_blocks DROP CONSTRAINT IF EXISTS time_blocks_color_format;
ALTER TABLE public.time_blocks
  ADD CONSTRAINT time_blocks_color_format CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.time_blocks DROP CONSTRAINT IF EXISTS time_blocks_reason_length;
ALTER TABLE public.time_blocks
  ADD CONSTRAINT time_blocks_reason_length CHECK (reason IS NULL OR char_length(reason) <= 1000) NOT VALID;

CREATE TABLE IF NOT EXISTS public.booking_staff_notes (
  booking_id uuid PRIMARY KEY REFERENCES public.bookings(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (char_length(note) <= 2000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid DEFAULT auth.uid()
);

CREATE INDEX IF NOT EXISTS booking_staff_notes_business_idx ON public.booking_staff_notes (business_id);

ALTER TABLE public.booking_staff_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read their shop's staff notes" ON public.booking_staff_notes;
CREATE POLICY "Admins read their shop's staff notes" ON public.booking_staff_notes
  FOR SELECT TO authenticated
  USING (business_id = public.get_admin_business_id());

DROP POLICY IF EXISTS "Admins write their shop's staff notes" ON public.booking_staff_notes;
CREATE POLICY "Admins write their shop's staff notes" ON public.booking_staff_notes
  FOR ALL TO authenticated
  USING (business_id = public.get_admin_business_id())
  WITH CHECK (
    business_id = public.get_admin_business_id()
    AND EXISTS (
      SELECT 1 FROM public.bookings b
      WHERE b.id = booking_id AND b.business_id = public.get_admin_business_id()
    )
  );

REVOKE ALL ON public.booking_staff_notes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_staff_notes TO authenticated;

NOTIFY pgrst, 'reload schema';
