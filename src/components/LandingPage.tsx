import { LogIn, UserPlus } from 'lucide-react';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  return (
    <div className="min-h-screen flex">
      <div
        className="hidden lg:block lg:w-[40%] bg-cover bg-center"
        style={{
          backgroundImage: "url('https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')"
        }}
      />

      <div className="flex-1 lg:w-[60%] bg-white flex flex-col">
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <div className="w-full max-w-lg space-y-8">
            <div className="text-center mb-12">
              <img
                src="/buuklogo copy copy.png"
                alt="Buuk"
                className="h-16 object-contain mx-auto mb-6"
              />
              <p className="text-xl text-slate-600">
                The all-in-one booking system for your business
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={onSignIn}
                className="group w-full bg-white shadow-lg hover:shadow-xl transition-all p-8 text-left border-2 border-slate-200 hover:border-slate-900"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors">
                    <LogIn className="w-6 h-6 text-slate-700" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-2">
                  Sign In
                </h2>
                <p className="text-slate-600">
                  Already have an account? Sign in to access your business dashboard.
                </p>
              </button>

              <button
                onClick={onSignUp}
                className="group w-full bg-slate-900 shadow-lg hover:shadow-xl transition-all p-8 text-left border-2 border-slate-900 hover:border-slate-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-slate-800 flex items-center justify-center group-hover:bg-slate-700 transition-colors">
                    <UserPlus className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h2 className="text-2xl font-semibold text-white mb-2">
                  Sign Up
                </h2>
                <p className="text-slate-300">
                  New to Buuk? Create an account and start managing bookings today.
                </p>
              </button>
            </div>

            <div className="text-center pt-8">
              <p className="text-slate-500 text-sm">
                Trusted by businesses worldwide to manage their appointments and bookings
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
