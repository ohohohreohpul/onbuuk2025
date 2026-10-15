import { useState, useEffect } from 'react';
import { AlertCircle, X, ArrowRight, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useAdminText } from '../../lib/adminLanguage';
import type { Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{ title: string; body: string; cta: string; dismiss: string }> = {
  en: {
    title: 'Complete Your Store Profile',
    body: 'Add your business details to activate your booking page and start accepting appointments',
    cta: 'Complete Setup', dismiss: 'Dismiss',
  },
  de: {
    title: 'Shop-Profil vervollständigen',
    body: 'Ergänzen Sie Ihre Unternehmensdaten, um die Buchungsseite zu aktivieren und Termine anzunehmen',
    cta: 'Einrichtung abschließen', dismiss: 'Ausblenden',
  },
  th: {
    title: 'กรอกข้อมูลร้านให้ครบ',
    body: 'เพิ่มข้อมูลธุรกิจเพื่อเปิดใช้หน้าจองและเริ่มรับนัดหมาย',
    cta: 'ตั้งค่าให้เสร็จ', dismiss: 'ปิด',
  },
};

interface ProfileCompletionBannerProps {
  onSetupClick: () => void;
}

export default function ProfileCompletionBanner({ onSetupClick }: ProfileCompletionBannerProps) {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
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
    <div className="bg-gradient-to-r from-[#1A1714] via-[#3D3833] to-[#1A1714] text-white shadow-lg shadow-[#1A1714]/20 relative overflow-hidden">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 animate-shimmer" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{t.title}</h3>
              <p className="text-white/80 text-sm">
                {t.body}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4">
            <button
              onClick={(e) => {
                e.preventDefault();
                onSetupClick();
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#1A1714] rounded-xl font-semibold hover:bg-white/90 hover:shadow-lg transition-all duration-200 group"
            >
              {t.cta}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-white/20 rounded-xl transition-colors backdrop-blur-sm"
              aria-label={t.dismiss}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
