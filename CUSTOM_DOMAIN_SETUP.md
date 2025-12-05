# Custom Domain Setup Guide

This guide explains how to configure custom domain support for your multi-tenant booking platform.

## Overview

The custom domain system allows each business to connect their own domain (e.g., `booking.theirsalon.com`) to their booking page. The system automatically handles:

1. DNS verification
2. Adding domains to Netlify
3. SSL certificate provisioning
4. Tenant detection based on hostname

## Required Environment Variables

You need to configure these environment variables in your Supabase project:

### 1. NETLIFY_ACCESS_TOKEN

**What it is:** A personal access token from Netlify that allows API access.

**How to get it:**
1. Log in to your Netlify account
2. Go to User Settings → Applications → Personal Access Tokens
3. Click "New access token"
4. Give it a name like "Custom Domain Management"
5. Copy the token (you'll only see it once)

**How to set it in Supabase:**
```bash
# Using Supabase CLI
supabase secrets set NETLIFY_ACCESS_TOKEN=your_token_here

# Or via Supabase Dashboard:
# Go to Project Settings → Edge Functions → Secrets
# Add: NETLIFY_ACCESS_TOKEN = your_token_here
```

### 2. NETLIFY_SITE_ID

**What it is:** The unique identifier for your Netlify site.

**How to get it:**
1. Log in to Netlify
2. Go to your site
3. Go to Site Settings → General
4. Find "Site information" section
5. Copy the "Site ID" (format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

**How to set it in Supabase:**
```bash
# Using Supabase CLI
supabase secrets set NETLIFY_SITE_ID=your_site_id_here

# Or via Supabase Dashboard:
# Go to Project Settings → Edge Functions → Secrets
# Add: NETLIFY_SITE_ID = your_site_id_here
```

### 3. NETLIFY_SITE_URL (for frontend)

**What it is:** Your Netlify site URL that customers will point their CNAME records to.

**Example:** `your-booking-app.netlify.app`

**How to set it:**

Add to your `.env` file:
```
VITE_NETLIFY_SITE_URL=your-booking-app.netlify.app
```

## How It Works

### User Flow

1. **User adds domain:** Business owner enters their custom domain in the admin panel
2. **DNS configuration:** User adds CNAME record at their domain registrar
3. **DNS verification:** User clicks "Verify" - system checks DNS records
4. **Platform integration:** After DNS verification, domain is automatically added to Netlify
5. **SSL provisioning:** Netlify automatically provisions SSL certificate (5-15 minutes)
6. **Domain active:** Custom domain is live with HTTPS

### Technical Flow

```
User adds domain → Stored in database with status "pending"
        ↓
User configures DNS (CNAME → your-app.netlify.app)
        ↓
User clicks "Verify" → verify-custom-domain function
        ↓
DNS verified → Status: "verified" → Automatically calls add-domain-to-netlify
        ↓
Domain added to Netlify → Status: "provisioning" → Netlify provisions SSL
        ↓
SSL active → Status: "active" → Domain is live
```

### Backend Functions

1. **verify-custom-domain**: Checks DNS records and triggers Netlify integration
2. **add-domain-to-netlify**: Adds domain to Netlify via API
3. **remove-domain-from-netlify**: Removes domain from Netlify when deleted
4. **check-ssl-status**: Monitors SSL certificate provisioning status

### Database Schema

The `custom_domains` table tracks:
- `domain`: The custom domain
- `status`: pending, verified, provisioning, active, failed
- `dns_configured`: Boolean - DNS records verified
- `netlify_domain_id`: Netlify's internal domain ID
- `ssl_certificate_status`: pending, provisioning, active, failed
- `provisioned_at`: When domain was added to Netlify
- `netlify_api_error`: Any Netlify-specific errors

## Testing

Before launching to customers:

1. Get a test domain (or subdomain)
2. Add it in the admin panel
3. Configure DNS CNAME record
4. Verify the domain
5. Wait for SSL provisioning
6. Test accessing your booking page via the custom domain

## Troubleshooting

### "Netlify credentials not configured"
- Make sure you've set NETLIFY_ACCESS_TOKEN and NETLIFY_SITE_ID in Supabase secrets

### DNS verification fails
- DNS changes can take 5-60 minutes to propagate
- Use a DNS checker tool to verify CNAME record is live
- Ensure CNAME points to your Netlify site URL

### SSL provisioning stuck
- Usually takes 5-15 minutes
- Can manually check status by clicking "Verify" button again
- Check Netlify dashboard for any domain issues

### Domain shows "Failed" status
- Check error_message or netlify_api_error in database
- Verify Netlify API credentials are correct
- Check Netlify API rate limits

## Security Notes

- Netlify API token has full access to your site - keep it secure
- RLS policies ensure businesses can only manage their own domains
- All API calls are authenticated with Supabase JWT
- DNS verification prevents domain hijacking

## Support

For issues with:
- DNS configuration: Check with domain registrar support
- Netlify integration: Check Netlify API status and credentials
- SSL certificates: Netlify handles provisioning automatically
- Application errors: Check Supabase Edge Function logs
