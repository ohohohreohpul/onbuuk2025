import { ReactNode, useEffect, useState } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';

interface VerticalLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
}

export default function VerticalLayout({ children, imageUrl, imageAlt = 'Business' }: VerticalLayoutProps) {
  const { businessId } = useTenant();
  const [businessName, setBusinessName] = useState('');
  const [businessTagline, setBusinessTagline] = useState('');

  useEffect(() => {
    async function fetchBusinessInfo() {
      if (!businessId) return;

      const { data } = await supabase
        .from('businesses')
        .select('name, tagline')
        .eq('id', businessId)
        .maybeSingle();

      if (data) {
        setBusinessName(data.name || '');
        setBusinessTagline(data.tagline || '');
      }
    }

    fetchBusinessInfo();
  }, [businessId]);

  return (
    <div className="min-h-screen bg-white flex flex-col relative">
      {imageUrl ? (
        <div className="w-full h-48 sm:h-64 relative overflow-hidden">
          <img
            src={imageUrl}
            alt={imageAlt}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/10"></div>
        </div>
      ) : (
        <div className="w-full h-48 sm:h-64 bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
          <div className="text-center px-4">
            <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-stone-300/50 flex items-center justify-center">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            {businessName && (
              <>
                <h2 className="text-xl sm:text-2xl font-light text-stone-700 mb-1">{businessName}</h2>
                {businessTagline && <p className="text-stone-600 text-xs sm:text-sm">{businessTagline}</p>}
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {children}
        </div>
      </div>

      <PoweredByBuuk />
    </div>
  );
}
