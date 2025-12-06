import { LogIn, UserPlus, Sparkles, Calendar, Users, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-slate-50">
      <div
        className="hidden lg:block lg:w-[45%] relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 z-10" />
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: "url('https://images.pexels.com/photos/3184360/pexels-photo-3184360.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')"
          }}
        />
        <div className="relative z-20 flex flex-col justify-center h-full p-12 text-white">
          <div className="space-y-6">
            <Badge className="bg-white/20 border-white/40 text-white backdrop-blur-sm w-fit">
              <Sparkles className="w-3 h-3 mr-1" />
              Modern Booking Platform
            </Badge>
            <h1 className="text-5xl font-bold leading-tight">
              Transform Your Booking Experience
            </h1>
            <p className="text-xl text-white/90">
              The all-in-one booking system designed for modern businesses. Streamline appointments, delight customers, and grow faster.
            </p>
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="space-y-2">
                <Calendar className="w-8 h-8" />
                <div className="text-2xl font-bold">10K+</div>
                <div className="text-sm text-white/80">Bookings Daily</div>
              </div>
              <div className="space-y-2">
                <Users className="w-8 h-8" />
                <div className="text-2xl font-bold">500+</div>
                <div className="text-sm text-white/80">Happy Businesses</div>
              </div>
              <div className="space-y-2">
                <TrendingUp className="w-8 h-8" />
                <div className="text-2xl font-bold">99.9%</div>
                <div className="text-sm text-white/80">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 lg:w-[55%] flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6 sm:px-8 py-12">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <img
                src="/buuklogo copy copy.png"
                alt="Buuk"
                className="h-14 object-contain mx-auto mb-4"
              />
              <h2 className="text-3xl font-bold text-foreground mb-2">
                Welcome Back
              </h2>
              <p className="text-muted-foreground">
                Choose an option to get started
              </p>
            </div>

            <div className="space-y-4">
              <Card className="group cursor-pointer border-2 hover:border-primary hover:shadow-lg transition-all duration-200" onClick={onSignIn}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <LogIn className="w-6 h-6 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Existing User
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl">Sign In</CardTitle>
                  <CardDescription className="text-base">
                    Access your business dashboard and manage your bookings
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-6">
                  <Button className="w-full" size="lg" variant="ghost">
                    Continue to Sign In
                  </Button>
                </CardContent>
              </Card>

              <Card className="group cursor-pointer border-2 border-primary bg-gradient-to-br from-primary to-primary/90 text-primary-foreground hover:shadow-xl transition-all duration-200" onClick={onSignUp}>
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-12 h-12 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors backdrop-blur-sm">
                      <UserPlus className="w-6 h-6 text-white" />
                    </div>
                    <Badge className="bg-white/20 border-white/40 text-white backdrop-blur-sm text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Start Free
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl text-white">Sign Up</CardTitle>
                  <CardDescription className="text-primary-foreground/90 text-base">
                    Create your account and start managing bookings in minutes
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-6">
                  <Button className="w-full bg-white text-primary hover:bg-white/90" size="lg">
                    Get Started Free
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="text-center pt-4">
              <p className="text-sm text-muted-foreground">
                Trusted by businesses worldwide to manage their appointments
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
