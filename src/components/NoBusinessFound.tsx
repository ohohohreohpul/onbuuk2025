import { Building2, AlertCircle } from 'lucide-react';

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
];

export function NoBusinessFound() {
  const currentPath = window.location.pathname;
  const pathParts = currentPath.split('/').filter(p => p);
  const firstSegment = pathParts[0];

  const isReservedRoute = firstSegment && RESERVED_ROUTES.includes(firstSegment);
  const attemptedPermalink = firstSegment && !isReservedRoute ? firstSegment : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 to-stone-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-stone-600" />
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">Business Not Found</h2>
        <p className="text-stone-600 mb-6">
          {attemptedPermalink ? (
            <>
              The booking page <span className="font-semibold text-stone-900">/{attemptedPermalink}</span> could not be found.
            </>
          ) : (
            <>This page could not be found or is not configured yet.</>
          )}
        </p>

        <div className="flex flex-col gap-3">
          <a
            href="/register"
            className="bg-stone-900 text-white py-3 px-6 rounded-lg font-semibold hover:bg-stone-800 transition-colors inline-flex items-center justify-center gap-2"
          >
            <Building2 className="w-5 h-5" />
            Create New Business
          </a>
          <a
            href="/"
            className="text-stone-600 hover:text-stone-900 transition-colors text-sm"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    </div>
  );
}
