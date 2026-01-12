import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, AlertCircle, DollarSign, Crown, Image, ToggleLeft } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { usePremiumFeatures } from '../../../hooks/usePremiumFeatures';
import { CURRENCY_NAMES, CURRENCY_SYMBOLS } from '../../../lib/currency';
import { useCurrency } from '../../../lib/currencyContext';

interface Business {
  id: string;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  logo_url: string | null;
  custom_logo_url: string | null;
  login_page_logo_url: string | null;
  hide_powered_by_badge: boolean;
  calendar_integration_enabled: boolean;
  plan_type: string;
  enable_gift_cards: boolean;
  enable_bookings: boolean;
  custom_page_title: string | null;
  custom_favicon_url: string | null;
  custom_og_image_url: string | null;
  custom_meta_description: string | null;
}

export default function GeneralSettings() {
  const { businessId } = useTenant();
  const premiumFeatures = usePremiumFeatures();
  const { currency, setCurrency: updateCurrency } = useCurrency();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLoginLogo, setUploadingLoginLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);
  const [localCurrency, setLocalCurrency] = useState<string>(currency);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, [businessId]);

  useEffect(() => {
    setLocalCurrency(currency);
  }, [currency]);

  const handleUpgrade = async () => {
    if (upgrading || !businessId) return;

    setUpgrading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upgrade-subscription`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          plan_type: 'pro',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Stripe checkout error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Upgrade error:', error);
      alert('Failed to start upgrade process. Please try again or contact support.');
      setUpgrading(false);
    }
  };

  const fetchBusiness = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (data) {
      setBusiness(data);
    }

    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !business) return;

    if (!premiumFeatures.canUseCustomLogo) {
      alert('Custom logo upload is a Pro feature. Please upgrade to continue.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    setUploadingLogo(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;

        const { error: updateError } = await supabase
          .from('businesses')
          .update({ custom_logo_url: dataUrl })
          .eq('id', businessId);

        if (updateError) throw updateError;

        setBusiness({ ...business, custom_logo_url: dataUrl });
        setSavedMessage('Logo uploaded successfully!');
        setTimeout(() => setSavedMessage(''), 3000);
        setUploadingLogo(false);
      };

      reader.onerror = () => {
        console.error('Error reading file');
        alert('Failed to upload logo. Please try again.');
        setUploadingLogo(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert('Failed to upload logo. Please try again.');
      setUploadingLogo(false);
    }
  };

  const handleLoginLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !business) return;

    if (!premiumFeatures.canUseCustomLogo) {
      alert('Custom logo upload is a Pro feature. Please upgrade to continue.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be less than 2MB');
      return;
    }

    setUploadingLoginLogo(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;

        const { error: updateError } = await supabase
          .from('businesses')
          .update({ login_page_logo_url: dataUrl })
          .eq('id', businessId);

        if (updateError) throw updateError;

        setBusiness({ ...business, login_page_logo_url: dataUrl });
        setSavedMessage('Login page logo uploaded successfully!');
        setTimeout(() => setSavedMessage(''), 3000);
        setUploadingLoginLogo(false);
      };

      reader.onerror = () => {
        console.error('Error reading file');
        alert('Failed to upload login logo. Please try again.');
        setUploadingLoginLogo(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading login logo:', error);
      alert('Failed to upload login logo. Please try again.');
      setUploadingLoginLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!businessId || !business) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ custom_logo_url: '/defbuuklogo.png' })
        .eq('id', businessId);

      if (error) throw error;

      setBusiness({ ...business, custom_logo_url: '/defbuuklogo.png' });
      setSavedMessage('Logo removed successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error removing logo:', error);
      alert('Failed to remove logo. Please try again.');
    }
  };

  const handleRemoveLoginLogo = async () => {
    if (!businessId || !business) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ login_page_logo_url: null })
        .eq('id', businessId);

      if (error) throw error;

      setBusiness({ ...business, login_page_logo_url: null });
      setSavedMessage('Login page logo reset to default!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error removing login logo:', error);
      alert('Failed to remove login logo. Please try again.');
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !business) return;

    if (!premiumFeatures.isPro) {
      alert('Custom favicon is a Pro feature. Please upgrade to continue.');
      return;
    }

    // Favicon should be small - max 500KB
    if (file.size > 500 * 1024) {
      alert('Favicon must be less than 500KB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, ICO, or SVG recommended)');
      return;
    }

    setUploadingFavicon(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}/branding/favicon-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload to storage');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('businesses')
        .update({ custom_favicon_url: publicUrl })
        .eq('id', businessId);

      if (updateError) throw updateError;

      setBusiness({ ...business, custom_favicon_url: publicUrl });
      setSavedMessage('Favicon uploaded successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error uploading favicon:', error);
      alert('Failed to upload favicon. Please try again.');
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleRemoveFavicon = async () => {
    if (!businessId || !business) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ custom_favicon_url: null })
        .eq('id', businessId);

      if (error) throw error;

      setBusiness({ ...business, custom_favicon_url: null });
      setSavedMessage('Favicon removed - will use default Buuk icon');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error removing favicon:', error);
      alert('Failed to remove favicon. Please try again.');
    }
  };

  const handleOgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !business) return;

    if (!premiumFeatures.isPro) {
      alert('Custom social preview image is a Pro feature. Please upgrade to continue.');
      return;
    }

    // OG images can be larger - max 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert('Social preview image must be less than 2MB');
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG or JPG recommended)');
      return;
    }

    setUploadingOgImage(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;

        const { error: updateError } = await supabase
          .from('businesses')
          .update({ custom_og_image_url: dataUrl })
          .eq('id', businessId);

        if (updateError) throw updateError;

        setBusiness({ ...business, custom_og_image_url: dataUrl });
        setSavedMessage('Social preview image uploaded successfully!');
        setTimeout(() => setSavedMessage(''), 3000);
        setUploadingOgImage(false);
      };

      reader.onerror = () => {
        console.error('Error reading file');
        alert('Failed to upload image. Please try again.');
        setUploadingOgImage(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading social preview image:', error);
      alert('Failed to upload image. Please try again.');
      setUploadingOgImage(false);
    }
  };

  const handleRemoveOgImage = async () => {
    if (!businessId || !business) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ custom_og_image_url: null })
        .eq('id', businessId);

      if (error) throw error;

      setBusiness({ ...business, custom_og_image_url: null });
      setSavedMessage('Social preview image removed - will use default');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error removing social preview image:', error);
      alert('Failed to remove image. Please try again.');
    }
  };


  const handleSave = async () => {
    if (!business) return;

    setSaving(true);
    setSavedMessage('');

    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: business.name,
          custom_domain: business.custom_domain,
          logo_url: business.logo_url,
          custom_logo_url: business.custom_logo_url,
          login_page_logo_url: business.login_page_logo_url,
          hide_powered_by_badge: business.hide_powered_by_badge,
          enable_gift_cards: business.enable_gift_cards,
          enable_bookings: business.enable_bookings,
          custom_page_title: business.custom_page_title,
          custom_favicon_url: business.custom_favicon_url,
          custom_og_image_url: business.custom_og_image_url,
          custom_meta_description: business.custom_meta_description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', business.id);

      if (error) throw error;

      if (localCurrency !== currency) {
        await updateCurrency(localCurrency);
      }

      setSavedMessage('Settings saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Failed to save settings. Please check the console for details.');
    } finally {
      setSaving(false);
    }
  };

  if (loading || premiumFeatures.isLoading) {
    return <div className="text-stone-600">Loading...</div>;
  }

  if (!business) {
    return <div className="text-stone-600">Business not found</div>;
  }

  return (
    <div className="space-y-6">
      {premiumFeatures.isPro && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-4 flex items-center space-x-3">
          <Crown className="w-6 h-6 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900">Pro Plan</h3>
            <p className="text-sm text-amber-800">You have access to all Pro features</p>
          </div>
        </div>
      )}

      {!premiumFeatures.isPro && premiumFeatures.limits && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">Standard Plan</h3>
                <p className="text-sm text-blue-800">Limited to {premiumFeatures.limits.maxStaff ?? 5} staff and {premiumFeatures.limits.maxServices ?? 20} services</p>
                <p className="text-xs text-blue-700 mt-1">Currently using: {premiumFeatures.limits.currentStaff ?? 0} staff, {premiumFeatures.limits.currentServices ?? 0} services</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4">Business Information</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Business Name
            </label>
            <input
              type="text"
              value={business.name}
              onChange={(e) => setBusiness({ ...business, name: e.target.value })}
              className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center space-x-2">
              <Image className="w-4 h-4" />
              <span>Custom Brand Logo</span>
              {!premiumFeatures.isPro && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center space-x-1">
                  <Crown className="w-3 h-3" />
                  <span>Pro</span>
                </span>
              )}
            </label>
            <div className="space-y-3">
              {premiumFeatures.isPro ? (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-stone-800 file:text-white hover:file:bg-stone-700"
                  />
                  {uploadingLogo && (
                    <p className="text-sm text-stone-600">Uploading logo...</p>
                  )}
                </>
              ) : (
                <div className="bg-stone-50 border border-stone-200 rounded p-4 text-center">
                  <Crown className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm text-stone-600">Upgrade to Pro to upload your custom brand logo</p>
                </div>
              )}
              {business.custom_logo_url && (
                <div className="flex items-center space-x-4">
                  <img
                    src={business.custom_logo_url}
                    alt="Logo preview"
                    className="h-16 object-contain border border-stone-200 rounded p-2 bg-white"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {premiumFeatures.isPro && business.custom_logo_url !== '/defbuuklogo.png' && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {premiumFeatures.isPro
                ? 'Upload a custom logo for your brand (PNG, JPG, max 2MB) - shown in admin panel'
                : 'Using default buuk logo'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center space-x-2">
              <Image className="w-4 h-4" />
              <span>Admin Login Page Logo</span>
              {!premiumFeatures.isPro && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center space-x-1">
                  <Crown className="w-3 h-3" />
                  <span>Pro</span>
                </span>
              )}
            </label>
            <div className="space-y-3">
              {premiumFeatures.isPro ? (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLoginLogoUpload}
                    className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-stone-800 file:text-white hover:file:bg-stone-700"
                  />
                  {uploadingLoginLogo && (
                    <p className="text-sm text-stone-600">Uploading login logo...</p>
                  )}
                </>
              ) : (
                <div className="bg-stone-50 border border-stone-200 rounded p-4 text-center">
                  <Crown className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm text-stone-600 mb-2">Upgrade to Pro to customize your login page logo</p>
                  <button
                    type="button"
                    className="text-sm text-amber-600 hover:text-amber-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? 'Processing...' : 'Upgrade Now →'}
                  </button>
                </div>
              )}
              {business.login_page_logo_url && (
                <div className="flex items-center space-x-4">
                  <div className="bg-stone-100 p-4 rounded border border-stone-200">
                    <img
                      src={business.login_page_logo_url}
                      alt="Login logo preview"
                      className="h-16 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  {premiumFeatures.isPro && (
                    <button
                      type="button"
                      onClick={handleRemoveLoginLogo}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>
              )}
              {!business.login_page_logo_url && (
                <div className="flex items-center space-x-4">
                  <div className="bg-stone-100 p-4 rounded border border-stone-200">
                    <img
                      src="/blbuuklogo.png"
                      alt="Default login logo"
                      className="h-16 object-contain"
                    />
                  </div>
                  <span className="text-sm text-stone-600">Default Buuk logo</span>
                </div>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {premiumFeatures.isPro
                ? 'Upload a logo specifically for your admin login page (PNG, JPG, max 2MB)'
                : 'Using default buuk logo on login page'}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <span>Currency Settings</span>
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Currency
            </label>
            <select
              value={localCurrency}
              onChange={(e) => setLocalCurrency(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
            >
              {Object.entries(CURRENCY_NAMES).map(([code, name]) => (
                <option key={code} value={code}>
                  {CURRENCY_SYMBOLS[code]} {name} ({code})
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-500 mt-1">
              This currency will be used throughout your booking system
            </p>
          </div>
        </div>
      </div>

      {savedMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{savedMessage}</span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <ToggleLeft className="w-5 h-5" />
          <span>Feature Toggles</span>
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-stone-200 rounded">
            <div>
              <h4 className="font-medium text-stone-800">Enable Booking Services</h4>
              <p className="text-sm text-stone-600">Allow customers to book appointments through your booking form</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={business.enable_bookings}
                onChange={(e) => setBusiness({ ...business, enable_bookings: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-800"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-stone-200 rounded">
            <div>
              <h4 className="font-medium text-stone-800">Enable Gift Card Sales</h4>
              <p className="text-sm text-stone-600">Allow customers to purchase gift cards through your booking form</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={business.enable_gift_cards}
                onChange={(e) => setBusiness({ ...business, enable_gift_cards: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-800"></div>
            </label>
          </div>

          {!business.enable_bookings && !business.enable_gift_cards && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">Warning: Both features are disabled</p>
                <p className="mt-1">At least one feature should be enabled for your booking form to function properly.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <Crown className="w-5 h-5" />
          <span>Pro Features</span>
          {!premiumFeatures.isPro && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center space-x-1">
              <Crown className="w-3 h-3" />
              <span>Pro</span>
            </span>
          )}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-stone-200 rounded">
            <div>
              <h4 className="font-medium text-stone-800">Hide "Powered by buuk" Badge</h4>
              <p className="text-sm text-stone-600">Remove the buuk branding from your booking pages</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={business.hide_powered_by_badge}
                onChange={(e) => {
                  if (!premiumFeatures.isPro) {
                    alert('This is a Pro feature. Please upgrade to continue.');
                    return;
                  }
                  setBusiness({ ...business, hide_powered_by_badge: e.target.checked });
                }}
                disabled={!premiumFeatures.isPro}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
            </label>
          </div>

          {/* Custom Branding Section */}
          <div className="p-4 border border-stone-200 rounded space-y-4">
            <div>
              <h4 className="font-medium text-stone-800 mb-1">Custom Branding</h4>
              <p className="text-sm text-stone-600 mb-4">Customize the page title, favicon, and social media preview for your booking pages when using a custom domain.</p>
            </div>

            {/* Custom Page Title */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Page Title (Browser Tab)
              </label>
              <input
                type="text"
                value={business.custom_page_title || ''}
                onChange={(e) => {
                  if (!premiumFeatures.isPro) {
                    alert('This is a Pro feature. Please upgrade to continue.');
                    return;
                  }
                  setBusiness({ ...business, custom_page_title: e.target.value || null });
                }}
                disabled={!premiumFeatures.isPro}
                placeholder={business.name || 'Your Business Name'}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 disabled:bg-stone-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-stone-500 mt-1">This will appear in the browser tab when customers visit your booking page</p>
            </div>

            {/* Custom Meta Description */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Meta Description (SEO & Social Preview)
              </label>
              <textarea
                value={business.custom_meta_description || ''}
                onChange={(e) => {
                  if (!premiumFeatures.isPro) {
                    alert('This is a Pro feature. Please upgrade to continue.');
                    return;
                  }
                  setBusiness({ ...business, custom_meta_description: e.target.value || null });
                }}
                disabled={!premiumFeatures.isPro}
                placeholder="Book your appointment easily and manage your schedule with our online booking system."
                rows={3}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 disabled:bg-stone-100 disabled:cursor-not-allowed resize-none"
              />
              <p className="text-xs text-stone-500 mt-1">This description appears when your link is shared on social media (WhatsApp, Facebook, etc.)</p>
            </div>

            {/* Custom Favicon Upload */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Favicon (Browser Tab Icon)
              </label>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {business.custom_favicon_url ? (
                    <div className="w-16 h-16 border border-stone-200 rounded flex items-center justify-center bg-stone-50">
                      <img 
                        src={business.custom_favicon_url} 
                        alt="Favicon preview" 
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/iconobrowser.png';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 border border-dashed border-stone-300 rounded flex items-center justify-center bg-stone-50">
                      <Image className="w-6 h-6 text-stone-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <label className={`px-4 py-2 border border-stone-300 rounded cursor-pointer hover:bg-stone-50 transition-colors text-sm ${!premiumFeatures.isPro ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="file"
                        accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
                        onChange={handleFaviconUpload}
                        disabled={!premiumFeatures.isPro || uploadingFavicon}
                        className="hidden"
                      />
                      {uploadingFavicon ? 'Uploading...' : 'Upload Favicon'}
                    </label>
                    {business.custom_favicon_url && (
                      <button
                        onClick={handleRemoveFavicon}
                        disabled={!premiumFeatures.isPro}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm transition-colors disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-2">Recommended: 32x32px or 64x64px PNG. Max 500KB.</p>
                </div>
              </div>
            </div>

            {/* Custom Social Preview Image Upload */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Social Preview Image
              </label>
              <p className="text-xs text-stone-500 mb-3">This image appears when your link is shared on WhatsApp, Facebook, Twitter, etc.</p>
              <div className="space-y-3">
                {business.custom_og_image_url ? (
                  <div className="border border-stone-200 rounded overflow-hidden">
                    <img 
                      src={business.custom_og_image_url} 
                      alt="Social preview" 
                      className="w-full max-w-md h-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-md h-40 border border-dashed border-stone-300 rounded flex items-center justify-center bg-stone-50">
                    <div className="text-center">
                      <Image className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                      <p className="text-sm text-stone-500">No image uploaded</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <label className={`px-4 py-2 border border-stone-300 rounded cursor-pointer hover:bg-stone-50 transition-colors text-sm ${!premiumFeatures.isPro ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleOgImageUpload}
                      disabled={!premiumFeatures.isPro || uploadingOgImage}
                      className="hidden"
                    />
                    {uploadingOgImage ? 'Uploading...' : 'Upload Image'}
                  </label>
                  {business.custom_og_image_url && (
                    <button
                      onClick={handleRemoveOgImage}
                      disabled={!premiumFeatures.isPro}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-500">Recommended: 1200x630px PNG or JPG. Max 2MB.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>
    </div>
  );
}
