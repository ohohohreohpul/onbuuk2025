import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Palette, Save, CheckCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useTheme } from '../../../lib/themeContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  loading: string; heading: string; intro: string; reset: string; error: string;
  loadFailed: string; saveFailed: string; noBusiness: string; saved: string; resetDone: string; confirmReset: string;
  brandColors: string; backgroundText: string; saving: string; save: string;
  primary: string; primaryDesc: string; primaryPreview: string;
  primaryHover: string; primaryHoverDesc: string; hoverPreview: string;
  secondary: string; secondaryDesc: string; secondaryPreview: string;
  secondaryHover: string; secondaryHoverDesc: string;
  accent: string; accentDesc: string; accentPreview: string;
  background: string; backgroundDesc: string;
  backgroundSecondary: string; backgroundSecondaryDesc: string;
  textPrimary: string; textPrimaryDesc: string; textPrimaryPreview: string;
  textSecondary: string; textSecondaryDesc: string; textSecondaryPreview: string;
  border: string; borderDesc: string;
}> = {
  en: {
    loading: 'Loading colors...', heading: 'Color Customization', intro: 'Customize your booking form colors. Changes apply immediately after saving.',
    reset: 'Reset to Defaults', error: 'Error', loadFailed: 'Failed to load colors', saveFailed: 'Failed to save colors', noBusiness: 'Business ID not found',
    saved: 'Colors saved successfully!', resetDone: 'Colors reset. Click "Save Changes" to apply.', confirmReset: 'Are you sure you want to reset all colors to defaults?',
    brandColors: 'Brand Colors', backgroundText: 'Background & Text', saving: 'Saving...', save: 'Save Changes',
    primary: 'Primary Color', primaryDesc: 'Main buttons and primary actions', primaryPreview: 'Book Now',
    primaryHover: 'Primary Hover', primaryHoverDesc: 'Hover state for primary buttons', hoverPreview: 'Hover State',
    secondary: 'Secondary Color', secondaryDesc: 'Secondary buttons and accents', secondaryPreview: 'Secondary',
    secondaryHover: 'Secondary Hover', secondaryHoverDesc: 'Hover state for secondary buttons',
    accent: 'Accent Color', accentDesc: 'Links and highlights', accentPreview: 'Accent',
    background: 'Background', backgroundDesc: 'Main page background',
    backgroundSecondary: 'Secondary Background', backgroundSecondaryDesc: 'Cards and panels',
    textPrimary: 'Primary Text', textPrimaryDesc: 'Main headings and important text', textPrimaryPreview: 'Heading',
    textSecondary: 'Secondary Text', textSecondaryDesc: 'Body text and descriptions', textSecondaryPreview: 'Body Text',
    border: 'Border', borderDesc: 'Input borders and dividers',
  },
  de: {
    loading: 'Farben werden geladen…', heading: 'Farben anpassen', intro: 'Farben des Buchungsformulars anpassen. Änderungen gelten sofort nach dem Speichern.',
    reset: 'Auf Standard zurücksetzen', error: 'Fehler', loadFailed: 'Farben konnten nicht geladen werden', saveFailed: 'Farben konnten nicht gespeichert werden', noBusiness: 'Betrieb nicht gefunden',
    saved: 'Farben gespeichert', resetDone: 'Farben zurückgesetzt. Zum Übernehmen auf „Speichern“ klicken.', confirmReset: 'Alle Farben wirklich auf die Standardwerte zurücksetzen?',
    brandColors: 'Markenfarben', backgroundText: 'Hintergrund & Text', saving: 'Wird gespeichert…', save: 'Speichern',
    primary: 'Hauptfarbe', primaryDesc: 'Haupt-Buttons und wichtige Aktionen', primaryPreview: 'Jetzt buchen',
    primaryHover: 'Hauptfarbe (Hover)', primaryHoverDesc: 'Hover-Zustand der Haupt-Buttons', hoverPreview: 'Hover',
    secondary: 'Zweitfarbe', secondaryDesc: 'Sekundäre Buttons und Akzente', secondaryPreview: 'Sekundär',
    secondaryHover: 'Zweitfarbe (Hover)', secondaryHoverDesc: 'Hover-Zustand der sekundären Buttons',
    accent: 'Akzentfarbe', accentDesc: 'Links und Hervorhebungen', accentPreview: 'Akzent',
    background: 'Hintergrund', backgroundDesc: 'Seitenhintergrund',
    backgroundSecondary: 'Zweiter Hintergrund', backgroundSecondaryDesc: 'Karten und Bereiche',
    textPrimary: 'Haupttext', textPrimaryDesc: 'Überschriften und wichtiger Text', textPrimaryPreview: 'Überschrift',
    textSecondary: 'Nebentext', textSecondaryDesc: 'Fließtext und Beschreibungen', textSecondaryPreview: 'Fließtext',
    border: 'Rahmen', borderDesc: 'Eingabefeld-Rahmen und Trennlinien',
  },
  th: {
    loading: 'กำลังโหลดสี…', heading: 'ปรับแต่งสี', intro: 'ปรับแต่งสีของแบบฟอร์มจอง มีผลทันทีหลังบันทึก',
    reset: 'รีเซ็ตเป็นค่าเริ่มต้น', error: 'ข้อผิดพลาด', loadFailed: 'โหลดสีไม่สำเร็จ', saveFailed: 'บันทึกสีไม่สำเร็จ', noBusiness: 'ไม่พบข้อมูลร้าน',
    saved: 'บันทึกสีแล้ว', resetDone: 'รีเซ็ตสีแล้ว กด "บันทึก" เพื่อใช้งาน', confirmReset: 'ต้องการรีเซ็ตสีทั้งหมดเป็นค่าเริ่มต้นหรือไม่',
    brandColors: 'สีแบรนด์', backgroundText: 'พื้นหลังและข้อความ', saving: 'กำลังบันทึก…', save: 'บันทึก',
    primary: 'สีหลัก', primaryDesc: 'ปุ่มหลักและการกระทำหลัก', primaryPreview: 'จองเลย',
    primaryHover: 'สีหลัก (เมื่อชี้)', primaryHoverDesc: 'สีของปุ่มหลักเมื่อเอาเมาส์ชี้', hoverPreview: 'เมื่อชี้',
    secondary: 'สีรอง', secondaryDesc: 'ปุ่มรองและส่วนเน้น', secondaryPreview: 'รอง',
    secondaryHover: 'สีรอง (เมื่อชี้)', secondaryHoverDesc: 'สีของปุ่มรองเมื่อเอาเมาส์ชี้',
    accent: 'สีเน้น', accentDesc: 'ลิงก์และไฮไลต์', accentPreview: 'เน้น',
    background: 'พื้นหลัง', backgroundDesc: 'พื้นหลังหลักของหน้า',
    backgroundSecondary: 'พื้นหลังรอง', backgroundSecondaryDesc: 'การ์ดและแผง',
    textPrimary: 'ข้อความหลัก', textPrimaryDesc: 'หัวข้อและข้อความสำคัญ', textPrimaryPreview: 'หัวข้อ',
    textSecondary: 'ข้อความรอง', textSecondaryDesc: 'เนื้อหาและคำอธิบาย', textSecondaryPreview: 'เนื้อหา',
    border: 'เส้นขอบ', borderDesc: 'ขอบช่องกรอกและเส้นแบ่ง',
  },
};

type ErrorKey = '' | 'loadFailed' | 'saveFailed' | 'noBusiness';
type NoticeKey = '' | 'saved' | 'resetDone';

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
            {previewText}
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
            {previewText}
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
  primary: '#1A1714',
  primary_hover: '#2E2926',
  secondary: '#A09990',
  secondary_hover: '#6B6560',
  text_primary: '#1A1714',
  text_secondary: '#6B6560',
  background: '#FDFCFA',
  background_secondary: '#F9F7F4',
  border: '#EEEBE6',
  accent: '#A09990',
};

export default function ColorCustomization() {
  const { businessId } = useTenant();
  const { refreshTheme } = useTheme();
  const { t } = useAdminText(TEXT);
  const [colors, setColors] = useState(DEFAULT_COLORS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ErrorKey>('');
  const [savedMessage, setSavedMessage] = useState<NoticeKey>('');

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
      setError('loadFailed');
    } finally {
      setLoading(false);
    }
  };

  const updateColor = (colorKey: string, value: string) => {
    setColors(prev => ({ ...prev, [colorKey]: value }));
  };

  const handleSave = async () => {
    if (!businessId) {
      setError('noBusiness');
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

      setSavedMessage('saved');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError('saveFailed');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm(t.confirmReset)) {
      return;
    }

    setColors(DEFAULT_COLORS);
    setSavedMessage('resetDone');
    setTimeout(() => setSavedMessage(''), 5000);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-stone-600">{t.loading}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-stone-900 flex items-center gap-2">
            <Palette className="w-6 h-6" />
            {t.heading}
          </h2>
          <p className="text-stone-600 mt-1">
            {t.intro}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-2 px-4 py-2 text-stone-600 hover:text-stone-900 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          {t.reset}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">{t.error}</p>
            <p className="text-sm text-red-700">{t[error]}</p>
          </div>
        </div>
      )}

      {savedMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-green-900">{t[savedMessage]}</p>
        </div>
      )}

      <div className="border border-stone-200 rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-semibold text-stone-900">{t.brandColors}</h3>

        <ColorPicker
          label={t.primary}
          description={t.primaryDesc}
          value={colors.primary}
          onChange={(value) => updateColor('primary', value)}
          previewType="button"
          previewText={t.primaryPreview}
        />

        <ColorPicker
          label={t.primaryHover}
          description={t.primaryHoverDesc}
          value={colors.primary_hover}
          onChange={(value) => updateColor('primary_hover', value)}
          previewType="button"
          previewText={t.hoverPreview}
        />

        <ColorPicker
          label={t.secondary}
          description={t.secondaryDesc}
          value={colors.secondary}
          onChange={(value) => updateColor('secondary', value)}
          previewType="button"
          previewText={t.secondaryPreview}
        />

        <ColorPicker
          label={t.secondaryHover}
          description={t.secondaryHoverDesc}
          value={colors.secondary_hover}
          onChange={(value) => updateColor('secondary_hover', value)}
          previewType="button"
          previewText={t.hoverPreview}
        />

        <ColorPicker
          label={t.accent}
          description={t.accentDesc}
          value={colors.accent}
          onChange={(value) => updateColor('accent', value)}
          previewType="button"
          previewText={t.accentPreview}
        />
      </div>

      <div className="border border-stone-200 rounded-lg p-6 space-y-6">
        <h3 className="text-lg font-semibold text-stone-900">{t.backgroundText}</h3>

        <ColorPicker
          label={t.background}
          description={t.backgroundDesc}
          value={colors.background}
          onChange={(value) => updateColor('background', value)}
          previewType="swatch"
        />

        <ColorPicker
          label={t.backgroundSecondary}
          description={t.backgroundSecondaryDesc}
          value={colors.background_secondary}
          onChange={(value) => updateColor('background_secondary', value)}
          previewType="swatch"
        />

        <ColorPicker
          label={t.textPrimary}
          description={t.textPrimaryDesc}
          value={colors.text_primary}
          onChange={(value) => updateColor('text_primary', value)}
          previewType="text"
          previewText={t.textPrimaryPreview}
          backgroundColor={colors.background}
        />

        <ColorPicker
          label={t.textSecondary}
          description={t.textSecondaryDesc}
          value={colors.text_secondary}
          onChange={(value) => updateColor('text_secondary', value)}
          previewType="text"
          previewText={t.textSecondaryPreview}
          backgroundColor={colors.background}
        />

        <ColorPicker
          label={t.border}
          description={t.borderDesc}
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
              {t.saving}
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {t.save}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
