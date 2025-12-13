import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { formatCurrency as formatCurrencyUtil, getCurrencySymbol as getSymbol } from './currency';
import { useTenant } from './tenantContext';

interface CurrencyContextType {
  currency: string;
  setCurrency: (currency: string) => void;
  formatPrice: (cents: number) => string;
  formatAmount: (amount: number) => string;
  currencySymbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { businessId } = useTenant();
  const [currency, setCurrencyState] = useState<string>('USD');

  useEffect(() => {
    if (!businessId) return;

    loadCurrency();

    const channel = supabase
      .channel(`site_settings:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_settings',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          if (payload.new?.currency) {
            setCurrencyState(payload.new.currency);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [businessId]);

  const loadCurrency = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('site_settings')
      .select('currency')
      .eq('business_id', businessId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data?.currency) {
      setCurrencyState(data.currency);
    }
  };

  const setCurrency = async (newCurrency: string) => {
    setCurrencyState(newCurrency);

    if (businessId) {
      const { data: existing, error: selectError } = await supabase
        .from('site_settings')
        .select('id')
        .eq('business_id', businessId)
        .maybeSingle();

      if (selectError) {
        console.error('Error checking existing settings:', selectError);
        throw selectError;
      }

      if (existing) {
        const { error: updateError } = await supabase
          .from('site_settings')
          .update({ currency: newCurrency, updated_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Error updating currency:', updateError);
          throw updateError;
        }
      } else {
        const { error: insertError } = await supabase
          .from('site_settings')
          .insert({
            key: `settings_${businessId}`,
            value: newCurrency,
            category: 'general',
            business_id: businessId,
            currency: newCurrency,
          });

        if (insertError) {
          console.error('Error inserting currency:', insertError);
          throw insertError;
        }
      }
    }
  };

  const formatPrice = (cents: number): string => {
    return formatCurrencyUtil(cents, currency);
  };

  const formatAmount = (amount: number): string => {
    return formatCurrencyUtil(Math.round(amount * 100), currency);
  };

  const currencySymbol = getSymbol(currency);

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        formatPrice,
        formatAmount,
        currencySymbol,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
