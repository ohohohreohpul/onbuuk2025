import { LogIn, UserPlus, Sparkles, Calendar, Gift, Shield, Zap, ArrowRight } from 'lucide-react';
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

const features = [
  {
    icon: Calendar,
    title: 'Smart Scheduling',
    description: 'AI-powered booking system that optimizes your calendar'
  },
  {
    icon: Gift,
    title: 'Gift Cards',
    description: 'Sell digital gift cards and grow your business'
  },
  {
    icon: Shield,
    title: 'Secure Payments',
    description: 'Enterprise-grade security for all transactions'
  },
  {
    icon: Zap,
    title: 'Real-time Sync',
    description: 'Instant updates across all your devices'
  }
];

export function LandingPage({ onSignIn, onSignUp }: LandingPageProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % carouselImages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-slate-100 overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 gradient-mesh opacity-70 pointer-events-none" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-[#008374]/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#89BA16]/10 rounded-full blur-3xl animate-pulse-slow animation-delay-300" />
      
      {/* Left Panel - Image Carousel */}
      <div className="hidden lg:block lg:w-[45%] relative overflow-hidden">
        {carouselImages.map((image, index) => (
          <div
            key={image}
            className={`absolute inset-0 bg-cover bg-center transition-all duration-1000 ${
              index === currentImageIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
            }`}
            style={{
              backgroundImage: `url('${image}')`
            }}
          />
        ))}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent z-10" />
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-10" />

        {/* Tagline */}
        <div className={`absolute bottom-0 left-0 right-0 z-20 p-12 transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-white">
              <span className="text-4xl font-light tracking-tight">Get booked, on</span>
              <img
                src="/blbuuklogo.png"
                alt="buuk"
                className="h-12 object-contain brightness-0 invert"
              />
            </div>
            <p className="text-white/70 text-lg max-w-md">
              The modern booking platform for forward-thinking businesses
            </p>
          </div>
          
          {/* Carousel indicators */}
          <div className="flex gap-2 mt-8">
            {carouselImages.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentImageIndex(index)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  index === currentImageIndex 
                    ? 'w-8 bg-white' 
                    : 'w-2 bg-white/40 hover:bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Auth Options */}
      <div className="flex-1 lg:w-[55%] flex flex-col relative z-10">
        <div className="flex-1 flex items-center justify-center px-6 sm:px-8 py-12">
          <div className="w-full max-w-md space-y-8">
            {/* Logo and heading */}
            <div className={`text-center transform transition-all duration-700 delay-100 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <div className="relative inline-block mb-6">
                <div className="absolute inset-0 bg-[#008374]/20 blur-2xl rounded-full scale-150" />
                <img
                  src="/buuklogo copy copy.png"
                  alt="Buuk"
                  className="h-14 object-contain mx-auto relative"
                />
              </div>
              <h2 className="text-3xl font-bold text-foreground mb-2 tracking-tight">
                Welcome Back
              </h2>
              <p className="text-muted-foreground">
                Choose an option to get started
              </p>
            </div>

            {/* Auth Cards */}
            <div className={`space-y-4 transform transition-all duration-700 delay-200 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              {/* Sign In Card */}
              <Card 
                glass
                className="group cursor-pointer border-2 border-transparent hover:border-[#008374]/30 hover:shadow-xl hover:shadow-[#008374]/10 hover-lift" 
                onClick={onSignIn}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-[#008374]/10 rounded-xl flex items-center justify-center group-hover:bg-[#008374]/20 group-hover:scale-110 transition-all duration-300">
                      <LogIn className="w-5 h-5 text-[#008374]" />
                    </div>
                    <Badge variant="outline" className="text-xs rounded-full px-3 border-gray-200">
                      Existing User
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">Sign In</CardTitle>
                  <CardDescription>
                    Access your business dashboard and manage your bookings
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-5">
                  <Button className="w-full group/btn" variant="ghost">
                    Continue to Sign In
                    <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>

              {/* Sign Up Card */}
              <Card 
                className="group cursor-pointer border-2 border-[#008374] bg-gradient-to-br from-[#008374] to-[#006b5e] text-white hover:shadow-2xl hover:shadow-[#008374]/30 hover-lift overflow-hidden relative" 
                onClick={onSignUp}
              >
                {/* Animated background effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                
                <CardHeader className="pb-4 relative">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 group-hover:scale-110 transition-all duration-300 backdrop-blur-sm">
                      <UserPlus className="w-5 h-5 text-white" />
                    </div>
                    <Badge className="bg-white/20 border-white/40 text-white backdrop-blur-sm rounded-full px-3">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Start Free
                    </Badge>
                  </div>
                  <CardTitle className="text-xl text-white">Sign Up</CardTitle>
                  <CardDescription className="text-white/80">
                    Create your account and start managing bookings in minutes
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-5 relative">
                  <Button className="w-full bg-white text-[#008374] hover:bg-white/90 hover:shadow-lg group/btn">
                    Get Started Free
                    <ArrowRight className="w-4 h-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Features Grid */}
            <div className={`grid grid-cols-2 gap-3 transform transition-all duration-700 delay-300 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              {features.map((feature, index) => (
                <div 
                  key={feature.title}
                  className={`p-4 rounded-xl bg-white/50 backdrop-blur-sm border border-gray-100 hover:bg-white hover:shadow-md transition-all duration-300 animation-delay-${(index + 1) * 100}`}
                >
                  <feature.icon className="w-5 h-5 text-[#008374] mb-2" />
                  <h4 className="text-sm font-medium text-foreground">{feature.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{feature.description}</p>
                </div>
              ))}
            </div>

            {/* Footer text */}
            <div className={`text-center pt-4 transform transition-all duration-700 delay-400 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
              <p className="text-xs text-muted-foreground">
                Trusted by <span className="font-semibold text-foreground">10,000+</span> businesses worldwide
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
