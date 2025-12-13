import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Layout, Save, CheckCircle, AlertCircle, Sparkles, Plus, Trash2, GripVertical, Upload, Code, Eye } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';

type LayoutType = 'default' | 'vertical' | 'minimal' | 'split-panel';

interface WelcomeCard {
  id: string;
  card_order: number;
  icon_type: 'lucide' | 'custom';
  icon_name: string | null;
  icon_url: string | null;
  title: string;
  description: string;
  is_enabled: boolean;
}

const POPULAR_ICONS = [
  'Check', 'CheckCircle2', 'Clock', 'Star', 'Heart', 'Award', 'Shield',
  'Sparkles', 'Zap', 'Users', 'Calendar', 'Gift', 'ThumbsUp', 'Smile',
  'BadgeCheck', 'CircleCheck', 'ShieldCheck', 'TrendingUp'
];

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

  const [showFeatures, setShowFeatures] = useState(true);
  const [useCustomHTML, setUseCustomHTML] = useState(false);
  const [customHTML, setCustomHTML] = useState('');
  const [featureCards, setFeatureCards] = useState<WelcomeCard[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showHTMLEditor, setShowHTMLEditor] = useState(false);

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

    try {
      const [businessData, cardsData] = await Promise.all([
        supabase
          .from('businesses')
          .select('booking_form_layout, show_welcome_features, use_custom_welcome_html, welcome_custom_html')
          .eq('id', businessId)
          .maybeSingle(),
        supabase
          .from('welcome_feature_cards')
          .select('*')
          .eq('business_id', businessId)
          .order('card_order')
      ]);

      if (businessData.data) {
        setSelectedLayout((businessData.data.booking_form_layout as LayoutType) || 'default');
        setShowFeatures(businessData.data.show_welcome_features ?? true);
        setUseCustomHTML(businessData.data.use_custom_welcome_html ?? false);
        setCustomHTML(businessData.data.welcome_custom_html ?? '');
      }

      if (cardsData.data) {
        setFeatureCards(cardsData.data);
      }

      if (businessData.error) {
        console.error('Error fetching layout:', businessData.error);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }

    setLoading(false);
  };

  const handleSave = async () => {
    if (!businessId) return;

    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      await supabase
        .from('businesses')
        .update({
          booking_form_layout: selectedLayout,
          show_welcome_features: showFeatures,
          use_custom_welcome_html: useCustomHTML,
          welcome_custom_html: customHTML
        })
        .eq('id', businessId);

      for (const card of featureCards) {
        if (card.id.startsWith('temp-')) {
          const { id, ...cardData } = card;
          await supabase
            .from('welcome_feature_cards')
            .insert({ ...cardData, business_id: businessId });
        } else {
          await supabase
            .from('welcome_feature_cards')
            .update(card)
            .eq('id', card.id);
        }
      }

      setSavedMessage('Settings saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
      await fetchCurrentLayout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const addCard = () => {
    const newCard: WelcomeCard = {
      id: `temp-${Date.now()}`,
      card_order: featureCards.length + 1,
      icon_type: 'lucide',
      icon_name: 'Check',
      icon_url: null,
      title: 'New Feature',
      description: 'Describe your feature here',
      is_enabled: true
    };
    setFeatureCards([...featureCards, newCard]);
  };

  const updateCard = (index: number, updates: Partial<WelcomeCard>) => {
    const newCards = [...featureCards];
    newCards[index] = { ...newCards[index], ...updates };
    setFeatureCards(newCards);
  };

  const deleteCard = async (index: number) => {
    const card = featureCards[index];
    if (!card.id.startsWith('temp-')) {
      try {
        await supabase
          .from('welcome_feature_cards')
          .delete()
          .eq('id', card.id);
      } catch (error) {
        console.error('Error deleting card:', error);
      }
    }
    setFeatureCards(featureCards.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newCards = [...featureCards];
    const draggedCard = newCards[draggedIndex];
    newCards.splice(draggedIndex, 1);
    newCards.splice(index, 0, draggedCard);

    newCards.forEach((card, idx) => {
      card.card_order = idx + 1;
    });

    setFeatureCards(newCards);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const uploadIcon = async (index: number, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}/${Date.now()}.${fileExt}`;

      const { error } = await supabase.storage
        .from('business-assets')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(fileName);

      updateCard(index, {
        icon_type: 'custom',
        icon_url: publicUrl,
        icon_name: null
      });
    } catch (error) {
      console.error('Error uploading icon:', error);
      setError('Failed to upload icon');
    }
  };

  const renderIcon = (card: WelcomeCard, size: string = 'w-5 h-5') => {
    if (card.icon_type === 'custom' && card.icon_url) {
      return <img src={card.icon_url} alt="icon" className={size} />;
    }
    if (card.icon_type === 'lucide' && card.icon_name) {
      const IconComponent = (LucideIcons as any)[card.icon_name];
      if (IconComponent) {
        return <IconComponent className={size} />;
      }
    }
    return <LucideIcons.HelpCircle className={size} />;
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

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-12">
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

      <div className="border-t border-stone-200 pt-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-stone-900" />
              <div>
                <h2 className="text-2xl font-bold text-stone-900">Welcome Features</h2>
                <p className="text-stone-600 text-sm">Customize the feature cards on your welcome page</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="flex items-center gap-2 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors text-sm"
              >
                <Eye className="w-4 h-4" />
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
              <button
                onClick={() => setShowHTMLEditor(!showHTMLEditor)}
                className="flex items-center gap-2 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors text-sm"
              >
                <Code className="w-4 h-4" />
                Custom HTML
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 border border-stone-200 rounded-lg">
            <div>
              <h3 className="font-semibold text-stone-900">Display Feature Cards</h3>
              <p className="text-sm text-stone-600">Show feature cards on the welcome page</p>
            </div>
            <button
              onClick={() => setShowFeatures(!showFeatures)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showFeatures
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {showFeatures ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {showHTMLEditor && (
            <div className="p-4 border border-stone-200 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-stone-900">Use Custom HTML</h3>
                  <p className="text-sm text-stone-600">Replace feature cards with custom HTML code</p>
                </div>
                <button
                  onClick={() => setUseCustomHTML(!useCustomHTML)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    useCustomHTML
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {useCustomHTML ? 'Enabled' : 'Disabled'}
                </button>
              </div>

              {useCustomHTML && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    Custom HTML Code
                  </label>
                  <textarea
                    value={customHTML}
                    onChange={(e) => setCustomHTML(e.target.value)}
                    className="w-full h-48 p-3 border border-stone-300 rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                    placeholder="<div>Your custom HTML here...</div>"
                  />
                  <p className="text-xs text-stone-500 mt-2">
                    HTML will be sanitized for security. Use inline styles or Tailwind classes.
                  </p>
                </div>
              )}
            </div>
          )}

          {!useCustomHTML && showFeatures && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-stone-700">
                  Feature Cards ({featureCards.length}/5)
                </label>
                <button
                  onClick={addCard}
                  disabled={featureCards.length >= 5}
                  className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Card
                </button>
              </div>

              <div className="space-y-3">
                {featureCards.map((card, index) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="border border-stone-200 rounded-lg p-4 space-y-4 bg-white hover:border-stone-400 transition-colors cursor-move"
                  >
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-5 h-5 text-stone-400 flex-shrink-0 mt-1" />

                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-100 rounded flex items-center justify-center">
                            {renderIcon(card)}
                          </div>

                          <div className="flex-1 flex flex-wrap gap-2">
                            <select
                              value={card.icon_type}
                              onChange={(e) => updateCard(index, {
                                icon_type: e.target.value as 'lucide' | 'custom',
                                icon_name: e.target.value === 'lucide' ? 'Check' : null,
                                icon_url: null
                              })}
                              className="px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                            >
                              <option value="lucide">Lucide Icon</option>
                              <option value="custom">Custom Image</option>
                            </select>

                            {card.icon_type === 'lucide' ? (
                              <select
                                value={card.icon_name || 'Check'}
                                onChange={(e) => updateCard(index, { icon_name: e.target.value })}
                                className="flex-1 min-w-[150px] px-3 py-1.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                              >
                                {POPULAR_ICONS.map(icon => (
                                  <option key={icon} value={icon}>{icon}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex-1 min-w-[200px]">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) uploadIcon(index, file);
                                  }}
                                  className="text-sm w-full"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => updateCard(index, { is_enabled: !card.is_enabled })}
                              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                card.is_enabled
                                  ? 'bg-stone-900 text-white'
                                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                              }`}
                            >
                              {card.is_enabled ? 'Enabled' : 'Disabled'}
                            </button>
                            <button
                              onClick={() => deleteCard(index)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              Title (max 50 chars)
                            </label>
                            <input
                              type="text"
                              value={card.title}
                              onChange={(e) => updateCard(index, { title: e.target.value.slice(0, 50) })}
                              placeholder="Feature title"
                              maxLength={50}
                              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-stone-700 mb-1">
                              Description (max 200 chars)
                            </label>
                            <textarea
                              value={card.description}
                              onChange={(e) => updateCard(index, { description: e.target.value.slice(0, 200) })}
                              placeholder="Feature description"
                              maxLength={200}
                              className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                              rows={2}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {showPreview && showFeatures && !useCustomHTML && (
            <div className="p-4 border border-stone-200 rounded-lg">
              <label className="block text-sm font-medium text-stone-700 mb-4">Preview</label>
              <div className="grid gap-4">
                {featureCards.filter(c => c.is_enabled).map((card) => (
                  <div key={card.id} className="border border-stone-200 rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-stone-100 flex items-center justify-center flex-shrink-0 rounded">
                        {renderIcon(card, 'w-5 h-5 text-stone-900')}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 text-sm">{card.title}</h3>
                        <p className="text-stone-600 text-xs leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-8">
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
