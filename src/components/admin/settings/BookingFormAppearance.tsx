import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Layout, Save, CheckCircle, AlertCircle, Type, Palette, Image as ImageIcon, Settings, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';

interface ColorPickerProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  previewType: 'button' | 'swatch' | 'text' | 'border';
  previewText?: string;
  backgroundColor?: string;
}

const ColorPicker = ({ label, description, value, onChange, previewType, previewText, backgroundColor }: ColorPickerProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleColorChange = (newValue: string) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  const handleTextChange = (newValue: string) => {
    setLocalValue(newValue);
    if (/^#[0-9A-F]{6}$/i.test(newValue)) {
      onChange(newValue);
    }
  };

  const renderPreview = () => {
    switch (previewType) {
      case 'button':
        return (
          <div
            className="px-4 py-2 rounded-lg text-white font-medium text-sm whitespace-nowrap transition-colors"
            style={{ backgroundColor: localValue }}
          >
            {previewText || 'Preview'}
          </div>
        );
      case 'swatch':
        return (
          <div
            className="w-24 h-10 rounded border border-stone-300 transition-colors"
            style={{ backgroundColor: localValue }}
          />
        );
      case 'text':
        return (
          <div
            className="px-4 py-2 rounded font-bold whitespace-nowrap transition-colors"
            style={{ color: localValue, backgroundColor: backgroundColor || '#ffffff' }}
          >
            {previewText || 'Text'}
          </div>
        );
      case 'border':
        return (
          <div
            className="w-24 h-10 rounded transition-all"
            style={{ border: `2px solid ${localValue}`, backgroundColor: backgroundColor || '#ffffff' }}
          />
        );
    }
  };

  return (
    <div className="space-y-2">
      <div>
        <label className="block text-sm font-medium text-stone-900 mb-0.5">
          {label}
        </label>
        <p className="text-xs text-stone-600">
          {description}
        </p>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={localValue}
          onChange={(e) => handleColorChange(e.target.value)}
          className="w-12 h-10 rounded border border-stone-300 cursor-pointer"
        />
        <input
          type="text"
          value={localValue}
          onChange={(e) => handleTextChange(e.target.value)}
          className="flex-1 px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent font-mono uppercase"
          placeholder="#000000"
          maxLength={7}
        />
        {renderPreview()}
      </div>
    </div>
  );
};

type LayoutType = 'default' | 'vertical' | 'minimal' | 'split-panel';

interface StepContent {
  title: string;
  subtitle: string;
  buttonText: string;
  [key: string]: any;
}

interface Colors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  error: string;
  warning: string;
}

interface Typography {
  fontFamily: string;
  headingSize: string;
  bodySize: string;
  headingWeight: string;
  bodyWeight: string;
}

interface Styling {
  borderRadius: string;
  spacing: string;
  shadowLevel: string;
  progressBarStyle: string;
  showStepNumbers: boolean;
  animationsEnabled: boolean;
  layout: LayoutType;
}

interface BookingFormCustomization {
  id?: string;
  business_id: string;
  welcome_step: StepContent;
  service_step: StepContent;
  duration_step: StepContent;
  specialist_step: StepContent;
  datetime_step: StepContent;
  details_step: StepContent;
  addons_step: StepContent;
  payment_step: StepContent;
  welcome_image_url: string | null;
  service_image_url: string | null;
  duration_image_url: string | null;
  specialist_image_url: string | null;
  datetime_image_url: string | null;
  details_image_url: string | null;
  addons_image_url: string | null;
  payment_image_url: string | null;
  colors: Colors;
  typography: Typography;
  styling: Styling;
}

const DEFAULT_CUSTOMIZATION: Omit<BookingFormCustomization, 'id' | 'business_id'> = {
  welcome_step: {
    title: "Welcome! Let's get you booked",
    subtitle: "Choose your preferred service and time",
    buttonText: "Get Started"
  },
  service_step: {
    title: "Choose Your Service",
    subtitle: "Select the service you would like to book",
    buttonText: "Continue"
  },
  duration_step: {
    title: "Select Duration",
    subtitle: "How long would you like your appointment?",
    buttonText: "Continue"
  },
  specialist_step: {
    title: "Choose Your Specialist",
    subtitle: "Select your preferred specialist or let us choose for you",
    buttonText: "Continue",
    anySpecialistText: "Any Available Specialist"
  },
  datetime_step: {
    title: "Select Date & Time",
    subtitle: "Choose your preferred appointment date and time",
    buttonText: "Continue"
  },
  details_step: {
    title: "Your Details",
    subtitle: "Please provide your contact information",
    buttonText: "Continue",
    labels: {
      name: "Full Name",
      email: "Email Address",
      phone: "Phone Number",
      notes: "Additional Notes (Optional)"
    }
  },
  addons_step: {
    title: "Enhance Your Experience",
    subtitle: "Add optional products or services",
    buttonText: "Continue",
    skipButtonText: "Skip Add-ons"
  },
  payment_step: {
    title: "Payment",
    subtitle: "Complete your booking",
    buttonText: "Confirm Booking"
  },
  welcome_image_url: null,
  service_image_url: null,
  duration_image_url: null,
  specialist_image_url: null,
  datetime_image_url: null,
  details_image_url: null,
  addons_image_url: null,
  payment_image_url: null,
  colors: {
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#3b82f6",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#1e293b",
    textSecondary: "#64748b",
    border: "#e2e8f0",
    success: "#22c55e",
    error: "#ef4444",
    warning: "#f59e0b"
  },
  typography: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    headingSize: "2xl",
    bodySize: "base",
    headingWeight: "bold",
    bodyWeight: "normal"
  },
  styling: {
    borderRadius: "md",
    spacing: "normal",
    shadowLevel: "md",
    progressBarStyle: "steps",
    showStepNumbers: true,
    animationsEnabled: true,
    layout: "default"
  }
};

export default function BookingFormAppearance() {
  const { businessId } = useTenant();
  const [customization, setCustomization] = useState<BookingFormCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    welcome: true,
    service: false,
    duration: false,
    specialist: false,
    datetime: false,
    details: false,
    addons: false,
    payment: false,
    colors: false,
    typography: false,
    styling: false
  });

  useEffect(() => {
    fetchCustomization();
  }, [businessId]);

  const fetchCustomization = async () => {
    if (!businessId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('booking_form_customization')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setCustomization(data);
      } else {
        setCustomization({
          ...DEFAULT_CUSTOMIZATION,
          business_id: businessId
        });
      }
    } catch (err) {
      console.error('Error fetching customization:', err);
      setError('Failed to load customization settings');
    }

    setLoading(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateStepContent = (step: string, field: string, value: any) => {
    if (!customization) return;

    setCustomization({
      ...customization,
      [`${step}_step`]: {
        ...customization[`${step}_step` as keyof BookingFormCustomization] as StepContent,
        [field]: value
      }
    });
  };

  const updateColors = (colorKey: string, value: string) => {
    if (!customization) return;

    setCustomization({
      ...customization,
      colors: {
        ...customization.colors,
        [colorKey]: value
      }
    });
  };

  const updateTypography = (field: string, value: string) => {
    if (!customization) return;

    setCustomization({
      ...customization,
      typography: {
        ...customization.typography,
        [field]: value
      }
    });
  };

  const updateStyling = (field: string, value: any) => {
    if (!customization) return;

    setCustomization({
      ...customization,
      styling: {
        ...customization.styling,
        [field]: value
      }
    });
  };

  const uploadImage = async (step: string, file: File) => {
    if (!businessId) {
      setError('Business ID not found. Please refresh the page and try again.');
      return;
    }

    setUploadingImage(step);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}/booking-form/${step}-${Date.now()}.${fileExt}`;

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

      if (customization) {
        setCustomization({
          ...customization,
          [`${step}_image_url`]: publicUrl
        });
        setSavedMessage('Image uploaded! Click "Save All Changes" to apply.');
        setTimeout(() => setSavedMessage(''), 5000);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSave = async () => {
    if (!businessId) {
      setError('Business ID not found. Please refresh and try again.');
      return;
    }

    if (!customization) {
      setError('Customization data not loaded. Please refresh and try again.');
      return;
    }

    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('Saving customization for business:', businessId);
      const { id, ...dataToSave } = customization;

      if (id) {
        console.log('Updating existing customization:', id);
        const { error: updateError } = await supabase
          .from('booking_form_customization')
          .update(dataToSave)
          .eq('id', id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw new Error(updateError.message || 'Failed to update customization');
        }
      } else {
        console.log('Creating new customization for business:', businessId);
        const { data, error: insertError } = await supabase
          .from('booking_form_customization')
          .insert([{ ...dataToSave, business_id: businessId }])
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error(insertError.message || 'Failed to create customization. You may not have permission to modify this business.');
        }

        if (data) {
          setCustomization(data);
        }
      }

      setSavedMessage('Booking form customization saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save customization');
    } finally {
      setSaving(false);
    }
  };

  const renderStepEditor = (stepKey: string, stepName: string) => {
    if (!customization) return null;

    const stepData = customization[`${stepKey}_step` as keyof BookingFormCustomization] as StepContent;
    const imageUrl = customization[`${stepKey}_image_url` as keyof BookingFormCustomization] as string | null;
    const isExpanded = expandedSections[stepKey];

    return (
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(stepKey)}
          className="w-full px-6 py-4 bg-stone-50 flex items-center justify-between hover:bg-stone-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Type className="w-5 h-5 text-stone-700" />
            <span className="font-semibold text-stone-900">{stepName}</span>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {isExpanded && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={stepData.title}
                onChange={(e) => updateStepContent(stepKey, 'title', e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Subtitle
              </label>
              <input
                type="text"
                value={stepData.subtitle}
                onChange={(e) => updateStepContent(stepKey, 'subtitle', e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Button Text
              </label>
              <input
                type="text"
                value={stepData.buttonText}
                onChange={(e) => updateStepContent(stepKey, 'buttonText', e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
            </div>

            {stepKey === 'specialist' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Any Specialist Text
                </label>
                <input
                  type="text"
                  value={stepData.anySpecialistText || ''}
                  onChange={(e) => updateStepContent(stepKey, 'anySpecialistText', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>
            )}

            {stepKey === 'addons' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Skip Button Text
                </label>
                <input
                  type="text"
                  value={stepData.skipButtonText || ''}
                  onChange={(e) => updateStepContent(stepKey, 'skipButtonText', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Background/Header Image
              </label>
              {imageUrl && (
                <div className="mb-3 relative">
                  <img
                    src={imageUrl}
                    alt={`${stepName} background`}
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => setCustomization({
                      ...customization,
                      [`${stepKey}_image_url`]: null
                    })}
                    className="absolute top-2 right-2 px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700"
                  >
                    Remove
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(stepKey, file);
                  }}
                  disabled={uploadingImage === stepKey}
                  className="flex-1 text-sm"
                  id={`${stepKey}-image`}
                />
                {uploadingImage === stepKey && (
                  <span className="text-sm text-stone-600">Uploading...</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-600">Loading customization settings...</div>
      </div>
    );
  }

  if (!customization) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">Failed to load customization</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Layout className="w-8 h-8 text-stone-900" />
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Booking Form Customization</h2>
            <p className="text-stone-600 text-sm">Customize every aspect of your booking form</p>
          </div>
        </div>
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

      <div className="space-y-8">
        <section>
          <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Type className="w-5 h-5" />
            Step Content & Images
          </h3>
          <div className="space-y-3">
            {renderStepEditor('welcome', 'Welcome Page')}
            {renderStepEditor('service', 'Service Selection')}
            {renderStepEditor('duration', 'Duration Selection')}
            {renderStepEditor('specialist', 'Specialist Selection')}
            {renderStepEditor('datetime', 'Date & Time Selection')}
            {renderStepEditor('details', 'Personal Details')}
            {renderStepEditor('addons', 'Add-ons')}
            {renderStepEditor('payment', 'Payment')}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-stone-900 flex items-center gap-2">
              <Palette className="w-5 h-5" />
              Color Scheme
            </h3>
            <button
              onClick={() => {
                if (!customization) return;
                setCustomization({
                  ...customization,
                  colors: DEFAULT_CUSTOMIZATION.colors
                });
                setSavedMessage('Colors reset to defaults. Click "Save All Changes" to apply.');
                setTimeout(() => setSavedMessage(''), 3000);
              }}
              className="text-sm text-stone-600 hover:text-stone-900 underline"
            >
              Reset to Defaults
            </button>
          </div>
          <div className="border border-stone-200 rounded-lg p-6 space-y-6">
            <p className="text-sm text-stone-600">
              Customize the colors used throughout your booking form. Changes are previewed live.
            </p>

            <div className="space-y-4">
              <ColorPicker
                label="Primary Color"
                description="Main buttons and primary actions"
                value={customization.colors.primary}
                onChange={(value) => updateColors('primary', value)}
                previewType="button"
                previewText="Book Now"
              />

              <ColorPicker
                label="Secondary Color"
                description="Secondary buttons and back buttons"
                value={customization.colors.secondary}
                onChange={(value) => updateColors('secondary', value)}
                previewType="button"
                previewText="Go Back"
              />

              <ColorPicker
                label="Accent Color"
                description="Hover states and highlights"
                value={customization.colors.accent}
                onChange={(value) => updateColors('accent', value)}
                previewType="button"
                previewText="Hover State"
              />

              <ColorPicker
                label="Background Color"
                description="Main page background"
                value={customization.colors.background}
                onChange={(value) => updateColors('background', value)}
                previewType="swatch"
              />

              <ColorPicker
                label="Surface Color"
                description="Cards and panels"
                value={customization.colors.surface}
                onChange={(value) => updateColors('surface', value)}
                previewType="swatch"
              />

              <ColorPicker
                label="Text Color"
                description="Main headings and text"
                value={customization.colors.text}
                onChange={(value) => updateColors('text', value)}
                previewType="text"
                previewText="Main Heading"
                backgroundColor={customization.colors.surface}
              />

              <ColorPicker
                label="Secondary Text"
                description="Descriptions and subtitles"
                value={customization.colors.textSecondary}
                onChange={(value) => updateColors('textSecondary', value)}
                previewType="text"
                previewText="Subtitle Text"
                backgroundColor={customization.colors.surface}
              />

              <ColorPicker
                label="Border Color"
                description="Input borders and dividers"
                value={customization.colors.border}
                onChange={(value) => updateColors('border', value)}
                previewType="border"
                backgroundColor={customization.colors.surface}
              />

              <ColorPicker
                label="Success Color"
                description="Success messages"
                value={customization.colors.success}
                onChange={(value) => updateColors('success', value)}
                previewType="button"
                previewText="Success"
              />

              <ColorPicker
                label="Error Color"
                description="Error messages"
                value={customization.colors.error}
                onChange={(value) => updateColors('error', value)}
                previewType="button"
                previewText="Error"
              />

              <ColorPicker
                label="Warning Color"
                description="Warning notices"
                value={customization.colors.warning}
                onChange={(value) => updateColors('warning', value)}
                previewType="button"
                previewText="Warning"
              />
            </div>
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Layout & Styling
          </h3>
          <div className="border border-stone-200 rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Layout Style
              </label>
              <select
                value={customization.styling.layout}
                onChange={(e) => updateStyling('layout', e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              >
                <option value="default">Default Split</option>
                <option value="vertical">Vertical Banner</option>
                <option value="minimal">Minimal</option>
                <option value="split-panel">Split Panel</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Border Radius
                </label>
                <select
                  value={customization.styling.borderRadius}
                  onChange={(e) => updateStyling('borderRadius', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                >
                  <option value="none">None</option>
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra Large</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  Spacing
                </label>
                <select
                  value={customization.styling.spacing}
                  onChange={(e) => updateStyling('spacing', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                >
                  <option value="compact">Compact</option>
                  <option value="normal">Normal</option>
                  <option value="relaxed">Relaxed</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-stone-200 rounded-lg">
              <div>
                <h4 className="font-medium text-stone-900">Show Step Numbers</h4>
                <p className="text-sm text-stone-600">Display numbers in progress bar</p>
              </div>
              <button
                onClick={() => updateStyling('showStepNumbers', !customization.styling.showStepNumbers)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  customization.styling.showStepNumbers
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {customization.styling.showStepNumbers ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border border-stone-200 rounded-lg">
              <div>
                <h4 className="font-medium text-stone-900">Animations</h4>
                <p className="text-sm text-stone-600">Enable smooth transitions</p>
              </div>
              <button
                onClick={() => updateStyling('animationsEnabled', !customization.styling.animationsEnabled)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  customization.styling.animationsEnabled
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {customization.styling.animationsEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end mt-8 pt-8 border-t border-stone-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save All Changes'}
        </button>
      </div>
    </div>
  );
}
