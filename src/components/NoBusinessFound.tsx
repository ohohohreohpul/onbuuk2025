import { Building2, AlertCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useEffect, useState } from 'react';

const RESERVED_ROUTES = [
  'admin',
  'staff',
  'superadmin',
  'login',
  'register',
  'signup',
  'signup-success',
  'forgot-password',
  'reset-password',
  'cancel',
  'account',
  'accept-invite',
  'booking-success',
  'gift-card-success',
  'payment-cancelled',
];

export function NoBusinessFound() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const currentPath = window.location.pathname;
  const pathParts = currentPath.split('/').filter(p => p);
  const firstSegment = pathParts[0];

  const isReservedRoute = firstSegment && RESERVED_ROUTES.includes(firstSegment);
  const attemptedPermalink = firstSegment && !isReservedRoute ? firstSegment : null;

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 100);
    
    // Auto-retry once after a short delay (handles race conditions)
    if (attemptedPermalink && retryCount === 0) {
      const timer = setTimeout(() => {
        setRetryCount(1);
        window.location.reload();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [attemptedPermalink, retryCount]);

  const handleRetry = () => {
    setIsRetrying(true);
    // Clear any cached data that might be stale
    localStorage.removeItem('current_business_id');
    localStorage.removeItem('business_permalink');
    // Force reload
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 gradient-mesh opacity-30 pointer-events-none" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#008374]/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#89BA16]/10 rounded-full blur-3xl animate-pulse-slow animation-delay-300" />
      
      <Card 
        glass 
        className={`max-w-md w-full shadow-2xl shadow-black/5 transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-8 opacity-0 scale-95'}`}
      >
        <CardContent className="p-8 text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-[#008374]/20 rounded-full blur-xl scale-150 opacity-50" />
            <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto relative">
              <AlertCircle className="w-8 h-8 text-gray-500" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Business Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {attemptedPermalink ? (
              <>
                The booking page <span className="font-semibold text-foreground">/{attemptedPermalink}</span> could not be found.
              </>
            ) : (
              <>This page could not be found or is not configured yet.</>
            )}
          </p>

          {attemptedPermalink && (
            <p className="text-sm text-muted-foreground mb-6">
              This might be a temporary issue. Please try refreshing the page.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {attemptedPermalink && (
              <Button
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full h-12 bg-gradient-to-r from-blue-500 to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-300 group"
                size="lg"
              >
                <RefreshCw className={`w-5 h-5 mr-2 ${isRetrying ? 'animate-spin' : ''}`} />
                {isRetrying ? 'Refreshing...' : 'Try Again'}
              </Button>
            )}
            
            <Button
              asChild
              className="w-full h-12 bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-lg hover:shadow-[#008374]/25 transition-all duration-300 group"
              size="lg"
            >
              <a href="/register">
                <Building2 className="w-5 h-5 mr-2" />
                Create New Business
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </a>
            </Button>
            <a
              href="/"
              className="text-muted-foreground hover:text-[#008374] transition-colors text-sm py-2"
            >
              Go to Homepage
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
