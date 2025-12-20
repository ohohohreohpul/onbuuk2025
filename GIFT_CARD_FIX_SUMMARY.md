# Gift Card Error - Fix Summary

## The Problem

Gift card purchases were failing because:
1. Customers completed payment successfully in Stripe
2. But Stripe's webhook couldn't verify the payment event
3. So the gift card never got created in your database
4. Customers paid but received no gift card

## Root Cause

The webhook verification was failing because the `STRIPE_WEBHOOK_SECRET` environment variable wasn't configured in Supabase Edge Functions. Without this secret, the webhook can't verify that payment events actually came from Stripe.

## The Solution

Your webhook code is already correctly written. You just need to configure two environment variables in Supabase:

### Required Configuration:

1. **STRIPE_SECRET_KEY** - Your Stripe API secret key (starts with `sk_`)
2. **STRIPE_WEBHOOK_SECRET** - Your Stripe webhook signing secret (starts with `whsec_`)

## What I Did

### 1. Created Comprehensive Setup Guide
Created `STRIPE_WEBHOOK_SETUP.md` with:
- Step-by-step instructions for configuring Supabase secrets
- How to set up the webhook endpoint in Stripe
- Testing instructions
- Troubleshooting tips
- Security best practices

### 2. Updated USER_GUIDE.md
Added warnings and references to webhook setup in:
- Payment Settings section (line 754-768)
- Gift Cards section (line 926-939)
- Troubleshooting section (line 1867-1884)

### 3. Verified Code
Confirmed that:
- Webhook function is correctly implemented
- Gift card creation logic is working
- RLS policies allow gift card inserts
- Frontend sends all required data

## What You Need to Do

### Step 1: Configure Supabase Secrets

1. Go to: https://supabase.com/dashboard
2. Select your project: **eicxhwgxelwcmxcjppwt**
3. Navigate to: **Edge Functions** → **Manage Secrets**
4. Add these two secrets:
   - `STRIPE_SECRET_KEY` = Your Stripe secret key
   - `STRIPE_WEBHOOK_SECRET` = Your Stripe webhook secret (get this in Step 2)

### Step 2: Configure Stripe Webhook

1. Go to: https://dashboard.stripe.com/webhooks
2. Click: **Add endpoint**
3. Enter URL:
   ```
   https://eicxhwgxelwcmxcjppwt.supabase.co/functions/v1/stripe-webhook
   ```
4. Select events to listen for:
   - `checkout.session.completed` (REQUIRED)
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `account.updated`
   - `account.application.authorized`
   - `account.application.deauthorized`
5. Click: **Add endpoint**
6. Click on your new endpoint to view details
7. Click: **Reveal** next to "Signing secret"
8. Copy the webhook secret (starts with `whsec_`)
9. Go back to Supabase and add this as `STRIPE_WEBHOOK_SECRET`

### Step 3: Test Gift Card Purchase

1. Go to your booking site's gift card page
2. Select an amount (or enter a custom amount)
3. Enter recipient email (optional)
4. Enter your details
5. Click "Continue to Payment"
6. Use Stripe test card: `4242 4242 4242 4242`
7. Complete the purchase
8. Check your database:
   ```sql
   SELECT * FROM gift_cards ORDER BY created_at DESC LIMIT 5;
   ```
9. You should see the newly created gift card!

## Verification

After configuration, verify webhooks are working:

### Check Stripe Logs:
- Stripe Dashboard → Developers → Webhooks → [Your endpoint] → Logs
- Look for successful `200 OK` responses

### Check Supabase Logs:
- Supabase Dashboard → Edge Functions → stripe-webhook → Logs
- Look for "Successfully created gift card" messages

## Architecture Notes

### Why Platform-Level Secrets?

This is a multi-tenant system where:
- Multiple businesses use the same platform
- Each business can have their own Stripe keys
- But webhooks must verify signatures BEFORE knowing which business

Therefore:
- **Checkout** uses business-specific Stripe keys from the database
- **Webhooks** use platform-level secrets for signature verification
- After verification, events are routed to the correct business via metadata

This is the standard approach for multi-tenant SaaS platforms using Stripe.

## Files Modified

1. **STRIPE_WEBHOOK_SETUP.md** (NEW)
   - Complete webhook setup guide
   - Troubleshooting tips
   - Security best practices

2. **USER_GUIDE.md** (UPDATED)
   - Added webhook configuration section
   - Added gift card prerequisites warning
   - Added troubleshooting entry for gift card errors

3. **GIFT_CARD_FIX_SUMMARY.md** (NEW - this file)
   - Quick reference for the fix

## No Code Changes Required

The webhook function (`stripe-webhook/index.ts`) was already correctly implemented. It just needs the environment variables configured in Supabase. No code changes were necessary.

## Need Help?

If you're still experiencing issues:
1. Check Supabase Edge Function logs for errors
2. Check Stripe webhook logs for delivery failures
3. Verify both secrets are correctly configured
4. Test with a small amount first (€1-5)
5. Review the complete setup guide: `STRIPE_WEBHOOK_SETUP.md`

---

## Quick Commands

### Check if secrets are set (run in Supabase SQL Editor):
```sql
-- This won't show the values, just verify gift cards table exists
SELECT COUNT(*) FROM gift_cards;
```

### View recent gift card attempts:
```sql
SELECT * FROM gift_cards
ORDER BY created_at DESC
LIMIT 10;
```

### Check webhook logs in Stripe:
Visit: https://dashboard.stripe.com/webhooks → [Your endpoint] → Logs
