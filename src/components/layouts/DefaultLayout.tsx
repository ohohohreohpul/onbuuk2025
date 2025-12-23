import { ReactNode, useEffect, useState } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';
import { useTenant } from '../../lib/tenantContext';
import { supabase } from '../../lib/supabase';

interface DefaultLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
}

export default function DefaultLayout({ children, imageUrl, imageAlt = 'Business' }: DefaultLayoutProps) {
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
    <div className="min-h-screen flex flex-col lg:flex-row lg:h-screen overflow-hidden relative bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Background decorations */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
      
      {/* Left Panel - Image */}
      <div className={`w-full lg:w-2/5 h-56 sm:h-72 lg:h-full relative overflow-hidden order-1 transform transition-all duration-700 ${isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-[#008374]/5 to-[#89BA16]/5">
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt={imageAlt}
                className="w-full h-full object-cover"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center px-4 sm:px-8">
                {/* Decorative circles */}
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-[#008374]/10 rounded-full blur-2xl scale-150 animate-pulse-slow" />
                  <div className="w-20 h-20 sm:w-28 sm:h-28 mx-auto rounded-2xl bg-gradient-to-br from-[#008374]/20 to-[#89BA16]/20 backdrop-blur-sm border border-white/50 flex items-center justify-center relative">
                    <svg className="w-10 h-10 sm:w-14 sm:h-14 text-[#008374]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
      </div>

      {/* Right Panel - Content */}
      <div className={`w-full lg:w-3/5 overflow-y-auto order-2 flex-1 relative z-10 transform transition-all duration-700 delay-200 ${isLoaded ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
        <div className="h-full w-full max-w-2xl mx-auto px-5 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16">
          {children}
        </div>
      </div>
      <PoweredByBuuk />
    </div>
  );
}
