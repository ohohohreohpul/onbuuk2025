import { useState, useEffect } from 'react';
import {
  Gift,
  Award,
  CreditCard,
  DollarSign,
  Save,
  Download,
  Mail,
  Eye,
  Upload,
  Trash2,
  CheckSquare,
  Square,
  AlertTriangle,
  Plus,
  Image as ImageIcon,
  Package,
  Clock,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import { POSView } from './POSView';
import { downloadGiftCardPDF } from '../../lib/giftCardPdfGenerator';
import { GiftCardDetailModal } from './GiftCardDetailModal';
import { ImportGiftCardsModal } from './ImportGiftCardsModal';
import {
  ADMIN_INPUT,
  ADMIN_MODAL,
  ADMIN_MODAL_BACKDROP,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SECONDARY_BUTTON,
  ADMIN_SEGMENT_ACTIVE,
  ADMIN_SEGMENT_INACTIVE,
  ADMIN_SEGMENTED_CONTROL,
  ADMIN_STATUS_PILL,
  ADMIN_SURFACE,
  ADMIN_TERTIARY_BUTTON,
} from './adminUi';

interface LoyaltySettings {
  enabled: boolean;
  points_per_dollar_spent: number;
  points_redemption_value: number;
  points_expiry_days: number | null;
  welcome_bonus_points: number;
}

type GiftCardCodeFormat = 'standard' | 'numeric_6' | 'alphanumeric_6' | 'prefix_numeric';

interface GiftCardSettings {
  enabled: boolean;
  preset_amounts_cents: number[];
  allow_custom_amount: boolean;
  min_custom_amount_cents: number;
  max_custom_amount_cents: number;
  expiry_days: number | null;
  design_url: string | null;
  terms_and_conditions: string | null;
  code_format: GiftCardCodeFormat;
  code_prefix: string | null;
}

const CODE_FORMAT_OPTIONS: { value: GiftCardCodeFormat; label: string; example: string }[] = [
  { value: 'standard', label: 'Standard (current)', example: 'ABCD-EFGH-JKLM-NPQR' },
  { value: 'numeric_6', label: '6-Digit Numeric', example: '482917' },
  { value: 'alphanumeric_6', label: '6-Character Alphanumeric', example: 'A3K8F2' },
  { value: 'prefix_numeric', label: 'Custom Prefix + 6 Digits', example: 'SPA-483921' },
];

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  purchase_price_cents?: number;
  card_type?: 'value' | 'service_pass';
  service_pass_offer_id?: string | null;
  service_pass_name?: string | null;
  service_id?: string | null;
  duration_id?: string | null;
  original_visits?: number | null;
  remaining_visits?: number | null;
  status: string;
  purchased_at: string;
  expires_at: string | null;
  purchased_for_email: string | null;
}

interface ServiceOption {
  id: string;
  name: string;
}

interface DurationOption {
  id: string;
  service_id: string;
  duration_minutes: number;
  price_cents: number;
}

interface ServicePassOffer {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  service_id: string;
  duration_id: string;
  visit_count: number;
  price_cents: number;
  expiry_days: number | null;
  is_active: boolean;
  created_at: string;
}

export function LoyaltyRewardsView() {
  const { businessId } = useTenant();
  const { currencySymbol, formatAmount } = useCurrency();
  const [activeTab, setActiveTab] = useState<'loyalty' | 'giftcards' | 'manage' | 'pos'>('loyalty');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [businessName, setBusinessName] = useState('Business');

  // Loyalty settings
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings>({
    enabled: false,
    points_per_dollar_spent: 10,
    points_redemption_value: 100,
    points_expiry_days: null,
    welcome_bonus_points: 0,
  });

  // Gift card settings
  const [giftCardSettings, setGiftCardSettings] = useState<GiftCardSettings>({
    enabled: false,
    preset_amounts_cents: [2500, 5000, 10000],
    allow_custom_amount: true,
    min_custom_amount_cents: 1000,
    max_custom_amount_cents: 50000,
    expiry_days: null,
    design_url: null,
    terms_and_conditions: null,
    code_format: 'standard',
    code_prefix: null,
  });
  const [uploadingDesign, setUploadingDesign] = useState(false);

  // Gift cards list
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [creatingGiftCard, setCreatingGiftCard] = useState(false);
  const [newGiftCardAmount, setNewGiftCardAmount] = useState('50');
  const [newGiftCardEmail, setNewGiftCardEmail] = useState('');
  const [newGiftCardType, setNewGiftCardType] = useState<'value' | 'service_pass'>('value');
  const [newServicePassOfferId, setNewServicePassOfferId] = useState('');
  const [selectedGiftCard, setSelectedGiftCard] = useState<GiftCard | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Service-pass catalogue
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [durations, setDurations] = useState<DurationOption[]>([]);
  const [servicePassOffers, setServicePassOffers] = useState<ServicePassOffer[]>([]);
  const [savingServicePass, setSavingServicePass] = useState(false);
  const [newServicePass, setNewServicePass] = useState({
    name: '',
    description: '',
    service_id: '',
    duration_id: '',
    visit_count: '5',
    price: '',
    expiry_days: '',
  });
  
  // Bulk selection state
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadSettings();
    loadGiftCards();
    loadServicePassData();
  }, [businessId]);

  const loadServicePassData = async () => {
    if (!businessId) return;

    const [servicesResult, durationsResult, offersResult] = await Promise.all([
      supabase
        .from('services')
        .select('id, name')
        .eq('business_id', businessId)
        .order('display_order', { ascending: true }),
      supabase
        .from('service_durations')
        .select('id, service_id, duration_minutes, price_cents')
        .eq('business_id', businessId)
        .order('duration_minutes', { ascending: true }),
      supabase
        .from('service_pass_offers')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
    ]);

    if (servicesResult.data) setServices(servicesResult.data);
    if (durationsResult.data) setDurations(durationsResult.data);
    if (offersResult.data) {
      setServicePassOffers(offersResult.data);
      setNewServicePassOfferId((current) => current || offersResult.data.find((offer) => offer.is_active)?.id || '');
    }
  };

  const createServicePassOffer = async () => {
    const visitCount = Number(newServicePass.visit_count);
    const priceCents = Math.round(Number(newServicePass.price) * 100);
    const expiryDays = newServicePass.expiry_days ? Number(newServicePass.expiry_days) : null;

    if (!newServicePass.name.trim() || !newServicePass.service_id || !newServicePass.duration_id) {
      setMessage('Name, service, and duration are required');
      return;
    }
    if (!Number.isInteger(visitCount) || visitCount < 1 || visitCount > 100) {
      setMessage('Visits must be a whole number between 1 and 100');
      return;
    }
    if (!priceCents || priceCents <= 0) {
      setMessage('Enter a valid package sale price');
      return;
    }

    setSavingServicePass(true);
    setMessage('');
    const { error } = await supabase.from('service_pass_offers').insert({
      business_id: businessId,
      name: newServicePass.name.trim(),
      description: newServicePass.description.trim() || null,
      service_id: newServicePass.service_id,
      duration_id: newServicePass.duration_id,
      visit_count: visitCount,
      price_cents: priceCents,
      expiry_days: expiryDays,
      is_active: true,
    });

    if (error) {
      console.error('Error creating service pass:', error);
      setMessage(`Error creating service pass: ${error.message}`);
    } else {
      setMessage('Service pass added to the customer shop');
      setNewServicePass({
        name: '',
        description: '',
        service_id: '',
        duration_id: '',
        visit_count: '5',
        price: '',
        expiry_days: '',
      });
      await loadServicePassData();
      setTimeout(() => setMessage(''), 3000);
    }
    setSavingServicePass(false);
  };

  const toggleServicePassOffer = async (offer: ServicePassOffer) => {
    const { error } = await supabase
      .from('service_pass_offers')
      .update({ is_active: !offer.is_active, updated_at: new Date().toISOString() })
      .eq('id', offer.id)
      .eq('business_id', businessId);

    if (error) {
      setMessage(`Error updating service pass: ${error.message}`);
      return;
    }
    await loadServicePassData();
  };

  const deleteServicePassOffer = async (offerId: string) => {
    const { error } = await supabase
      .from('service_pass_offers')
      .delete()
      .eq('id', offerId)
      .eq('business_id', businessId);

    if (error) {
      setMessage(error.code === '23503'
        ? 'This pass has already been sold. Pause it instead of deleting it.'
        : `Error deleting service pass: ${error.message}`);
      return;
    }
    await loadServicePassData();
  };

  const loadSettings = async () => {
    setLoading(true);

    // Load business name
    const { data: businessData } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .maybeSingle();

    if (businessData) {
      setBusinessName(businessData.name);
    }

    // Load loyalty settings
    const { data: loyaltyData } = await supabase
      .from('loyalty_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (loyaltyData) {
      setLoyaltySettings(loyaltyData);
    }

    // Load gift card settings
    const { data: giftCardData } = await supabase
      .from('gift_card_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle();

    if (giftCardData) {
      setGiftCardSettings(giftCardData);
    }

    setLoading(false);
  };

  const loadGiftCards = async () => {
    if (!businessId) {
      console.warn('loadGiftCards: No businessId available');
      return;
    }
    
    const { data, error } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('business_id', businessId)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error('Error loading gift cards:', error);
      return;
    }
    
    if (data) {
      setGiftCards(data);
    }
  };

  const saveLoyaltySettings = async () => {
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('loyalty_settings')
      .upsert({
        business_id: businessId,
        ...loyaltySettings,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      setMessage('Error saving settings');
      console.error(error);
    } else {
      setMessage('Loyalty settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    }

    setSaving(false);
  };

  const saveGiftCardSettings = async () => {
    setSaving(true);
    setMessage('');

    const { error } = await supabase
      .from('gift_card_settings')
      .upsert({
        business_id: businessId,
        ...giftCardSettings,
        updated_at: new Date().toISOString(),
      });

    if (error) {
      setMessage('Error saving settings');
      console.error(error);
    } else {
      setMessage('Gift card settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    }

    setSaving(false);
  };

  const createGiftCard = async () => {
    const trimmedEmail = newGiftCardEmail.trim();
    if (!trimmedEmail) {
      setMessage('Recipient email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setMessage('Please enter a valid recipient email');
      return;
    }

    setCreatingGiftCard(true);
    setMessage('');

    const selectedOffer = servicePassOffers.find((offer) => offer.id === newServicePassOfferId);
    const amountCents = newGiftCardType === 'service_pass'
      ? selectedOffer?.price_cents || 0
      : Math.round(parseFloat(newGiftCardAmount) * 100);

    if (newGiftCardType === 'service_pass' && !selectedOffer) {
      setMessage('Choose a service pass to issue');
      setCreatingGiftCard(false);
      return;
    }

    if (newGiftCardType === 'value' && (!amountCents || amountCents <= 0)) {
      setMessage('Enter a valid gift-card value');
      setCreatingGiftCard(false);
      return;
    }

    // Generate code using the database function
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_gift_card_code', { p_business_id: businessId });

    if (codeError || !codeData) {
      setMessage('Error generating gift card code');
      setCreatingGiftCard(false);
      return;
    }

    const code = codeData;

    // Calculate expiry date
    let expiresAt = null;
    const expiryDays = newGiftCardType === 'service_pass'
      ? selectedOffer?.expiry_days ?? giftCardSettings.expiry_days
      : giftCardSettings.expiry_days;
    if (expiryDays) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + expiryDays);
      expiresAt = expiry.toISOString();
    }

    const cardPayload = newGiftCardType === 'service_pass' && selectedOffer
      ? {
          business_id: businessId,
          code,
          card_type: 'service_pass',
          service_pass_offer_id: selectedOffer.id,
          service_pass_name: selectedOffer.name,
          service_id: selectedOffer.service_id,
          duration_id: selectedOffer.duration_id,
          original_visits: selectedOffer.visit_count,
          remaining_visits: selectedOffer.visit_count,
          purchase_price_cents: selectedOffer.price_cents,
          original_value_cents: 0,
          current_balance_cents: 0,
          purchased_for_email: trimmedEmail,
          expires_at: expiresAt,
        }
      : {
          business_id: businessId,
          code,
          card_type: 'value',
          purchase_price_cents: amountCents,
          original_value_cents: amountCents,
          current_balance_cents: amountCents,
          purchased_for_email: trimmedEmail,
          expires_at: expiresAt,
        };

    const { data: createdCard, error } = await supabase
      .from('gift_cards')
      .insert(cardPayload)
      .select('id')
      .single();

    if (error) {
      setMessage('Error creating gift card');
      console.error(error);
    } else {
      if (createdCard) {
        await supabase.from('gift_card_transactions').insert({
          gift_card_id: createdCard.id,
          amount_cents: amountCents,
          visit_count: newGiftCardType === 'service_pass' ? selectedOffer?.visit_count || 0 : 0,
          transaction_type: 'purchase',
          description: newGiftCardType === 'service_pass'
            ? `Service pass issued manually: ${selectedOffer?.name}`
            : 'Value gift card issued manually',
        });
      }
      setMessage(`${newGiftCardType === 'service_pass' ? 'Service pass' : 'Gift card'} created: ${code}`);
      setNewGiftCardAmount('50');
      setNewGiftCardEmail('');
      loadGiftCards();
      setTimeout(() => setMessage(''), 5000);
    }

    setCreatingGiftCard(false);
  };

  const handleDownloadGiftCard = async (card: GiftCard) => {
    try {
      const passDuration = durations.find((duration) => duration.id === card.duration_id);
      await downloadGiftCardPDF({
        code: card.code,
        amount: card.original_value_cents / 100,
        cardType: card.card_type || 'value',
        servicePassName: card.service_pass_name,
        visits: card.original_visits,
        durationMinutes: passDuration?.duration_minutes,
        designUrl: giftCardSettings.design_url,
        termsAndConditions: giftCardSettings.terms_and_conditions,
        businessName: businessName,
        expiresAt: card.expires_at,
        currencySymbol: currencySymbol,
      });
      setMessage('Gift card PDF downloaded!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error downloading gift card:', error);
      setMessage('Error downloading gift card');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEmailGiftCard = async (card: GiftCard) => {
    if (!card.purchased_for_email) {
      setMessage('No recipient email address for this gift card');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setMessage('Sending gift card email...');
      
      const { data, error } = await supabase.functions.invoke('send-business-email', {
        body: {
          business_id: businessId,
          event_key: 'gift_card_received',
          recipient_email: card.purchased_for_email,
          recipient_name: card.purchased_for_email.split('@')[0],
          variables: {
            recipient_email: card.purchased_for_email,
            gift_card_code: card.code,
            amount: card.card_type === 'service_pass'
              ? `${card.service_pass_name || 'Service pass'} · ${card.original_visits || 0} visits`
              : formatAmount(card.original_value_cents / 100),
            message: '',
            sender_name: (card as any).purchased_by_name || 'Someone special',
            business_name: businessName,
          },
        },
      });

      if (error) {
        console.error('Error sending email:', error);
        setMessage(`Error: ${error.message}`);
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      if (data?.error) {
        console.error('Email service error:', data.error);
        setMessage(`Error: ${data.error}`);
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      setMessage('Gift card email sent successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error emailing gift card:', error);
      setMessage(`Error sending email: ${error.message || 'Unknown error'}`);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Bulk selection handlers
  const toggleSelectCard = (cardId: string) => {
    const newSelected = new Set(selectedCardIds);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCardIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCardIds.size === giftCards.length) {
      setSelectedCardIds(new Set());
    } else {
      setSelectedCardIds(new Set(giftCards.map(card => card.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCardIds.size === 0) return;
    
    setIsDeleting(true);
    setMessage('');

    try {
      const idsToDelete = Array.from(selectedCardIds);
      
      const { error } = await supabase
        .from('gift_cards')
        .delete()
        .in('id', idsToDelete);

      if (error) {
        throw error;
      }

      setMessage(`Successfully deleted ${idsToDelete.length} gift card(s)`);
      setSelectedCardIds(new Set());
      setShowDeleteConfirm(false);
      await loadGiftCards();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting gift cards:', error);
      setMessage('Error deleting gift cards. Please try again.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setIsDeleting(false);
    }
  };

  const activeGiftCards = giftCards.filter((card) => card.status === 'active').length;
  const outstandingBalance = giftCards
    .filter((card) => (card.card_type || 'value') === 'value')
    .reduce((sum, card) => sum + card.current_balance_cents, 0);
  const outstandingVisits = giftCards
    .filter((card) => card.card_type === 'service_pass' && card.status === 'active')
    .reduce((sum, card) => sum + (card.remaining_visits || 0), 0);
  const issuedValue = giftCards.reduce(
    (sum, card) => sum + (card.purchase_price_cents ?? card.original_value_cents),
    0,
  );
  const messageIsError = /error|required|valid|failed/i.test(message);

  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-56 rounded-lg bg-stone-900/[0.06]" />
          <div className="h-4 w-80 rounded bg-stone-900/[0.04]" />
        </div>
        <div className="h-12 w-[36rem] max-w-full rounded-xl bg-stone-900/[0.05]" />
        <div className={`${ADMIN_SURFACE} h-80 bg-stone-900/[0.025]`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#1A1714]">Loyalty & Rewards</h1>
          <p className="text-sm text-stone-500">Turn repeat visits into lasting relationships and manage cards and service passes.</p>
        </div>
        <span className={`${ADMIN_STATUS_PILL} w-fit ${loyaltySettings.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-900/[0.05] text-stone-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${loyaltySettings.enabled ? 'bg-emerald-500' : 'bg-stone-400'}`} />
          Loyalty {loyaltySettings.enabled ? 'active' : 'paused'}
        </span>
      </div>

      {message && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm ${
            messageIsError
              ? 'border-red-200/80 bg-red-50/70 text-red-700'
              : 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'
          }`}
        >
          {message}
        </div>
      )}

      <div className="overflow-x-auto pb-1">
        <div className={`${ADMIN_SEGMENTED_CONTROL} min-w-max`}>
          {[
            { id: 'loyalty' as const, label: 'Loyalty program', icon: Award },
            { id: 'giftcards' as const, label: 'Gift-card setup', icon: Gift },
            { id: 'manage' as const, label: 'Gift cards', icon: CreditCard },
            { id: 'pos' as const, label: 'Point of sale', icon: DollarSign },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id ? ADMIN_SEGMENT_ACTIVE : ADMIN_SEGMENT_INACTIVE
              }`}
            >
              <tab.icon className="h-4 w-4" strokeWidth={1.75} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'loyalty' && (
        <div className={`${ADMIN_SURFACE} overflow-hidden`}>
          <div className="flex flex-col justify-between gap-5 border-b border-stone-200/70 p-6 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]">
                <Award className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="font-semibold text-[#1A1714]">Points program</h2>
                <p className="mt-1 max-w-xl text-sm text-stone-500">Reward completed bookings automatically and let customers redeem points on future visits.</p>
              </div>
            </div>
            <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-3">
              <span className="text-sm font-medium text-stone-600">{loyaltySettings.enabled ? 'Enabled' : 'Disabled'}</span>
              <input
                type="checkbox"
                checked={loyaltySettings.enabled}
                onChange={(event) => setLoyaltySettings({ ...loyaltySettings, enabled: event.target.checked })}
                className="peer sr-only"
                aria-label="Enable loyalty points"
              />
              <span className="relative h-6 w-11 rounded-full bg-stone-200 ring-1 ring-stone-900/[0.06] transition peer-focus-visible:ring-4 peer-focus-visible:ring-stone-900/10 peer-checked:bg-[#1A1714] peer-checked:after:translate-x-5 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition" />
            </label>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Points per {currencySymbol}1 spent</span>
                <input
                  type="number"
                  min="0"
                  value={loyaltySettings.points_per_dollar_spent}
                  onChange={(event) => setLoyaltySettings({ ...loyaltySettings, points_per_dollar_spent: Number(event.target.value) || 0 })}
                  className={ADMIN_INPUT}
                />
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">Awarded after a booking is completed.</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Points for {currencySymbol}1 reward</span>
                <input
                  type="number"
                  min="1"
                  value={loyaltySettings.points_redemption_value}
                  onChange={(event) => setLoyaltySettings({ ...loyaltySettings, points_redemption_value: Math.max(1, Number(event.target.value) || 1) })}
                  className={ADMIN_INPUT}
                />
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">Sets the redemption value of each point.</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Welcome bonus</span>
                <input
                  type="number"
                  min="0"
                  value={loyaltySettings.welcome_bonus_points}
                  onChange={(event) => setLoyaltySettings({ ...loyaltySettings, welcome_bonus_points: Number(event.target.value) || 0 })}
                  className={ADMIN_INPUT}
                />
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">Points granted when a customer joins.</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Points expire after</span>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={loyaltySettings.points_expiry_days || ''}
                    onChange={(event) => setLoyaltySettings({ ...loyaltySettings, points_expiry_days: event.target.value ? Number(event.target.value) : null })}
                    placeholder="Never"
                    className={`${ADMIN_INPUT} pr-16`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-stone-400">days</span>
                </div>
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">Leave empty for no expiry.</span>
              </label>
            </div>

            <aside className="rounded-2xl bg-[#1A1714] p-5 text-white shadow-[0_12px_36px_rgba(26,23,20,0.16)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">Customer example</p>
              <p className="mt-5 text-3xl font-semibold tracking-tight">
                {100 * loyaltySettings.points_per_dollar_spent} points
              </p>
              <p className="mt-1 text-sm leading-6 text-white/60">earned on a {currencySymbol}100 completed visit</p>
              <div className="my-5 h-px bg-white/10" />
              <p className="text-sm text-white/70">
                {loyaltySettings.points_redemption_value} points unlock {formatAmount(1)} off.
              </p>
              {loyaltySettings.welcome_bonus_points > 0 && (
                <p className="mt-2 text-sm text-white/70">New members start with {loyaltySettings.welcome_bonus_points} points.</p>
              )}
            </aside>
          </div>

          <div className="flex justify-end border-t border-stone-200/70 bg-white/30 px-6 py-4">
            <button type="button" onClick={saveLoyaltySettings} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
              <Save className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save loyalty program'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'giftcards' && (
        <div className="space-y-6">
          <section className={`${ADMIN_SURFACE} overflow-hidden`}>
            <div className="flex flex-col justify-between gap-5 border-b border-stone-200/70 p-6 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]">
                  <Gift className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="font-semibold text-[#1A1714]">Gift-card rules</h2>
                  <p className="mt-1 text-sm text-stone-500">Choose values, expiry, and how new gift-card codes are generated.</p>
                </div>
              </div>
              <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-3">
                <span className="text-sm font-medium text-stone-600">{giftCardSettings.enabled ? 'Enabled' : 'Disabled'}</span>
                <input
                  type="checkbox"
                  checked={giftCardSettings.enabled}
                  onChange={(e) => setGiftCardSettings({ ...giftCardSettings, enabled: e.target.checked })}
                  className="peer sr-only"
                  aria-label="Enable gift cards"
                />
                <span className="relative h-6 w-11 rounded-full bg-stone-200 ring-1 ring-stone-900/[0.06] transition peer-focus-visible:ring-4 peer-focus-visible:ring-stone-900/10 peer-checked:bg-[#1A1714] peer-checked:after:translate-x-5 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition" />
              </label>
            </div>

            <div className="space-y-8 p-6">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700">Suggested values</label>
                    <p className="mt-1 text-xs text-stone-400">Customers can choose these values at checkout.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGiftCardSettings({
                      ...giftCardSettings,
                      preset_amounts_cents: [...giftCardSettings.preset_amounts_cents, 2500],
                    })}
                    className={ADMIN_SECONDARY_BUTTON}
                  >
                    <Plus className="h-4 w-4" /> Add value
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {giftCardSettings.preset_amounts_cents.map((amount, index) => (
                    <div key={`${amount}-${index}`} className="flex items-center gap-2 rounded-xl bg-stone-900/[0.035] p-2">
                      <span className="pl-2 text-sm text-stone-400">{currencySymbol}</span>
                      <input
                        type="number"
                        value={amount / 100}
                        onChange={(event) => {
                          const newAmounts = [...giftCardSettings.preset_amounts_cents];
                          newAmounts[index] = Math.round((Number(event.target.value) || 0) * 100);
                          setGiftCardSettings({ ...giftCardSettings, preset_amounts_cents: newAmounts });
                        }}
                        className="min-w-0 flex-1 bg-transparent py-2 text-sm font-medium text-[#1A1714] outline-none"
                        min="1"
                        aria-label={`Suggested gift-card value ${index + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => setGiftCardSettings({
                          ...giftCardSettings,
                          preset_amounts_cents: giftCardSettings.preset_amounts_cents.filter((_, itemIndex) => itemIndex !== index),
                        })}
                        className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={`Remove ${formatAmount(amount / 100)} value`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-stone-900/[0.025] p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1A1714]">Let customers choose a custom value</h3>
                    <p className="mt-1 text-xs text-stone-400">Set a safe minimum and maximum for checkout.</p>
                  </div>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={giftCardSettings.allow_custom_amount}
                      onChange={(event) => setGiftCardSettings({ ...giftCardSettings, allow_custom_amount: event.target.checked })}
                      className="peer sr-only"
                      aria-label="Allow custom gift-card values"
                    />
                    <span className="relative h-6 w-11 rounded-full bg-stone-200 ring-1 ring-stone-900/[0.06] transition peer-checked:bg-[#1A1714] peer-checked:after:translate-x-5 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition" />
                  </label>
                </div>

                {giftCardSettings.allow_custom_amount && (
                  <div className="mt-5 grid gap-4 border-t border-stone-200/70 pt-5 sm:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">Minimum ({currencySymbol})</span>
                      <input
                        type="number"
                        value={giftCardSettings.min_custom_amount_cents / 100}
                        onChange={(event) => setGiftCardSettings({ ...giftCardSettings, min_custom_amount_cents: Math.round((Number(event.target.value) || 0) * 100) })}
                        className={ADMIN_INPUT}
                        min="1"
                      />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">Maximum ({currencySymbol})</span>
                      <input
                        type="number"
                        value={giftCardSettings.max_custom_amount_cents / 100}
                        onChange={(event) => setGiftCardSettings({ ...giftCardSettings, max_custom_amount_cents: Math.round((Number(event.target.value) || 0) * 100) })}
                        className={ADMIN_INPUT}
                        min="1"
                      />
                    </label>
                  </div>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
                <label>
                  <span className="mb-2 block text-sm font-medium text-stone-700">Expiry</span>
                  <input
                    type="number"
                    value={giftCardSettings.expiry_days || ''}
                    onChange={(event) => setGiftCardSettings({ ...giftCardSettings, expiry_days: event.target.value ? Number(event.target.value) : null })}
                    className={ADMIN_INPUT}
                    placeholder="Never expires"
                    min="1"
                  />
                  <span className="mt-1.5 block text-xs text-stone-400">Days until expiry; leave empty for no expiry.</span>
                </label>
                <div>
                  <span className="mb-2 block text-sm font-medium text-stone-700">Code format</span>
                  <p className="mb-3 text-xs text-stone-400">Only new cards use the selected format.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {CODE_FORMAT_OPTIONS.map((option) => (
                      <label
                        key={option.value}
                        className={`cursor-pointer rounded-xl border p-3 transition ${
                          giftCardSettings.code_format === option.value
                            ? 'border-[#1A1714] bg-[#1A1714] text-white shadow-[0_4px_16px_rgba(26,23,20,0.14)]'
                            : 'border-stone-200/80 bg-white/55 text-stone-600 hover:border-stone-300 hover:bg-white/80'
                        }`}
                      >
                        <input
                          type="radio"
                          name="code_format"
                          value={option.value}
                          checked={giftCardSettings.code_format === option.value}
                          onChange={() => setGiftCardSettings({ ...giftCardSettings, code_format: option.value })}
                          className="sr-only"
                        />
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className={`mt-1 block font-mono text-xs ${giftCardSettings.code_format === option.value ? 'text-white/55' : 'text-stone-400'}`}>{option.example}</span>
                      </label>
                    ))}
                  </div>

                  {giftCardSettings.code_format === 'prefix_numeric' && (
                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-medium text-stone-700">Code prefix</span>
                      <input
                        type="text"
                        value={giftCardSettings.code_prefix || ''}
                        onChange={(event) => setGiftCardSettings({ ...giftCardSettings, code_prefix: event.target.value.toUpperCase().slice(0, 10) })}
                        placeholder="SPA"
                        className={ADMIN_INPUT}
                      />
                      <span className="mt-1.5 block text-xs text-stone-400">Preview: {(giftCardSettings.code_prefix || 'GC').toUpperCase()}-483921</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-stone-200/70 bg-white/30 px-6 py-4">
              <button type="button" onClick={saveGiftCardSettings} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save gift-card rules'}
              </button>
            </div>
          </section>

          <section className={`${ADMIN_SURFACE} overflow-hidden`}>
            <div className="flex flex-col justify-between gap-5 border-b border-stone-200/70 p-6 lg:flex-row lg:items-center">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100/70 text-violet-700">
                  <Package className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-[#1A1714]">Service passes</h2>
                    <span className={`${ADMIN_STATUS_PILL} bg-violet-50 text-violet-700`}>Visit based</span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-stone-500">
                    Sell one visit or a multi-visit package for an exact service and duration. The sale price can be different from the service's current price.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-stone-200/70 bg-white/55 px-4 py-3 text-xs leading-5 text-stone-500">
                One redemption covers one service unit.<br />Add-ons and a second guest remain payable.
              </div>
            </div>

            <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">Customer shop</p>
                {servicePassOffers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300/80 bg-white/35 px-6 py-10 text-center">
                    <Package className="mx-auto h-7 w-7 text-stone-300" strokeWidth={1.5} />
                    <p className="mt-3 text-sm font-medium text-stone-700">No service passes yet</p>
                    <p className="mt-1 text-xs text-stone-400">Create the first offer with the form beside this panel.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {servicePassOffers.map((offer) => {
                      const service = services.find((item) => item.id === offer.service_id);
                      const duration = durations.find((item) => item.id === offer.duration_id);
                      return (
                        <article key={offer.id} className={`rounded-2xl border p-4 transition ${offer.is_active ? 'border-stone-200/80 bg-white/55' : 'border-stone-200/60 bg-stone-900/[0.025] opacity-70'}`}>
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-medium text-[#1A1714]">{offer.name}</h3>
                                <span className={`${ADMIN_STATUS_PILL} ${offer.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-200/70 text-stone-500'}`}>
                                  {offer.is_active ? 'For sale' : 'Paused'}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-stone-500">
                                {service?.name || 'Service'} · {duration?.duration_minutes || '—'} min
                              </p>
                              {offer.description && <p className="mt-2 text-xs leading-5 text-stone-400">{offer.description}</p>}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-lg font-semibold tracking-tight text-[#1A1714]">{formatAmount(offer.price_cents / 100)}</p>
                              <p className="text-xs text-stone-400">{offer.visit_count} {offer.visit_count === 1 ? 'visit' : 'visits'}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/60 pt-3">
                            <div className="flex items-center gap-1.5 text-xs text-stone-400">
                              <Clock className="h-3.5 w-3.5" />
                              {offer.expiry_days ? `Expires ${offer.expiry_days} days after purchase` : 'Uses the default gift-card expiry'}
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => toggleServicePassOffer(offer)} className={ADMIN_TERTIARY_BUTTON}>
                                {offer.is_active ? 'Pause' : 'Resume'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteServicePassOffer(offer.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                                aria-label={`Delete ${offer.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-stone-900/[0.035] p-5">
                <div className="mb-5">
                  <h3 className="font-semibold text-[#1A1714]">Create a service pass</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-400">This becomes a purchasable option next to value gift cards.</p>
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-stone-700">Pass name</span>
                    <input
                      type="text"
                      value={newServicePass.name}
                      onChange={(event) => setNewServicePass({ ...newServicePass, name: event.target.value })}
                      className={ADMIN_INPUT}
                      placeholder="5 × Thai Massage · 60 min"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">Service</span>
                      <select
                        value={newServicePass.service_id}
                        onChange={(event) => setNewServicePass({ ...newServicePass, service_id: event.target.value, duration_id: '' })}
                        className={ADMIN_INPUT}
                      >
                        <option value="">Choose service</option>
                        {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">Duration</span>
                      <select
                        value={newServicePass.duration_id}
                        onChange={(event) => setNewServicePass({ ...newServicePass, duration_id: event.target.value })}
                        className={ADMIN_INPUT}
                        disabled={!newServicePass.service_id}
                      >
                        <option value="">Choose duration</option>
                        {durations
                          .filter((duration) => duration.service_id === newServicePass.service_id)
                          .map((duration) => (
                            <option key={duration.id} value={duration.id}>
                              {duration.duration_minutes} min · {formatAmount(duration.price_cents / 100)} standard
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">Visits</span>
                      <input type="number" min="1" max="100" step="1" value={newServicePass.visit_count} onChange={(event) => setNewServicePass({ ...newServicePass, visit_count: event.target.value })} className={ADMIN_INPUT} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">Sale price ({currencySymbol})</span>
                      <input type="number" min="0.01" step="0.01" value={newServicePass.price} onChange={(event) => setNewServicePass({ ...newServicePass, price: event.target.value })} className={ADMIN_INPUT} placeholder="250.00" />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">Expiry days</span>
                      <input type="number" min="1" step="1" value={newServicePass.expiry_days} onChange={(event) => setNewServicePass({ ...newServicePass, expiry_days: event.target.value })} className={ADMIN_INPUT} placeholder="Default" />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-stone-700">Customer description <span className="font-normal text-stone-400">(optional)</span></span>
                    <textarea value={newServicePass.description} onChange={(event) => setNewServicePass({ ...newServicePass, description: event.target.value })} rows={2} className={`${ADMIN_INPUT} resize-y`} placeholder="A simple note shown before purchase." />
                  </label>
                  <button type="button" onClick={createServicePassOffer} disabled={savingServicePass} className={`${ADMIN_PRIMARY_BUTTON} w-full`}>
                    <Plus className="h-4 w-4" />
                    {savingServicePass ? 'Creating…' : 'Add service pass'}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className={`${ADMIN_SURFACE} p-6`}>
            <div className="mb-6 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900/[0.06] text-[#1A1714]">
                <ImageIcon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <div>
                <h2 className="font-semibold text-[#1A1714]">PDF design</h2>
                <p className="mt-1 text-sm text-stone-500">Add branded artwork and the terms printed beside each gift-card QR code.</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">Gift-card artwork</label>
                <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-900/[0.025]">
                  {giftCardSettings.design_url ? (
                    <img src={giftCardSettings.design_url} alt="Gift-card design" className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center px-6 text-center">
                      <ImageIcon className="h-7 w-7 text-stone-300" strokeWidth={1.5} />
                      <p className="mt-3 text-sm font-medium text-stone-600">No artwork uploaded</p>
                      <p className="mt-1 text-xs leading-5 text-stone-400">Portrait 3:4 works best.</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <label className={`${ADMIN_SECONDARY_BUTTON} flex-1 cursor-pointer`}>
                    <Upload className="h-4 w-4" />
                    {uploadingDesign ? 'Reading…' : 'Choose image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;

                        if (file.size > 5 * 1024 * 1024) {
                          setMessage('Error: artwork must be smaller than 5 MB');
                          return;
                        }

                        setUploadingDesign(true);
                        try {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const dataUrl = reader.result as string;
                            setGiftCardSettings({ ...giftCardSettings, design_url: dataUrl });
                            setUploadingDesign(false);
                          };
                          reader.onerror = () => {
                            setMessage('Error: failed to read artwork');
                            setUploadingDesign(false);
                          };
                          reader.readAsDataURL(file);
                        } catch (error) {
                          console.error('Error uploading design:', error);
                          setMessage('Error: failed to read artwork');
                          setUploadingDesign(false);
                        }
                      }}
                    />
                  </label>
                  {giftCardSettings.design_url && (
                    <button
                      type="button"
                      onClick={() => setGiftCardSettings({ ...giftCardSettings, design_url: null })}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-50"
                      aria-label="Remove artwork"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">Terms and conditions</span>
                <textarea
                  value={giftCardSettings.terms_and_conditions || ''}
                  onChange={(event) => setGiftCardSettings({ ...giftCardSettings, terms_and_conditions: event.target.value })}
                  rows={11}
                  className={`${ADMIN_INPUT} resize-y leading-6`}
                  placeholder="Enter the terms printed on gift-card PDFs…"
                />
                <span className="mt-1.5 block text-xs text-stone-400">These appear beside the QR code on the generated PDF.</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end border-t border-stone-200/70 pt-5">
              <button type="button" onClick={saveGiftCardSettings} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save PDF design'}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Active codes', value: activeGiftCards.toString(), note: `${giftCards.length} total issued` },
              { label: 'Outstanding balance', value: formatAmount(outstandingBalance / 100), note: 'Value customers can redeem' },
              { label: 'Pass visits remaining', value: outstandingVisits.toString(), note: 'Service visits still owed' },
              { label: 'Lifetime sales value', value: formatAmount(issuedValue / 100), note: 'Cards and passes issued' },
            ].map((metric) => (
              <div key={metric.label} className={`${ADMIN_SURFACE} p-5`}>
                <p className="text-xs font-medium text-stone-500">{metric.label}</p>
                <p className="mt-3 text-2xl font-semibold tracking-tight text-[#1A1714]">{metric.value}</p>
                <p className="mt-1 text-xs text-stone-400">{metric.note}</p>
              </div>
            ))}
          </div>

          <section className={`${ADMIN_SURFACE} p-6`}>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-[#1A1714]">Issue a card or pass</h2>
                <p className="mt-1 text-sm text-stone-500">Create one manually or import existing value cards.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className={ADMIN_SECONDARY_BUTTON}
              >
                <Upload className="h-4 w-4" /> Import CSV
              </button>
            </div>

            <div className="mt-5 flex w-fit rounded-xl bg-stone-900/[0.045] p-1">
              {([
                ['value', 'Value card'],
                ['service_pass', 'Service pass'],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setNewGiftCardType(type)}
                  className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${newGiftCardType === type ? 'bg-white text-[#1A1714] shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(220px,0.75fr)_minmax(280px,1fr)_auto] lg:items-end">
              {newGiftCardType === 'value' ? (
                <label>
                  <span className="mb-2 block text-sm font-medium text-stone-700">Amount ({currencySymbol})</span>
                  <input
                    type="number"
                    value={newGiftCardAmount}
                    onChange={(event) => setNewGiftCardAmount(event.target.value)}
                    className={ADMIN_INPUT}
                    min="1"
                    step="0.01"
                  />
                </label>
              ) : (
                <label>
                  <span className="mb-2 block text-sm font-medium text-stone-700">Pass offer</span>
                  <select value={newServicePassOfferId} onChange={(event) => setNewServicePassOfferId(event.target.value)} className={ADMIN_INPUT}>
                    <option value="">Choose a pass</option>
                    {servicePassOffers.filter((offer) => offer.is_active).map((offer) => (
                      <option key={offer.id} value={offer.id}>{offer.name} · {formatAmount(offer.price_cents / 100)}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span className="mb-2 block text-sm font-medium text-stone-700">Recipient email</span>
                <input
                  type="email"
                  required
                  value={newGiftCardEmail}
                  onChange={(event) => setNewGiftCardEmail(event.target.value)}
                  className={ADMIN_INPUT}
                  placeholder="recipient@example.com"
                />
              </label>
              <button
                type="button"
                onClick={createGiftCard}
                disabled={creatingGiftCard || !newGiftCardEmail.trim() || (newGiftCardType === 'service_pass' && !newServicePassOfferId)}
                className={`${ADMIN_PRIMARY_BUTTON} min-h-10`}
              >
                <Gift className="h-4 w-4" />
                {creatingGiftCard ? 'Creating…' : newGiftCardType === 'service_pass' ? 'Issue pass' : 'Create card'}
              </button>
            </div>
          </section>

          <section className={`${ADMIN_SURFACE} overflow-hidden`}>
            <div className="flex flex-col justify-between gap-4 border-b border-stone-200/70 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-[#1A1714]">All cards and passes</h2>
                <p className="mt-1 text-xs text-stone-400">Money balances and visit entitlements in one place.</p>
              </div>
              {selectedCardIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" /> Delete selected ({selectedCardIds.size})
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead className="bg-stone-900/[0.025]">
                  <tr>
                    <th className="w-12 px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="rounded-lg p-1 text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-[#1A1714]"
                        aria-label={selectedCardIds.size === giftCards.length && giftCards.length > 0 ? 'Deselect all gift cards' : 'Select all gift cards'}
                      >
                        {selectedCardIds.size === giftCards.length && giftCards.length > 0 ? (
                          <CheckSquare className="h-4 w-4 text-[#1A1714]" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    {['Code', 'Product', 'Sold for', 'Remaining', 'Status', 'Purchased', 'Recipient', ''].map((heading) => (
                      <th key={heading} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 last:text-right">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/60">
                  {giftCards.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-14 text-center">
                        <Gift className="mx-auto h-6 w-6 text-stone-300" strokeWidth={1.5} />
                        <p className="mt-3 text-sm font-medium text-stone-600">No cards or passes yet</p>
                        <p className="mt-1 text-xs text-stone-400">Create the first one above or import value cards from CSV.</p>
                      </td>
                    </tr>
                  ) : (
                    giftCards.map((card) => (
                      <tr key={card.id} className={`transition-colors hover:bg-white/60 ${selectedCardIds.has(card.id) ? 'bg-stone-900/[0.035]' : ''}`}>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => toggleSelectCard(card.id)}
                            className="rounded-lg p-1 text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-[#1A1714]"
                            aria-label={`${selectedCardIds.has(card.id) ? 'Deselect' : 'Select'} ${card.code}`}
                          >
                            {selectedCardIds.has(card.id) ? (
                              <CheckSquare className="h-4 w-4 text-[#1A1714]" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-sm font-medium text-[#1A1714]">{card.code}</td>
                        <td className="px-4 py-3.5">
                          <span className="text-sm font-medium text-[#1A1714]">{card.card_type === 'service_pass' ? card.service_pass_name || 'Service pass' : 'Value card'}</span>
                          {card.card_type === 'service_pass' && <span className="mt-0.5 block text-xs text-stone-400">{card.original_visits} {card.original_visits === 1 ? 'visit' : 'visits'}</span>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-stone-600">{formatAmount((card.purchase_price_cents ?? card.original_value_cents) / 100)}</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-[#1A1714]">
                          {card.card_type === 'service_pass'
                            ? `${card.remaining_visits || 0} ${card.remaining_visits === 1 ? 'visit' : 'visits'}`
                            : formatAmount(card.current_balance_cents / 100)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`${ADMIN_STATUS_PILL} ${
                            card.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                            card.status === 'fully_redeemed' ? 'bg-stone-900/[0.05] text-stone-600' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {card.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-stone-500">
                          {new Date(card.purchased_at).toLocaleDateString()}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3.5 text-sm text-stone-500">
                          {card.purchased_for_email || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedGiftCard(card)}
                              className={ADMIN_TERTIARY_BUTTON}
                              title="View Details"
                              aria-label={`View ${card.code}`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadGiftCard(card)}
                              className={ADMIN_TERTIARY_BUTTON}
                              title="Download PDF"
                              aria-label={`Download ${card.code}`}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            {card.purchased_for_email && (
                              <button
                                type="button"
                                onClick={() => handleEmailGiftCard(card)}
                                className={ADMIN_TERTIARY_BUTTON}
                                title="Email to recipient"
                                aria-label={`Email ${card.code}`}
                              >
                                <Mail className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'pos' && (
        <POSView />
      )}

      {selectedGiftCard && (
        <GiftCardDetailModal
          giftCard={selectedGiftCard}
          businessName={businessName}
          designUrl={giftCardSettings.design_url}
          termsAndConditions={giftCardSettings.terms_and_conditions}
          onClose={() => setSelectedGiftCard(null)}
          onUpdate={() => {
            loadGiftCards();
            setSelectedGiftCard(null);
          }}
        />
      )}

      {showImportModal && (
        <ImportGiftCardsModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={async () => {
            console.log('Import complete, refreshing gift cards list...');
            await loadGiftCards();
            console.log('Gift cards refreshed');
          }}
          expiryDays={giftCardSettings.expiry_days}
        />
      )}

      {showDeleteConfirm && (
        <div className={ADMIN_MODAL_BACKDROP}>
          <div className={`${ADMIN_MODAL} max-w-md p-6 sm:p-7`} role="dialog" aria-modal="true" aria-labelledby="delete-gift-cards-title">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 id="delete-gift-cards-title" className="font-semibold text-[#1A1714]">Delete selected gift cards?</h3>
                <p className="mt-1 text-sm text-stone-500">{selectedCardIds.size} card{selectedCardIds.size === 1 ? '' : 's'} and their transaction history will be removed.</p>
              </div>
            </div>
            <div className="rounded-xl border border-red-200/80 bg-red-50/70 p-3 text-sm text-red-700">This cannot be undone.</div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className={ADMIN_SECONDARY_BUTTON}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete {selectedCardIds.size}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
