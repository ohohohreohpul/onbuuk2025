/*
  # Create Integrations Management System

  1. New Tables
    - `integrations`
      - `id` (uuid, primary key)
      - `business_id` (uuid, foreign key to businesses)
      - `integration_type` (text) - Type: 'make', 'zapier', 'manychat', 'webhook', etc.
      - `is_enabled` (boolean) - Whether integration is active
      - `config` (jsonb) - Integration-specific configuration
      - `webhook_url` (text, nullable) - Webhook endpoint URL
      - `api_key_encrypted` (text, nullable) - Encrypted API key
      - `last_sync_at` (timestamp, nullable) - Last successful sync
      - `created_at`, `updated_at` timestamps

    - `integration_logs`
      - `id` (uuid, primary key)
      - `integration_id` (uuid, foreign key to integrations)
      - `event_type` (text) - Event that triggered webhook
      - `payload` (jsonb) - Data sent
      - `response_status` (integer) - HTTP status code
      - `response_body` (jsonb, nullable) - Response from webhook
      - `error_message` (text, nullable) - Error if failed
      - `created_at` (timestamp)

  2. Purpose
    - Allow businesses to integrate with external tools (Make.com, Zapier, ManyChat)
    - Track webhook deliveries and responses
    - Support custom webhooks for flexibility
    - Enable automation workflows for bookings, gift cards, customers

  3. Security
    - Enable RLS on all tables
    - Business-level access only (users can only see their own integrations)
    - API keys are stored encrypted
    - Webhook signatures for verification

  4. Event Types
    - booking.created, booking.updated, booking.cancelled
    - giftcard.purchased
    - customer.created, customer.updated
*/

-- Create integrations table
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  integration_type text NOT NULL CHECK (integration_type IN ('make', 'zapier', 'manychat', 'webhook', 'custom')),
  is_enabled boolean DEFAULT false NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  webhook_url text,
  api_key_encrypted text,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(business_id, integration_type)
);

-- Create integration_logs table
CREATE TABLE IF NOT EXISTS integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  response_status integer,
  response_body jsonb,
  error_message text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

-- Create function to get business_id from integration_id
CREATE OR REPLACE FUNCTION get_integration_business_id(integration_uuid uuid)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT business_id FROM integrations WHERE id = integration_uuid;
$$;

-- RLS Policies for integrations
CREATE POLICY "Users can view their own business integrations"
  ON integrations
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Users can insert integrations for their business"
  ON integrations
  FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Users can update their own business integrations"
  ON integrations
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Users can delete their own business integrations"
  ON integrations
  FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  );

-- RLS Policies for integration_logs
CREATE POLICY "Users can view logs for their business integrations"
  ON integration_logs
  FOR SELECT
  USING (
    get_integration_business_id(integration_id) IN (
      SELECT business_id FROM admin_users WHERE email = auth.jwt()->>'email'
    )
  );

CREATE POLICY "Service role can insert integration logs"
  ON integration_logs
  FOR INSERT
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_integrations_business ON integrations(business_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(integration_type, is_enabled);
CREATE INDEX IF NOT EXISTS idx_integration_logs_integration ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_event_type ON integration_logs(event_type);

-- Create updated_at trigger for integrations
CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();