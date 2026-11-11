import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import StartTrialScreen from './StartTrialScreen';
import { useBilling } from './useBilling';

interface PlanGateProps {
  onLogout: () => void;
  children: ReactNode;
}

/**
 * New shops start Zenno with a 7-day trial: until they have one (or a plan),
 * they see the trial screen instead of the dashboard. Shops that existed before
 * the trial keep their Free plan and pass straight through.
 */
export default function PlanGate({ onLogout, children }: PlanGateProps) {
  const { overview, isLoaded } = useBilling();

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-stone-400" />
      </div>
    );
  }
  // If the plan cannot be read, never lock the owner out of their shop.
  if (overview?.needs_plan) return <StartTrialScreen overview={overview} onLogout={onLogout} />;
  return <>{children}</>;
}
