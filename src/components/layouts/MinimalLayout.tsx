import { ReactNode } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';

interface MinimalLayoutProps {
  children: ReactNode;
}

export default function MinimalLayout({ children }: MinimalLayoutProps) {
  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center relative p-4 sm:p-6">
      <div className="w-full max-w-2xl bg-white border border-stone-200 shadow-sm">
        <div className="px-4 sm:px-6 lg:px-12 py-8 sm:py-12 lg:py-16">
          {children}
        </div>
      </div>
      <PoweredByBuuk />
    </div>
  );
}
