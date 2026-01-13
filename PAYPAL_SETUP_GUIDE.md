# PayPal Integration Setup Guide

This guide explains how to set up PayPal as a payment method for your booking application.

## Overview

PayPal has been added as an alternative payment method alongside Stripe. Businesses can enable PayPal in their Payment Settings to allow customers to pay via:
- PayPal balance
- Linked bank accounts
- Credit/Debit cards through PayPal
- Pay Later options

## How It Works

1. **Business Setup**: Each business enters their own PayPal API credentials in the admin panel
2. **Customer Checkout**: Customers can choose between Stripe and PayPal at checkout
3. **Payment Processing**: PayPal payments are processed through PayPal's checkout flow
4. **Order Capture**: After approval, payments are captured via Supabase Edge Functions

## Setup Instructions

### Step 1: Create PayPal Business Account

If you don't have a PayPal Business account:
1. Go to [PayPal Business](https://www.paypal.com/business)
2. Click "Sign Up"
3. Complete the registration process

### Step 2: Get API Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/applications/live)
2. Log in with your PayPal Business account
3. Click on **Apps & Credentials**
4. Click **Create App** under **Live** section (not Sandbox)
5. Enter an app name (e.g., "My Booking App")
6. Click **Create App**
7. Copy the **Client ID** and **Secret**

### Step 3: Configure in Admin Panel

1. Log in to your business admin panel
2. Go to **Settings** → **Payment Settings**
3. Scroll to the **PayPal Payments** section
4. Enable PayPal Payments toggle
5. Enter your PayPal Client ID
6. Enter your PayPal Secret Key
7. Click **Save Payment Settings**

### Step 4: Deploy Supabase Edge Functions

The following Edge Functions need to be deployed to your Supabase project:

#### create-paypal-order
Handles creating PayPal orders when customers initiate payment.

```bash
supabase functions deploy create-paypal-order
```

#### capture-paypal-order
Captures the payment after customer approves on PayPal.

```bash
supabase functions deploy capture-paypal-order
```

### Step 5: Database Migration

Run the migration to add PayPal order ID columns:

```sql
-- Add to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

-- Add to gift_cards table
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bookings_paypal_order_id ON bookings(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gift_cards_paypal_order_id ON gift_cards(paypal_order_id) WHERE paypal_order_id IS NOT NULL;
```

## Customer Experience

### Booking Flow
1. Customer completes booking details
2. On Payment step, they see payment method options:
   - **Pay with Card** (Stripe)
   - **Pay with PayPal** (if enabled)
   - **Pay in Person** (if enabled)
3. If PayPal is selected, they click "Confirm & Pay"
4. PayPal buttons appear
5. Customer clicks PayPal button and completes payment in PayPal popup
6. Booking is confirmed upon successful payment

### Gift Card Purchase
1. Customer selects gift card amount
2. Chooses payment method (Stripe or PayPal)
3. Completes payment
4. Gift card is created and email is sent

## Troubleshooting

### PayPal buttons not appearing
- Check that PayPal is enabled in Payment Settings
- Verify Client ID is correct
- Check browser console for JavaScript errors

### Payment fails after approval
- Check Supabase Edge Function logs for errors
- Verify PayPal Secret is correct
- Ensure PayPal account is properly verified

### "Credentials not configured" error
- Make sure both Client ID and Secret are saved in Payment Settings
- Check that the business ID is correctly passed

## Security Notes

- PayPal credentials are stored in the `site_settings` table
- Secret keys should never be exposed to the frontend
- All payment processing happens through Supabase Edge Functions
- PayPal verifies the payment server-side before creating bookings

## Architecture

```
Customer Browser
       │
       ▼
PaymentStep.tsx / GiftCardPurchase.tsx
       │
       │  1. Create PayPal order
       ▼
create-paypal-order (Edge Function)
       │
       │  2. PayPal API call
       ▼
PayPal (creates order, returns order ID)
       │
       │  3. Customer approves in popup
       ▼
capture-paypal-order (Edge Function)
       │
       │  4. Capture payment, update DB
       ▼
Database (booking/gift card confirmed)
```

## Files Modified/Created

### New Files
- `/app/supabase/functions/create-paypal-order/index.ts`
- `/app/supabase/functions/capture-paypal-order/index.ts`
- `/app/supabase/migrations/20250801000000_add_paypal_support.sql`
- `/app/src/types/paypal.d.ts`
- `/app/PAYPAL_SETUP_GUIDE.md`

### Modified Files
- `/app/src/components/PaymentStep.tsx` - Added PayPal payment option
- `/app/src/components/GiftCardPurchase.tsx` - Added PayPal payment option
- `/app/src/components/admin/settings/PaymentSettings.tsx` - Added PayPal configuration

## Testing

### Test with PayPal Sandbox (Optional)
1. Create a PayPal Sandbox account at [developer.paypal.com](https://developer.paypal.com)
2. Use Sandbox credentials in development
3. Switch to Live credentials for production

### Test Checklist
- [ ] PayPal option appears in Payment Settings
- [ ] Can save PayPal credentials
- [ ] PayPal option appears at checkout (when enabled)
- [ ] PayPal buttons load properly
- [ ] Payment can be completed through PayPal
- [ ] Booking/Gift card is created after payment
- [ ] Confirmation email is sent
