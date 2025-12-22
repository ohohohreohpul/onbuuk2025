import { ReactNode } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';
import { Check } from 'lucide-react';

interface SplitPanelLayoutProps {
  children: ReactNode;
  bookingSummary?: {
    service?: string;
    serviceType?: string;
    duration?: string;
    specialist?: string;
    date?: string;
    time?: string;
    total?: string;
  };
}

export default function SplitPanelLayout({ children, bookingSummary }: SplitPanelLayoutProps) {
  return (
    <div className="min-h-screen bg-stone-50 flex flex-col lg:flex-row relative">
      <div className="flex-1 overflow-y-auto order-2 lg:order-1">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          {children}
        </div>
      </div>

      <aside className="w-full lg:w-96 bg-white border-b lg:border-b-0 lg:border-l border-stone-200 overflow-y-auto order-1 lg:order-2">
        <div className="sticky top-0 p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-stone-900 mb-2">Booking Summary</h2>
            <p className="text-sm text-stone-600">Review your selection</p>
          </div>

          <div className="space-y-4">
            {bookingSummary?.service ? (
              <div className="flex items-start gap-3 pb-4 border-b border-stone-200">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-stone-600">Service</p>
                  <div className="flex items-baseline gap-2">
                    <p className="font-medium text-stone-900">{bookingSummary.service}</p>
                    {bookingSummary.serviceType && (
                      <span className="text-xs text-stone-500">({bookingSummary.serviceType})</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="pb-4 border-b border-stone-200">
                <p className="text-sm text-stone-600">Service</p>
                <p className="text-stone-400 italic">Not selected</p>
              </div>
            )}

            {bookingSummary?.duration ? (
              <div className="flex items-start gap-3 pb-4 border-b border-stone-200">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-stone-600">Duration</p>
                  <p className="font-medium text-stone-900">{bookingSummary.duration}</p>
                </div>
              </div>
            ) : (
              <div className="pb-4 border-b border-stone-200">
                <p className="text-sm text-stone-600">Duration</p>
                <p className="text-stone-400 italic">Not selected</p>
              </div>
            )}

            {bookingSummary?.specialist ? (
              <div className="flex items-start gap-3 pb-4 border-b border-stone-200">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-stone-600">Specialist</p>
                  <p className="font-medium text-stone-900">{bookingSummary.specialist}</p>
                </div>
              </div>
            ) : (
              <div className="pb-4 border-b border-stone-200">
                <p className="text-sm text-stone-600">Specialist</p>
                <p className="text-stone-400 italic">Not selected</p>
              </div>
            )}

            {bookingSummary?.date && bookingSummary?.time ? (
              <div className="flex items-start gap-3 pb-4 border-b border-stone-200">
                <Check className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-stone-600">Date & Time</p>
                  <p className="font-medium text-stone-900">
                    {bookingSummary.date} at {bookingSummary.time}
                  </p>
                </div>
              </div>
            ) : (
              <div className="pb-4 border-b border-stone-200">
                <p className="text-sm text-stone-600">Date & Time</p>
                <p className="text-stone-400 italic">Not selected</p>
              </div>
            )}

            {bookingSummary?.total && (
              <div className="pt-2">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-semibold text-stone-900">Total</p>
                  <p className="text-2xl font-bold text-stone-900">{bookingSummary.total}</p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-stone-200">
            <div className="bg-stone-50 rounded-lg p-4">
              <p className="text-xs text-stone-600 text-center">
                Complete all steps to confirm your booking
              </p>
            </div>
          </div>
        </div>
      </aside>

      <PoweredByBuuk />
    </div>
  );
}
