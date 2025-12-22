import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Palette, Save, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useTheme } from '../../../lib/themeContext';

interface ColorPickerProps {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  previewType: 'button' | 'swatch' | 'text';
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

const DEFAULT_COLORS = {
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

export default function ColorCustomization() {
  const { businessId } = useTenant();
  const { refreshTheme } = useTheme();
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    if (businessId) {
      loadColors();
    }
  }, [businessId]);

  const loadColors = async () => {
    if (!businessId) return;

    setLoading(true);
    setError('');

    try {
      const { data, error: fetchError } = await supabase
        .from('booking_form_colors')
        .select('*')
        .eq('business_id', businessId);

      if (fetchError) {
        console.error('Error loading colors:', fetchError);
        throw fetchError;
      }

      if (data && data.length > 0) {
        const loadedColors: Record<string, string> = { ...DEFAULT_COLORS };
        data.forEach((row) => {
          if (row.color_key && row.color_value) {
            loadedColors[row.color_key] = row.color_value;
          }
        });
        setColors(loadedColors);
      }
    } catch (err) {
      console.error('Error loading colors:', err);
      setError('Failed to load colors');
    } finally {
      setLoading(false);
    }
  };

  const updateColor = (colorKey: string, value: string) => {
    setColors(prev => ({ ...prev, [colorKey]: value }));
  };

  const handleSave = async () => {
    if (!businessId) {
      setError('Business ID not found');
      return;
    }

    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      for (const [colorKey, colorValue] of Object.entries(colors)) {
        const { data: existing } = await supabase
          .from('booking_form_colors')
          .select('id')
          .eq('business_id', businessId)
          .eq('color_key', colorKey)
          .maybeSingle();

        if (existing) {
          const { error: updateError } = await supabase
            .from('booking_form_colors')
            .update({ color_value: colorValue, updated_at: new Date().toISOString() })
            .eq('id', existing.id);

          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('booking_form_colors')
            .insert({
              business_id: businessId,
              color_key: colorKey,
              color_value: colorValue
            });

          if (insertError) throw insertError;
        }
      }

      await refreshTheme();

      setSavedMessage('Colors saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save colors');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all colors to defaults?')) {
      return;
    }

    setColors(DEFAULT_COLORS);
    setSavedMessage('Colors reset. Click "Save Changes" to apply.');
    setTimeout(() => setSavedMessage(''), 5000);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-stone-600">Loading colors...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Palette className="w-6 h-6" />
            Color Customization
          </h2>
          <p className="text-stone-600 mt-1">
            Customize your booking form colors. Changes apply immediately after saving.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:text-stone-900 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Defaults
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {savedMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-900">{savedMessage}</p>
        </div>
      )}

      <div className="border border-stone-200 rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-semibold text-stone-900">Brand Colors</h3>

        <ColorPicker
          label="Primary Color"
          description="Main buttons and primary actions"
          value={colors.primary}
          onChange={(value) => updateColor('primary', value)}
          previewType="button"
          previewText="Book Now"
        />

        <ColorPicker
          label="Primary Hover"
          description="Hover state for primary buttons"
          value={colors.primary_hover}
          onChange={(value) => updateColor('primary_hover', value)}
          previewType="button"
          previewText="Hover State"
        />

        <ColorPicker
          label="Secondary Color"
          description="Secondary buttons and accents"
          value={colors.secondary}
          onChange={(value) => updateColor('secondary', value)}
          previewType="button"
          previewText="Secondary"
        />

        <ColorPicker
          label="Secondary Hover"
          description="Hover state for secondary buttons"
          value={colors.secondary_hover}
          onChange={(value) => updateColor('secondary_hover', value)}
          previewType="button"
          previewText="Hover State"
        />

        <ColorPicker
          label="Accent Color"
          description="Links and highlights"
          value={colors.accent}
          onChange={(value) => updateColor('accent', value)}
          previewType="button"
          previewText="Accent"
        />
      </div>

      <div className="border border-stone-200 rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-semibold text-stone-900">Background & Text</h3>

        <ColorPicker
          label="Background"
          description="Main page background"
          value={colors.background}
          onChange={(value) => updateColor('background', value)}
          previewType="swatch"
        />

        <ColorPicker
          label="Secondary Background"
          description="Cards and panels"
          value={colors.background_secondary}
          onChange={(value) => updateColor('background_secondary', value)}
          previewType="swatch"
        />

        <ColorPicker
          label="Primary Text"
          description="Main headings and important text"
          value={colors.text_primary}
          onChange={(value) => updateColor('text_primary', value)}
          previewType="text"
          previewText="Heading"
          backgroundColor={colors.background}
        />

        <ColorPicker
          label="Secondary Text"
          description="Body text and descriptions"
          value={colors.text_secondary}
          onChange={(value) => updateColor('text_secondary', value)}
          previewType="text"
          previewText="Body Text"
          backgroundColor={colors.background}
        />

        <ColorPicker
          label="Border"
          description="Input borders and dividers"
          value={colors.border}
          onChange={(value) => updateColor('border', value)}
          previewType="swatch"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
