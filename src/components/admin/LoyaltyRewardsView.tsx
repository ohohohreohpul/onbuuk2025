import { useState, useEffect } from 'react';
import { Gift, Award, CreditCard, DollarSign, Save, Download, Mail, Eye, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import { POSView } from './POSView';
import { downloadGiftCardPDF } from '../../lib/giftCardPdfGenerator';
import { GiftCardDetailModal } from './GiftCardDetailModal';
import ImportGiftCardsModal from './ImportGiftCardsModal';

interface LoyaltySettings {
  enabled: boolean;
  points_per_dollar_spent: number;
  points_redemption_value: number;
  points_expiry_days: number | null;
  welcome_bonus_points: number;
}

interface GiftCardSettings {
  enabled: boolean;
  preset_amounts_cents: number[];
  allow_custom_amount: boolean;
  min_custom_amount_cents: number;
  max_custom_amount_cents: number;
  expiry_days: number | null;
  design_url: string | null;
  terms_and_conditions: string | null;
}

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  status: string;
  purchased_at: string;
  expires_at: string | null;
  purchased_for_email: string | null;
}

export function LoyaltyRewardsView() {
  const { businessId } = useTenant();
  const { currencySymbol, formatAmount } = useCurrency();
  const [activeTab, setActiveTab] = useState<'giftcards' | 'manage' | 'pos'>('giftcards');
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
  });
  const [uploadingDesign, setUploadingDesign] = useState(false);

  // Gift cards list
  const [giftCards, setGiftCards] = useState<GiftCard[]>([]);
  const [creatingGiftCard, setCreatingGiftCard] = useState(false);
  const [newGiftCardAmount, setNewGiftCardAmount] = useState('50');
  const [newGiftCardEmail, setNewGiftCardEmail] = useState('');
  const [selectedGiftCard, setSelectedGiftCard] = useState<GiftCard | null>(null);

  useEffect(() => {
    loadSettings();
    loadGiftCards();
  }, [businessId]);

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
    const { data, error } = await supabase
      .from('gift_cards')
      .select('*')
      .eq('business_id', businessId)
      .order('purchased_at', { ascending: false });

    if (!error && data) {
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
    setCreatingGiftCard(true);
    setMessage('');

    const amountCents = Math.round(parseFloat(newGiftCardAmount) * 100);

    // Generate code using the database function
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_gift_card_code');

    if (codeError || !codeData) {
      setMessage('Error generating gift card code');
      setCreatingGiftCard(false);
      return;
    }

    const code = codeData;

    // Calculate expiry date
    let expiresAt = null;
    if (giftCardSettings.expiry_days) {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + giftCardSettings.expiry_days);
      expiresAt = expiry.toISOString();
    }

    const { error } = await supabase
      .from('gift_cards')
      .insert({
        business_id: businessId,
        code,
        original_value_cents: amountCents,
        current_balance_cents: amountCents,
        purchased_for_email: newGiftCardEmail || null,
        expires_at: expiresAt,
      });

    if (error) {
      setMessage('Error creating gift card');
      console.error(error);
    } else {
      setMessage(`Gift card created: ${code}`);
      setNewGiftCardAmount('50');
      setNewGiftCardEmail('');
      loadGiftCards();
      setTimeout(() => setMessage(''), 5000);
    }

    setCreatingGiftCard(false);
  };

  const handleDownloadGiftCard = async (card: GiftCard) => {
    try {
      await downloadGiftCardPDF({
        code: card.code,
        amount: card.original_value_cents / 100,
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
      setMessage('Email functionality coming soon!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error emailing gift card:', error);
      setMessage('Error sending gift card email');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Gift Cards & Rewards</h2>
        <p className="text-gray-600 mt-1">
          Manage your gift card system and POS transactions
        </p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('giftcards')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'giftcards'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5" />
              Gift Card Settings
            </div>
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'manage'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Manage Gift Cards
            </div>
          </button>
          <button
            onClick={() => setActiveTab('pos')}
            className={`pb-3 px-1 font-medium transition-colors border-b-2 ${
              activeTab === 'pos'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              POS System
            </div>
          </button>
        </div>
      </div>

      {/* Gift Card Settings */}
      {activeTab === 'giftcards' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-lg p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Enable Gift Cards</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Allow customers to purchase and redeem gift cards
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={giftCardSettings.enabled}
                  onChange={(e) => setGiftCardSettings({ ...giftCardSettings, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Preset Amounts ({currencySymbol})
              </label>
              <div className="flex gap-2 flex-wrap">
                {giftCardSettings.preset_amounts_cents.map((amount, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="number"
                      value={amount / 100}
                      onChange={(e) => {
                        const newAmounts = [...giftCardSettings.preset_amounts_cents];
                        newAmounts[index] = Math.round(parseFloat(e.target.value) * 100);
                        setGiftCardSettings({ ...giftCardSettings, preset_amounts_cents: newAmounts });
                      }}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      min="1"
                    />
                    <button
                      onClick={() => {
                        const newAmounts = giftCardSettings.preset_amounts_cents.filter((_, i) => i !== index);
                        setGiftCardSettings({ ...giftCardSettings, preset_amounts_cents: newAmounts });
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setGiftCardSettings({
                      ...giftCardSettings,
                      preset_amounts_cents: [...giftCardSettings.preset_amounts_cents, 2500],
                    });
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  + Add Amount
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={giftCardSettings.allow_custom_amount}
                onChange={(e) => setGiftCardSettings({ ...giftCardSettings, allow_custom_amount: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <label className="text-sm font-medium text-gray-700">
                Allow custom amounts
              </label>
            </div>

            {giftCardSettings.allow_custom_amount && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={giftCardSettings.min_custom_amount_cents / 100}
                    onChange={(e) => setGiftCardSettings({ ...giftCardSettings, min_custom_amount_cents: Math.round(parseFloat(e.target.value) * 100) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={giftCardSettings.max_custom_amount_cents / 100}
                    onChange={(e) => setGiftCardSettings({ ...giftCardSettings, max_custom_amount_cents: Math.round(parseFloat(e.target.value) * 100) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gift Card Expiry (days)
              </label>
              <input
                type="number"
                value={giftCardSettings.expiry_days || ''}
                onChange={(e) => setGiftCardSettings({ ...giftCardSettings, expiry_days: e.target.value ? parseInt(e.target.value) : null })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Never expires"
                min="1"
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for no expiry
              </p>
            </div>

            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-base font-semibold text-gray-800 mb-4">Gift Card Design & PDF Settings</h4>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gift Card Design (1:1 ratio)
                  </label>
                  <div className="space-y-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        if (file.size > 5 * 1024 * 1024) {
                          alert('File size must be less than 5MB');
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
                            alert('Failed to upload design');
                            setUploadingDesign(false);
                          };
                          reader.readAsDataURL(file);
                        } catch (error) {
                          console.error('Error uploading design:', error);
                          alert('Failed to upload design');
                          setUploadingDesign(false);
                        }
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                    />
                    {uploadingDesign && (
                      <p className="text-sm text-gray-600">Uploading design...</p>
                    )}
                    {giftCardSettings.design_url && (
                      <div className="flex items-center space-x-4">
                        <img
                          src={giftCardSettings.design_url}
                          alt="Gift card design"
                          className="h-32 w-32 object-cover border border-gray-200 rounded"
                        />
                        <button
                          type="button"
                          onClick={() => setGiftCardSettings({ ...giftCardSettings, design_url: null })}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          Remove Design
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Portrait image with 3:4 aspect ratio (1200x1656px recommended, min 800x1104px). This will appear on the left side of the gift card PDF.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Terms and Conditions
                  </label>
                  <textarea
                    value={giftCardSettings.terms_and_conditions || ''}
                    onChange={(e) => setGiftCardSettings({ ...giftCardSettings, terms_and_conditions: e.target.value })}
                    rows={8}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter terms and conditions for gift cards..."
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    These terms will appear on the right side of the gift card PDF along with the QR code.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={saveGiftCardSettings}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Gift Card Settings'}
            </button>
          </div>
        </div>
      )}

      {/* Manage Gift Cards */}
      {activeTab === 'manage' && (
        <div className="space-y-6">
          {/* Create Gift Card */}
          <div className="bg-white border rounded-lg p-6 space-y-4">
            <h3 className="text-lg font-semibold">Create Gift Card</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount ({currencySymbol})
                </label>
                <input
                  type="number"
                  value={newGiftCardAmount}
                  onChange={(e) => setNewGiftCardAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email (optional)
                </label>
                <input
                  type="email"
                  value={newGiftCardEmail}
                  onChange={(e) => setNewGiftCardEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="recipient@example.com"
                />
              </div>
            </div>
            <button
              onClick={createGiftCard}
              disabled={creatingGiftCard}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Gift className="w-4 h-4" />
              {creatingGiftCard ? 'Creating...' : 'Create Gift Card'}
            </button>
          </div>

          {/* Gift Cards List */}
          <div className="bg-white border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">All Gift Cards</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Code</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Original Value ({currencySymbol})</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Balance ({currencySymbol})</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Purchased</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Recipient</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {giftCards.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-500">
                        No gift cards yet
                      </td>
                    </tr>
                  ) : (
                    giftCards.map((card) => (
                      <tr key={card.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-4 font-mono text-sm">{card.code}</td>
                        <td className="py-3 px-4">{formatAmount(card.original_value_cents / 100)}</td>
                        <td className="py-3 px-4">{formatAmount(card.current_balance_cents / 100)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            card.status === 'active' ? 'bg-green-100 text-green-700' :
                            card.status === 'fully_redeemed' ? 'bg-gray-100 text-gray-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {card.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(card.purchased_at).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {card.purchased_for_email || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedGiftCard(card)}
                              className="p-2 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDownloadGiftCard(card)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="Download PDF"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {card.purchased_for_email && (
                              <button
                                onClick={() => handleEmailGiftCard(card)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                                title="Email to recipient"
                              >
                                <Mail className="w-4 h-4" />
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
          </div>
        </div>
      )}

      {/* POS System */}
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
    </div>
  );
}
