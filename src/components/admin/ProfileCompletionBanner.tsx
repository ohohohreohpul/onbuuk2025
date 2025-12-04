import { useState, useEffect } from 'react';
import { AlertCircle, X, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';

interface ProfileCompletionBannerProps {
  onSetupClick: () => void;
}

export default function ProfileCompletionBanner({ onSetupClick }: ProfileCompletionBannerProps) {
  const { businessId } = useTenant();
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkProfileCompletion();
  }, [businessId]);

  const checkProfileCompletion = async () => {
    if (!businessId) return;

    const dismissedKey = `profile-banner-dismissed-${businessId}`;
    if (localStorage.getItem(dismissedKey) === 'true') {
      setDismissed(true);
      return;
    }

    const { data } = await supabase
      .from('businesses')
      .select('profile_completed')
      .eq('id', businessId)
      .single();

    if (data && !data.profile_completed) {
      setShowBanner(true);
    }
  };

  const handleDismiss = () => {
    const dismissedKey = `profile-banner-dismissed-${businessId}`;
    localStorage.setItem(dismissedKey, 'true');
    setShowBanner(false);
    setDismissed(true);
  };

  if (!showBanner || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Complete Your Store Profile</h3>
              <p className="text-blue-100 text-sm">
                Add your business details to activate your booking page and start accepting appointments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={(e) => {
                e.preventDefault();
                console.log('Complete Setup clicked');
                onSetupClick();
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              Complete Setup
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
