import { ReactNode, useEffect, useState } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';

interface VerticalLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  imageMobile?: string;
  imageTablet?: string;
  imageDesktop?: string;
  imageAlt?: string;
}

export default function VerticalLayout({ children, imageUrl, imageMobile, imageTablet, imageDesktop, imageAlt = 'Business' }: VerticalLayoutProps) {
  const { businessId } = useTenant();
  const [businessName, setBusinessName] = useState('');
  const [businessTagline, setBusinessTagline] = useState('');
  const [isLoaded, setIsLoaded] = useState(false);

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
    setTimeout(() => setIsLoaded(true), 100);
  }, [businessId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col relative">
      {/* Background decorations */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
      
      {/* Hero Image */}
      <div className={`relative transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}`}>
        {(imageUrl || imageMobile || imageTablet || imageDesktop) ? (
          <div className="w-full h-56 sm:h-72 relative overflow-hidden">
            <picture>
              {/* Mobile image (< 640px) */}
              {imageMobile && (
                <source media="(max-width: 639px)" srcSet={imageMobile} />
              )}
              {/* Tablet image (640px - 1023px) */}
              {imageTablet && (
                <source media="(min-width: 640px) and (max-width: 1023px)" srcSet={imageTablet} />
              )}
              {/* Desktop image (>= 1024px) */}
              {imageDesktop && (
                <source media="(min-width: 1024px)" srcSet={imageDesktop} />
              )}
              {/* Fallback image */}
              <img
                src={imageDesktop || imageTablet || imageMobile || imageUrl}
                alt={imageAlt}
                className="w-full h-full object-cover"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          </div>
        ) : (
          <div className="w-full h-56 sm:h-72 bg-gradient-to-br from-[#008374]/10 to-[#89BA16]/10 flex items-center justify-center">
            <div className="text-center px-4">
              <div className="relative mb-4">
                <div className="absolute inset-0 bg-[#008374]/20 rounded-full blur-xl scale-150 animate-pulse-slow" />
                <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#008374]/20 to-[#89BA16]/20 backdrop-blur-sm border border-white/50 flex items-center justify-center relative">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-[#008374]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
              </div>
              {businessName && (
                <>
                  <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-2 tracking-tight">{businessName}</h2>
                  {businessTagline && <p className="text-muted-foreground text-sm sm:text-base">{businessTagline}</p>}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto relative z-10 transform transition-all duration-700 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {children}
        </div>
      </div>

      <PoweredByBuuk />
    </div>
  );
}
