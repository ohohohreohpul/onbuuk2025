import { LogIn, UserPlus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';

interface LandingPageProps {
  onSignIn: () => void;
  onSignUp: () => void;
}

const carouselImages = [
  '/pexels-skylar-kang-6045539.jpg',
  '/pexels-yankrukov-5793650.jpg',
  '/pexels-rdne-7697677.jpg'
];

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % carouselImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen flex bg-white overflow-hidden">
      <div className="hidden lg:block lg:w-[45%] relative overflow-hidden">
        {carouselImages.map((image, index) => (
          <div
            key={image}
            className={`absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ${
              index === currentImageIndex ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              backgroundImage: `url('${image}')`
            }}
          />
        ))}

        {/* Bottom shadow gradient */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />

        {/* Tagline */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-12">
          <div className="flex items-center gap-3 text-white">
            <span className="text-4xl font-light">Get booked, on</span>
            <img
              src="/blbuuklogo.png"
              alt="buuk"
              className="h-12 object-contain brightness-0 invert"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 lg:w-[55%] flex flex-col">
        <div className="flex-1 flex items-center justify-center px-6 sm:px-8 py-8">
          <div className="w-full max-w-md space-y-6">
            <div className="text-center">
              <img
                src="/buuklogo copy copy.png"
                alt="Buuk"
                className="h-12 object-contain mx-auto mb-3"
              />
              <h2 className="text-2xl font-bold text-foreground mb-1">
                Welcome Back
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose an option to get started
              </p>
            </div>

            <div className="space-y-3">
              <Card className="group cursor-pointer border-2 hover:border-primary hover:shadow-lg transition-all duration-200" onClick={onSignIn}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <LogIn className="w-5 h-5 text-primary" />
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Existing User
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">Sign In</CardTitle>
                  <CardDescription className="text-sm">
                    Access your business dashboard and manage your bookings
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <Button className="w-full" variant="ghost">
                    Continue to Sign In
                  </Button>
                </CardContent>
              </Card>

              <Card className="group cursor-pointer border-2 border-primary bg-primary text-primary-foreground hover:shadow-xl transition-all duration-200" onClick={onSignUp}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors backdrop-blur-sm">
                      <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <Badge className="bg-white/20 border-white/40 text-white backdrop-blur-sm text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Start Free
                    </Badge>
                  </div>
                  <CardTitle className="text-xl text-white">Sign Up</CardTitle>
                  <CardDescription className="text-primary-foreground/90 text-sm">
                    Create your account and start managing bookings in minutes
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <Button className="w-full bg-white text-primary hover:bg-white/90">
                    Get Started Free
                  </Button>
                </CardContent>
              </Card>
            </div>

            <div className="text-center pt-2">
              <p className="text-xs text-muted-foreground">
                Trusted by businesses worldwide to manage their appointments
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
