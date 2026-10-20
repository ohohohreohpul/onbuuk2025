-- =============================================================================
-- Sadudee Thai Massage (Heide) – CONVERT the existing test shop into the live shop
-- Target: businesses.id = 2c367b45-c21f-47b5-bc72-151fd0154404
--         (was "Sadudee Heide", permalink 'testsadudee', plan 'free').
-- Modelled on SATUUU99 (55f77e36-…) and Zenno Demo Studio (c2f1ae8f-…).
--
-- Run ONCE as a privileged session WITHOUT an API JWT (Supabase SQL editor or
-- `supabase db query --linked -f …`). private.protect_business_billing_fields
-- rejects plan changes from API sessions; the script asserts 'custom' below.
--
-- Safety: aborts unless the shop still has 0 services, specialists, bookings
-- and customers, so a second run (or a run after real use) cannot clobber data.
--
-- Kept as they are: owner_id, the owner admin_users row (email + login ids),
-- roles, custom_domains (gutscheine.sadudeeheide.de), credential rows in
-- site_settings (stripe_secret_key, stripeSecretKey, stripePublishableKey),
-- the uploaded welcome photo in booking_form_customization and the uploaded
-- gift card design (gift_card_settings.design_url).
--
-- NOT created on purpose: email_settings (needs real SMTP credentials; without
-- a row the shop sends no e-mails), payment keys, gift card sets/packages.
-- =============================================================================

BEGIN;

DO $setup$
DECLARE
  v_biz constant uuid := '2c367b45-c21f-47b5-bc72-151fd0154404';
  v_ailadda   uuid;
  v_nutcharee uuid;
  v_plan      text;
  v_logo constant text := 'https://www.sadudeeheide.de/files_8303466-2026-04-08T09-22-54-299Z-674fd8e3c7b548d131423fb0_Logo_-_Prakun_Thai_Massage_-_Ailadda_Saturday-p-500-removebg-preview-2-1024x406.webp';
BEGIN
  -- ---------------------------------------------------------------------------
  -- 0. Guards
  -- ---------------------------------------------------------------------------
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = v_biz) THEN
    RAISE EXCEPTION 'Target business % does not exist – aborting.', v_biz;
  END IF;
  IF EXISTS (SELECT 1 FROM public.services    WHERE business_id = v_biz)
  OR EXISTS (SELECT 1 FROM public.specialists WHERE business_id = v_biz)
  OR EXISTS (SELECT 1 FROM public.bookings    WHERE business_id = v_biz)
  OR EXISTS (SELECT 1 FROM public.customers   WHERE business_id = v_biz) THEN
    RAISE EXCEPTION 'Business % already has services, specialists, bookings or customers – aborting (already converted or in use).', v_biz;
  END IF;
  IF EXISTS (SELECT 1 FROM public.businesses WHERE name = 'Sadudee Thai Massage' AND id <> v_biz) THEN
    RAISE EXCEPTION 'Another business named "Sadudee Thai Massage" already exists – aborting.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.businesses WHERE permalink = 'sadudee' AND id <> v_biz) THEN
    RAISE EXCEPTION 'Permalink "sadudee" is already taken by another business – aborting.';
  END IF;

  -- ---------------------------------------------------------------------------
  -- 1. Business row (plan_type 'custom' BEFORE services/staff: free plan = 1 staff, 5 services)
  --    owner_id is left untouched.
  -- ---------------------------------------------------------------------------
  UPDATE public.businesses SET
    name                      = 'Sadudee Thai Massage',
    permalink                 = 'sadudee',
    plan_type                 = 'custom',
    is_active                 = true,
    business_type             = 'massage_studio',
    vertical                  = 'wellness',
    phone                     = '0481 78778000',
    address                   = 'Süderstraße 1A, 25746 Heide',
    address_line              = 'Süderstraße 1A',
    city                      = 'Heide',
    language                  = 'de',
    custom_logo_url           = v_logo,   -- replaces the old white-on-transparent PNG (invisible on white)
    login_page_logo_url       = v_logo,
    hide_powered_by_badge     = true,
    profile_completed         = true,
    enable_bookings           = true,
    enable_gift_cards         = true,
    custom_domain_enabled     = true,
    booking_form_layout       = 'default',
    booking_confirmation_mode = 'auto',
    send_booking_reminders    = true,
    notify_owner_bookings     = true,
    custom_page_title         = 'Sadudee Thai Massage · Termin buchen · Heide',
    custom_meta_description   = 'Sadudee Thai Massage in Heide: traditionelle Thai-Massagen, Hot Stone, Ayurveda und Wellness-Pakete. Weil Sie mehr verdienen als nur eine Pause – jetzt online Ihren Termin buchen.',
    updated_at                = now()
  WHERE id = v_biz
  RETURNING plan_type INTO v_plan;

  IF v_plan IS DISTINCT FROM 'custom' THEN
    RAISE EXCEPTION 'plan_type is % after update (script ran with an API JWT?) – aborting.', v_plan;
  END IF;

  -- ---------------------------------------------------------------------------
  -- 2. Owner admin row: kept (email, user_id, auth_user_id, role unchanged).
  --    Only replace the placeholder display name (currently the old shop name).
  -- ---------------------------------------------------------------------------
  UPDATE public.admin_users
     SET full_name = 'Ailadda'
   WHERE business_id = v_biz
     AND is_owner
     AND coalesce(btrim(full_name), '') IN ('', 'Sadudee Heide');

  -- ---------------------------------------------------------------------------
  -- 3. Site settings: upsert the keys this script owns. Credential rows
  --    (stripe_secret_key, stripeSecretKey, stripePublishableKey) are not touched.
  -- ---------------------------------------------------------------------------
  INSERT INTO public.site_settings (business_id, key, value, category, currency) VALUES
    (v_biz, 'businessName',          'Sadudee Thai Massage',        'general', 'EUR'),
    (v_biz, 'contactEmail',          'info@sadudeeheide.de',        'general', 'EUR'),
    (v_biz, 'contactPhone',          '0481 78778000',               'general', 'EUR'),
    (v_biz, 'address',               'Süderstraße 1A, 25746 Heide', 'general', 'EUR'),
    (v_biz, 'timezone',              'Europe/Berlin',               'general', 'EUR'),
    (v_biz, 'currency',              'EUR',                         'general', 'EUR'),
    (v_biz, 'bookingWindowDays',     '30',                          'booking', 'EUR'),
    (v_biz, 'cancellationHours',     '24',                          'booking', 'EUR'),
    (v_biz, 'allowSpecialistChoice', 'true',                        'booking', 'EUR'),
    (v_biz, 'allow_pay_in_person',   'true',                        'payment', 'EUR'),
    (v_biz, 'payInPersonEnabled',    'false',                       'payment', 'EUR'),
    (v_biz, 'stripe_enabled',        'false',                       'payment', 'EUR'),  -- was 'true' on the test shop
    (v_biz, 'paypal_enabled',        'false',                       'payment', 'EUR')
  ON CONFLICT (business_id, key) DO UPDATE
    SET value = EXCLUDED.value, category = EXCLUDED.category, currency = EXCLUDED.currency, updated_at = now();

  -- Stray key from an old currency bug ("currency_<business id>" = 'USD'); nothing reads it.
  DELETE FROM public.site_settings
   WHERE business_id = v_biz AND key = 'currency_' || v_biz::text;


  -- ---------------------------------------------------------------------------
  -- 4. Brand colours (booking page theme)
  -- ---------------------------------------------------------------------------
  INSERT INTO public.booking_form_colors (business_id, color_key, color_value) VALUES
    (v_biz, 'primary',              '#B8302C'),  -- deep red, white button text
    (v_biz, 'primary_hover',        '#9A2520'),
    (v_biz, 'secondary',            '#A8862A'),  -- gold, darkened for readable text
    (v_biz, 'secondary_hover',      '#8A6D1F'),
    (v_biz, 'text_primary',         '#2B2B2B'),
    (v_biz, 'text_secondary',       '#666666'),
    (v_biz, 'background',           '#FFFFFF'),
    (v_biz, 'background_secondary', '#F7F6F4'),
    (v_biz, 'border',               '#E5E2DD'),
    (v_biz, 'accent',               '#D4AF37')   -- gold
  ON CONFLICT (business_id, color_key) DO UPDATE
    SET color_value = EXCLUDED.color_value, updated_at = now();

  -- ---------------------------------------------------------------------------
  -- 5. Booking page texts (German, "Sie")
  -- ---------------------------------------------------------------------------
  INSERT INTO public.booking_form_customization (
    business_id, welcome_step, service_step, duration_step, specialist_step,
    datetime_step, details_step, addons_step, payment_step, colors, typography, styling
  ) VALUES (
    v_biz,
    jsonb_build_object(
      'title', 'Weil Sie mehr verdienen als nur eine Pause.',
      'subtitle', 'Traditionelle Thai-Massage in Heide – mit Wärme, Respekt & Sorgfalt seit 2012.',
      'buttonText', 'Termin buchen',
      'bookingButtonText', 'Termin buchen',
      'giftCardButtonText', 'Gutschein verschenken',
      'showBookingButton', true,
      'showGiftCardButton', true,
      'showAccountButton', false,
      'noticeTitle', '',
      'noticeText', ''),
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
      'subtitle', 'Wählen Sie Tag und Uhrzeit.',
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
      'subtitle', 'Kleine Extras im Anschluss an Ihre Massage – zum Vorzugspreis.',
      'buttonText', 'Weiter',
      'skipButtonText', 'Ohne Extras weiter'),
    jsonb_build_object(
      'title', 'Fast geschafft',
      'subtitle', 'Prüfen Sie Ihre Buchung und bestätigen Sie Ihren Termin. Bezahlt wird bequem vor Ort.',
      'buttonText', 'Termin bestätigen'),
    jsonb_build_object(
      'primary', '#B8302C', 'secondary', '#A8862A', 'accent', '#D4AF37',
      'background', '#FFFFFF', 'surface', '#F7F6F4', 'border', '#E5E2DD',
      'text', '#2B2B2B', 'textSecondary', '#666666',
      'success', '#22c55e', 'warning', '#f59e0b', 'error', '#ef4444'),
    jsonb_build_object(
      'fontFamily', 'system-ui, -apple-system, sans-serif',
      'headingSize', '2xl', 'headingWeight', 'bold',
      'bodySize', 'base', 'bodyWeight', 'normal'),
    jsonb_build_object(
      'layout', 'default', 'spacing', 'relaxed', 'shadowLevel', 'sm',
      'borderRadius', 'md', 'showStepNumbers', false,
      'progressBarStyle', 'steps', 'animationsEnabled', true)
  )
  -- The test shop already has a row (English defaults). Replace texts and style;
  -- image columns are left alone (keeps the uploaded welcome photo).
  ON CONFLICT (business_id) DO UPDATE SET
    welcome_step    = EXCLUDED.welcome_step,
    service_step    = EXCLUDED.service_step,
    duration_step   = EXCLUDED.duration_step,
    specialist_step = EXCLUDED.specialist_step,
    datetime_step   = EXCLUDED.datetime_step,
    details_step    = EXCLUDED.details_step,
    addons_step     = EXCLUDED.addons_step,
    payment_step    = EXCLUDED.payment_step,
    colors          = EXCLUDED.colors,
    typography      = EXCLUDED.typography,
    styling         = EXCLUDED.styling,
    updated_at      = now();

  -- ---------------------------------------------------------------------------
  -- 6. Therapists + working hours (0 = Sunday … 6 = Saturday, JS getDay())
  -- ---------------------------------------------------------------------------
  INSERT INTO public.specialists (business_id, name, bio, is_active)
  VALUES (v_biz, 'Ailadda',
          'Inhaberin von Sadudee Thai Massage. Mit Wärme, Respekt & Sorgfalt verwöhnt sie ihre Gäste seit 2012 mit traditioneller Thai-Massage.',
          true)
  RETURNING id INTO v_ailadda;

  INSERT INTO public.specialists (business_id, name, bio, is_active)
  VALUES (v_biz, 'Nutcharee',
          'Thai-Masseurin mit viel Gefühl für Ihre Wünsche – ob sanft und entspannend oder kräftig und intensiv.',
          true)
  RETURNING id INTO v_nutcharee;

  INSERT INTO public.working_hours (business_id, specialist_id, day_of_week, start_time, end_time, is_available)
  SELECT v_biz, sp.id, h.dow, h.start_t, h.end_t, h.is_open
  FROM (VALUES (v_ailadda), (v_nutcharee)) AS sp(id)
  CROSS JOIN (VALUES
    (0, time '10:00', time '18:00', false),  -- Sonntag geschlossen
    (1, time '10:00', time '20:00', true),
    (2, time '10:00', time '20:00', true),
    (3, time '10:00', time '20:00', true),
    (4, time '10:00', time '20:00', true),
    (5, time '10:00', time '20:00', true),
    (6, time '10:00', time '18:00', true)
  ) AS h(dow, start_t, end_t, is_open);

  -- ---------------------------------------------------------------------------
  -- 7. Services (category = free text; display_order sets category order)
  --    + one service_durations row per duration/price option
  -- ---------------------------------------------------------------------------
  WITH data(ord, category, name, description, mins, cents) AS (
    VALUES
    -- Angebot des Monats
    (1,  'Angebot des Monats', 'Angebot des Monats: Ganzkörpermassage',
         'Unser Angebot des Monats: 60 Minuten Ganzkörpermassage zum Sonderpreis. Gönnen Sie sich die Pause, die Sie verdienen.',
         ARRAY[60], ARRAY[5900]),
    -- Massagen
    (10, 'Massagen', 'Teilkörpermassage',
         'Gezielte Massage für die Bereiche, die Sie sich wünschen – etwa Rücken, Nacken und Schultern. Ideal, wenn Sie wenig Zeit haben.',
         ARRAY[20,30,45,60], ARRAY[2900,3900,5300,6400]),
    (11, 'Massagen', 'Ganzkörpermassage',
         'Traditionelle Thai-Massage für den ganzen Körper mit wohltuenden Dehnungen – sanft oder kräftig, ganz nach Ihrem Wunsch.',
         ARRAY[45,60,90,120], ARRAY[5300,6400,9600,11800]),
    (12, 'Massagen', 'Aromaöl-Massage',
         'Sanfte, fließende Ganzkörpermassage mit warmem, duftendem Aromaöl. Zum Abschalten und Durchatmen.',
         ARRAY[30,45,60,90,120], ARRAY[4200,5600,6700,10000,12800]),
    (13, 'Massagen', 'Fußmassage',
         'Thailändische Fußmassage über ausgewählte Punkte der Fußsohle – eine kleine Auszeit, die Sie vom Kopf bis zu den Füßen spüren.',
         ARRAY[30,45,60], ARRAY[3900,5300,6400]),
    (14, 'Massagen', 'Gesichtsmassage',
         'Sanfte Massage für Gesicht, Kopf und Nacken – entspannend und pflegend zugleich.',
         ARRAY[30,45,60], ARRAY[3900,5300,6400]),
    (15, 'Massagen', 'Schröpfmassage',
         'Massage mit Schröpfgläsern, die ein angenehmes Ziehen auf der Haut erzeugen – besonders beliebt für Rücken und Schultern.',
         ARRAY[30,45,60], ARRAY[3900,5300,6400]),
    (16, 'Massagen', 'Schwangerschaftsmassage',
         'Behutsame Massage in bequemer Lagerung, ganz auf werdende Mütter abgestimmt. Bitte nennen Sie uns bei der Buchung Ihre Schwangerschaftswoche.',
         ARRAY[45,60,90,120], ARRAY[5200,6400,9600,11800]),
    -- Spezialmassagen
    (20, 'Spezialmassagen', 'Hot Stone Massage',
         'Warme Basaltsteine und fließende Massagegriffe schenken Ihnen wohlige Wärme und tiefe Ruhe.',
         ARRAY[45,60,90,120], ARRAY[6000,7500,10800,13800]),
    (21, 'Spezialmassagen', 'Bambus-Massage',
         'Massage mit warmen Bambusstäben – rollende, ausstreichende Bewegungen für ein ganz besonderes Körpergefühl.',
         ARRAY[45,60,90,120], ARRAY[6000,7500,10800,13800]),
    (22, 'Spezialmassagen', 'Kräuterstempel-Massage',
         'Warme, mit thailändischen Kräutern gefüllte Stempel verwöhnen Sie mit Wärme und feinem Duft – ein traditionelles Ritual aus Thailand.',
         ARRAY[60,90,120], ARRAY[7500,10800,13800]),
    (23, 'Spezialmassagen', 'Lomi Lomi Nui Massage',
         'Hawaiianische Massage mit langen, fließenden Bewegungen von Händen und Unterarmen – wie sanfte Wellen, die Sie tragen.',
         ARRAY[60,90,120], ARRAY[7500,10800,13800]),
    (24, 'Spezialmassagen', 'Abhyanga Ayurveda (Ganzkörper)',
         'Ayurvedische Ganzkörpermassage mit reichlich warmem Öl und rhythmischen Streichungen – für tiefe Entspannung von Kopf bis Fuß.',
         ARRAY[60,90,120], ARRAY[7500,10800,13800]),
    -- Wellness-Pakete
    (30, 'Wellness-Pakete', 'Wellness-Paket Basic Harmony',
         'Fußbad, Fußpeeling und Fußmassage, danach eine Ganzkörpermassage mit Aromaöl und eine Gesichtsmassage – Ihr rundum wohltuendes Ritual.',
         ARRAY[60,90,120], ARRAY[7700,11200,14400]),
    (31, 'Wellness-Pakete', 'Wellness-Paket Nature Harmony (Ayurveda)',
         'Wellness-Paket rund um die ayurvedische Ganzkörpermassage mit warmem Öl – ein ganzheitliches Verwöhnprogramm für Körper und Sinne.',
         ARRAY[60,90,120], ARRAY[8500,12800,16000]),
    (32, 'Wellness-Pakete', 'Wellness-Paket Royal Harmony (Hot Stone)',
         'Wellness-Paket rund um die Hot Stone Massage – wohlige Wärme und Ruhe für einen besonderen Moment nur für Sie.',
         ARRAY[60,90,120], ARRAY[8500,12800,16000]),
    (33, 'Wellness-Pakete', 'Wellness-Paket Pure Vitalität (Kräuterstempel)',
         'Wellness-Paket rund um die traditionelle Kräuterstempel-Massage – Wärme, Duft und Entspannung in einem Ritual.',
         ARRAY[60,90,120], ARRAY[8500,12800,16000]),
    -- Extras (also bookable on their own)
    (40, 'Extras', 'Heiße Rolle',
         'Eine heiße Rolle schenkt Rücken und Nacken wohlige Wärme. Im Anschluss an eine Massage für nur 12 € als Extra buchbar.',
         ARRAY[10], ARRAY[1500]),
    (41, 'Extras', 'Warmpackung',
         'Eine wärmende Packung für Rücken und Schultern – die ideale Ergänzung für noch mehr Wohlgefühl.',
         ARRAY[20], ARRAY[2500]),
    (42, 'Extras', 'Rückenpeeling',
         'Sanftes Peeling für eine glatte, gepflegte Haut am Rücken.',
         ARRAY[15], ARRAY[2000]),
    (43, 'Extras', 'Ganzkörperpeeling',
         'Peeling für den ganzen Körper – Ihre Haut fühlt sich danach weich und frisch an. Im Anschluss an eine Massage für nur 32 € als Extra buchbar.',
         ARRAY[30], ARRAY[4900]),
    (44, 'Extras', 'Ganzkörperpeeling mit Packung',
         'Ganzkörperpeeling mit anschließender pflegender Packung. Im Anschluss an eine Massage für nur 35 € als Extra buchbar.',
         ARRAY[45], ARRAY[5300])
  ),
  ins AS (
    INSERT INTO public.services (business_id, name, description, category, display_order, is_pair_massage, is_hidden)
    SELECT v_biz, d.name, d.description, d.category, d.ord, false, false
    FROM data d
    ORDER BY d.ord
    RETURNING id, name
  )
  INSERT INTO public.service_durations (business_id, service_id, duration_minutes, price_cents)
  SELECT v_biz, ins.id, x.minutes, x.price_cents
  FROM ins
  JOIN data d ON d.name = ins.name
  CROSS JOIN LATERAL unnest(d.mins, d.cents) AS x(minutes, price_cents);

  -- Both therapists do every treatment
  INSERT INTO public.specialist_services (business_id, specialist_id, service_id)
  SELECT v_biz, sp.id, s.id
  FROM public.specialists sp
  JOIN public.services s ON s.business_id = v_biz
  WHERE sp.business_id = v_biz;

  -- ---------------------------------------------------------------------------
  -- 8. Add-ons (booking step "Noch etwas dazu?")
  --    ASSUMPTION: 12/32/35 € = Heiße Rolle / Ganzkörperpeeling / mit Packung.
  --    NOTE: add-ons carry a price only – they do NOT extend the booked time.
  -- ---------------------------------------------------------------------------
  WITH prod(ord, category, name, description, cents, exclusive, targets) AS (
    VALUES
    (1, 'Im Anschluss an Ihre Massage', 'Heiße Rolle (im Anschluss)',
        'Wohlige Wärme für Rücken und Nacken direkt nach Ihrer Massage – ca. 10 Minuten.',
        1200, false, ARRAY['Angebot des Monats','Massagen','Spezialmassagen']),
    (2, 'Peeling im Anschluss', 'Ganzkörperpeeling (im Anschluss)',
        'Ganzkörperpeeling direkt nach Ihrer Massage – ca. 30 Minuten. Ihre Haut fühlt sich danach weich und frisch an.',
        3200, true, ARRAY['Angebot des Monats','Massagen','Spezialmassagen']),
    (3, 'Peeling im Anschluss', 'Ganzkörperpeeling mit Packung (im Anschluss)',
        'Ganzkörperpeeling mit pflegender Packung direkt nach Ihrer Massage – ca. 45 Minuten.',
        3500, true, ARRAY['Angebot des Monats','Massagen','Spezialmassagen']),
    (4, 'Für Paare', 'Zeit zu Zweit – Romantik-Programm für Paare',
        'Genießen Sie Ihre Auszeit gemeinsam: unser Romantik-Programm für Paare (30 Minuten). Bitte buchen Sie für jede Person einen Termin zur gleichen Uhrzeit.',
        1600, false, ARRAY['Angebot des Monats','Massagen','Spezialmassagen','Wellness-Pakete'])
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

  -- ---------------------------------------------------------------------------
  -- 9. Gift cards: 49 / 62 / 92 / 114 €, valid 3 years, e-mail delivery.
  --    No online payment is configured yet -> pay_in_store_enabled keeps the
  --    gift card page selling (GiftCardPurchase canSell needs a pay option).
  -- ---------------------------------------------------------------------------
  --    design_url (the test shop's uploaded gift card design) is kept.
  INSERT INTO public.gift_card_settings (
    business_id, enabled, preset_amounts_cents, allow_custom_amount,
    min_custom_amount_cents, max_custom_amount_cents, expiry_days,
    code_format, pay_in_store_enabled, terms_and_conditions
  ) VALUES (
    v_biz, true, ARRAY[4900, 6200, 9200, 11400], true,
    1000, 100000, 1095,
    'alphanumeric_6', true,
'Gutscheinbedingungen:

• Der Gutschein ist 3 Jahre ab Kaufdatum gültig.
• Er kann für alle Behandlungen bei Sadudee Thai Massage in Heide eingelöst werden.
• Eine Barauszahlung ist nicht möglich.
• Bitte nennen Sie den Gutscheincode bei der Buchung oder geben Sie ihn bei der Online-Buchung ein.
• Restbeträge bleiben auf dem Gutschein erhalten.'
  )
  ON CONFLICT (business_id) DO UPDATE SET
    enabled                 = EXCLUDED.enabled,
    preset_amounts_cents    = EXCLUDED.preset_amounts_cents,
    allow_custom_amount     = EXCLUDED.allow_custom_amount,
    min_custom_amount_cents = EXCLUDED.min_custom_amount_cents,
    max_custom_amount_cents = EXCLUDED.max_custom_amount_cents,
    expiry_days             = EXCLUDED.expiry_days,
    code_format             = EXCLUDED.code_format,
    pay_in_store_enabled    = EXCLUDED.pay_in_store_enabled,
    terms_and_conditions    = EXCLUDED.terms_and_conditions,
    updated_at              = now();

  -- Void the 4 test gift cards from 2025-12-13 (kept for history, not deleted).
  UPDATE public.gift_cards
     SET status = 'cancelled', updated_at = now()
   WHERE business_id = v_biz
     AND code IN ('EDYS-JYZS-HMEZ-258A', 'NR34-PYEU-QUQD-BKU2', 'G5YN-6AT4-TDLL-T5GJ', 'QQHX-PKTR-HPFL-8CYS')
     AND status <> 'cancelled';

  -- E-mail templates. The test shop has the English system-default booking
  -- templates, which would override the built-in German booking e-mails:
  -- remove them, then (re)create the two gift card templates.
  DELETE FROM public.email_templates
   WHERE business_id = v_biz
     AND (   (event_key IN ('booking_confirmation', 'booking_cancelled') AND is_system_default)
          OR event_key IN ('gift_card_purchased', 'gift_card_received'));

  -- Gift card e-mails (send-business-email requires a per-shop template; booking
  -- e-mails use the built-in German templates).
  INSERT INTO public.email_templates (business_id, name, event_key, subject, body, variables, is_enabled, is_system_default)
  VALUES
  (v_biz, 'Gutschein gekauft', 'gift_card_purchased',
   'Ihr Gutschein von Sadudee Thai Massage',
   $tpl$<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F6F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F4;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E5E2DD;border-top:4px solid #B8302C;border-radius:16px;">
<tr><td style="padding:32px 32px 8px;text-align:center;font-family:Georgia,'Times New Roman',serif;color:#B8302C;letter-spacing:4px;font-size:16px;">SADUDEE THAI MASSAGE</td></tr>
<tr><td style="padding:0 32px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#A8862A;letter-spacing:3px;font-size:10px;">MIT WÄRME, RESPEKT &amp; SORGFALT SEIT 2012</td></tr>
<tr><td style="padding:28px 32px 4px;font-family:Georgia,'Times New Roman',serif;color:#2B2B2B;font-size:24px;line-height:1.3;">Vielen Dank für Ihren Gutscheinkauf</td></tr>
<tr><td style="padding:8px 32px 0;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:15px;line-height:1.6;">Guten Tag {{customer_name}},<br>vielen Dank! Im Anhang finden Sie Ihren Gutschein zum Ausdrucken oder Weiterleiten.</td></tr>
<tr><td style="padding:20px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F4;border-radius:12px;">
<tr><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666666;width:38%;vertical-align:top;">Gutschein</td><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2B2B2B;font-weight:bold;">{{amount}}</td></tr>
<tr><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666666;width:38%;vertical-align:top;">Code</td><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2B2B2B;font-weight:bold;"><span style="font-family:Courier New,monospace;letter-spacing:2px;">{{gift_card_code}}</span></td></tr>
<tr><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666666;width:38%;vertical-align:top;">Gültigkeit</td><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2B2B2B;font-weight:bold;">3 Jahre ab Kaufdatum</td></tr>
</table></td></tr>
<tr><td style="padding:8px 32px 28px;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:15px;line-height:1.6;">Wir freuen uns auf Sie.<br>Ihr Team von {{business_name}}</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #E5E2DD;font-family:Arial,Helvetica,sans-serif;color:#999999;font-size:12px;line-height:1.6;text-align:center;">{{business_name}} · {{business_address}}<br>{{business_phone}}</td></tr>
</table></td></tr></table></body></html>$tpl$,
   '["customer_name", "amount", "gift_card_code", "business_name", "business_address", "business_phone"]'::jsonb,
   true, false),
  (v_biz, 'Gutschein erhalten', 'gift_card_received',
   '{{sender_name}} schenkt Ihnen eine Auszeit bei Sadudee Thai Massage',
   $tpl$<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F7F6F4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F4;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E5E2DD;border-top:4px solid #B8302C;border-radius:16px;">
<tr><td style="padding:32px 32px 8px;text-align:center;font-family:Georgia,'Times New Roman',serif;color:#B8302C;letter-spacing:4px;font-size:16px;">SADUDEE THAI MASSAGE</td></tr>
<tr><td style="padding:0 32px;text-align:center;font-family:Arial,Helvetica,sans-serif;color:#A8862A;letter-spacing:3px;font-size:10px;">MIT WÄRME, RESPEKT &amp; SORGFALT SEIT 2012</td></tr>
<tr><td style="padding:28px 32px 4px;font-family:Georgia,'Times New Roman',serif;color:#2B2B2B;font-size:24px;line-height:1.3;">Ein Gutschein für Sie</td></tr>
<tr><td style="padding:8px 32px 0;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:15px;line-height:1.6;">Guten Tag,<br><strong>{{sender_name}}</strong> schenkt Ihnen eine Auszeit bei {{business_name}} – weil Sie mehr verdienen als nur eine Pause.</td></tr>
<tr><td style="padding:20px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F6F4;border-radius:12px;">
<tr><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666666;width:38%;vertical-align:top;">Gutschein</td><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2B2B2B;font-weight:bold;">{{amount}}</td></tr>
<tr><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666666;width:38%;vertical-align:top;">Code</td><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2B2B2B;font-weight:bold;"><span style="font-family:Courier New,monospace;letter-spacing:2px;">{{gift_card_code}}</span></td></tr>
<tr><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#666666;width:38%;vertical-align:top;">Nachricht</td><td style="padding:10px 18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#2B2B2B;font-weight:bold;">{{message}}</td></tr>
</table></td></tr>
<tr><td style="padding:0 32px 16px;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:13px;line-height:1.6;">So lösen Sie ihn ein: Buchen Sie Ihren Termin online und geben Sie den Code im letzten Schritt ein, oder nennen Sie ihn uns telefonisch unter 0481 78778000. Der Gutschein ist 3 Jahre ab Kaufdatum gültig.</td></tr>
<tr><td style="padding:8px 32px 28px;font-family:Arial,Helvetica,sans-serif;color:#666666;font-size:15px;line-height:1.6;">Wir freuen uns auf Sie.<br>Ihr Team von {{business_name}}</td></tr>
<tr><td style="padding:16px 32px 28px;border-top:1px solid #E5E2DD;font-family:Arial,Helvetica,sans-serif;color:#999999;font-size:12px;line-height:1.6;text-align:center;">{{business_name}} · {{business_address}}<br>{{business_phone}}</td></tr>
</table></td></tr></table></body></html>$tpl$,
   '["sender_name", "amount", "gift_card_code", "message", "business_name", "business_address", "business_phone"]'::jsonb,
   true, false);

  -- ---------------------------------------------------------------------------
  -- 10. AI receptionist: row present (both reference shops have one), switched OFF
  -- ---------------------------------------------------------------------------
  INSERT INTO public.receptionist_settings (
    business_id, is_enabled, assistant_name, address_form,
    web_enabled, email_enabled, whatsapp_enabled, knowledge, playbook
  ) VALUES (
    v_biz, false, '', 'sie',
    true, false, false,
    'Website: https://www.sadudeeheide.de · Instagram und Facebook: @sadudeeheide.',
    jsonb_build_object(
      'personality', 'warm',
      'emoji', 'mirror',
      'length', 'short',
      'initiative', 'guide',
      'habits', jsonb_build_array('introduce_self', 'ask_needs_first', 'offer_alternatives', 'suggest_gift'),
      'briefing',
'Du bist die herzliche Stimme von Sadudee Thai Massage in der Süderstraße 1A in 25746 Heide. Seit 2012 empfangen wir unsere Gäste mit Wärme, Respekt und Sorgfalt – unser Leitsatz: „Weil Sie mehr verdienen als nur eine Pause.“ Wir siezen unsere Gäste und sprechen ruhig, freundlich und einladend. Geöffnet ist Montag bis Freitag von 10 bis 20 Uhr und Samstag von 10 bis 18 Uhr, sonntags ist geschlossen. Unsere Therapeutinnen sind Ailadda (Inhaberin) und Nutcharee. Wir sind spezialisiert auf traditionelle Thai-Massage, dazu Aromaöl-, Hot-Stone-, Bambus-, Kräuterstempel-, Lomi-Lomi- und ayurvedische Abhyanga-Massagen sowie Wellness-Pakete. Gutscheine gibt es ab 49 € – sie sind 3 Jahre gültig und werden per E-Mail verschickt; sie sind ein schönes Geschenk für Geburtstage und besondere Anlässe. Bei Fragen erreichen Gäste uns telefonisch unter 0481 78778000. Versprich niemals Heilwirkungen.')
  )
  ON CONFLICT (business_id) DO UPDATE SET
    is_enabled       = EXCLUDED.is_enabled,
    assistant_name   = EXCLUDED.assistant_name,
    address_form     = EXCLUDED.address_form,
    web_enabled      = EXCLUDED.web_enabled,
    email_enabled    = EXCLUDED.email_enabled,
    whatsapp_enabled = EXCLUDED.whatsapp_enabled,
    knowledge        = EXCLUDED.knowledge,
    playbook         = EXCLUDED.playbook,
    updated_at       = now();

  RAISE NOTICE 'Sadudee Thai Massage converted: business_id=%, permalink=sadudee', v_biz;
END
$setup$;

COMMIT;
