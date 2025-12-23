import { ReactNode, useState, useEffect } from 'react';
import { PoweredByBuuk } from '../PoweredByBuuk';
import { Check, Clock, User, Calendar } from 'lucide-react';

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
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col lg:flex-row relative">
      {/* Background decorations */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
      
      {/* Main Content */}
      <div className={`flex-1 overflow-y-auto order-2 lg:order-1 relative z-10 transform transition-all duration-700 ${isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-8 opacity-0'}`}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
          {children}
        </div>
      </div>

      {/* Sidebar - Booking Summary */}
      <aside className={`w-full lg:w-[380px] overflow-y-auto order-1 lg:order-2 relative transform transition-all duration-700 delay-200 ${isLoaded ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'}`}>
        <div className="sticky top-0 h-full lg:min-h-screen bg-white/70 backdrop-blur-xl border-b lg:border-b-0 lg:border-l border-gray-200/50">
          <div className="p-6 lg:p-8 space-y-6">
            {/* Header */}
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Booking Summary</h2>
              <p className="text-sm text-muted-foreground">Review your selection</p>
            </div>

            {/* Summary Items */}
            <div className="space-y-4">
              {/* Service */}
              <div className={`p-4 rounded-xl transition-all duration-300 ${bookingSummary?.service ? 'bg-[#008374]/5 border border-[#008374]/20' : 'bg-gray-50 border border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  {bookingSummary?.service ? (
                    <div className="w-8 h-8 rounded-lg bg-[#008374] flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Service</p>
                    {bookingSummary?.service ? (
                      <div className="mt-1">
                        <p className="font-semibold text-foreground truncate">{bookingSummary.service}</p>
                        {bookingSummary.serviceType && (
                          <span className="text-xs text-[#008374] bg-[#008374]/10 px-2 py-0.5 rounded-full mt-1 inline-block">
                            {bookingSummary.serviceType}
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1 italic">Not selected</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Duration */}
              <div className={`p-4 rounded-xl transition-all duration-300 ${bookingSummary?.duration ? 'bg-[#008374]/5 border border-[#008374]/20' : 'bg-gray-50 border border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  {bookingSummary?.duration ? (
                    <div className="w-8 h-8 rounded-lg bg-[#008374] flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duration</p>
                    {bookingSummary?.duration ? (
                      <p className="font-semibold text-foreground mt-1">{bookingSummary.duration}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1 italic">Not selected</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Specialist */}
              <div className={`p-4 rounded-xl transition-all duration-300 ${bookingSummary?.specialist ? 'bg-[#008374]/5 border border-[#008374]/20' : 'bg-gray-50 border border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  {bookingSummary?.specialist ? (
                    <div className="w-8 h-8 rounded-lg bg-[#008374] flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Specialist</p>
                    {bookingSummary?.specialist ? (
                      <p className="font-semibold text-foreground mt-1">{bookingSummary.specialist}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1 italic">Not selected</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Date & Time */}
              <div className={`p-4 rounded-xl transition-all duration-300 ${bookingSummary?.date && bookingSummary?.time ? 'bg-[#008374]/5 border border-[#008374]/20' : 'bg-gray-50 border border-gray-100'}`}>
                <div className="flex items-start gap-3">
                  {bookingSummary?.date && bookingSummary?.time ? (
                    <div className="w-8 h-8 rounded-lg bg-[#008374] flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                      <Calendar className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date & Time</p>
                    {bookingSummary?.date && bookingSummary?.time ? (
                      <p className="font-semibold text-foreground mt-1">
                        {bookingSummary.date} at {bookingSummary.time}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground mt-1 italic">Not selected</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Total */}
              {bookingSummary?.total && (
                <div className="pt-4 mt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center p-4 rounded-xl bg-gradient-to-r from-[#008374] to-[#00a894]">
                    <p className="text-base font-semibold text-white">Total</p>
                    <p className="text-2xl font-bold text-white">{bookingSummary.total}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Helper text */}
            <div className="pt-4">
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-xs text-muted-foreground text-center">
                  Complete all steps to confirm your booking
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <PoweredByBuuk />
    </div>
  );
}
