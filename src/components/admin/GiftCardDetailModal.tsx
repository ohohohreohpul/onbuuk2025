import { useState, useEffect } from 'react';
import { X, Trash2, CreditCard, Calendar, DollarSign, Download, Mail, Edit2, Save, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../lib/currencyContext';
import { useTenant } from '../../lib/tenantContext';
import { downloadGiftCardPDF } from '../../lib/giftCardPdfGenerator';

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  status: string;
  purchased_at: string;
  expires_at: string | null;
  purchased_for_email: string | null;
  purchased_by_email?: string | null;
  purchased_by_name?: string | null;
}

interface Transaction {
  id: string;
  amount_cents: number;
  transaction_type: string;
  description: string;
  created_at: string;
  created_by: string | null;
}

interface GiftCardDetailModalProps {
  giftCard: GiftCard;
  businessName: string;
  designUrl: string | null;
  termsAndConditions: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

export function GiftCardDetailModal({
  giftCard,
  businessName,
  designUrl,
  termsAndConditions,
  onClose,
  onUpdate,
}: GiftCardDetailModalProps) {
  const { currencySymbol, formatAmount } = useCurrency();
  const { businessId } = useTenant();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');
  const [redeemDescription, setRedeemDescription] = useState('');
  const [deleting, setDeleting] = useState(false);
  
  // Email editing state
  const [isEditingEmails, setIsEditingEmails] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState(giftCard.purchased_by_email || '');
  const [buyerName, setBuyerName] = useState(giftCard.purchased_by_name || '');
  const [recipientEmail, setRecipientEmail] = useState(giftCard.purchased_for_email || '');
  const [savingEmails, setSavingEmails] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<'buyer' | 'recipient' | 'both' | null>(null);

  useEffect(() => {
    loadTransactions();
  }, [giftCard.id]);

  useEffect(() => {
    setBuyerEmail(giftCard.purchased_by_email || '');
    setBuyerName(giftCard.purchased_by_name || '');
    setRecipientEmail(giftCard.purchased_for_email || '');
  }, [giftCard]);

  const loadTransactions = async () => {
    const { data } = await supabase
      .from('gift_card_transactions')
      .select('*')
      .eq('gift_card_id', giftCard.id)
      .order('created_at', { ascending: false });

    if (data) {
      setTransactions(data);
    }
    setLoading(false);
  };

  const handleSaveEmails = async () => {
    setSavingEmails(true);
    try {
      const { error } = await supabase
        .from('gift_cards')
        .update({
          purchased_by_email: buyerEmail || null,
          purchased_by_name: buyerName || null,
          purchased_for_email: recipientEmail || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', giftCard.id);

      if (error) throw error;

      setIsEditingEmails(false);
      onUpdate();
      alert('Email information saved successfully!');
    } catch (error) {
      console.error('Error saving emails:', error);
      alert('Failed to save email information');
    } finally {
      setSavingEmails(false);
    }
  };

  const handleSendEmail = async (target: 'buyer' | 'recipient' | 'both') => {
    const targetEmail = target === 'buyer' ? buyerEmail : target === 'recipient' ? recipientEmail : null;
    
    if (target === 'buyer' && !buyerEmail) {
      alert('Please add a buyer email first');
      return;
    }
    if (target === 'recipient' && !recipientEmail) {
      alert('Please add a recipient email first');
      return;
    }
    if (target === 'both' && !buyerEmail && !recipientEmail) {
      alert('Please add at least one email address');
      return;
    }

    setSendingEmail(target);
    try {
      const emailPromises = [];

      // Send to buyer
      if ((target === 'buyer' || target === 'both') && buyerEmail) {
        emailPromises.push(
          supabase.functions.invoke('send-business-email', {
            body: {
              business_id: businessId,
              event_key: 'gift_card_purchased',
              recipient_email: buyerEmail,
              recipient_name: buyerName || buyerEmail.split('@')[0],
              variables: {
                customer_name: buyerName || 'Valued Customer',
                customer_email: buyerEmail,
                gift_card_code: giftCard.code,
                amount: formatAmount(giftCard.original_value_cents / 100),
                recipient_email: recipientEmail || 'N/A',
                message: '',
                business_name: businessName,
              },
            },
          })
        );
      }

      // Send to recipient
      if ((target === 'recipient' || target === 'both') && recipientEmail) {
        emailPromises.push(
          supabase.functions.invoke('send-business-email', {
            body: {
              business_id: businessId,
              event_key: 'gift_card_received',
              recipient_email: recipientEmail,
              recipient_name: recipientEmail.split('@')[0],
              variables: {
                recipient_email: recipientEmail,
                gift_card_code: giftCard.code,
                amount: formatAmount(giftCard.original_value_cents / 100),
                message: '',
                sender_name: buyerName || 'Someone special',
                business_name: businessName,
              },
            },
          })
        );
      }

      await Promise.all(emailPromises);
      
      const sentTo = target === 'both' 
        ? 'buyer and recipient' 
        : target;
      alert(`Email sent successfully to ${sentTo}!`);
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleRedeem = async () => {
    if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    const amountCents = Math.round(parseFloat(redeemAmount) * 100);

    if (amountCents > giftCard.current_balance_cents) {
      alert('Redemption amount exceeds current balance');
      return;
    }

    setRedeeming(true);

    try {
      const newBalance = giftCard.current_balance_cents - amountCents;
      const newStatus = newBalance === 0 ? 'fully_redeemed' : 'active';

      await supabase.from('gift_card_transactions').insert({
        gift_card_id: giftCard.id,
        amount_cents: amountCents,
        transaction_type: 'redemption',
        description: redeemDescription || 'Manual redemption',
      });

      await supabase
        .from('gift_cards')
        .update({
          current_balance_cents: newBalance,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', giftCard.id);

      setRedeemAmount('');
      setRedeemDescription('');
      loadTransactions();
      onUpdate();
    } catch (error) {
      console.error('Error redeeming gift card:', error);
      alert('Failed to redeem gift card');
    } finally {
      setRedeeming(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this gift card? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);

    try {
      const { error } = await supabase.from('gift_cards').delete().eq('id', giftCard.id);

      if (error) throw error;

      alert('Gift card deleted successfully');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting gift card:', error);
      alert('Failed to delete gift card');
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadGiftCardPDF({
        code: giftCard.code,
        amount: giftCard.original_value_cents / 100,
        designUrl: designUrl,
        termsAndConditions: termsAndConditions,
        businessName: businessName,
        expiresAt: giftCard.expires_at,
        currencySymbol: currencySymbol,
      });
    } catch (error) {
      console.error('Error downloading gift card:', error);
      alert('Failed to download gift card PDF');
    }
  };

  const isExpired = giftCard.expires_at && new Date(giftCard.expires_at) < new Date();
  const balancePercentage = (giftCard.current_balance_cents / giftCard.original_value_cents) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">Gift Card Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="col-span-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-6 h-6" />
                  <span className="text-sm opacity-90">Gift Card</span>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    giftCard.status === 'active'
                      ? 'bg-green-500 text-white'
                      : giftCard.status === 'fully_redeemed'
                      ? 'bg-gray-500 text-white'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {giftCard.status.replace('_', ' ').toUpperCase()}
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold">
                  {formatAmount(giftCard.current_balance_cents / 100)}
                </div>
                <div className="text-sm opacity-90">
                  Original Value: {formatAmount(giftCard.original_value_cents / 100)}
                </div>
                <div className="w-full bg-blue-400 rounded-full h-2 mt-3">
                  <div
                    className="bg-white h-2 rounded-full transition-all"
                    style={{ width: `${balancePercentage}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Code:</span>
                <div className="font-mono font-medium text-gray-800 mt-1">{giftCard.code}</div>
              </div>
              <div>
                <span className="text-gray-600">Purchased:</span>
                <div className="font-medium text-gray-800 mt-1">
                  {new Date(giftCard.purchased_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-3 text-sm">
              {giftCard.expires_at && (
                <div>
                  <span className="text-gray-600">Expires:</span>
                  <div
                    className={`font-medium mt-1 ${
                      isExpired ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    {new Date(giftCard.expires_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {isExpired && ' (Expired)'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Email Management Section */}
          <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                <User className="w-5 h-5" />
                <span>Contact Information</span>
              </h3>
              {!isEditingEmails ? (
                <button
                  onClick={() => setIsEditingEmails(true)}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveEmails}
                  disabled={savingEmails}
                  className="flex items-center space-x-1 text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingEmails ? 'Saving...' : 'Save'}</span>
                </button>
              )}
            </div>

            {isEditingEmails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buyer Name
                    </label>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="Enter buyer's name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Buyer Email
                    </label>
                    <input
                      type="email"
                      value={buyerEmail}
                      onChange={(e) => setBuyerEmail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder="buyer@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recipient Email
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="recipient@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    The person who will receive/use this gift card
                  </p>
                </div>
                <button
                  onClick={() => setIsEditingEmails(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Buyer</div>
                    <div className="font-medium text-gray-800">
                      {buyerName || <span className="text-gray-400 italic">No name</span>}
                    </div>
                    <div className="text-sm text-gray-600">
                      {buyerEmail || <span className="text-gray-400 italic">No email - click Edit to add</span>}
                    </div>
                  </div>
                  {buyerEmail && (
                    <button
                      onClick={() => handleSendEmail('buyer')}
                      disabled={sendingEmail !== null}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm disabled:opacity-50"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{sendingEmail === 'buyer' ? 'Sending...' : 'Send'}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Recipient</div>
                    <div className="text-sm text-gray-600">
                      {recipientEmail || <span className="text-gray-400 italic">No email - click Edit to add</span>}
                    </div>
                  </div>
                  {recipientEmail && (
                    <button
                      onClick={() => handleSendEmail('recipient')}
                      disabled={sendingEmail !== null}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm disabled:opacity-50"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{sendingEmail === 'recipient' ? 'Sending...' : 'Send'}</span>
                    </button>
                  )}
                </div>
                {(buyerEmail || recipientEmail) && (
                  <button
                    onClick={() => handleSendEmail('both')}
                    disabled={sendingEmail !== null || (!buyerEmail && !recipientEmail)}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white hover:bg-purple-700 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{sendingEmail === 'both' ? 'Sending...' : 'Send to Both'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3 pt-3 border-t border-gray-200">
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>

          {giftCard.status === 'active' && !isExpired && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <DollarSign className="w-5 h-5" />
                <span>Redeem Gift Card</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                    step="0.01"
                    max={giftCard.current_balance_cents / 100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <input
                    type="text"
                    value={redeemDescription}
                    onChange={(e) => setRedeemDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Booking #123"
                  />
                </div>
              </div>
              <button
                onClick={handleRedeem}
                disabled={redeeming || !redeemAmount}
                className="mt-4 w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {redeeming ? 'Processing...' : 'Redeem Amount'}
              </button>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>Transaction History</span>
            </h3>
            {loading ? (
              <div className="text-center py-4 text-gray-500">Loading...</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-4 text-gray-500">No transactions yet</div>
            ) : (
              <div className="space-y-2">
                {transactions.map((txn) => (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                  >
                    <div>
                      <div className="font-medium text-gray-800">{txn.description}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(txn.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`font-semibold ${
                          txn.transaction_type === 'redemption'
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        {txn.transaction_type === 'redemption' ? '-' : '+'}
                        {formatAmount(Math.abs(txn.amount_cents / 100))}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {txn.transaction_type}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>{deleting ? 'Deleting...' : 'Delete Gift Card'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
