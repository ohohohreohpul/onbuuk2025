import DOMPurify from 'isomorphic-dompurify';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAdminAuth } from '../../../hooks/useAdminAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { WELCOME_ICON_NAMES, welcomeIcon } from '../../../lib/welcomeIcons';
import { Plus, Trash2, GripVertical, Save, Upload, AlertCircle, Eye, Code } from 'lucide-react';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  loading: string; heading: string; intro: string; showPreview: string; hidePreview: string; customHtml: string;
  loadFailed: string; saveFailed: string; saved: string; uploadFailed: string;
  displayCards: string; displayCardsHint: string; enabled: string; disabled: string;
  useCustomHtml: string; useCustomHtmlHint: string; customHtmlCode: string; customHtmlPlaceholder: string; customHtmlHint: string;
  cardsCount: string; addCard: string; lucideIcon: string; customImage: string; deleteCard: string; iconAlt: string;
  titleLabel: string; titlePlaceholder: string; descriptionLabel: string; descriptionPlaceholder: string;
  preview: string; customHtmlPreview: string; saving: string; save: string;
}> = {
  en: {
    loading: 'Loading...', heading: 'Welcome Features', intro: 'Customize the feature cards displayed on your booking welcome page',
    showPreview: 'Show Preview', hidePreview: 'Hide Preview', customHtml: 'Custom HTML',
    loadFailed: 'Failed to load settings', saveFailed: 'Failed to save settings', saved: 'Settings saved successfully!', uploadFailed: 'Failed to upload icon',
    displayCards: 'Display Feature Cards', displayCardsHint: 'Show feature cards on the welcome page', enabled: 'Enabled', disabled: 'Disabled',
    useCustomHtml: 'Use Custom HTML', useCustomHtmlHint: 'Replace feature cards with custom HTML code', customHtmlCode: 'Custom HTML Code',
    customHtmlPlaceholder: '<div>Your custom HTML here...</div>', customHtmlHint: 'HTML will be sanitized for security. Use inline styles or Tailwind classes.',
    cardsCount: 'Feature Cards ({count}/{max})', addCard: 'Add Card', lucideIcon: 'Lucide Icon', customImage: 'Custom Image', deleteCard: 'Delete card', iconAlt: 'icon',
    titleLabel: 'Title (max {max} chars)', titlePlaceholder: 'Feature title', descriptionLabel: 'Description (max {max} chars)', descriptionPlaceholder: 'Feature description',
    preview: 'Preview', customHtmlPreview: 'Custom HTML Preview', saving: 'Saving...', save: 'Save Changes',
  },
  de: {
    loading: 'Wird geladen…', heading: 'Info-Karten der Willkommensseite', intro: 'Info-Karten auf der Willkommensseite der Buchungsseite anpassen',
    showPreview: 'Vorschau anzeigen', hidePreview: 'Vorschau ausblenden', customHtml: 'Eigenes HTML',
    loadFailed: 'Einstellungen konnten nicht geladen werden', saveFailed: 'Einstellungen konnten nicht gespeichert werden', saved: 'Einstellungen gespeichert', uploadFailed: 'Symbol konnte nicht hochgeladen werden',
    displayCards: 'Info-Karten anzeigen', displayCardsHint: 'Info-Karten auf der Willkommensseite anzeigen', enabled: 'Aktiv', disabled: 'Inaktiv',
    useCustomHtml: 'Eigenes HTML verwenden', useCustomHtmlHint: 'Info-Karten durch eigenen HTML-Code ersetzen', customHtmlCode: 'Eigener HTML-Code',
    customHtmlPlaceholder: '<div>Ihr HTML hier…</div>', customHtmlHint: 'HTML wird aus Sicherheitsgründen bereinigt. Inline-Styles oder Tailwind-Klassen verwenden.',
    cardsCount: 'Info-Karten ({count}/{max})', addCard: 'Karte hinzufügen', lucideIcon: 'Lucide-Symbol', customImage: 'Eigenes Bild', deleteCard: 'Karte löschen', iconAlt: 'Symbol',
    titleLabel: 'Titel (max. {max} Zeichen)', titlePlaceholder: 'Titel der Karte', descriptionLabel: 'Beschreibung (max. {max} Zeichen)', descriptionPlaceholder: 'Beschreibung der Karte',
    preview: 'Vorschau', customHtmlPreview: 'Vorschau eigenes HTML', saving: 'Wird gespeichert…', save: 'Speichern',
  },
  th: {
    loading: 'กำลังโหลด…', heading: 'การ์ดแนะนำในหน้าต้อนรับ', intro: 'ปรับแต่งการ์ดแนะนำที่แสดงในหน้าต้อนรับของหน้าจอง',
    showPreview: 'แสดงตัวอย่าง', hidePreview: 'ซ่อนตัวอย่าง', customHtml: 'HTML กำหนดเอง',
    loadFailed: 'โหลดการตั้งค่าไม่สำเร็จ', saveFailed: 'บันทึกการตั้งค่าไม่สำเร็จ', saved: 'บันทึกการตั้งค่าแล้ว', uploadFailed: 'อัปโหลดไอคอนไม่สำเร็จ',
    displayCards: 'แสดงการ์ดแนะนำ', displayCardsHint: 'แสดงการ์ดแนะนำในหน้าต้อนรับ', enabled: 'เปิดใช้', disabled: 'ปิดใช้',
    useCustomHtml: 'ใช้ HTML กำหนดเอง', useCustomHtmlHint: 'แทนที่การ์ดแนะนำด้วยโค้ด HTML ของคุณเอง', customHtmlCode: 'โค้ด HTML กำหนดเอง',
    customHtmlPlaceholder: '<div>ใส่ HTML ของคุณที่นี่…</div>', customHtmlHint: 'ระบบจะกรอง HTML เพื่อความปลอดภัย ใช้ inline style หรือคลาส Tailwind ได้',
    cardsCount: 'การ์ดแนะนำ ({count}/{max})', addCard: 'เพิ่มการ์ด', lucideIcon: 'ไอคอน Lucide', customImage: 'รูปภาพของร้าน', deleteCard: 'ลบการ์ด', iconAlt: 'ไอคอน',
    titleLabel: 'หัวข้อ (ไม่เกิน {max} ตัวอักษร)', titlePlaceholder: 'หัวข้อการ์ด', descriptionLabel: 'คำอธิบาย (ไม่เกิน {max} ตัวอักษร)', descriptionPlaceholder: 'คำอธิบายการ์ด',
    preview: 'ตัวอย่าง', customHtmlPreview: 'ตัวอย่าง HTML กำหนดเอง', saving: 'กำลังบันทึก…', save: 'บันทึก',
  },
};

type MessageKey = 'loadFailed' | 'saveFailed' | 'saved' | 'uploadFailed';

const MAX_CARDS = 5;
const MAX_TITLE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 200;

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

export default function WelcomeFeaturesSettings() {
  const adminUser = useAdminAuth();
  const businessId = adminUser?.business_id;
  const { t } = useAdminText(TEXT);
  const [cards, setCards] = useState<WelcomeCard[]>([]);
  const [showFeatures, setShowFeatures] = useState(true);
  const [useCustomHTML, setUseCustomHTML] = useState(false);
  const [customHTML, setCustomHTML] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', key: MessageKey } | null>(null);
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
      setMessage({ type: 'error', key: 'loadFailed' });
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

      setMessage({ type: 'success', key: 'saved' });
      await fetchSettings();
    } catch (error) {
      console.error('Error saving:', error);
      setMessage({ type: 'error', key: 'saveFailed' });
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
      setMessage({ type: 'error', key: 'uploadFailed' });
    }
  };

  const renderIcon = (card: WelcomeCard, size: string = 'w-5 h-5') => {
    if (card.icon_type === 'custom' && card.icon_url) {
      return <img src={card.icon_url} alt={t.iconAlt} className={size} />;
    }
    const IconComponent = welcomeIcon(card.icon_type === 'lucide' ? card.icon_name : null);
    return <IconComponent className={size} />;
  };

  if (loading) {
    return <div className="p-6">{t.loading}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">{t.heading}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {t.intro}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? t.hidePreview : t.showPreview}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowHTMLEditor(!showHTMLEditor)}
          >
            <Code className="w-4 h-4 mr-2" />
            {t.customHtml}
          </Button>
        </div>
      </div>

      {message && (
        <Alert variant={message.type === 'error' ? 'destructive' : 'default'}>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{t[message.key]}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t.displayCards}</Label>
              <p className="text-sm text-muted-foreground">
                {t.displayCardsHint}
              </p>
            </div>
            <Button
              variant={showFeatures ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFeatures(!showFeatures)}
            >
              {showFeatures ? t.enabled : t.disabled}
            </Button>
          </div>

          {showHTMLEditor && (
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t.useCustomHtml}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t.useCustomHtmlHint}
                  </p>
                </div>
                <Button
                  variant={useCustomHTML ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setUseCustomHTML(!useCustomHTML)}
                >
                  {useCustomHTML ? t.enabled : t.disabled}
                </Button>
              </div>

              {useCustomHTML && (
                <div className="space-y-2">
                  <Label>{t.customHtmlCode}</Label>
                  <textarea
                    value={customHTML}
                    onChange={(e) => setCustomHTML(e.target.value)}
                    className="w-full h-48 p-3 border rounded-md font-mono text-sm"
                    placeholder={t.customHtmlPlaceholder}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t.customHtmlHint}
                  </p>
                </div>
              )}
            </div>
          )}

          {!useCustomHTML && showFeatures && (
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <Label>{fillText(t.cardsCount, { count: cards.length, max: MAX_CARDS })}</Label>
                <Button
                  onClick={addCard}
                  size="sm"
                  disabled={cards.length >= MAX_CARDS}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t.addCard}
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
                              <option value="lucide">{t.lucideIcon}</option>
                              <option value="custom">{t.customImage}</option>
                            </select>

                            {card.icon_type === 'lucide' ? (
                              <select
                                value={card.icon_name || 'Check'}
                                onChange={(e) => updateCard(index, { icon_name: e.target.value })}
                                className="flex-1 px-3 py-1.5 border rounded-md text-sm"
                              >
                                {WELCOME_ICON_NAMES.map(icon => (
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
                              {card.is_enabled ? t.enabled : t.disabled}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => deleteCard(index)}
                              aria-label={t.deleteCard}
                              title={t.deleteCard}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          <div>
                            <Label className="text-xs">{fillText(t.titleLabel, { max: MAX_TITLE_LENGTH })}</Label>
                            <Input
                              value={card.title}
                              onChange={(e) => updateCard(index, { title: e.target.value.slice(0, MAX_TITLE_LENGTH) })}
                              placeholder={t.titlePlaceholder}
                              maxLength={MAX_TITLE_LENGTH}
                            />
                          </div>
                          <div>
                            <Label className="text-xs">{fillText(t.descriptionLabel, { max: MAX_DESCRIPTION_LENGTH })}</Label>
                            <textarea
                              value={card.description}
                              onChange={(e) => updateCard(index, { description: e.target.value.slice(0, MAX_DESCRIPTION_LENGTH) })}
                              placeholder={t.descriptionPlaceholder}
                              maxLength={MAX_DESCRIPTION_LENGTH}
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
            <Label className="mb-4 block">{t.preview}</Label>
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
            <Label className="mb-4 block">{t.customHtmlPreview}</Label>
            <div
              className="p-4 border rounded-md"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(customHTML) }}
            />
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </div>
  );
}
