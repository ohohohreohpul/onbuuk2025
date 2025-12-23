import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, ArrowRight, Mail, Loader2, ArrowLeft, User, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';

export function BusinessSignUp() {
  const [mode, setMode] = useState<'choice' | 'email'>('choice');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, []);

  const handleGoogleSignUp = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/admin`,
        },
      });

      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google');
      setIsSubmitting(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
          data: {
            full_name: formData.fullName,
          },
        },
      });

      if (signUpError) throw signUpError;
      if (!authData.user) throw new Error('Failed to create user account');

      if (authData.user.identities && authData.user.identities.length === 0) {
        throw new Error('This email is already registered. Please use a different email or sign in.');
      }

      const randomPermalink = `biz-${Math.random().toString(36).substring(2, 10)}`;

      const { data: business, error: businessError } = await supabase
        .from('businesses')
        .insert({
          name: null,
          permalink: randomPermalink,
          business_type: null,
          phone: null,
          address: null,
          plan_type: 'free',
          is_active: true,
          owner_id: authData.user.id,
          custom_logo_url: '/defbuuklogo.png',
          profile_completed: false,
        })
        .select()
        .single();

      if (businessError) throw new Error(`Failed to create business: ${businessError.message}`);

      const { error: adminError } = await supabase
        .from('admin_users')
        .insert({
          business_id: business.id,
          email: formData.email,
          password_hash: null,
          full_name: formData.fullName,
          role: 'owner',
          is_owner: true,
          is_active: true,
          user_id: authData.user.id,
        });

      if (adminError) throw new Error(`Failed to create admin user: ${adminError.message}`);

      await supabase.from('booking_form_colors').insert([
        { business_id: business.id, color_key: 'primary', color_value: '#008374' },
        { business_id: business.id, color_key: 'primary_hover', color_value: '#006b5e' },
        { business_id: business.id, color_key: 'secondary', color_value: '#89BA16' },
        { business_id: business.id, color_key: 'text_primary', color_value: '#171717' },
        { business_id: business.id, color_key: 'text_secondary', color_value: '#737373' },
        { business_id: business.id, color_key: 'background', color_value: '#ffffff' },
        { business_id: business.id, color_key: 'background_secondary', color_value: '#f8fafc' },
        { business_id: business.id, color_key: 'border', color_value: '#e2e8f0' },
        { business_id: business.id, color_key: 'accent', color_value: '#89BA16' },
      ]);

      const { data: adminUser } = await supabase
        .from('admin_users')
        .select('*')
        .eq('email', formData.email)
        .eq('business_id', business.id)
        .single();

      if (adminUser) {
        const adminUserData = {
          id: adminUser.id,
          email: adminUser.email,
          full_name: adminUser.full_name,
          role: adminUser.role,
          is_active: adminUser.is_active,
          business_id: adminUser.business_id,
          specialist_id: adminUser.specialist_id,
        };
        localStorage.setItem('admin_user', JSON.stringify(adminUserData));
      }

      localStorage.setItem('current_business_id', business.id);
      localStorage.setItem('business_permalink', business.permalink);

      setIsSubmitting(false);
      window.location.href = '/admin';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setIsSubmitting(false);
    }
  };


  if (mode === 'choice') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />
        <div className="absolute top-20 right-20 w-72 h-72 bg-[#008374]/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-[#89BA16]/10 rounded-full blur-3xl animate-pulse-slow animation-delay-300" />
        
        <Card glass className={`max-w-md w-full shadow-2xl shadow-black/5 transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <CardHeader className="text-center space-y-4 pb-2">
            <div className="relative mx-auto">
              <div className="absolute inset-0 bg-[#008374]/30 blur-2xl rounded-full scale-150" />
              <div className="w-20 h-20 bg-gradient-to-br from-[#008374] to-[#00a894] rounded-2xl flex items-center justify-center relative shadow-lg shadow-[#008374]/30">
                <Building2 className="w-10 h-10 text-white" />
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl">Create Your Booking System</CardTitle>
              <CardDescription className="text-base mt-2">Choose how you'd like to sign up</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {error && (
              <Alert variant="destructive" className="animate-fade-in border-red-200 bg-red-50/80 backdrop-blur-sm">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleGoogleSignUp}
              disabled={isSubmitting}
              variant="outline"
              className="w-full h-12 bg-white/70 hover:bg-white hover:shadow-md transition-all duration-200"
              size="lg"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="bg-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white/80 backdrop-blur-sm px-3 text-muted-foreground rounded-full">or</span>
              </div>
            </div>

            <Button
              onClick={() => setMode('email')}
              className="w-full h-12 bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-lg hover:shadow-[#008374]/25 transition-all duration-300"
              size="lg"
            >
              <Mail className="w-5 h-5 mr-2" />
              Continue with Email
            </Button>

            <p className="text-center text-sm text-muted-foreground pt-2">
              Already have an account?{' '}
              <a href="/login" className="text-[#008374] font-semibold hover:text-[#006b5e] hover:underline transition-colors">
                Sign in
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 gradient-mesh opacity-50 pointer-events-none" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-[#008374]/10 rounded-full blur-3xl animate-pulse-slow" />
      <div className="absolute bottom-20 left-20 w-96 h-96 bg-[#89BA16]/10 rounded-full blur-3xl animate-pulse-slow animation-delay-300" />

      <div className="max-w-md w-full relative z-10">
        <Button
          variant="ghost"
          onClick={() => setMode('choice')}
          className={`mb-6 hover:bg-white/80 transform transition-all duration-500 ${isLoaded ? 'translate-x-0 opacity-100' : '-translate-x-4 opacity-0'}`}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <Card glass className={`shadow-2xl shadow-black/5 transform transition-all duration-700 ${isLoaded ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
          <CardHeader className="text-center space-y-3 pb-2">
            <div className="relative mx-auto">
              <div className="absolute inset-0 bg-[#008374]/30 blur-2xl rounded-full scale-150" />
              <div className="w-16 h-16 bg-gradient-to-br from-[#008374] to-[#00a894] rounded-2xl flex items-center justify-center relative shadow-lg shadow-[#008374]/30">
                <Building2 className="w-8 h-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-3xl">Create Your Account</CardTitle>
            <CardDescription className="text-base">Get started in seconds</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {error && (
              <Alert variant="destructive" className="animate-fade-in border-red-200 bg-red-50/80 backdrop-blur-sm">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-[#008374] transition-colors" />
                  <Input
                    id="fullName"
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="pl-11 h-12 bg-white/70 hover:bg-white focus:bg-white"
                    placeholder="John Doe"
                    glass
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 group-focus-within:text-[#008374] transition-colors" />
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="pl-11 h-12 bg-white/70 hover:bg-white focus:bg-white"
                    placeholder="you@example.com"
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
                    required
                    minLength={8}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="pl-11 pr-11 h-12 bg-white/70 hover:bg-white focus:bg-white"
                    placeholder="Min 8 characters"
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
                disabled={isSubmitting}
                className="w-full h-12 bg-gradient-to-r from-[#008374] to-[#00a894] hover:shadow-lg hover:shadow-[#008374]/25 transition-all duration-300"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <a href="/login" className="text-[#008374] font-semibold hover:text-[#006b5e] hover:underline transition-colors">
                Sign in
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
