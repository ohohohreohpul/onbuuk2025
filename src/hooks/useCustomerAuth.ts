import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface Customer {
  id: string;
  business_id: string;
  name: string;
  email: string;
  phone: string | null;
  total_bookings: number;
  total_spent_cents: number;
  user_id: string | null;
  account_status: string;
}

export function useCustomerAuth() {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        loadCustomerProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setCustomer(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        await loadCustomerProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error checking user:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCustomerProfile(userId: string) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error loading customer profile:', error);
      return;
    }

    setCustomer(data);
  }

  async function signUp(email: string, password: string, name: string, phone: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          phone,
        }
      }
    });

    if (error) throw error;

    if (data.user) {
      const { error: profileError } = await supabase
        .from('customers')
        .update({
          user_id: data.user.id,
          account_status: 'active',
          name,
          phone,
        })
        .eq('email', email)
        .is('user_id', null);

      if (profileError) {
        console.error('Error linking customer profile:', profileError);
      }

      await loadCustomerProfile(data.user.id);
    }

    return data;
  }

  async function signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setCustomer(null);
  }

  async function updateProfile(updates: Partial<Customer>) {
    if (!customer) throw new Error('No customer logged in');

    const { error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customer.id);

    if (error) throw error;

    setCustomer({ ...customer, ...updates });
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) throw error;
  }

  return {
    customer,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
    updatePassword,
  };
}
