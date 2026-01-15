# Booking & E-Commerce Application - PRD

## Original Problem Statement
Build a full-stack booking and e-commerce application with:
- PayPal integration alongside existing Stripe
- Gift card management with email capabilities
- PDF attachment for gift card emails
- Currency settings management
- Business permalink pages

## Tech Stack
- **Frontend**: Vite, React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions in Deno)
- **Payments**: Stripe API, PayPal Checkout SDK
- **Email**: Resend/SendGrid/Mailgun via custom Supabase functions

## What's Been Implemented

### January 15, 2026
- ✅ **PDF Attachment Feature Completed**
  - Updated `send-business-email/index.ts` to accept and forward attachments
  - Deployed `generate-gift-card-pdf` function (server-side PDF generation)
  - Deployed `send-business-email` function (with attachment support)
  - Deployed `send-customer-email` function (already had attachment support)

### Previous Session (from Handoff)
- ✅ PayPal Integration scaffolding (create-paypal-order, capture-paypal-order)
- ✅ Stripe secret key bug fix (key parsing in create-checkout-session)
- ✅ Currency fallback bug fix (currencyContext.tsx)
- ✅ Permalink 404 bug fix (App.tsx resilience improvements)
- ✅ Gift card management enhancements (buyer email, resend emails)
- ✅ Gift card form validation (all fields required)
- ✅ Email template editor improvements

## Pending User Verification
1. **PayPal payment flow** - Fix deployed for `INVALID_STRING_LENGTH` error
2. **Stripe checkout flow** - Fix deployed for API key parsing issue
3. **PDF attachment emails** - Now complete, ready for testing

## Key Files
- `/app/supabase/functions/generate-gift-card-pdf/index.ts` - Server-side PDF generation
- `/app/supabase/functions/send-business-email/index.ts` - Business email with attachments
- `/app/supabase/functions/send-customer-email/index.ts` - Customer email sender
- `/app/src/components/admin/GiftCardDetailModal.tsx` - Gift card management UI

## Database Schema (Key Tables)
- `bookings` - includes `paypal_order_id`
- `gift_cards` - includes `paypal_order_id`, `purchased_by_email`
- `site_settings` - key/value store for business settings
- `email_templates` - customizable email templates
- `paypal_temp_orders` - temporary storage for PayPal metadata

## Supabase Project
- **Project Ref**: `eicxhwgxelwcmxcjppwt`
- **Dashboard**: https://supabase.com/dashboard/project/eicxhwgxelwcmxcjppwt/functions

## Future/Backlog Tasks
- Refactor client-side PDF generator to use server-side function for consistency
- Additional payment provider integrations if needed
