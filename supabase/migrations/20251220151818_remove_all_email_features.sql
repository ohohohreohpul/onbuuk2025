/*
  # Remove All Email Features

  This migration completely removes all email-related functionality from the system to start fresh.

  1. Dropped Tables
    - `business_email_events` - Business email event definitions
    - `business_email_logs` - Business email sending logs
    - `business_email_settings` - Business email provider settings
    - `business_email_templates` - Business email templates
    - `email_settings` - Legacy email settings
    - `platform_email_events` - Platform email event definitions
    - `platform_email_logs` - Platform email sending logs
    - `platform_email_settings` - Platform email provider settings
    - `platform_email_templates` - Platform email templates

  2. Cleanup
    - All associated RLS policies
    - All triggers and functions related to emails
    - All indexes on email tables

  Note: This is a clean slate operation. All email configuration and logs will be permanently deleted.
*/

-- Drop all email-related tables (CASCADE removes all dependent objects)
DROP TABLE IF EXISTS business_email_logs CASCADE;
DROP TABLE IF EXISTS business_email_templates CASCADE;
DROP TABLE IF EXISTS business_email_events CASCADE;
DROP TABLE IF EXISTS business_email_settings CASCADE;
DROP TABLE IF EXISTS email_settings CASCADE;
DROP TABLE IF EXISTS platform_email_logs CASCADE;
DROP TABLE IF EXISTS platform_email_templates CASCADE;
DROP TABLE IF EXISTS platform_email_events CASCADE;
DROP TABLE IF EXISTS platform_email_settings CASCADE;

-- Drop any email-related functions
DROP FUNCTION IF EXISTS ensure_business_email_system() CASCADE;
DROP FUNCTION IF EXISTS create_default_business_email_templates() CASCADE;
DROP FUNCTION IF EXISTS create_default_platform_email_templates() CASCADE;