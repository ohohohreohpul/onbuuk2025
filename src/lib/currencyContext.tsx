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
      .channel(`site_settings_currency:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'site_settings',
          filter: `business_id=eq.${businessId}`,
        },
        (payload: any) => {
          // Check if this is a currency update using key/value pattern
          if (payload.new?.key === 'currency' && payload.new?.value) {
            let currencyValue = payload.new.value;
            // Handle potential JSON-encoded value
            try {
              const parsed = JSON.parse(currencyValue);
              if (typeof parsed === 'string') {
                currencyValue = parsed;
              }
            } catch {
              // Not JSON, use as-is
            }
            setCurrencyState(currencyValue);
          }
          // Also check for legacy currency column
          else if (payload.new?.currency) {
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

    // First try to get currency from key/value pattern
    const { data: keyValueData } = await supabase
      .from('site_settings')
      .select('value')
      .eq('business_id', businessId)
      .eq('key', 'currency')
      .maybeSingle();

    if (keyValueData?.value) {
      let currencyValue = keyValueData.value;
      // Handle potential JSON-encoded value
      try {
        const parsed = JSON.parse(currencyValue);
        if (typeof parsed === 'string') {
          currencyValue = parsed;
        }
      } catch {
        // Not JSON, use as-is
      }
      setCurrencyState(currencyValue);
      return;
    }

    // Fallback: check for legacy currency column
    const { data: legacyData } = await supabase
      .from('site_settings')
      .select('currency')
      .eq('business_id', businessId)
      .not('currency', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (legacyData?.currency) {
      setCurrencyState(legacyData.currency);
      // Migrate to key/value pattern
      await migrateCurrencyToKeyValue(businessId, legacyData.currency);
    }
  };

  const migrateCurrencyToKeyValue = async (businessId: string, currencyValue: string) => {
    try {
      await supabase
        .from('site_settings')
        .upsert({
          business_id: businessId,
          key: 'currency',
          value: currencyValue,
          category: 'general',
        }, { onConflict: 'business_id,key' });
    } catch (error) {
      console.error('Error migrating currency to key/value:', error);
    }
  };

  const setCurrency = async (newCurrency: string) => {
    setCurrencyState(newCurrency);

    if (businessId) {
      try {
        // Use key/value pattern for consistency
        const { error } = await supabase
          .from('site_settings')
          .upsert({
            business_id: businessId,
            key: 'currency',
            value: newCurrency,
            category: 'general',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'business_id,key' });

        if (error) {
          console.error('Error saving currency:', error);
          throw error;
        }
      } catch (error) {
        console.error('Error updating currency:', error);
        throw error;
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
