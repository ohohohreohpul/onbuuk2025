import { ReactNode } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';

interface DefaultLayoutProps {
  children: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
}

export default function DefaultLayout({ children, imageUrl, imageAlt = 'Massage studio' }: DefaultLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row lg:h-screen overflow-hidden relative">
      <div className="w-full lg:w-2/5 h-48 sm:h-64 lg:h-full relative overflow-hidden order-1">
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 to-stone-200">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={imageAlt}
              className="w-full h-full object-cover opacity-80"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center px-4 sm:px-8">
                <div className="w-16 h-16 sm:w-24 sm:h-24 mx-auto mb-4 sm:mb-6 rounded-full bg-stone-300/50 flex items-center justify-center">
                  <svg className="w-8 h-8 sm:w-12 sm:h-12 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl font-light text-stone-700 mb-2">Hamburg</h2>
                <p className="text-stone-600 text-sm">Holistic Massage Studio</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full lg:w-3/5 bg-white overflow-y-auto order-2 flex-1">
        <div className="h-full w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12 lg:py-16">
          {children}
        </div>
      </div>
      <PoweredByBuuk />
    </div>
  );
}
