import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Store, AlertCircle, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';

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

interface Business {
  id: string;
  name: string | null;
  business_type: string | null;
  phone: string | null;
  address: string | null;
  permalink: string;
  profile_completed: boolean;
}

export default function StoreProfile() {
  const { businessId } = useTenant();
  const [business, setBusiness] = useState<Business | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    business_type: 'salon',
    phone: '',
    address: '',
    permalink: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');
  const [permalinkAvailable, setPermalinkAvailable] = useState(true);
  const [checkingPermalink, setCheckingPermalink] = useState(false);
  const [isReservedRoute, setIsReservedRoute] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, [businessId]);

  const fetchBusiness = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (data) {
      setBusiness(data);
      setFormData({
        name: data.name || '',
        business_type: data.business_type || 'salon',
        phone: data.phone || '',
        address: data.address || '',
        permalink: data.permalink || '',
      });
    }

    if (error) {
      console.error('Error fetching business:', error);
    }

    setLoading(false);
  };

  const checkPermalinkAvailability = async (permalink: string) => {
    if (!permalink || permalink === business?.permalink) {
      setPermalinkAvailable(true);
      return;
    }

    setCheckingPermalink(true);

    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('permalink', permalink)
      .maybeSingle();

    setPermalinkAvailable(!data);
    setCheckingPermalink(false);
  };

  const handlePermalinkChange = (value: string) => {
    const sanitized = value
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    const isReserved = RESERVED_ROUTES.includes(sanitized);
    setIsReservedRoute(isReserved);

    setFormData({ ...formData, permalink: sanitized });

    if (!isReserved) {
      checkPermalinkAvailability(sanitized);
    } else {
      setPermalinkAvailable(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessId) return;
    if (isReservedRoute) {
      setError('This permalink is reserved by the system. Please choose a different one.');
      return;
    }
    if (!permalinkAvailable) {
      setError('This permalink is already taken. Please choose another one.');
      return;
    }

    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const isFirstCompletion = !business?.profile_completed && formData.name;

      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          name: formData.name,
          business_type: formData.business_type,
          phone: formData.phone,
          address: formData.address,
          permalink: formData.permalink,
          profile_completed: isFirstCompletion ? true : business?.profile_completed,
        })
        .eq('id', businessId);

      if (updateError) throw updateError;

      localStorage.setItem('business_permalink', formData.permalink);

      setSavedMessage('Store profile saved successfully!');
      await fetchBusiness();

      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const getCompletionPercentage = () => {
    const fields = [formData.name, formData.business_type, formData.phone, formData.address, formData.permalink];
    const completed = fields.filter(f => f && f.trim() !== '').length;
    return Math.round((completed / fields.length) * 100);
  };

  const bookingUrl = `${window.location.origin}/${formData.permalink}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-600">Loading...</div>
      </div>
    );
  }

  const completionPercentage = getCompletionPercentage();

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Store className="w-8 h-8 text-stone-900" />
            <div>
              <h2 className="text-2xl font-bold text-stone-900">Store Profile</h2>
              <p className="text-stone-600 text-sm">Manage your business information</p>
            </div>
          </div>

          {!business?.profile_completed && (
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">
                {completionPercentage}% Complete
              </span>
            </div>
          )}
        </div>

        {!business?.profile_completed && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Complete Your Profile</h3>
                <p className="text-sm text-blue-800">
                  Fill out your store information to start accepting bookings. Your booking page will be available once your profile is complete.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {savedMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{savedMessage}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
          <h3 className="text-lg font-semibold text-stone-900">Basic Information</h3>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Business Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="My Awesome Salon"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Business Type <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.business_type}
              onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent bg-white"
            >
              <option value="salon">Salon</option>
              <option value="spa">Spa</option>
              <option value="massage_studio">Massage Studio</option>
              <option value="barbershop">Barbershop</option>
              <option value="nail_salon">Nail Salon</option>
              <option value="wellness_center">Wellness Center</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Business Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="123 Main St, City, State 12345"
            />
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
          <h3 className="text-lg font-semibold text-stone-900">Booking Page URL</h3>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Permalink <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <input
                type="text"
                required
                value={formData.permalink}
                onChange={(e) => handlePermalinkChange(e.target.value)}
                className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                placeholder="your-business-name"
              />
              {checkingPermalink ? (
                <p className="text-sm text-stone-600">Checking availability...</p>
              ) : isReservedRoute ? (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  This permalink is reserved by the system
                </p>
              ) : !permalinkAvailable ? (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  This permalink is already taken
                </p>
              ) : formData.permalink ? (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  This permalink is available
                </p>
              ) : null}
            </div>
          </div>

          {formData.permalink && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Your Booking Page URL
              </label>
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-stone-400" />
                <code className="flex-1 text-sm text-stone-900 break-all">{bookingUrl}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bookingUrl);
                    setSavedMessage('URL copied to clipboard!');
                    setTimeout(() => setSavedMessage(''), 2000);
                  }}
                  className="px-3 py-1.5 bg-stone-900 text-white text-sm rounded hover:bg-stone-800 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !permalinkAvailable || isReservedRoute}
            className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
