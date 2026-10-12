import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * id -> name for all therapists of the shop (inactive ones too, for old bookings).
 * Couple bookings reference a second therapist (partner_specialist_id) that can't
 * be embedded in the bookings query, so names come from here.
 */
export function useSpecialistNames(businessId: string | null): Map<string, string> {
  const [names, setNames] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!businessId) return;
    let isCancelled = false;
    supabase
      .from('specialists')
      .select('id, name')
      .eq('business_id', businessId)
      .then(({ data, error }) => {
        if (isCancelled) return;
        if (error) {
          console.error('Could not load therapist names:', error);
          return;
        }
        setNames(new Map((data ?? []).map((row: { id: string; name: string }) => [row.id, row.name])));
      });
    return () => {
      isCancelled = true;
    };
  }, [businessId]);

  return names;
}
