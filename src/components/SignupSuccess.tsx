import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, Loader } from 'lucide-react';

export function SignupSuccess() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    const checkBusinessCreation = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');

      if (!sessionId) {
        setStatus('error');
        return;
      }

      let attempts = 0;
      const maxAttempts = 30;

      const checkInterval = setInterval(async () => {
        attempts++;

        try {
          const { data: stripeCustomers } = await supabase
            .from('stripe_customers')
            .select('business_id, businesses(*)')
            .not('business_id', 'is', null)
            .limit(1);

          if (stripeCustomers && stripeCustomers.length > 0 && stripeCustomers[0].businesses) {
            const foundBusiness = stripeCustomers[0].businesses;
            setBusiness(foundBusiness);
            setStatus('success');
            clearInterval(checkInterval);

            setTimeout(() => {
              window.location.href = `/${foundBusiness.permalink}/admin`;
            }, 2000);
          } else if (attempts >= maxAttempts) {
            setStatus('error');
            clearInterval(checkInterval);
          }
        } catch (error) {
          console.error('Error checking business creation:', error);
          if (attempts >= maxAttempts) {
            setStatus('error');
            clearInterval(checkInterval);
          }
        }
      }, 2000);

      return () => clearInterval(checkInterval);
    };

    checkBusinessCreation();
  }, []);

  if (status === 'processing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Loader className="w-8 h-8 text-stone-900 animate-spin" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-3">Setting Up Your Account</h1>
          <p className="text-stone-600 mb-4">
            Your payment was successful! We're creating your business account now.
          </p>
          <p className="text-sm text-stone-500">This may take a few moments...</p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-3">Account Created Successfully!</h1>
          <p className="text-stone-600 mb-4">
            Welcome to your new booking system. Redirecting you to your dashboard...
          </p>
          {business && (
            <p className="text-sm text-stone-500">Business: {business.name}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">⚠️</span>
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-3">Something Went Wrong</h1>
        <p className="text-stone-600 mb-6">
          We couldn't complete your account setup. Please contact support or try again.
        </p>
        <a
          href="/signup"
          className="inline-block bg-stone-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-stone-800 transition-colors"
        >
          Try Again
        </a>
      </div>
    </div>
  );
}
