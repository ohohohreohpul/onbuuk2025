-- =============================================================================
-- Prakun Thai Massage (Hamburg) – complete the ONLINE BOOKING PAGE of the LIVE shop
-- Target: businesses.id = 9d79aec2-41a7-4ef0-a35f-afcf238227e1
--         (permalink 'hamburg', plan 'custom', voucher shop shop.prakunthaimassage.de)
-- Modelled on scripts/shops/sadudee-setup.sql.
--
-- Run ONCE as a privileged session (Supabase SQL editor or
-- `supabase db query --linked -f scripts/shops/prakun-booking-setup.sql`).
--
-- Safety: aborts if the shop has any booking, any therapist or any add-on
-- product, so a second run cannot duplicate anything.
--
-- NOT touched (live voucher business): customers, gift_cards, gift_card_orders,
-- gift_card_settings, gift_card_packages, service_pass_offers (5er/10er-Karten),
-- marketing_*, email_settings, email_templates, custom_domains,
-- receptionist_settings, admin_users, businesses.permalink/plan_type/owner_id,
-- all image/logo columns, credential rows in site_settings, the payment
-- switches stripe_enabled / paypal_enabled (the voucher shop sells through them;
-- gift_card_settings.pay_in_store_enabled is false) and the gift-card texts of
-- the welcome step (buttonText, giftCardButtonText, showGiftCardButton).
--
-- The 5 existing treatments keep their ids: all 7 durations are referenced by
-- service_pass_offers, so they are kept; only missing durations are added.
--
-- Optional blocks at the end (delete them to skip):
--   -- GO LIVE (optional)  : switches the booking button on
--   -- COLOURS (optional)  : brand colours (also used by the voucher shop)
-- =============================================================================

BEGIN;

DO $setup$
DECLARE
  v_biz constant uuid := '9d79aec2-41a7-4ef0-a35f-afcf238227e1';
  v_keep constant uuid[] := ARRAY[
    'edb1c615-a863-445e-b4ea-5049997bc827',  -- Aromaöl-Massage
    'fcf1fad8-80f7-4317-9bcb-e5398b4fce52',  -- Fußmassage
    '1df8132e-50b4-43a9-810c-c97a8f27e257',  -- Ganzkörpermassage
    '35978567-93c9-4075-84d0-fabf46193a0e',  -- Hot Stone Massage
    'ac001477-fa1a-4573-87cf-7cf0f22075c0'   -- Teilkörpermassage
  ]::uuid[];
  v_bad  text;
  v_rows int;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 0. Guards
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = v_biz) THEN
    RAISE EXCEPTION 'Target business % does not exist – aborting.', v_biz;
  END IF;
  IF EXISTS (SELECT 1 FROM public.bookings WHERE business_id = v_biz) THEN
    RAISE EXCEPTION 'Business % already has bookings – aborting.', v_biz;
  END IF;
  IF EXISTS (SELECT 1 FROM public.specialists WHERE business_id = v_biz) THEN
    RAISE EXCEPTION 'Business % already has specialists – aborting (script already applied?).', v_biz;
  END IF;
  IF EXISTS (SELECT 1 FROM public.products WHERE business_id = v_biz) THEN
    RAISE EXCEPTION 'Business % already has add-on products – aborting (script already applied?).', v_biz;
  END IF;
  IF (SELECT count(*) FROM public.services WHERE business_id = v_biz AND id = ANY (v_keep)) <> 5 THEN
    RAISE EXCEPTION 'The 5 known treatments of business % are not all present – aborting.', v_biz;
  END IF;
  IF EXISTS (SELECT 1 FROM public.services WHERE business_id = v_biz AND NOT (id = ANY (v_keep))) THEN
    RAISE EXCEPTION 'Business % has treatments besides the 5 known ones – aborting (script already applied?).', v_biz;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1. Business row: only fill empty fields (address/phone are already set).
  --    No e-mail / website / timezone column exists on businesses.
  -- ---------------------------------------------------------------------------
  UPDATE public.businesses SET
    address_line            = coalesce(nullif(btrim(address_line), ''), 'Winterhuder Weg 24'),
    city                    = coalesce(nullif(btrim(city), ''), 'Hamburg'),
    vertical                = coalesce(nullif(btrim(vertical), ''), 'wellness'),
    custom_page_title       = coalesce(nullif(btrim(custom_page_title), ''),
                                       'Prakun Thai Massage · Termin buchen · Hamburg-Winterhude'),
    custom_meta_description = coalesce(nullif(btrim(custom_meta_description), ''),
                                       'Prakun Thai Massage in Hamburg-Winterhude: traditionelle Thai-Massagen, Hot Stone, Ayurveda und Wellness-Pakete. Weil Sie mehr verdienen als nur eine Pause – jetzt online Ihren Termin buchen.'),
    updated_at              = now()
  WHERE id = v_biz;

  -- ---------------------------------------------------------------------------
  -- 2. Site settings (no credential or payment-switch rows are touched)
  -- ---------------------------------------------------------------------------
  -- 2a. Fill only when empty / placeholder ('My Business').
  INSERT INTO public.site_settings (business_id, key, value, category, currency) VALUES
    (v_biz, 'businessName', 'Prakun Thai Massage',               'general', 'EUR'),
    (v_biz, 'contactEmail', 'info@prakunthaimassage.de',         'general', 'EUR'),
    (v_biz, 'contactPhone', '040 22697033',                      'general', 'EUR'),
    (v_biz, 'address',      'Winterhuder Weg 24, 22085 Hamburg', 'general', 'EUR')
  ON CONFLICT (business_id, key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now()
    WHERE coalesce(btrim(public.site_settings.value), '') IN ('', 'My Business');

  -- 2b. Booking rules (always set). stripe_enabled / paypal_enabled stay as they are.
  INSERT INTO public.site_settings (business_id, key, value, category, currency) VALUES
    (v_biz, 'timezone',              'Europe/Berlin', 'general', 'EUR'),  -- was 'UTC'
    (v_biz, 'currency',              'EUR',           'general', 'EUR'),
    (v_biz, 'bookingWindowDays',     '30',            'booking', 'EUR'),
    (v_biz, 'cancellationHours',     '24',            'booking', 'EUR'),
    (v_biz, 'allowSpecialistChoice', 'true',          'booking', 'EUR'),  -- was 'false'
    (v_biz, 'allow_pay_in_person',   'true',          'payment', 'EUR')
  ON CONFLICT (business_id, key) DO UPDATE
    SET value = EXCLUDED.value, category = EXCLUDED.category, updated_at = now();

  -- ---------------------------------------------------------------------------
  -- 3. Booking page texts (German, "Sie"). Only text/styling columns; image
  --    columns and the gift-card keys of welcome_step are kept (jsonb merge).
  -- ---------------------------------------------------------------------------
  INSERT INTO public.booking_form_customization (
    business_id, welcome_step, service_step, duration_step, specialist_step,
    datetime_step, details_step, addons_step, payment_step, typography, styling
  ) VALUES (
    v_biz,
    jsonb_build_object(
      'title', 'Weil Sie mehr verdienen als nur eine Pause.',
      'subtitle', 'Traditionelle Thai-Massage in Hamburg-Winterhude – mit Wärme, Respekt & Sorgfalt seit 2012.',
      'bookingButtonText', 'Termin buchen'),
    jsonb_build_object(
      'title', 'Wählen Sie Ihre Behandlung',
      'subtitle', 'Massagen, Wellness-Pakete und Extras – nehmen Sie sich Zeit für sich.',
      'buttonText', 'Weiter'),
    jsonb_build_object(
      'title', 'Wie viel Zeit nehmen Sie sich?',
      'subtitle', 'Wählen Sie die Dauer Ihrer Behandlung.',
      'buttonText', 'Weiter'),
    jsonb_build_object(
      'title', 'Wer darf Sie verwöhnen?',
      'subtitle', 'Wählen Sie Ihre Therapeutin oder lassen Sie uns für Sie wählen.',
      'buttonText', 'Weiter',
      'anySpecialistText', 'Egal, wer frei ist'),
    jsonb_build_object(
      'title', 'Wann passt es Ihnen?',
      'subtitle', 'Wählen Sie Tag und Uhrzeit. Kostenlose Stornierung bis 24 Stunden vor Ihrem Termin.',
      'buttonText', 'Weiter'),
    jsonb_build_object(
      'title', 'Ihre Angaben',
      'subtitle', 'Damit wir Sie erreichen und Ihren Termin bestätigen können.',
      'buttonText', 'Weiter',
      'labels', jsonb_build_object(
        'name', 'Vor- und Nachname',
        'email', 'E-Mail',
        'phone', 'Telefon',
        'notes', 'Hinweise für uns (optional)')),
    jsonb_build_object(
      'title', 'Noch etwas dazu?',
      'subtitle', 'Kleine Extras im Anschluss an Ihre Behandlung – zum Vorzugspreis.',
      'buttonText', 'Weiter',
      'skipButtonText', 'Ohne Extras weiter'),
    jsonb_build_object(
      'title', 'Fast geschafft',
      'subtitle', 'Prüfen Sie Ihre Buchung und bestätigen Sie Ihren Termin. Sie können bequem vor Ort bezahlen. Kostenlose Stornierung bis 24 Stunden vorher.',
      'buttonText', 'Termin bestätigen'),
    jsonb_build_object(
      'fontFamily', 'system-ui, -apple-system, sans-serif',
      'headingSize', '2xl', 'headingWeight', 'bold',
      'bodySize', 'base', 'bodyWeight', 'normal'),
    jsonb_build_object(
      'layout', 'default', 'spacing', 'relaxed', 'shadowLevel', 'sm',
      'borderRadius', 'md', 'showStepNumbers', false,
      'progressBarStyle', 'steps', 'animationsEnabled', true)
  )
  ON CONFLICT (business_id) DO UPDATE SET
    welcome_step    = coalesce(public.booking_form_customization.welcome_step, '{}'::jsonb) || EXCLUDED.welcome_step,
    service_step    = EXCLUDED.service_step,
    duration_step   = EXCLUDED.duration_step,
    specialist_step = EXCLUDED.specialist_step,
    datetime_step   = EXCLUDED.datetime_step,
    details_step    = EXCLUDED.details_step,
    addons_step     = EXCLUDED.addons_step,
    payment_step    = EXCLUDED.payment_step,
    typography      = EXCLUDED.typography,
    styling         = EXCLUDED.styling,
    updated_at      = now();

  -- ---------------------------------------------------------------------------
  -- 4. Therapists + working hours (0 = Sunday … 6 = Saturday, JS getDay())
  -- ---------------------------------------------------------------------------
  INSERT INTO public.specialists (business_id, name, bio, is_active)
  SELECT v_biz, s.name, s.bio, true
  FROM (VALUES
    (1, 'Ailadda',
        'Inhaberin von Prakun Thai Massage. Seit 2012 empfängt sie ihre Gäste mit Wärme, Respekt & Sorgfalt – und nimmt sich Zeit für Ihre ganz persönlichen Wünsche.'),
    (2, 'Nattacha',
        'Teil unseres zertifizierten Teams. Mit ruhiger Hand und viel Gefühl geht sie auf Sie ein – sanft und entspannend oder kräftig, ganz wie Sie möchten.'),
    (3, 'Suphaphan',
        'Zertifizierte Thai-Masseurin, die mit Herz und Aufmerksamkeit dafür sorgt, dass Sie sich vom ersten Moment an wohlfühlen.'),
    (4, 'Khanittha',
        'Teil unseres zertifizierten Teams. Sie verbindet traditionelle Thai-Massage mit viel Feingefühl – für Ihre ganz persönliche Auszeit.'),
    (5, 'Narumon',
        'Zertifizierte Thai-Masseurin mit warmherziger Art. Bei ihr dürfen Sie einfach loslassen und den Alltag hinter sich lassen.')
  ) AS s(ord, name, bio)
  ORDER BY s.ord;

  INSERT INTO public.working_hours (business_id, specialist_id, day_of_week, start_time, end_time, is_available)
  SELECT v_biz, sp.id, h.dow, h.start_t, h.end_t, h.is_open
  FROM public.specialists sp
  CROSS JOIN (VALUES
    (0, time '10:00', time '18:00', false),  -- Sonntag geschlossen
    (1, time '10:00', time '20:00', true),
    (2, time '10:00', time '20:00', true),
    (3, time '10:00', time '20:00', true),
    (4, time '10:00', time '20:00', true),
    (5, time '10:00', time '20:00', true),
    (6, time '11:00', time '18:00', true)
  ) AS h(dow, start_t, end_t, is_open)
  WHERE sp.business_id = v_biz;

  -- ---------------------------------------------------------------------------
  -- 5. Treatments: spec table (existing_id set = keep that row and its id)
  -- ---------------------------------------------------------------------------
  CREATE TEMP TABLE _prakun_services (
    ord int, category text, name text, description text,
    mins int[], cents int[], existing_id uuid
  ) ON COMMIT DROP;

  INSERT INTO _prakun_services VALUES
  -- Angebot des Monats
  (1,  'Angebot des Monats', 'Ayurveda Abhyanga Ganzkörper',
       'Unser Angebot des Monats: 60 Minuten ayurvedische Ganzkörpermassage mit reichlich warmem Öl und rhythmischen Streichungen – zum Sonderpreis. Weil Sie mehr verdienen als nur eine Pause.',
       ARRAY[60], ARRAY[6700], NULL),
  -- Massagen
  (10, 'Massagen', 'Teilkörpermassage',
       'Gezielte Massage für die Bereiche, die Sie sich wünschen – etwa Rücken, Nacken und Schultern. Ideal, wenn Sie wenig Zeit haben.',
       ARRAY[20,30,45,60], ARRAY[2400,3500,4900,6200], 'ac001477-fa1a-4573-87cf-7cf0f22075c0'),
  (11, 'Massagen', 'Ganzkörpermassage',
       'Traditionelle Thai-Massage für den ganzen Körper mit wohltuenden Dehnungen – sanft oder kräftig, ganz nach Ihrem Wunsch.',
       ARRAY[45,60,90,120], ARRAY[4900,6200,9200,11800], '1df8132e-50b4-43a9-810c-c97a8f27e257'),
  (12, 'Massagen', 'Aromaöl-Massage',
       'Sanfte, fließende Ganzkörpermassage mit warmem, duftendem Aromaöl. Zum Abschalten und Durchatmen.',
       ARRAY[30,45,60,90,120], ARRAY[3600,5200,6500,9500,12100], 'edb1c615-a863-445e-b4ea-5049997bc827'),
  (13, 'Massagen', 'Aroma-Kerzenmassage',
       'Warmes, duftendes Öl aus einer Massagekerze, sanft auf der Haut verteilt – eine Massage, die Sie in wohlige Wärme hüllt.',
       ARRAY[30,45,60,90], ARRAY[3700,5400,6800,9600], NULL),
  (14, 'Massagen', 'Fußmassage',
       'Thailändische Fußmassage über ausgewählte Punkte der Fußsohle – eine kleine Auszeit, die Sie vom Kopf bis zu den Füßen spüren.',
       ARRAY[30,45,60], ARRAY[3500,4900,6200], 'fcf1fad8-80f7-4317-9bcb-e5398b4fce52'),
  (15, 'Massagen', 'Gesichtsmassage',
       'Sanfte Massage für Gesicht, Kopf und Nacken – entspannend und pflegend zugleich.',
       ARRAY[30,45,60], ARRAY[3600,5300,6800], NULL),
  (16, 'Massagen', 'Schröpfmassage',
       'Massage mit Schröpfgläsern, die ein angenehmes Ziehen auf der Haut erzeugen – besonders beliebt für Rücken und Schultern.',
       ARRAY[30,45,60], ARRAY[3800,5200,6500], NULL),
  (17, 'Massagen', 'Schwangerschaftsmassage',
       'Behutsame Massage in bequemer Lagerung, ganz auf werdende Mütter abgestimmt. Bitte nennen Sie uns bei der Buchung Ihre Schwangerschaftswoche.',
       ARRAY[45,60,90,120], ARRAY[5000,6300,9300,11900], NULL),
  -- Spezialmassagen
  (20, 'Spezialmassagen', 'Hot Stone Massage',
       'Warme Basaltsteine und fließende Massagegriffe schenken Ihnen wohlige Wärme und tiefe Ruhe.',
       ARRAY[45,60,90,120], ARRAY[5500,7000,10200,13200], '35978567-93c9-4075-84d0-fabf46193a0e'),
  (21, 'Spezialmassagen', 'Kräuterstempel-Massage',
       'Warme, mit thailändischen Kräutern gefüllte Stempel verwöhnen Sie mit Wärme und feinem Duft – ein traditionelles Ritual aus Thailand.',
       ARRAY[60,90,120], ARRAY[7500,10700,13700], NULL),
  (22, 'Spezialmassagen', 'Bambus-Massage',
       'Massage mit warmen Bambusstäben – rollende, ausstreichende Bewegungen für ein ganz besonderes Körpergefühl.',
       ARRAY[45,60,90,120], ARRAY[5500,7000,10200,13200], NULL),
  (23, 'Spezialmassagen', 'Lomi Lomi Nui Massage',
       'Hawaiianische Massage mit langen, fließenden Bewegungen von Händen und Unterarmen – wie sanfte Wellen, die Sie tragen.',
       ARRAY[60,90,120], ARRAY[7200,10500,13500], NULL),
  (24, 'Spezialmassagen', 'Ayurveda Abhyanga',
       'Ayurvedische Massage mit reichlich warmem Öl und rhythmischen Streichungen – für tiefe Entspannung von Kopf bis Fuß.',
       ARRAY[30,45,60,90,120], ARRAY[4200,5500,7200,10500,13500], NULL),
  (25, 'Spezialmassagen', 'Thai Warrior Massage',
       'Kraftvolle traditionelle Thai-Massage mit intensivem Druck und ausgiebigen Dehnungen – für alle, die es richtig kräftig mögen.',
       ARRAY[60,90,120], ARRAY[8500,12900,16500], NULL),
  -- Wellness-Pakete (each: Fußbad, Fußpeeling, Fußmassage, Ganzkörperbehandlung, Gesichtsmassage)
  (30, 'Wellness-Pakete', 'Wellness-Paket Basic Harmony (Aromaöl)',
       'Fußbad, Fußpeeling und Fußmassage, danach eine Ganzkörpermassage mit Aromaöl und eine Gesichtsmassage – Ihr rundum wohltuendes Ritual. 120 Minuten inklusive Rückenpeeling und Körperpackung.',
       ARRAY[60,90,120], ARRAY[7500,10700,13700], NULL),
  (31, 'Wellness-Pakete', 'Wellness-Paket Nature Harmony (Ayurveda)',
       'Fußbad, Fußpeeling und Fußmassage, danach eine ayurvedische Ganzkörpermassage mit warmem Öl und eine Gesichtsmassage. 90 Minuten inklusive Rückenpeeling, 120 Minuten inklusive Rückenpeeling und Körperpackung.',
       ARRAY[60,90,120], ARRAY[7700,10900,13900], NULL),
  (32, 'Wellness-Pakete', 'Wellness-Paket Royal Harmony (Hot Stone)',
       'Fußbad, Fußpeeling und Fußmassage, danach eine Hot Stone Ganzkörpermassage und eine Gesichtsmassage – wohlige Wärme für einen besonderen Moment. 90 Minuten inklusive Rückenpeeling, 120 Minuten inklusive Rückenpeeling und Körperpackung.',
       ARRAY[60,90,120], ARRAY[7700,10900,13900], NULL),
  (33, 'Wellness-Pakete', 'Wellness-Paket Pure Vitalität (Kräuterstempel)',
       'Fußbad, Fußpeeling und Fußmassage, danach eine Ganzkörpermassage mit warmen Kräuterstempeln und eine Gesichtsmassage – Wärme, Duft und Entspannung in einem Ritual. 90 Minuten inklusive Rückenpeeling.',
       ARRAY[60,90,120], ARRAY[7900,11000,14000], NULL),
  (34, 'Wellness-Pakete', 'Wellness-Party (ab 4 Personen)',
       'Feiern Sie mit Ihren Liebsten: Wellness-Programm mit Fußbad, Fußpeeling, Fußmassage, Ganzkörperbehandlung und Gesichtsmassage, dazu Prosecco, Obst & Snacks. Preis pro Person, mindestens 4 Personen. Bitte buchen Sie für jede Person einen eigenen Termin zur gleichen Uhrzeit – oder fragen Sie uns gern telefonisch unter 040 22697033 oder per E-Mail an info@prakunthaimassage.de.',
       ARRAY[60], ARRAY[7500], NULL),
  -- Extras (also bookable on their own)
  (40, 'Extras', 'Heiße Rolle',
       'Eine heiße Rolle schenkt Rücken und Nacken wohlige Wärme.',
       ARRAY[10], ARRAY[1500], NULL),
  (41, 'Extras', 'Warmpackung',
       'Eine wärmende Packung für Rücken und Schultern – die ideale Ergänzung für noch mehr Wohlgefühl.',
       ARRAY[20], ARRAY[2500], NULL),
  (42, 'Extras', 'Rückenpeeling',
       'Sanftes Peeling für eine glatte, gepflegte Haut am Rücken. Im Anschluss an eine Massage nur 12 €.',
       ARRAY[15], ARRAY[1500], NULL),
  (43, 'Extras', 'Ganzkörperpeeling',
       'Peeling für den ganzen Körper – Ihre Haut fühlt sich danach weich und frisch an. Im Anschluss an eine Massage nur 32 €.',
       ARRAY[30], ARRAY[3500], NULL),
  (44, 'Extras', 'Ganzkörperpeeling mit Körperpackung',
       'Ganzkörperpeeling mit anschließender pflegender Körperpackung. Im Anschluss an eine Massage nur 35 €.',
       ARRAY[45], ARRAY[4000], NULL);

  -- 5a. Keep the 5 existing rows (ids referenced by the 5er/10er-Karten), make them bookable.
  UPDATE public.services s SET
    name          = d.name,
    description   = d.description,
    category      = d.category,
    display_order = d.ord,
    is_hidden     = false,          -- were hidden from the booking page
    updated_at    = now()
  FROM _prakun_services d
  WHERE s.id = d.existing_id AND s.business_id = v_biz;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 5 THEN
    RAISE EXCEPTION 'Expected to update 5 existing treatments, updated % – aborting.', v_rows;
  END IF;

  -- 5b. Durations of the kept treatments: delete only rows nothing references.
  DELETE FROM public.service_durations sd
   WHERE sd.service_id = ANY (v_keep)
     AND NOT EXISTS (SELECT 1 FROM public.service_pass_offers     x WHERE x.duration_id = sd.id)
     AND NOT EXISTS (SELECT 1 FROM public.gift_cards              x WHERE x.duration_id = sd.id)
     AND NOT EXISTS (SELECT 1 FROM public.gift_card_package_items x WHERE x.duration_id = sd.id)
     AND NOT EXISTS (SELECT 1 FROM public.booking_items           x WHERE x.duration_id = sd.id)
     AND NOT EXISTS (SELECT 1 FROM public.bookings                x WHERE x.duration_id = sd.id)
     AND NOT EXISTS (SELECT 1 FROM public.slot_holds              x WHERE x.duration_id = sd.id);
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RAISE NOTICE 'Unreferenced durations removed (re-created below): %', v_rows;

  -- Kept (referenced) durations must already carry the new price – otherwise stop,
  -- because the voucher shop shows "statt <duration price>" for the 5er/10er-Karten.
  SELECT string_agg(format('%s %s min: %s ≠ %s', d.name, sd.duration_minutes, sd.price_cents, x.price_cents), '; ')
    INTO v_bad
  FROM public.service_durations sd
  JOIN _prakun_services d ON d.existing_id = sd.service_id
  JOIN LATERAL unnest(d.mins, d.cents) AS x(minutes, price_cents) ON x.minutes = sd.duration_minutes
  WHERE sd.price_cents <> x.price_cents;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Referenced duration prices differ from the new price list: % – aborting.', v_bad;
  END IF;

  SELECT string_agg(format('%s %s min', d.name, sd.duration_minutes), '; ')
    INTO v_bad
  FROM public.service_durations sd
  JOIN _prakun_services d ON d.existing_id = sd.service_id
  WHERE NOT (sd.duration_minutes = ANY (d.mins));
  IF v_bad IS NOT NULL THEN
    RAISE NOTICE 'Referenced durations outside the new price list kept: %', v_bad;
  END IF;

  -- 5c. New treatments.
  INSERT INTO public.services (business_id, name, description, category, display_order, is_pair_massage, is_hidden)
  SELECT v_biz, d.name, d.description, d.category, d.ord, false, false
  FROM _prakun_services d
  WHERE d.existing_id IS NULL
  ORDER BY d.ord;

  -- 5d. All missing duration/price options (new treatments + kept ones).
  INSERT INTO public.service_durations (business_id, service_id, duration_minutes, price_cents)
  SELECT v_biz, s.id, x.minutes, x.price_cents
  FROM _prakun_services d
  JOIN public.services s
    ON s.business_id = v_biz
   AND (s.id = d.existing_id OR (d.existing_id IS NULL AND s.name = d.name))
  CROSS JOIN LATERAL unnest(d.mins, d.cents) AS x(minutes, price_cents)
  WHERE NOT EXISTS (SELECT 1 FROM public.service_durations sd
                     WHERE sd.service_id = s.id AND sd.duration_minutes = x.minutes)
  ORDER BY d.ord, x.minutes;

  -- 5e. Every therapist does every treatment.
  INSERT INTO public.specialist_services (business_id, specialist_id, service_id)
  SELECT v_biz, sp.id, s.id
  FROM public.specialists sp
  JOIN public.services s ON s.business_id = v_biz
  WHERE sp.business_id = v_biz;

  -- ---------------------------------------------------------------------------
  -- 6. Add-ons (booking step "Noch etwas dazu?") for Massagen, Spezialmassagen,
  --    Wellness-Pakete. Add-ons carry a price only – they do NOT extend the slot.
  -- ---------------------------------------------------------------------------
  WITH prod(ord, category, name, description, cents, exclusive, targets) AS (
    VALUES
    (1, 'Peeling im Anschluss', 'Rückenpeeling (im Anschluss)',
        'Sanftes Rückenpeeling direkt nach Ihrer Behandlung – ca. 15 Minuten. Statt 15 € nur 12 €.',
        1200, true, ARRAY['Massagen','Spezialmassagen','Wellness-Pakete']),
    (2, 'Peeling im Anschluss', 'Ganzkörperpeeling (im Anschluss)',
        'Ganzkörperpeeling direkt nach Ihrer Behandlung – ca. 30 Minuten. Ihre Haut fühlt sich danach weich und frisch an. Statt 35 € nur 32 €.',
        3200, true, ARRAY['Massagen','Spezialmassagen','Wellness-Pakete']),
    (3, 'Peeling im Anschluss', 'Ganzkörperpeeling mit Körperpackung (im Anschluss)',
        'Ganzkörperpeeling mit pflegender Körperpackung direkt nach Ihrer Behandlung – ca. 45 Minuten. Statt 40 € nur 35 €.',
        3500, true, ARRAY['Massagen','Spezialmassagen','Wellness-Pakete']),
    (4, 'Für Paare', 'Zeit zu Zweit – Paarprogramm',
        'Genießen Sie Ihre Auszeit gemeinsam: mit Rosenblättern, Prosecco, Obst & Snacks. Bitte buchen Sie für jede Person einen eigenen Termin zur gleichen Uhrzeit.',
        1400, false, ARRAY['Massagen','Spezialmassagen','Wellness-Pakete'])
  ),
  ins AS (
    INSERT INTO public.products (business_id, name, description, price_cents, is_active, display_order,
                                 max_quantity_per_booking, category, is_exclusive_in_category)
    SELECT v_biz, p.name, p.description, p.cents, true, p.ord, 1, p.category, p.exclusive
    FROM prod p
    RETURNING id, name
  )
  INSERT INTO public.product_service_assignments (business_id, product_id, service_id)
  SELECT v_biz, ins.id, s.id
  FROM ins
  JOIN prod p ON p.name = ins.name
  JOIN public.services s ON s.business_id = v_biz AND s.category = ANY (p.targets);

  RAISE NOTICE 'Prakun booking page set up: business_id=%', v_biz;
END
$setup$;

-- =============================================================================
-- GO LIVE (optional) – delete this block to prepare everything without showing
-- the booking button yet. Today enable_bookings = false and the welcome step has
-- showBookingButton = false, so shop.prakunthaimassage.de only sells vouchers.
-- =============================================================================
UPDATE public.businesses
   SET enable_bookings = true, updated_at = now()
 WHERE id = '9d79aec2-41a7-4ef0-a35f-afcf238227e1';

UPDATE public.booking_form_customization
   SET welcome_step = coalesce(welcome_step, '{}'::jsonb) || jsonb_build_object('showBookingButton', true),
       updated_at   = now()
 WHERE business_id = '9d79aec2-41a7-4ef0-a35f-afcf238227e1';

-- =============================================================================
-- COLOURS (optional) – delete this block to keep the current colours.
-- booking_form_colors is shared by the booking page AND the voucher shop.
-- Before: primary #7B2957, primary_hover #4d0f32, secondary #D2A647,
--         secondary_hover #a88e57, accent #7B2957, text_primary #7B2957,
--         text_secondary #57534e, background #ffffff,
--         background_secondary #fafaf9, border #e7e5e4
-- =============================================================================
INSERT INTO public.booking_form_colors (business_id, color_key, color_value) VALUES
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'primary',              '#7B2958'),  -- plum, white button text
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'primary_hover',        '#5C1E42'),
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'secondary',            '#C4A77D'),  -- gold
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'secondary_hover',      '#A88B5F'),
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'accent',               '#C4A77D'),
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'text_primary',         '#2B2B2B'),  -- charcoal
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'text_secondary',       '#666666'),
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'background',           '#FFFFFF'),
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'background_secondary', '#F7F6F4'),
  ('9d79aec2-41a7-4ef0-a35f-afcf238227e1', 'border',               '#E5E2DD')
ON CONFLICT (business_id, color_key) DO UPDATE
  SET color_value = EXCLUDED.color_value, updated_at = now();

-- Legacy copy inside booking_form_customization (was the blue default palette).
UPDATE public.booking_form_customization
   SET colors = jsonb_build_object(
         'primary', '#7B2958', 'secondary', '#C4A77D', 'accent', '#C4A77D',
         'background', '#FFFFFF', 'surface', '#F7F6F4', 'border', '#E5E2DD',
         'text', '#2B2B2B', 'textSecondary', '#666666',
         'success', '#22c55e', 'warning', '#f59e0b', 'error', '#ef4444'),
       updated_at = now()
 WHERE business_id = '9d79aec2-41a7-4ef0-a35f-afcf238227e1';

COMMIT;
