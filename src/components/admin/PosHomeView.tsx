import { adminAuth } from '../../lib/adminAuth';
import { usePermissions } from '../../hooks/usePermissions';
import CalendarView from './CalendarView';
import DashboardView from './DashboardView';

interface PosHomeViewProps {
  onNavigate: (view: string) => void;
}

/** Home screen ("POS"): the calendar workspace on top, the day's numbers and to-dos below. */
export default function PosHomeView({ onNavigate }: PosHomeViewProps) {
  const adminUser = adminAuth.getCurrentUser();
  const { hasPermission } = usePermissions(adminUser?.id || null);

  return (
    <div className="space-y-10">
      <CalendarView onNavigate={onNavigate} />
      {hasPermission('view_reports') && (
        <section aria-label="Dashboard" className="border-t border-stone-200/70 pt-8">
          <DashboardView onNavigate={onNavigate} isEmbedded />
        </section>
      )}
    </div>
  );
}
