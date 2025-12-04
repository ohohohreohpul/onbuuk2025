import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

export type Service = {
  id: string;
  name: string;
  description: string;
  is_pair_massage: boolean;
  image_url: string | null;
  category: string;
  display_order: number;
};

export type ServiceDuration = {
  id: string;
  service_id: string;
  duration_minutes: number;
  price_cents: number;
};

export type Specialist = {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
  is_active: boolean;
};

export type BookingData = {
  service_id: string;
  duration_id: string;
  specialist_id: string | null;
  booking_date: string;
  start_time: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  is_pair_booking: boolean;
  notes?: string;
};
