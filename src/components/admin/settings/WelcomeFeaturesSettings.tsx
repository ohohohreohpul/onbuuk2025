import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import * as LucideIcons from 'lucide-react';
import { Plus, Trash2, GripVertical, Save, Upload, AlertCircle, Eye, Code } from 'lucide-react';

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

export default function WelcomeFeaturesSettings() {
  const { businessId } = useAdminAuth();
  const [cards, setCards] = useState<WelcomeCard[]>([]);
  const [showFeatures, setShowFeatures] = useState(true);
  const [useCustomHTML, setUseCustomHTML] = useState(false);
  const [customHTML, setCustomHTML] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showHTMLEditor, setShowHTMLEditor] = useState(false);

  useEffect(() => {
    if (businessId) {
      fetchSettings();
    }
  }, [businessId]);

  const fetchSettings = async () => {
    try {
      const [businessData, cardsData] = await Promise.all([
        supabase
          .from('businesses')
          .select('show_welcome_features, use_custom_welcome_html, welcome_custom_html')
          .eq('id', businessId)
          .single(),
        supabase
          .from('welcome_feature_cards')
          .select('*')
          .eq('business_id', businessId)
          .order('card_order')
      ]);

      if (businessData.data) {
        setShowFeatures(businessData.data.show_welcome_features ?? true);
        setUseCustomHTML(businessData.data.use_custom_welcome_html ?? false);
        setCustomHTML(businessData.data.welcome_custom_html ?? '');
      }

      if (cardsData.data) {
        setCards(cardsData.data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!businessId) return;
    setSaving(true);
    setMessage(null);

    try {
      await supabase
        .from('businesses')
        .update({
          show_welcome_features: showFeatures,
          use_custom_welcome_html: useCustomHTML,
          welcome_custom_html: customHTML
        })
        .eq('id', businessId);

      for (const card of cards) {
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

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      await fetchSettings();
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const addCard = () => {
    const newCard: WelcomeCard = {
      id: `temp-${Date.now()}`,
      card_order: cards.length + 1,
      icon_type: 'lucide',
      icon_name: 'Check',
      icon_url: null,
      title: 'New Feature',
      description: 'Describe your feature here',
      is_enabled: true
    };
    setCards([...cards, newCard]);
  };

  const updateCard = (index: number, updates: Partial<WelcomeCard>) => {
    const newCards = [...cards];
    newCards[index] = { ...newCards[index], ...updates };
    setCards(newCards);
  };

  const deleteCard = async (index: number) => {
    const card = cards[index];
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
    setCards(cards.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newCards = [...cards];
    const draggedCard = newCards[draggedIndex];
    newCards.splice(draggedIndex, 1);
    newCards.splice(index, 0, draggedCard);

    newCards.forEach((card, idx) => {
      card.card_order = idx + 1;
    });

    setCards(newCards);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const uploadIcon = async (index: number, file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
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
      setMessage({ type: 'error', text: 'Failed to upload icon' });
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
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Welcome Features</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Customize the feature cards displayed on your booking welcome page
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? 'Hide' : 'Show'} Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowHTMLEditor(!showHTMLEditor)}
          >
            <Code className="w-4 h-4 mr-2" />
            Custom HTML
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Display Feature Cards</Label>
              <p className="text-sm text-muted-foreground">
                Show feature cards on the welcome page
              </p>
            </div>
            <Button
              variant={showFeatures ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFeatures(!showFeatures)}
            >
              {showFeatures ? 'Enabled' : 'Disabled'}
            </Button>
          </div>

          {showHTMLEditor && (
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Use Custom HTML</Label>
                  <p className="text-sm text-muted-foreground">
                    Replace feature cards with custom HTML code
                  </p>
                </div>
                <Button
                  variant={useCustomHTML ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseCustomHTML(!useCustomHTML)}
                >
                  {useCustomHTML ? 'Enabled' : 'Disabled'}
                </Button>
              </div>

              {useCustomHTML && (
                <div className="space-y-2">
                  <Label>Custom HTML Code</Label>
                  <textarea
                    value={customHTML}
                    onChange={(e) => setCustomHTML(e.target.value)}
                    className="w-full h-48 p-3 border rounded-md font-mono text-sm"
                    placeholder="<div>Your custom HTML here...</div>"
                  />
                  <p className="text-xs text-muted-foreground">
                    HTML will be sanitized for security. Use inline styles or Tailwind classes.
                  </p>
                </div>
              )}
            </div>
          )}

          {!useCustomHTML && showFeatures && (
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <Label>Feature Cards ({cards.length}/5)</Label>
                <Button
                  onClick={addCard}
                  size="sm"
                  disabled={cards.length >= 5}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Card
                </Button>
              </div>

              <div className="space-y-3">
                {cards.map((card, index) => (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="border rounded-lg p-4 space-y-4 bg-card hover:border-primary/50 transition-colors cursor-move"
                  >
                    <div className="flex items-start gap-3">
                      <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />

                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded flex items-center justify-center">
                            {renderIcon(card)}
                          </div>

                          <div className="flex-1 flex gap-2">
                            <select
                              value={card.icon_type}
                              onChange={(e) => updateCard(index, {
                                icon_type: e.target.value as 'lucide' | 'custom',
                                icon_name: e.target.value === 'lucide' ? 'Check' : null,
                                icon_url: null
                              })}
                              className="px-3 py-1.5 border rounded-md text-sm"
                            >
                              <option value="lucide">Lucide Icon</option>
                              <option value="custom">Custom Image</option>
                            </select>

                            {card.icon_type === 'lucide' ? (
                              <select
                                value={card.icon_name || 'Check'}
                                onChange={(e) => updateCard(index, { icon_name: e.target.value })}
                                className="flex-1 px-3 py-1.5 border rounded-md text-sm"
                              >
                                {POPULAR_ICONS.map(icon => (
                                  <option key={icon} value={icon}>{icon}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex-1">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) uploadIcon(index, file);
                                  }}
                                  className="text-sm"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant={card.is_enabled ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateCard(index, { is_enabled: !card.is_enabled })}
                            >
                              {card.is_enabled ? 'Enabled' : 'Disabled'}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteCard(index)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div>
                            <Label className="text-xs">Title (max 50 chars)</Label>
                            <Input
                              value={card.title}
                              onChange={(e) => updateCard(index, { title: e.target.value.slice(0, 50) })}
                              placeholder="Feature title"
                              maxLength={50}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Description (max 200 chars)</Label>
                            <textarea
                              value={card.description}
                              onChange={(e) => updateCard(index, { description: e.target.value.slice(0, 200) })}
                              placeholder="Feature description"
                              maxLength={200}
                              className="w-full px-3 py-2 border rounded-md text-sm resize-none"
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
        </CardContent>
      </Card>

      {showPreview && showFeatures && !useCustomHTML && (
        <Card>
          <CardContent className="pt-6">
            <Label className="mb-4 block">Preview</Label>
            <div className="grid gap-4">
              {cards.filter(c => c.is_enabled).map((card) => (
                <Card key={card.id} className="border-muted">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-primary/10 flex items-center justify-center flex-shrink-0">
                        {renderIcon(card, 'w-5 h-5 text-primary')}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1 text-sm">{card.title}</h3>
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {card.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showPreview && useCustomHTML && customHTML && (
        <Card>
          <CardContent className="pt-6">
            <Label className="mb-4 block">Custom HTML Preview</Label>
            <div
              className="p-4 border rounded-md"
              dangerouslySetInnerHTML={{ __html: customHTML }}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}
