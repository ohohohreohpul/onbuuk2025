import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
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
    const { plan_type, billing_cycle = 'monthly', business_data, user_data } = await req.json();

    if (!plan_type || !business_data || !user_data) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine the price ID based on plan type and billing cycle
    const priceIds: Record<string, Record<string, string>> = {
      standard: {
        monthly: Deno.env.get('STRIPE_STANDARD_MONTHLY_PRICE_ID') || '',
        yearly: 'price_1SZVauAenAaCiGrhII4j5E2T',
      },
      pro: {
        monthly: Deno.env.get('STRIPE_PRO_MONTHLY_PRICE_ID') || '',
        yearly: 'price_1SZVevAenAaCiGrhXZqsixHl',
      },
    };

    const priceId = priceIds[plan_type.toLowerCase()]?.[billing_cycle];

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan type or billing cycle' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Create Stripe customer
    const customer = await stripe.customers.create({
      email: user_data.email,
      name: user_data.fullName,
      metadata: {
        business_name: business_data.businessName,
        plan_type: plan_type,
        billing_cycle: billing_cycle,
      },
    });

    // Create checkout session with 7-day trial
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          business_name: business_data.businessName,
          business_type: business_data.businessType,
          phone: business_data.phone,
          address: business_data.address,
          plan_type: plan_type,
          billing_cycle: billing_cycle,
          user_email: user_data.email,
          user_password: user_data.password,
          user_full_name: user_data.fullName,
        },
      },
      success_url: `${business_data.origin}/signup-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${business_data.origin}/signup`,
    });

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