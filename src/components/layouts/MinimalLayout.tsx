import { ReactNode, useEffect, useState } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';

interface MinimalLayoutProps {
  children: ReactNode;
}

export default function MinimalLayout({ children }: MinimalLayoutProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center relative p-4 sm:p-8">
      {/* Background decorations */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#008374]/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#89BA16]/10 rounded-full blur-3xl animate-pulse-slow animation-delay-300" />
      
      <div className={`w-full max-w-2xl relative z-10 transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-white/50 shadow-xl shadow-black/5">
          <div className="px-5 sm:px-8 lg:px-12 py-8 sm:py-12 lg:py-16">
            {children}
          </div>
        </div>
      </div>
      <PoweredByBuuk />
    </div>
  );
}
