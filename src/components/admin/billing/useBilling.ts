import { useCallback, useEffect, useState } from 'react';
import { loadBillingOverview, type BillingOverview } from './billingApi';

/** The shop's plan and AI replies; null while loading or when it cannot be read. */
export function useBilling(): { overview: BillingOverview | null; reload: () => void } {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const reload = useCallback(() => {
    loadBillingOverview()
      .then(setOverview)
      .catch((error) => console.error('Could not load the plan:', error));
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return { overview, reload };
}
