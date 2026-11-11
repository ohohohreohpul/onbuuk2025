import { useCallback, useEffect, useState } from 'react';
import { loadBillingOverview, type BillingOverview } from './billingApi';

/** The shop's plan and AI replies; null while loading or when it cannot be read. */
export function useBilling(): { overview: BillingOverview | null; isLoaded: boolean; reload: () => void } {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const reload = useCallback(() => {
    loadBillingOverview()
      .then(setOverview)
      .catch((error) => console.error('Could not load the plan:', error))
      .finally(() => setIsLoaded(true));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { overview, isLoaded, reload };
}
