import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { SPECIALIST_CHOICE_KEY, isSpecialistChoiceAllowed } from '../lib/specialistChoice';

/** Whether the booking page shows the therapist step (true until loaded, and on errors). */
export function useSpecialistChoice(businessId: string | null): boolean {
  const [isAllowed, setIsAllowed] = useState(true);

  useEffect(() => {
    if (!businessId) return;
    let isCancelled = false;

    supabase
      .from('site_settings')
      .select('value')
      .eq('business_id', businessId)
      .eq('key', SPECIALIST_CHOICE_KEY)
      .maybeSingle()
      .then(({ data, error }) => {
        if (isCancelled) return;
        if (error) {
          console.error('Could not load the therapist choice setting:', error);
          return;
        }
        setIsAllowed(isSpecialistChoiceAllowed(data?.value));
      });

    return () => {
      isCancelled = true;
    };
  }, [businessId]);

  return isAllowed;
}
