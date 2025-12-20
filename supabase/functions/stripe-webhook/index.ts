import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: any) {
      console.error(`Webhook signature verification failed: ${error.message}`);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  console.log(`Processing event: ${event.type}`);

  if (event.type === 'account.updated') {
    await handleAccountUpdated(event.data.object as Stripe.Account);
    return;
  }

  if (event.type === 'account.application.authorized') {
    await handleAccountAuthorized(event.data.object as any);
    return;
  }

  if (event.type === 'account.application.deauthorized') {
    await handleAccountDeauthorized(event.data.object as any);
    return;
  }

  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    return;
  }

  if (!('customer' in stripeData)) {
    return;
  }

  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error(`No customer received on event: ${JSON.stringify(event)}`);
  } else {
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info(`Starting subscription sync for customer: ${customerId}`);
      await syncCustomerFromStripe(customerId);

      if (event.type === 'checkout.session.completed') {
        await handleNewSignup(customerId, stripeData as Stripe.Checkout.Session);
      }
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
          metadata,
        } = stripeData as Stripe.Checkout.Session;

        if (metadata?.type === 'booking' && metadata?.booking_id) {
          const bookingId = metadata.booking_id;
          console.log(`Processing booking payment for booking: ${bookingId}`);

          const { error: bookingUpdateError } = await supabase
            .from('bookings')
            .update({
              payment_status: 'completed',
              status: 'confirmed',
              stripe_session_id: checkout_session_id,
            })
            .eq('id', bookingId);

          if (bookingUpdateError) {
            console.error('Error updating booking:', bookingUpdateError);
          } else {
            console.info(`Successfully confirmed booking: ${bookingId}`);

            const { data: booking } = await supabase
              .from('bookings')
              .select('customer_email, customer_name, service_id, duration_id, specialist_id, booking_date, start_time, business_id')
              .eq('id', bookingId)
              .maybeSingle();

            if (booking) {
              const { data: service } = await supabase
                .from('services')
                .select('name')
                .eq('id', booking.service_id)
                .maybeSingle();

              const { data: duration } = await supabase
                .from('service_durations')
                .select('duration_minutes, price_cents')
                .eq('id', booking.duration_id)
                .maybeSingle();

              const { data: business } = await supabase
                .from('businesses')
                .select('name, address, phone')
                .eq('id', booking.business_id)
                .maybeSingle();

              let specialistName = 'Any Available Specialist';
              if (booking.specialist_id) {
                const { data: specialist } = await supabase
                  .from('specialists')
                  .select('name')
                  .eq('id', booking.specialist_id)
                  .maybeSingle();
                if (specialist) {
                  specialistName = specialist.name;
                }
              }

              const calculateEndTime = (startTime: string, durationMinutes: number): string => {
                const [hours, minutes] = startTime.split(':').map(Number);
                const totalMinutes = hours * 60 + minutes + durationMinutes;
                const endHours = Math.floor(totalMinutes / 60) % 24;
                const endMinutes = totalMinutes % 60;
                return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;
              };

              const formattedDate = new Date(booking.booking_date).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              });

              const endTime = duration ? calculateEndTime(booking.start_time, duration.duration_minutes) : booking.start_time;
              const cancelUrl = `${Deno.env.get('SUPABASE_URL')?.replace('/functions/v1', '')}/cancel?id=${bookingId}`;

              console.log(`📧 Sending booking confirmation email to ${booking.customer_email}`);

              const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-business-email', {
                body: {
                  business_id: booking.business_id,
                  event_key: 'booking_confirmation',
                  recipient_email: booking.customer_email,
                  recipient_name: booking.customer_name,
                  variables: {
                    customer_name: booking.customer_name,
                    customer_email: booking.customer_email,
                    service_name: service?.name || 'Service',
                    service_duration: duration ? `${duration.duration_minutes} minutes` : 'N/A',
                    service_price: duration ? `$${(duration.price_cents / 100).toFixed(2)}` : 'N/A',
                    booking_date: formattedDate,
                    booking_time: booking.start_time,
                    booking_end_time: endTime,
                    specialist_name: specialistName,
                    business_name: business?.name || 'Our Business',
                    business_address: business?.address || '',
                    business_phone: business?.phone || '',
                    business_email: '',
                    cancellation_link: cancelUrl,
                    reschedule_link: cancelUrl,
                  },
                  booking_id: bookingId,
                },
              });

              if (emailError) {
                console.error('❌ Error sending booking confirmation email:', emailError);
              } else {
                console.log('✅ Booking confirmation email sent successfully');
              }
            }
          }
        } else if (metadata?.type === 'gift_card' && metadata?.gift_card_id) {
          const giftCardId = metadata.gift_card_id;
          console.log(`Processing gift card payment for gift card: ${giftCardId}`);

          const { error: giftCardUpdateError } = await supabase
            .from('gift_cards')
            .update({
              stripe_session_id: checkout_session_id,
            })
            .eq('id', giftCardId);

          if (giftCardUpdateError) {
            console.error('Error updating gift card:', giftCardUpdateError);
          } else {
            console.info(`Successfully processed gift card: ${giftCardId}`);
          }
        } else if (metadata?.type === 'gift_card_new' && metadata?.gc_code && metadata?.gc_amount) {
          console.log(`Processing gift card creation for code: ${metadata.gc_code}, session: ${checkout_session_id}`);
          console.log('Gift card metadata:', JSON.stringify(metadata, null, 2));

          const { data: existingGiftCard } = await supabase
            .from('gift_cards')
            .select('id, code')
            .eq('stripe_session_id', checkout_session_id)
            .maybeSingle();

          if (existingGiftCard) {
            console.log(`Gift card already exists with session ${checkout_session_id}, skipping creation. ID: ${existingGiftCard.id}`);
          } else {
            const giftCardInsert: any = {
              business_id: metadata.business_id,
              code: metadata.gc_code,
              original_value_cents: parseInt(metadata.gc_amount),
              current_balance_cents: parseInt(metadata.gc_amount),
              status: 'active',
              stripe_session_id: checkout_session_id,
              purchased_for_email: metadata.gc_recipient_email || null,
              expires_at: metadata.gc_expires_at || null,
            };

            console.log('Attempting to insert gift card:', JSON.stringify(giftCardInsert, null, 2));

            const { data: newGiftCard, error: giftCardCreateError } = await supabase
              .from('gift_cards')
              .insert(giftCardInsert)
              .select()
              .single();

            if (giftCardCreateError) {
              if (giftCardCreateError.code === '23505') {
                console.log('Duplicate key error, gift card likely created by another process. Verifying...');

                const { data: verifyGiftCard } = await supabase
                  .from('gift_cards')
                  .select('id, code')
                  .or(`code.eq.${metadata.gc_code},stripe_session_id.eq.${checkout_session_id}`)
                  .maybeSingle();

                if (verifyGiftCard) {
                  console.log(`Confirmed gift card exists: ${verifyGiftCard.id}`);
                } else {
                  console.error('Duplicate key error but could not find gift card. This is unexpected.');
                }
              } else {
                console.error('Error creating gift card - Full error:', JSON.stringify(giftCardCreateError, null, 2));
                console.error('Error code:', giftCardCreateError.code);
                console.error('Error message:', giftCardCreateError.message);
                console.error('Error details:', giftCardCreateError.details);
              }
            } else {
              console.info(`Successfully created gift card: ${newGiftCard.id}`);

              await supabase
                .from('gift_card_transactions')
                .insert({
                  gift_card_id: newGiftCard.id,
                  amount_cents: parseInt(metadata.gc_amount),
                  transaction_type: 'purchase',
                  description: `Purchased by ${metadata.customer_name}`,
                });

              if (metadata.gc_recipient_email) {
                console.log(`📧 Sending gift card email to ${metadata.gc_recipient_email}`);

                const { data: giftCardBusiness } = await supabase
                  .from('businesses')
                  .select('name')
                  .eq('id', metadata.business_id)
                  .maybeSingle();

                const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-business-email', {
                  body: {
                    business_id: metadata.business_id,
                    event_key: 'gift_card_received',
                    recipient_email: metadata.gc_recipient_email,
                    recipient_name: metadata.gc_recipient_email.split('@')[0],
                    variables: {
                      recipient_email: metadata.gc_recipient_email,
                      gift_card_code: metadata.gc_code,
                      amount: `$${(parseInt(metadata.gc_amount) / 100).toFixed(2)}`,
                      message: metadata.gc_message || '',
                      sender_name: metadata.customer_name,
                      business_name: giftCardBusiness?.name || 'Our Business',
                    },
                  },
                });

                if (emailError) {
                  console.error('❌ Error sending gift card email:', emailError);
                } else {
                  console.log('✅ Gift card email sent successfully');
                }
              }
            }
          }
        }

        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed',
        });

        if (orderError) {
          console.error('Error inserting order:', orderError);
          return;
        }
        console.info(`Successfully processed one-time payment for session: ${checkout_session_id}`);
      } catch (error) {
        console.error('Error processing one-time payment:', error);
      }
    }
  }
}

async function handleAccountUpdated(account: Stripe.Account) {
  try {
    console.log(`Account updated: ${account.id}`);

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('stripe_connect_account_id', account.id)
      .maybeSingle();

    if (!business) {
      console.log(`No business found for account ${account.id}`);
      return;
    }

    const { error } = await supabase
      .from('businesses')
      .update({
        stripe_connect_charges_enabled: account.charges_enabled || false,
        stripe_connect_payouts_enabled: account.payouts_enabled || false,
        stripe_connect_details_submitted: account.details_submitted || false,
        stripe_connect_onboarding_complete: account.details_submitted && account.charges_enabled,
      })
      .eq('id', business.id);

    if (error) {
      console.error('Error updating business Connect status:', error);
    } else {
      console.log(`Updated Connect status for business ${business.id}`);
    }
  } catch (error) {
    console.error('Error handling account.updated event:', error);
  }
}

async function handleAccountAuthorized(data: any) {
  try {
    console.log('Account authorized:', data.account);
  } catch (error) {
    console.error('Error handling account.application.authorized event:', error);
  }
}

async function handleAccountDeauthorized(data: any) {
  try {
    console.log('Account deauthorized:', data.account);

    const { error } = await supabase
      .from('businesses')
      .update({
        stripe_connect_account_id: null,
        stripe_connect_onboarding_complete: false,
        stripe_connect_charges_enabled: false,
        stripe_connect_payouts_enabled: false,
        stripe_connect_details_submitted: false,
      })
      .eq('stripe_connect_account_id', data.account);

    if (error) {
      console.error('Error clearing Connect account:', error);
    }
  } catch (error) {
    console.error('Error handling account.application.deauthorized event:', error);
  }
}

async function handleNewSignup(customerId: string, session: Stripe.Checkout.Session) {
  try {
    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
    const metadata = subscription.metadata;

    if (!metadata.user_email || !metadata.business_name) {
      console.log('No signup metadata found, skipping business creation');
      return;
    }

    const { data: existingBusiness } = await supabase
      .from('businesses')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle();

    if (existingBusiness) {
      console.log('Business already exists for this customer');
      return;
    }

    console.log('Creating new business account for customer:', customerId);

    const { data: authData, error: signUpError } = await supabase.auth.admin.createUser({
      email: metadata.user_email,
      password: metadata.user_password,
      email_confirm: true,
      user_metadata: {
        full_name: metadata.user_full_name,
        business_name: metadata.business_name,
      },
    });

    if (signUpError || !authData.user) {
      console.error('Failed to create auth user:', signUpError);
      throw new Error('Failed to create auth user');
    }

    const randomPermalink = `biz-${Math.random().toString(36).substring(2, 10)}`;
    const trialEndDate = new Date(subscription.trial_end! * 1000);

    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        name: metadata.business_name,
        permalink: randomPermalink,
        subdomain: null,
        business_type: metadata.business_type,
        phone: metadata.phone,
        address: metadata.address,
        plan_type: metadata.plan_type,
        is_active: true,
        owner_id: authData.user.id,
        custom_logo_url: '/defbuuklogo.png',
        stripe_customer_id: customerId,
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        trial_end_date: trialEndDate.toISOString(),
      })
      .select()
      .single();

    if (businessError) {
      console.error('Business creation error:', businessError);
      throw new Error(`Failed to create business: ${businessError.message}`);
    }

    await supabase.from('admin_users').insert({
      business_id: business.id,
      email: metadata.user_email,
      password_hash: metadata.user_password,
      full_name: metadata.user_full_name,
      role: 'admin',
      is_owner: true,
      is_active: true,
      user_id: authData.user.id,
    });

    await supabase.from('booking_form_colors').insert([
      { business_id: business.id, color_key: 'primary', color_value: '#1c1917' },
      { business_id: business.id, color_key: 'primary_hover', color_value: '#44403c' },
      { business_id: business.id, color_key: 'secondary', color_value: '#78716c' },
      { business_id: business.id, color_key: 'text_primary', color_value: '#1c1917' },
      { business_id: business.id, color_key: 'text_secondary', color_value: '#57534e' },
      { business_id: business.id, color_key: 'background', color_value: '#ffffff' },
      { business_id: business.id, color_key: 'background_secondary', color_value: '#fafaf9' },
      { business_id: business.id, color_key: 'border', color_value: '#e7e5e4' },
      { business_id: business.id, color_key: 'accent', color_value: '#1c1917' },
    ]);

    await supabase
      .from('stripe_customers')
      .update({ business_id: business.id })
      .eq('customer_id', customerId);

    console.log('Successfully created business account:', business.id);
  } catch (error) {
    console.error('Error handling new signup:', error);
    throw error;
  }
}

async function syncCustomerFromStripe(customerId: string) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    if (subscriptions.data.length === 0) {
      console.info(`No active subscriptions found for customer: ${customerId}`);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          subscription_status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
    }

    const subscription = subscriptions.data[0];

    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      {
        customer_id: customerId,
        subscription_id: subscription.id,
        price_id: subscription.items.data[0].price.id,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
          ? {
              payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
              payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
            }
          : {}),
        status: subscription.status,
      },
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }

    const { error: businessUpdateError } = await supabase
      .from('businesses')
      .update({
        stripe_subscription_id: subscription.id,
        subscription_status: subscription.status,
        trial_end_date: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      })
      .eq('stripe_customer_id', customerId);

    if (businessUpdateError) {
      console.error('Error updating business subscription status:', businessUpdateError);
    }

    console.info(`Successfully synced subscription for customer: ${customerId}`);
  } catch (error) {
    console.error(`Failed to sync subscription for customer ${customerId}:`, error);
    throw error;
  }
}