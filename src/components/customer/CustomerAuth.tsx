import { useState, useEffect } from 'react';
import { Mail, Lock, User, Phone, X, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useCustomerAuth } from '../../hooks/useCustomerAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CustomerAuthProps {
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

export function CustomerAuth({ onClose, initialMode = 'login' }: CustomerAuthProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { signIn, signUp } = useCustomerAuth();

  useEffect(() => {
    setTimeout(() => setIsLoaded(true), 50);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        onClose();
      } else {
        await signUp(email, password, name, phone);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
      <div 
        className={`bg-white/90 backdrop-blur-xl rounded-2xl max-w-md w-full p-8 relative shadow-2xl shadow-black/10 border border-white/50 transform transition-all duration-300 ${isLoaded ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground hover:bg-gray-100 rounded-xl transition-all duration-200"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gradient-to-br from-[#008374] to-[#00a894] rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#008374]/30">
            <User className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === 'login' ? 'Sign in to manage your bookings' : 'Join us to book appointments easily'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50/80 backdrop-blur-sm text-red-600 rounded-xl text-sm border border-red-200 animate-fade-in">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'signup' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-[#008374] transition-colors" />
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-11 h-12"
                    placeholder="John Doe"
                    required
                    glass
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                <div className="relative group">
                  <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-[#008374] transition-colors" />
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-11 h-12"
                    placeholder="+1 (555) 000-0000"
                    required
                    glass
                  />
                </div>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">Email</Label>
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-[#008374] transition-colors" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-11 h-12"
                placeholder="you@example.com"
                required
                glass
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-[#008374] transition-colors" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-11 pr-11 h-12"
                placeholder="••••••••"
                required
                minLength={6}
                glass
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-lg hover:shadow-[#008374]/25 transition-all duration-300 group"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Please wait...
              </>
            ) : (
              <>
                {mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            className="text-[#008374] hover:text-[#006b5e] text-sm font-medium hover:underline transition-colors"
          >
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
