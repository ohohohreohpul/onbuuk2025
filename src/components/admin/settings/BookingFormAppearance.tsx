import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Layout, Save, CheckCircle, AlertCircle } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';

type LayoutType = 'default' | 'vertical' | 'minimal' | 'split-panel';

interface LayoutOption {
  id: LayoutType;
  name: string;
  description: string;
  features: string[];
  previewImage: string;
}

export default function BookingFormAppearance() {
  const { businessId } = useTenant();
  const [selectedLayout, setSelectedLayout] = useState<LayoutType>('default');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');

  const layoutOptions: LayoutOption[] = [
    {
      id: 'default',
      name: 'Default Split',
      description: 'Classic 40/60 split with image on the left',
      features: ['Professional layout', 'Image showcase', 'Best for desktop'],
      previewImage: '/placeholder-default.png',
    },
    {
      id: 'vertical',
      name: 'Vertical Banner',
      description: 'Full-width banner image at the top',
      features: ['Modern design', 'Mobile-friendly', 'Full-width content'],
      previewImage: '/placeholder-vertical.png',
    },
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Clean form-only interface',
      features: ['Fast loading', 'Distraction-free', 'Maximum simplicity'],
      previewImage: '/placeholder-minimal.png',
    },
    {
      id: 'split-panel',
      name: 'Split Panel',
      description: 'Form with live booking summary sidebar',
      features: ['Real-time summary', 'Clear progress tracking', 'Best for conversions'],
      previewImage: '/placeholder-split.png',
    },
  ];

  useEffect(() => {
    fetchCurrentLayout();
  }, [businessId]);

  const fetchCurrentLayout = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('businesses')
      .select('booking_form_layout')
      .eq('id', businessId)
      .single();

    if (data) {
      setSelectedLayout((data.booking_form_layout as LayoutType) || 'default');
    }

    if (error) {
      console.error('Error fetching layout:', error);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const { error: updateError } = await supabase
        .from('businesses')
        .update({ booking_form_layout: selectedLayout })
        .eq('id', businessId);

      if (updateError) throw updateError;

      setSavedMessage('Booking form layout saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Layout className="w-8 h-8 text-stone-900" />
          <div>
            <h2 className="text-2xl font-bold text-stone-900">Booking Form Layout</h2>
            <p className="text-stone-600 text-sm">Choose how your booking form appears to customers</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {layoutOptions.map((layout) => (
          <button
            key={layout.id}
            onClick={() => setSelectedLayout(layout.id)}
            className={`text-left p-6 rounded-lg border-2 transition-all ${
              selectedLayout === layout.id
                ? 'border-stone-900 bg-stone-50 shadow-md'
                : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-stone-900 mb-1">{layout.name}</h3>
                <p className="text-sm text-stone-600">{layout.description}</p>
              </div>
              {selectedLayout === layout.id && (
                <CheckCircle className="w-6 h-6 text-stone-900 flex-shrink-0" />
              )}
            </div>

            <div className="bg-stone-100 rounded-lg aspect-video mb-4 flex items-center justify-center">
              <Layout className="w-12 h-12 text-stone-400" />
            </div>

            <ul className="space-y-2">
              {layout.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm text-stone-700">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-semibold text-blue-900 mb-1">Preview Your Layout</h3>
            <p className="text-sm text-blue-800">
              Your selected layout will be applied to your booking page immediately after saving.
              Visit your booking page to see the changes in action.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saving ? 'Saving...' : 'Save Layout'}
        </button>
      </div>
    </div>
  );
}
