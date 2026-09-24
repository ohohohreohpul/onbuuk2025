-- Tax & reporting module: cash register entries, cross-source revenue imports
-- (Treatwell Pro / Planity Pro CSV exports), and generated tax documents.

-- Cash register journal entries (manual + imported)
CREATE TABLE IF NOT EXISTS cash_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  entry_date date NOT NULL,
  entry_time time,
  description text NOT NULL,
  source text NOT NULL DEFAULT 'manual',            -- manual | booking | treatwell | planity | import
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  payment_method text NOT NULL DEFAULT 'cash',      -- cash | card | online | gift_card | other
  net_cents integer NOT NULL DEFAULT 0,             -- excl. USt
  vat_rate_bps integer NOT NULL DEFAULT 0,          -- 1900 = 19%, 0 = Kleinunternehmer §19
  gross_cents integer NOT NULL DEFAULT 0,           -- incl. USt
  import_batch_id uuid,
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_entries_business_date ON cash_entries(business_id, entry_date desc);
ALTER TABLE cash_entries ENABLE ROW LEVEL SECURITY;

-- Import batches from external booking platforms (Treatwell Pro / Planity Pro CSV exports)
CREATE TABLE IF NOT EXISTS revenue_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  filename text NOT NULL,
  source text NOT NULL DEFAULT 'unknown',           -- treatwell | planity | generic
  row_count integer NOT NULL DEFAULT 0,
  imported_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  column_mapping jsonb,
  status text NOT NULL DEFAULT 'completed',         -- completed | failed
  imported_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE revenue_imports ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_revenue_imports_business ON revenue_imports(business_id, created_at desc);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cash_import_batch') THEN
    ALTER TABLE cash_entries ADD CONSTRAINT fk_cash_import_batch FOREIGN KEY (import_batch_id) REFERENCES revenue_imports(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Generated tax documents (EÜR summary, DATEV export, month-end report)
CREATE TABLE IF NOT EXISTS tax_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  document_type text NOT NULL,                      -- euer_summary | datev_export | month_report
  file_name text NOT NULL,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,        -- {gross, net, vat19, vat7, bookings, cash, card, imports}
  storage_path text,
  generated_by uuid,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tax_documents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_tax_documents_business ON tax_documents(business_id, period_end desc);

-- RLS: scoped to the caller's business, same pattern as the rest of the app
DO $pol$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cash_entries', 'revenue_imports', 'tax_documents'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admins can view own business %1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "Admins can view own business %1$s" ON %1$s FOR SELECT TO authenticated USING (business_id = get_admin_business_id())', t);
    EXECUTE format('DROP POLICY IF EXISTS "Admins can manage own business %1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "Admins can manage own business %1$s" ON %1$s FOR ALL TO authenticated USING (business_id = get_admin_business_id()) WITH CHECK (business_id = get_admin_business_id())', t);
    EXECUTE format('DROP POLICY IF EXISTS "Super admins can manage all %1$s" ON %1$s', t);
    EXECUTE format('CREATE POLICY "Super admins can manage all %1$s" ON %1$s FOR ALL TO authenticated USING (is_super_admin())', t);
  END LOOP;
END $pol$;
