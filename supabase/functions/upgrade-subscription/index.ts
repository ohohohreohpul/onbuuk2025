import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Buuk Booking System',
    version: '1.0.0',
  },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { business_id, plan_type, coupon_code } = await req.json();

    if (!business_id || !plan_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: business_id and plan_type' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!['standard', 'pro'].includes(plan_type.toLowerCase())) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan type. Must be "standard" or "pro"' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .select('id, name, stripe_customer_id')
      .eq('id', business_id)
      .single();

    if (businessError || !business) {
      return new Response(
        JSON.stringify({ error: 'Business not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('email')
      .eq('business_id', business_id)
      .in('role', ['owner', 'admin'])
      .order('role', { ascending: true })
      .limit(1)
      .maybeSingle();

    const ownerEmail = adminUser?.email || 'noreply@onbuuk.com';

    const priceIds: Record<string, string> = {
      standard: Deno.env.get('STRIPE_STANDARD_PRICE_ID') || '',
      pro: Deno.env.get('STRIPE_PRO_PRICE_ID') || '',
    };

    const priceId = priceIds[plan_type.toLowerCase()];

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan type or price ID not configured' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let customerId = business.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: ownerEmail,
        name: business.name,
        metadata: {
          business_id: business.id,
          business_name: business.name,
        },
      });

      customerId = customer.id;

      await supabase
        .from('businesses')
        .update({ stripe_customer_id: customerId })
        .eq('id', business_id);
    }

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer_email: ownerEmail,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      allow_promotion_codes: true,
      metadata: {
        business_id: business.id,
        plan_type: plan_type,
      },
      success_url: `${req.headers.get('origin')}/admin/settings?upgrade=success`,
      cancel_url: `${req.headers.get('origin')}/admin/settings?upgrade=cancelled`,
    };

    if (coupon_code && coupon_code.trim() !== '') {
      sessionParams.discounts = [
        {
          coupon: coupon_code.trim(),
        },
      ];
      if (sessionParams.metadata) {
        sessionParams.metadata.coupon_code = coupon_code.trim();
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return new Response(
      JSON.stringify({ sessionId: session.id, url: session.url }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});