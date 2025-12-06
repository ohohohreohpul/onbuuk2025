import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Upload, Image as ImageIcon, Type, X, Palette, Eye, RefreshCw } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';

interface FormImage {
  id: string;
  step: string;
  image_url: string;
}

interface FormText {
  id: string;
  step: string;
  text_key: string;
  text_value: string;
}

interface FormColor {
  id: string;
  color_key: string;
  color_value: string;
}

const BOOKING_STEPS = [
  { value: 'default', label: 'All Steps (Default)' },
  { value: 'welcome', label: 'Welcome Page' },
  { value: 'service', label: 'Service Selection' },
  { value: 'duration', label: 'Duration Selection' },
  { value: 'specialist', label: 'Specialist Selection' },
  { value: 'datetime', label: 'Date & Time' },
  { value: 'personal_details', label: 'Personal Details' },
  { value: 'payment', label: 'Review & Payment' },
];

const TEXT_FIELDS = {
  welcome: [
    { key: 'title', label: 'Title', default: 'Welcome to Hamburg Massage Studio' },
    { key: 'subtitle', label: 'Subtitle', default: 'Book Your Holistic Massage Experience' },
    { key: 'description', label: 'Description', default: 'Experience tranquility and rejuvenation...' },
    { key: 'button', label: 'Button Text', default: 'Book Your Appointment' },
  ],
  service: [
    { key: 'title', label: 'Title', default: 'Choose Your Service' },
    { key: 'subtitle', label: 'Subtitle', default: 'Select the treatment that best suits your needs' },
  ],
  duration: [
    { key: 'title', label: 'Title', default: 'Select Duration' },
    { key: 'subtitle', label: 'Subtitle', default: 'Choose how long you\'d like your session to be' },
  ],
  specialist: [
    { key: 'title', label: 'Title', default: 'Choose Your Specialist' },
    { key: 'subtitle', label: 'Subtitle', default: 'Select a therapist or let us assign one for you' },
    { key: 'any_available', label: 'Any Available Text', default: 'Anyone Available' },
  ],
  datetime: [
    { key: 'title', label: 'Title', default: 'Choose Date & Time' },
    { key: 'subtitle', label: 'Subtitle', default: 'Select your preferred appointment slot' },
  ],
  personal_details: [
    { key: 'title', label: 'Title', default: 'Your Details' },
    { key: 'subtitle', label: 'Subtitle', default: 'Please provide your contact information' },
  ],
  payment: [
    { key: 'title', label: 'Title', default: 'Review & Pay' },
    { key: 'subtitle', label: 'Subtitle', default: 'Please review your booking details' },
    { key: 'policy', label: 'Cancellation Policy', default: 'Cancellations must be made at least 24 hours in advance.' },
  ],
};

const COLOR_OPTIONS = [
  {
    key: 'primary',
    label: 'Primary Color',
    description: 'Main brand color for buttons and accents',
    category: 'Brand Colors'
  },
  {
    key: 'primary_hover',
    label: 'Primary Hover',
    description: 'Color when hovering over primary elements',
    category: 'Brand Colors'
  },
  {
    key: 'secondary',
    label: 'Secondary Color',
    description: 'Secondary brand color for alternative actions',
    category: 'Brand Colors'
  },
  {
    key: 'secondary_hover',
    label: 'Secondary Hover',
    description: 'Color when hovering over secondary elements',
    category: 'Brand Colors'
  },
  {
    key: 'accent',
    label: 'Accent Color',
    description: 'Highlight color for special elements',
    category: 'Brand Colors'
  },
  {
    key: 'text_primary',
    label: 'Primary Text',
    description: 'Main text color for headings and important content',
    category: 'Text Colors'
  },
  {
    key: 'text_secondary',
    label: 'Secondary Text',
    description: 'Lighter text for descriptions and subtitles',
    category: 'Text Colors'
  },
  {
    key: 'background',
    label: 'Background',
    description: 'Main background color',
    category: 'Backgrounds & Borders'
  },
  {
    key: 'background_secondary',
    label: 'Secondary Background',
    description: 'Background for cards and highlighted sections',
    category: 'Backgrounds & Borders'
  },
  {
    key: 'border',
    label: 'Border Color',
    description: 'Color for borders, dividers, and input outlines',
    category: 'Backgrounds & Borders'
  },
];

export default function BookingFormCustomization() {
  const { updateTheme, refreshTheme } = useTheme();
  const [images, setImages] = useState<FormImage[]>([]);
  const [texts, setTexts] = useState<FormText[]>([]);
  const [colors, setColors] = useState<FormColor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'images' | 'texts' | 'colors'>('colors');
  const [selectedStep, setSelectedStep] = useState('default');
  const [livePreview, setLivePreview] = useState(true);

  useEffect(() => {
    fetchCustomization();
  }, []);

  const fetchCustomization = async () => {
    const [imagesResult, textsResult, colorsResult] = await Promise.all([
      supabase.from('booking_form_images').select('*').order('step'),
      supabase.from('booking_form_texts').select('*').order('step, text_key'),
      supabase.from('booking_form_colors').select('*'),
    ]);

    if (imagesResult.data) setImages(imagesResult.data);
    if (textsResult.data) setTexts(textsResult.data);
    if (colorsResult.data) setColors(colorsResult.data);
    setLoading(false);
  };

  const handleImageUpload = async (step: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const imageUrl = e.target?.result as string;

      const existingImage = images.find(img => img.step === step);

      if (existingImage) {
        const { error } = await supabase
          .from('booking_form_images')
          .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
          .eq('id', existingImage.id);

        if (!error) {
          setImages(images.map(img => img.id === existingImage.id ? { ...img, image_url: imageUrl } : img));
        }
      } else {
        const { data, error } = await supabase
          .from('booking_form_images')
          .insert({ step, image_url: imageUrl })
          .select()
          .single();

        if (data && !error) {
          setImages([...images, data]);
        }
      }

      setSavedMessage('Image uploaded successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = async (step: string) => {
    const imageToRemove = images.find(img => img.step === step);
    if (!imageToRemove) return;

    const { error } = await supabase
      .from('booking_form_images')
      .delete()
      .eq('id', imageToRemove.id);

    if (!error) {
      setImages(images.filter(img => img.id !== imageToRemove.id));
      setSavedMessage('Image removed successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    }
  };

  const handleTextChange = (step: string, textKey: string, value: string) => {
    const existingText = texts.find(t => t.step === step && t.text_key === textKey);

    if (existingText) {
      setTexts(texts.map(t =>
        t.id === existingText.id ? { ...t, text_value: value } : t
      ));
    } else {
      setTexts([...texts, {
        id: `temp-${Date.now()}`,
        step,
        text_key: textKey,
        text_value: value,
      }]);
    }
  };

  const handleSaveTexts = async () => {
    setSaving(true);
    setSavedMessage('');

    try {
      for (const text of texts) {
        if (text.text_value.trim()) {
          await supabase
            .from('booking_form_texts')
            .upsert({
              step: text.step,
              text_key: text.text_key,
              text_value: text.text_value,
              updated_at: new Date().toISOString(),
            });
        }
      }

      setSavedMessage('Text customizations saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
      await fetchCustomization();
    } catch (error) {
      console.error('Error saving texts:', error);
      setSavedMessage('Error saving customizations');
    } finally {
      setSaving(false);
    }
  };

  const getTextValue = (step: string, textKey: string, defaultValue: string) => {
    const text = texts.find(t => t.step === step && t.text_key === textKey);
    return text?.text_value || defaultValue;
  };

  const getImageForStep = (step: string) => {
    return images.find(img => img.step === step) || images.find(img => img.step === 'default');
  };

  const getColorValue = (colorKey: string, defaultValue: string) => {
    const color = colors.find(c => c.color_key === colorKey);
    return color?.color_value || defaultValue;
  };

  const handleColorChange = (colorKey: string, value: string) => {
    const existingColor = colors.find(c => c.color_key === colorKey);

    if (existingColor) {
      setColors(colors.map(c =>
        c.color_key === colorKey ? { ...c, color_value: value } : c
      ));
    } else {
      setColors([...colors, {
        id: `temp-${Date.now()}`,
        color_key: colorKey,
        color_value: value,
      }]);
    }

    if (livePreview) {
      const colorKeyMap: { [key: string]: string } = {
        'primary': 'primary',
        'primary_hover': 'primaryHover',
        'secondary': 'secondary',
        'secondary_hover': 'secondaryHover',
        'text_primary': 'textPrimary',
        'text_secondary': 'textSecondary',
        'background': 'background',
        'background_secondary': 'backgroundSecondary',
        'border': 'border',
        'accent': 'accent',
      };

      const mappedKey = colorKeyMap[colorKey];
      if (mappedKey) {
        updateTheme({ [mappedKey]: value });
      }
    }
  };

  const handleSaveColors = async () => {
    setSaving(true);
    setSavedMessage('');

    try {
      for (const color of colors) {
        if (color.color_value) {
          const { error } = await supabase
            .from('booking_form_colors')
            .upsert(
              {
                color_key: color.color_key,
                color_value: color.color_value,
                updated_at: new Date().toISOString(),
              },
              {
                onConflict: 'color_key',
              }
            );

          if (error) {
            console.error('Error upserting color:', error);
            throw error;
          }
        }
      }

      setSavedMessage('Color customizations saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
      await fetchCustomization();
      await refreshTheme();
    } catch (error) {
      console.error('Error saving colors:', error);
      setSavedMessage('Error saving customizations');
    } finally {
      setSaving(false);
    }
  };

  const handleResetColors = async () => {
    if (!confirm('Are you sure you want to reset all colors to defaults?')) return;

    const defaultColors: { [key: string]: string } = {
      primary: '#008374',
      primary_hover: '#006b5e',
      secondary: '#89BA16',
      secondary_hover: '#72970f',
      text_primary: '#171717',
      text_secondary: '#737373',
      background: '#ffffff',
      background_secondary: '#f5f5f5',
      border: '#e5e5e5',
      accent: '#89BA16',
    };

    setSaving(true);
    try {
      for (const [key, value] of Object.entries(defaultColors)) {
        await supabase
          .from('booking_form_colors')
          .upsert(
            {
              color_key: key,
              color_value: value,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'color_key',
            }
          );
      }
      await fetchCustomization();
      await refreshTheme();
      setSavedMessage('Colors reset to defaults successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error resetting colors:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-light text-stone-800 mb-2">Booking Form Customization</h1>
        <p className="text-stone-600">Customize images and text for your booking form</p>
      </div>

      {savedMessage && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 text-sm">
          {savedMessage}
        </div>
      )}

      <div className="flex space-x-1 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('images')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'images'
              ? 'border-b-2 border-stone-800 text-stone-800'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4" />
            <span>Images</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('texts')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'texts'
              ? 'border-b-2 border-stone-800 text-stone-800'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Type className="w-4 h-4" />
            <span>Text Content</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('colors')}
          className={`px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'colors'
              ? 'border-b-2 border-stone-800 text-stone-800'
              : 'text-stone-500 hover:text-stone-700'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Palette className="w-4 h-4" />
            <span>Colors</span>
          </div>
        </button>
      </div>

      {activeTab === 'images' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Image Display Options</p>
            <p>
              Upload a default image to use across all booking steps, or upload individual images for each step.
              Step-specific images will override the default image.
            </p>
          </div>

          <div className="grid gap-6">
            {BOOKING_STEPS.map((step) => {
              const existingImage = getImageForStep(step.value);
              const hasStepSpecificImage = images.some(img => img.step === step.value);

              return (
                <div key={step.value} className="bg-white border border-stone-200 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-medium text-stone-800">{step.label}</h3>
                      <p className="text-sm text-stone-600 mt-1">
                        {step.value === 'default'
                          ? 'This image will be used for all steps unless overridden'
                          : hasStepSpecificImage
                            ? 'Custom image for this step'
                            : 'Using default image'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    {existingImage && (
                      <div className="relative w-48 h-32 border border-stone-200 rounded overflow-hidden flex-shrink-0">
                        <img
                          src={existingImage.image_url}
                          alt={`${step.label} preview`}
                          className="w-full h-full object-cover"
                        />
                        {hasStepSpecificImage && (
                          <button
                            onClick={() => handleRemoveImage(step.value)}
                            className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded hover:bg-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex-1">
                      <label className="block">
                        <div className="flex items-center justify-center px-4 py-3 border-2 border-dashed border-stone-300 hover:border-stone-400 cursor-pointer transition-colors">
                          <Upload className="w-5 h-5 text-stone-600 mr-2" />
                          <span className="text-sm text-stone-700">
                            {hasStepSpecificImage ? 'Replace Image' : 'Upload Image'}
                          </span>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(step.value, file);
                          }}
                          className="hidden"
                        />
                      </label>
                      <p className="text-xs text-stone-500 mt-2">
                        Recommended: 800x1200px or similar portrait ratio. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'texts' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 flex-1 mr-4">
              <p className="font-medium mb-1">Text Customization</p>
              <p>
                Customize the text content for each step of the booking form. Leave fields empty to use default text.
              </p>
            </div>
            <button
              onClick={handleSaveTexts}
              disabled={saving}
              className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:bg-stone-400"
            >
              <Save className="w-5 h-5" />
              <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
            </button>
          </div>

          <div className="space-y-6">
            {Object.entries(TEXT_FIELDS).map(([step, fields]) => (
              <div key={step} className="bg-white border border-stone-200 p-6">
                <h3 className="text-lg font-medium text-stone-800 mb-4">
                  {BOOKING_STEPS.find(s => s.value === step)?.label}
                </h3>
                <div className="space-y-4">
                  {fields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-sm font-medium text-stone-700 mb-2">
                        {field.label}
                      </label>
                      {field.key === 'description' || field.key === 'policy' ? (
                        <textarea
                          value={getTextValue(step, field.key, field.default)}
                          onChange={(e) => handleTextChange(step, field.key, e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800 resize-none"
                          placeholder={field.default}
                        />
                      ) : (
                        <input
                          type="text"
                          value={getTextValue(step, field.key, field.default)}
                          onChange={(e) => handleTextChange(step, field.key, e.target.value)}
                          className="w-full px-4 py-3 border border-stone-200 focus:outline-none focus:border-stone-800"
                          placeholder={field.default}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'colors' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 flex-1">
              <p className="font-medium mb-1">Color Customization</p>
              <p>
                Customize your brand colors. {livePreview ? 'Changes preview in real-time!' : 'Save to apply changes.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setLivePreview(!livePreview)}
                className={`flex items-center space-x-2 px-4 py-2 border-2 transition-colors ${
                  livePreview
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-stone-300 bg-white text-stone-600 hover:border-stone-400'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span className="text-sm font-medium">Live Preview</span>
              </button>
              <button
                onClick={handleResetColors}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2 border-2 border-stone-300 text-stone-700 hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm font-medium">Reset</span>
              </button>
              <button
                onClick={handleSaveColors}
                disabled={saving}
                className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:bg-stone-400"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Saving...' : 'Save Colors'}</span>
              </button>
            </div>
          </div>

          {['Brand Colors', 'Text Colors', 'Backgrounds & Borders'].map((category) => {
            const categoryOptions = COLOR_OPTIONS.filter(opt => opt.category === category);
            const defaultColors: { [key: string]: string } = {
              primary: '#008374',
              primary_hover: '#006b5e',
              secondary: '#89BA16',
              secondary_hover: '#72970f',
              accent: '#89BA16',
              text_primary: '#171717',
              text_secondary: '#737373',
              background: '#ffffff',
              background_secondary: '#f5f5f5',
              border: '#e5e5e5',
            };

            return (
              <div key={category} className="bg-white border border-stone-200 rounded-lg">
                <div className="p-6">
                  <h3 className="text-lg font-medium text-stone-800 mb-6">{category}</h3>
                  <div className="space-y-5">
                    {categoryOptions.map((option) => (
                      <div key={option.key} className="flex items-center gap-4">
                        <div className="flex-1">
                          <label className="block text-sm font-medium text-stone-700 mb-0.5">
                            {option.label}
                          </label>
                          <p className="text-xs text-stone-500">{option.description}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <input
                              type="color"
                              value={getColorValue(option.key, defaultColors[option.key])}
                              onChange={(e) => handleColorChange(option.key, e.target.value)}
                              className="w-14 h-14 border-2 border-stone-300 rounded-lg cursor-pointer"
                            />
                          </div>
                          <input
                            type="text"
                            value={getColorValue(option.key, defaultColors[option.key])}
                            onChange={(e) => handleColorChange(option.key, e.target.value)}
                            className="w-32 px-3 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 focus:ring-1 focus:ring-stone-800 font-mono text-sm uppercase"
                            placeholder="#000000"
                            pattern="^#[0-9A-Fa-f]{6}$"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}

          {livePreview && (
            <div className="bg-green-50 border border-green-200 p-4 text-sm text-green-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4" />
                <p className="font-medium">Live Preview Active</p>
              </div>
              <p className="mt-1">
                Color changes are being applied in real-time. Don't forget to save your changes!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
