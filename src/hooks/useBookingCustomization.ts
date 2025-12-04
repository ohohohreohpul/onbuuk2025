import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../lib/tenantContext';

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

export function useBookingCustomization() {
  const tenant = useTenant();
  const [images, setImages] = useState<FormImage[]>([]);
  const [texts, setTexts] = useState<FormText[]>([]);
  const [colors, setColors] = useState<FormColor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tenant.businessId) {
      fetchCustomization();
    }
  }, [tenant.businessId]);

  const fetchCustomization = async () => {
    if (!tenant.businessId) return;

    const [imagesResult, textsResult, colorsResult] = await Promise.all([
      supabase.from('booking_form_images').select('*').eq('business_id', tenant.businessId),
      supabase.from('booking_form_texts').select('*').eq('business_id', tenant.businessId),
      supabase.from('booking_form_colors').select('*').eq('business_id', tenant.businessId),
    ]);

    if (imagesResult.data) setImages(imagesResult.data);
    if (textsResult.data) setTexts(textsResult.data);
    if (colorsResult.data) {
      setColors(colorsResult.data);
      applyColors(colorsResult.data);
    }
    setLoading(false);
  };

  const applyColors = (colorData: FormColor[]) => {
    const root = document.documentElement;

    colorData.forEach(color => {
      root.style.setProperty(`--color-${color.color_key.replace(/_/g, '-')}`, color.color_value);
    });
  };

  const getImageForStep = (step: string): string | undefined => {
    const stepImage = images.find(img => img.step === step);
    if (stepImage) return stepImage.image_url;

    const defaultImage = images.find(img => img.step === 'default');
    return defaultImage?.image_url;
  };

  const getText = (step: string, textKey: string, defaultValue: string): string => {
    const text = texts.find(t => t.step === step && t.text_key === textKey);
    return text?.text_value || defaultValue;
  };

  const getColor = (colorKey: string, defaultValue: string): string => {
    const color = colors.find(c => c.color_key === colorKey);
    return color?.color_value || defaultValue;
  };

  return { getImageForStep, getText, getColor, loading };
}
