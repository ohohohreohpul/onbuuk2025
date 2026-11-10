/*
  # Custom domains follow the plan (plan audit 2026-11-10)

  custom_domain_enabled is a separate flag that a downgrade never cleared, so
  free shops kept their own domain. Fix:
  1. Shops that paid for their domain before plans existed move to Custom:
     Kasa Wellness Hamburg (booking.kasa-wellness.de) and app demo (oh.onbuuk.com).
  2. Every other shop without a paid plan loses the flag (none of them has a
     connected domain).
  stripe-webhook now also clears the flag when a subscription ends.
*/

UPDATE public.businesses
   SET plan_type = 'custom'
 WHERE id IN (
   '49ba69a4-ffe7-40c4-a4e0-8dd0908ce958', -- Kasa Wellness Hamburg
   '3886dbb5-1138-4ada-8554-e564b749b4c0'  -- app demo
 );

UPDATE public.businesses
   SET custom_domain_enabled = false
 WHERE custom_domain_enabled
   AND NOT public.business_is_paid(id);
