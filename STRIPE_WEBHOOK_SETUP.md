# Stripe Webhook Setup Guide

This guide explains how to fix the gift card error by properly configuring Stripe webhooks.

## The Problem

Gift card purchases fail because the Stripe webhook can't verify payment events. When users pay for gift cards, Stripe charges them successfully, but the webhook verification fails, so gift cards never get created in your database.

## The Solution

Configure platform-level webhook secrets in Supabase Edge Functions.

---

## Step 1: Configure Supabase Edge Function Secrets

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: **eicxhwgxelwcmxcjppwt**
3. Navigate to **Edge Functions** in the left sidebar
4. Click on **Manage Secrets** or **Environment Variables**
5. Add the following secrets:

### Required Secrets:

#### STRIPE_SECRET_KEY
- **Name:** `STRIPE_SECRET_KEY`
- **Value:** Your Stripe Secret Key (starts with `sk_test_` or `sk_live_`)
- **Where to find it:** [Stripe Dashboard → Developers → API keys](https://dashboard.stripe.com/apikeys)

#### STRIPE_WEBHOOK_SECRET
- **Name:** `STRIPE_WEBHOOK_SECRET`
- **Value:** Your Stripe Webhook Signing Secret (starts with `whsec_`)
- **Where to find it:** Follow Step 2 below to get this

---

## Step 2: Set Up Stripe Webhook Endpoint

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click **Add endpoint** or **+ Add an endpoint**
3. Enter your webhook URL:
   ```
   https://eicxhwgxelwcmxcjppwt.supabase.co/functions/v1/stripe-webhook
   ```
4. Click **Select events** and add these events:
   - `checkout.session.completed` (REQUIRED - for gift cards and bookings)
   - `payment_intent.succeeded`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `account.updated` (for Stripe Connect)
   - `account.application.authorized` (for Stripe Connect)
   - `account.application.deauthorized` (for Stripe Connect)

5. Click **Add endpoint**
6. After creating the endpoint, click on it to view details
7. Click **Reveal** next to "Signing secret"
8. Copy the webhook signing secret (starts with `whsec_`)
9. Go back to Supabase and add this as the `STRIPE_WEBHOOK_SECRET`

---

## Step 3: Verify Configuration

### Test the webhook:

1. In Stripe Dashboard, go to your webhook endpoint
2. Click **Send test webhook**
3. Select `checkout.session.completed` event
4. Click **Send test webhook**
5. Check the response - it should return `200 OK`

### Test gift card purchase:

1. Go to your booking site
2. Navigate to gift card purchase page
3. Enter gift card details:
   - Amount: Any amount (e.g., €50)
   - Recipient email (optional)
   - Personal message (optional)
4. Complete the purchase using Stripe test card: `4242 4242 4242 4242`
5. Check your Supabase database:
   ```sql
   SELECT * FROM gift_cards ORDER BY created_at DESC LIMIT 5;
   ```
6. You should see the newly created gift card

---

## How It Works

### Purchase Flow:
1. **User purchases gift card** → Frontend calls `create-checkout-session` edge function
2. **Checkout session created** → Uses business's Stripe settings to create Stripe checkout
3. **User pays** → Stripe processes payment
4. **Webhook triggered** → Stripe sends `checkout.session.completed` event to your webhook
5. **Webhook verified** → Edge function verifies signature using `STRIPE_WEBHOOK_SECRET`
6. **Gift card created** → Edge function creates gift card in database
7. **Email sent** → Recipient receives gift card email (if applicable)

### Webhook Verification:
- Stripe signs every webhook with your webhook secret
- The edge function verifies this signature before processing
- This prevents unauthorized/fake webhook calls
- Without proper verification, webhooks fail and gift cards aren't created

---

## Troubleshooting

### Webhook fails with "signature verification failed"
- Check that `STRIPE_WEBHOOK_SECRET` is correctly set in Supabase
- Make sure you copied the full signing secret from Stripe (including `whsec_` prefix)
- Verify the webhook URL in Stripe matches exactly: `https://eicxhwgxelwcmxcjppwt.supabase.co/functions/v1/stripe-webhook`

### Gift cards still not created after payment
- Check Stripe webhook logs: [Stripe Dashboard → Developers → Webhooks → Your endpoint → Logs]
- Check Supabase Edge Function logs: [Supabase Dashboard → Edge Functions → stripe-webhook → Logs]
- Verify `checkout.session.completed` event is enabled in webhook settings
- Check that metadata includes `type: 'gift_card_new'` in checkout session

### How to view logs:

**Supabase Logs:**
```bash
# In Supabase Dashboard:
Edge Functions → stripe-webhook → Logs tab
```

**Stripe Logs:**
```bash
# In Stripe Dashboard:
Developers → Webhooks → [Your endpoint] → Logs tab
```

---

## Security Notes

- **Never commit** `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` to your repository
- These secrets are stored securely in Supabase Edge Functions environment
- Each business can still have their own Stripe account keys in the database
- The webhook secret is platform-wide and used only for signature verification
- After verification, events are routed to the correct business based on metadata

---

## Multiple Businesses

This webhook setup works for multi-tenant systems:

1. **One webhook endpoint** serves all businesses
2. **Signature verification** uses the platform secret
3. **Event routing** uses `business_id` from checkout session metadata
4. **Each business** can have their own Stripe API keys in the database
5. **Payments are processed** using business-specific keys
6. **Webhook verification** uses the shared platform secret

This is the standard approach for multi-tenant SaaS platforms using Stripe.

### Business-Specific Stripe Keys

Each business can configure their own Stripe API keys in the admin panel:

1. **Admin Panel** → **Settings** → **Payment Settings**
2. Enter your Stripe Secret Key (starts with `sk_test_` or `sk_live_`)
3. Enter your Stripe Publishable Key (starts with `pk_test_` or `pk_live_`)

**Important Notes:**
- If a business has their own keys configured, those keys are used for creating checkout sessions
- The webhook still uses platform-level keys for signature verification
- After verification, the webhook retrieves the business-specific keys to process the payment
- This allows each business to receive payments directly to their own Stripe account

---

## Need Help?

If you're still experiencing issues after following this guide:

1. Check Supabase Edge Function logs
2. Check Stripe webhook logs
3. Verify all secrets are correctly configured
4. Test with a small gift card purchase (€1-5)
5. Look for specific error messages in the logs
