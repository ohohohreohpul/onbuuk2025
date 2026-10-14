import { useState, useEffect } from 'react';
import { X, Trash2, CreditCard, Calendar, DollarSign, Download, Mail, Edit2, Save, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useCurrency } from '../../lib/currencyContext';
import { useTenant } from '../../lib/tenantContext';
import { downloadGiftCardPDF, getGiftCardPDFBase64 } from '../../lib/giftCardPdfGenerator';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

type DetailText = {
  emailsSaved: string; emailsSaveFailed: string; addBuyerEmail: string; addRecipientEmail: string; addAnyEmail: string;
  buyerError: string; recipientError: string; someEmailsFailed: string; sentToBuyer: string; sentToRecipient: string;
  sentToBoth: string; sendFailed: string; tryAgain: string; invalidAmount: string; exceedsBalance: string;
  redeemFailed: string; confirmDelete: string; deleted: string; deleteFailed: string; downloadFailed: string;
  passDetails: string; cardDetails: string; servicePass: string; valueCard: string; visitLeft: string; visitsLeft: string;
  passOriginally: string; originalValue: string; code: string; purchased: string; expires: string; expiredSuffix: string;
  contactInfo: string; edit: string; saving: string; save: string; buyerName: string; buyerNamePlaceholder: string;
  buyerEmail: string; recipientEmail: string; recipientHint: string; cancel: string; buyer: string; noName: string;
  noEmail: string; recipient: string; sending: string; send: string; sendBoth: string; downloadPdf: string;
  redeemHeading: string; amount: string; descriptionOptional: string; descriptionPlaceholder: string; processing: string;
  redeemAmount: string; visitRedemption: string; visitRedemptionHint: string; history: string; loading: string;
  noTransactions: string; visitOne: string; visitMany: string; deleting: string; deleteCard: string; close: string;
  statusActive: string; statusFullyRedeemed: string; statusExpired: string; statusCancelled: string; statusPendingPayment: string;
  txnPurchase: string; txnRedemption: string; txnRefund: string;
};

const TEXT: Translations<DetailText> = {
  en: {
    emailsSaved: 'Email information saved successfully!', emailsSaveFailed: 'Failed to save email information',
    addBuyerEmail: 'Please add a buyer email first', addRecipientEmail: 'Please add a recipient email first',
    addAnyEmail: 'Please add at least one email address', buyerError: 'Buyer: {error}', recipientError: 'Recipient: {error}',
    someEmailsFailed: 'Some emails failed to send:\n{errors}\n\nPlease check your email settings.',
    sentToBuyer: 'Email with PDF attachment sent successfully to buyer!',
    sentToRecipient: 'Email with PDF attachment sent successfully to recipient!',
    sentToBoth: 'Email with PDF attachment sent successfully to buyer and recipient!',
    sendFailed: 'Failed to send email: {error}', tryAgain: 'Please try again.', invalidAmount: 'Please enter a valid amount',
    exceedsBalance: 'Redemption amount exceeds current balance', redeemFailed: 'Failed to redeem gift card',
    confirmDelete: 'Are you sure you want to delete this gift card? This action cannot be undone.',
    deleted: 'Gift card deleted successfully', deleteFailed: 'Failed to delete gift card', downloadFailed: 'Failed to download gift card PDF',
    passDetails: 'Service Pass Details', cardDetails: 'Gift Card Details', servicePass: 'Service Pass', valueCard: 'Value Card',
    visitLeft: '1 visit left', visitsLeft: '{count} visits left', passOriginally: '{name} · {count} originally',
    originalValue: 'Original value: {amount}', code: 'Code:', purchased: 'Purchased:', expires: 'Expires:', expiredSuffix: ' (Expired)',
    contactInfo: 'Contact Information', edit: 'Edit', saving: 'Saving...', save: 'Save', buyerName: 'Buyer Name',
    buyerNamePlaceholder: "Enter buyer's name", buyerEmail: 'Buyer Email', recipientEmail: 'Recipient Email',
    recipientHint: 'The person who will receive/use this gift card', cancel: 'Cancel', buyer: 'Buyer', noName: 'No name',
    noEmail: 'No email - click Edit to add', recipient: 'Recipient', sending: 'Sending...', send: 'Send', sendBoth: 'Send to Both',
    downloadPdf: 'Download PDF', redeemHeading: 'Redeem Gift Card', amount: 'Amount ({symbol})',
    descriptionOptional: 'Description (optional)', descriptionPlaceholder: 'e.g., Booking #123', processing: 'Processing...',
    redeemAmount: 'Redeem Amount', visitRedemption: 'Visit redemption',
    visitRedemptionHint: 'This pass is visit-based, so it is redeemed through checkout when the customer books the matching service. It is never deducted as a cash amount.',
    history: 'Transaction History', loading: 'Loading...', noTransactions: 'No transactions yet',
    visitOne: '1 visit', visitMany: '{count} visits', deleting: 'Deleting...', deleteCard: 'Delete Gift Card', close: 'Close',
    statusActive: 'Active', statusFullyRedeemed: 'Fully redeemed', statusExpired: 'Expired', statusCancelled: 'Cancelled',
    statusPendingPayment: 'Awaiting payment', txnPurchase: 'Purchase', txnRedemption: 'Redemption', txnRefund: 'Refund',
  },
  de: {
    emailsSaved: 'E-Mail-Angaben gespeichert.', emailsSaveFailed: 'E-Mail-Angaben konnten nicht gespeichert werden',
    addBuyerEmail: 'Bitte zuerst eine E-Mail-Adresse der Käufer:in hinzufügen',
    addRecipientEmail: 'Bitte zuerst eine E-Mail-Adresse der Empfänger:in hinzufügen',
    addAnyEmail: 'Bitte mindestens eine E-Mail-Adresse hinzufügen', buyerError: 'Käufer:in: {error}', recipientError: 'Empfänger:in: {error}',
    someEmailsFailed: 'Einige E-Mails konnten nicht gesendet werden:\n{errors}\n\nBitte prüfen Sie Ihre E-Mail-Einstellungen.',
    sentToBuyer: 'E-Mail mit PDF-Anhang an die Käufer:in gesendet.',
    sentToRecipient: 'E-Mail mit PDF-Anhang an die Empfänger:in gesendet.',
    sentToBoth: 'E-Mail mit PDF-Anhang an Käufer:in und Empfänger:in gesendet.',
    sendFailed: 'E-Mail konnte nicht gesendet werden: {error}', tryAgain: 'Bitte erneut versuchen.',
    invalidAmount: 'Bitte einen gültigen Betrag eingeben', exceedsBalance: 'Der Betrag übersteigt das aktuelle Guthaben',
    redeemFailed: 'Gutschein konnte nicht eingelöst werden',
    confirmDelete: 'Diesen Gutschein wirklich löschen? Dies kann nicht rückgängig gemacht werden.',
    deleted: 'Gutschein gelöscht', deleteFailed: 'Gutschein konnte nicht gelöscht werden', downloadFailed: 'Gutschein-PDF konnte nicht heruntergeladen werden',
    passDetails: 'Details zum Behandlungsgutschein', cardDetails: 'Gutscheindetails', servicePass: 'Behandlungsgutschein', valueCard: 'Wertgutschein',
    visitLeft: 'Noch 1 Besuch', visitsLeft: 'Noch {count} Besuche', passOriginally: '{name} · ursprünglich {count}',
    originalValue: 'Ursprünglicher Wert: {amount}', code: 'Code:', purchased: 'Gekauft:', expires: 'Gültig bis:', expiredSuffix: ' (abgelaufen)',
    contactInfo: 'Kontaktdaten', edit: 'Bearbeiten', saving: 'Speichern...', save: 'Speichern', buyerName: 'Name Käufer:in',
    buyerNamePlaceholder: 'Name der Käufer:in eingeben', buyerEmail: 'E-Mail Käufer:in', recipientEmail: 'E-Mail Empfänger:in',
    recipientHint: 'Die Person, die diesen Gutschein erhält bzw. einlöst', cancel: 'Abbrechen', buyer: 'Käufer:in', noName: 'Kein Name',
    noEmail: 'Keine E-Mail – zum Hinzufügen auf Bearbeiten klicken', recipient: 'Empfänger:in', sending: 'Wird gesendet...',
    send: 'Senden', sendBoth: 'An beide senden', downloadPdf: 'PDF herunterladen', redeemHeading: 'Gutschein einlösen',
    amount: 'Betrag ({symbol})', descriptionOptional: 'Beschreibung (optional)', descriptionPlaceholder: 'z. B. Buchung #123',
    processing: 'Wird verarbeitet...', redeemAmount: 'Betrag einlösen', visitRedemption: 'Einlösung pro Besuch',
    visitRedemptionHint: 'Dieser Gutschein gilt pro Besuch und wird an der Kasse eingelöst, wenn die Kund:in die passende Leistung bucht. Er wird nie als Geldbetrag abgezogen.',
    history: 'Transaktionsverlauf', loading: 'Wird geladen...', noTransactions: 'Noch keine Transaktionen',
    visitOne: '1 Besuch', visitMany: '{count} Besuche', deleting: 'Wird gelöscht...', deleteCard: 'Gutschein löschen', close: 'Schließen',
    statusActive: 'Aktiv', statusFullyRedeemed: 'Vollständig eingelöst', statusExpired: 'Abgelaufen', statusCancelled: 'Storniert',
    statusPendingPayment: 'Zahlung offen', txnPurchase: 'Kauf', txnRedemption: 'Einlösung', txnRefund: 'Erstattung',
  },
  th: {
    emailsSaved: 'บันทึกข้อมูลอีเมลแล้ว', emailsSaveFailed: 'บันทึกข้อมูลอีเมลไม่สำเร็จ',
    addBuyerEmail: 'กรุณาเพิ่มอีเมลผู้ซื้อก่อน', addRecipientEmail: 'กรุณาเพิ่มอีเมลผู้รับก่อน',
    addAnyEmail: 'กรุณาเพิ่มอีเมลอย่างน้อยหนึ่งรายการ', buyerError: 'ผู้ซื้อ: {error}', recipientError: 'ผู้รับ: {error}',
    someEmailsFailed: 'ส่งอีเมลบางฉบับไม่สำเร็จ:\n{errors}\n\nกรุณาตรวจสอบการตั้งค่าอีเมล',
    sentToBuyer: 'ส่งอีเมลพร้อมไฟล์ PDF ถึงผู้ซื้อแล้ว', sentToRecipient: 'ส่งอีเมลพร้อมไฟล์ PDF ถึงผู้รับแล้ว',
    sentToBoth: 'ส่งอีเมลพร้อมไฟล์ PDF ถึงผู้ซื้อและผู้รับแล้ว',
    sendFailed: 'ส่งอีเมลไม่สำเร็จ: {error}', tryAgain: 'กรุณาลองอีกครั้ง', invalidAmount: 'กรุณากรอกจำนวนเงินที่ถูกต้อง',
    exceedsBalance: 'จำนวนเงินเกินยอดคงเหลือ', redeemFailed: 'ใช้บัตรของขวัญไม่สำเร็จ',
    confirmDelete: 'ต้องการลบบัตรของขวัญนี้ใช่ไหม? การลบนี้ย้อนกลับไม่ได้',
    deleted: 'ลบบัตรของขวัญแล้ว', deleteFailed: 'ลบบัตรของขวัญไม่สำเร็จ', downloadFailed: 'ดาวน์โหลด PDF บัตรของขวัญไม่สำเร็จ',
    passDetails: 'รายละเอียดบัตรบริการ', cardDetails: 'รายละเอียดบัตรของขวัญ', servicePass: 'บัตรบริการ', valueCard: 'บัตรมูลค่า',
    visitLeft: 'เหลือ 1 ครั้ง', visitsLeft: 'เหลือ {count} ครั้ง', passOriginally: '{name} · เดิม {count} ครั้ง',
    originalValue: 'มูลค่าเดิม: {amount}', code: 'รหัส:', purchased: 'วันที่ซื้อ:', expires: 'หมดอายุ:', expiredSuffix: ' (หมดอายุแล้ว)',
    contactInfo: 'ข้อมูลติดต่อ', edit: 'แก้ไข', saving: 'กำลังบันทึก...', save: 'บันทึก', buyerName: 'ชื่อผู้ซื้อ',
    buyerNamePlaceholder: 'กรอกชื่อผู้ซื้อ', buyerEmail: 'อีเมลผู้ซื้อ', recipientEmail: 'อีเมลผู้รับ',
    recipientHint: 'ผู้ที่จะได้รับหรือใช้บัตรของขวัญนี้', cancel: 'ยกเลิก', buyer: 'ผู้ซื้อ', noName: 'ไม่มีชื่อ',
    noEmail: 'ไม่มีอีเมล - กดแก้ไขเพื่อเพิ่ม', recipient: 'ผู้รับ', sending: 'กำลังส่ง...', send: 'ส่ง', sendBoth: 'ส่งถึงทั้งสองคน',
    downloadPdf: 'ดาวน์โหลด PDF', redeemHeading: 'ใช้บัตรของขวัญ', amount: 'จำนวนเงิน ({symbol})',
    descriptionOptional: 'รายละเอียด (ไม่บังคับ)', descriptionPlaceholder: 'เช่น การจอง #123', processing: 'กำลังดำเนินการ...',
    redeemAmount: 'ใช้ยอดเงิน', visitRedemption: 'การใช้สิทธิ์ตามครั้ง',
    visitRedemptionHint: 'บัตรนี้นับตามจำนวนครั้ง จะถูกใช้ตอนชำระเงินเมื่อลูกค้าจองบริการที่ตรงกัน และไม่ถูกหักเป็นยอดเงิน',
    history: 'ประวัติรายการ', loading: 'กำลังโหลด...', noTransactions: 'ยังไม่มีรายการ',
    visitOne: '1 ครั้ง', visitMany: '{count} ครั้ง', deleting: 'กำลังลบ...', deleteCard: 'ลบบัตรของขวัญ', close: 'ปิด',
    statusActive: 'ใช้งานได้', statusFullyRedeemed: 'ใช้ครบแล้ว', statusExpired: 'หมดอายุ', statusCancelled: 'ยกเลิกแล้ว',
    statusPendingPayment: 'รอชำระเงิน', txnPurchase: 'ซื้อ', txnRedemption: 'ใช้บัตร', txnRefund: 'คืนเงิน',
  },
};

const STATUS_KEYS: Record<string, keyof DetailText> = {
  active: 'statusActive',
  fully_redeemed: 'statusFullyRedeemed',
  redeemed: 'statusFullyRedeemed',
  expired: 'statusExpired',
  cancelled: 'statusCancelled',
  pending_payment: 'statusPendingPayment',
};

const TRANSACTION_KEYS: Record<string, keyof DetailText> = {
  purchase: 'txnPurchase',
  redemption: 'txnRedemption',
  refund: 'txnRefund',
};

interface GiftCard {
  id: string;
  code: string;
  original_value_cents: number;
  current_balance_cents: number;
  purchase_price_cents?: number;
  card_type?: 'value' | 'service_pass';
  service_pass_name?: string | null;
  original_visits?: number | null;
  remaining_visits?: number | null;
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
  visit_count?: number;
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
  const { currency, currencySymbol, formatAmount } = useCurrency();
  const { businessId, language } = useTenant();
  const { t, locale } = useAdminText(TEXT);
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
  const isServicePass = giftCard.card_type === 'service_pass';
  // Sent to customers as an email template variable, so it stays independent of the admin language.
  const entitlementLabel = isServicePass
    ? `${giftCard.service_pass_name || 'Service pass'} · ${giftCard.original_visits || 0} ${(giftCard.original_visits || 0) === 1 ? 'visit' : 'visits'}`
    : formatAmount(giftCard.original_value_cents / 100);

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
      alert(t.emailsSaved);
    } catch (error) {
      console.error('Error saving emails:', error);
      alert(t.emailsSaveFailed);
    } finally {
      setSavingEmails(false);
    }
  };

  const handleSendEmail = async (target: 'buyer' | 'recipient' | 'both') => {
    if (target === 'buyer' && !buyerEmail) {
      alert(t.addBuyerEmail);
      return;
    }
    if (target === 'recipient' && !recipientEmail) {
      alert(t.addRecipientEmail);
      return;
    }
    if (target === 'both' && !buyerEmail && !recipientEmail) {
      alert(t.addAnyEmail);
      return;
    }

    setSendingEmail(target);
    try {
      const errors: string[] = [];

      // Generate PDF using the same client-side generator as "Download PDF" button
      let pdfAttachment: { filename: string; content: string; contentType: string } | null = null;
      try {
        const pdfBase64 = await getGiftCardPDFBase64({
          code: giftCard.code,
          amount: giftCard.original_value_cents / 100,
          cardType: giftCard.card_type || 'value',
          servicePassName: giftCard.service_pass_name,
          visits: giftCard.original_visits,
          designUrl: designUrl,
          termsAndConditions: termsAndConditions,
          businessName: businessName,
          expiresAt: giftCard.expires_at,
          currencySymbol: currencySymbol,
        currencyCode: currency,
        language: language === 'de' ? 'de' : 'en',
        });

        pdfAttachment = {
          filename: `GiftCard-${giftCard.code}.pdf`,
          content: pdfBase64,
          contentType: 'application/pdf',
        };
        console.log('PDF generated successfully');
      } catch (pdfErr) {
        console.warn('PDF generation failed, sending email without attachment:', pdfErr);
      }

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
                amount: entitlementLabel,
                recipient_email: recipientEmail || 'N/A',
                message: '',
                business_name: businessName,
              },
              attachments: pdfAttachment ? [pdfAttachment] : undefined,
            },
          }).then(({ data, error }) => {
            if (error) {
              console.error('Error sending to buyer:', error);
              errors.push(fillText(t.buyerError, { error: error.message }));
            } else if (data?.error) {
              console.error('Email service error (buyer):', data.error);
              errors.push(fillText(t.buyerError, { error: String(data.error) }));
            } else {
              console.log('Email sent to buyer successfully');
            }
            return { data, error };
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
                amount: entitlementLabel,
                message: '',
                sender_name: buyerName || 'Someone special',
                business_name: businessName,
              },
              attachments: pdfAttachment ? [pdfAttachment] : undefined,
            },
          }).then(({ data, error }) => {
            if (error) {
              console.error('Error sending to recipient:', error);
              errors.push(fillText(t.recipientError, { error: error.message }));
            } else if (data?.error) {
              console.error('Email service error (recipient):', data.error);
              errors.push(fillText(t.recipientError, { error: String(data.error) }));
            } else {
              console.log('Email sent to recipient successfully');
            }
            return { data, error };
          })
        );
      }

      await Promise.all(emailPromises);
      
      if (errors.length > 0) {
        alert(fillText(t.someEmailsFailed, { errors: errors.join('\n') }));
      } else {
        const sentMessage = { buyer: t.sentToBuyer, recipient: t.sentToRecipient, both: t.sentToBoth }[target];
        alert(sentMessage);
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(fillText(t.sendFailed, { error: error.message || t.tryAgain }));
    } finally {
      setSendingEmail(null);
    }
  };

  const handleRedeem = async () => {
    if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
      alert(t.invalidAmount);
      return;
    }

    const amountCents = Math.round(parseFloat(redeemAmount) * 100);

    if (amountCents > giftCard.current_balance_cents) {
      alert(t.exceedsBalance);
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
      alert(t.redeemFailed);
    } finally {
      setRedeeming(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t.confirmDelete)) {
      return;
    }

    setDeleting(true);

    try {
      const { error } = await supabase.from('gift_cards').delete().eq('id', giftCard.id);

      if (error) throw error;

      alert(t.deleted);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting gift card:', error);
      alert(t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  const handleDownload = async () => {
    try {
      await downloadGiftCardPDF({
        code: giftCard.code,
        amount: giftCard.original_value_cents / 100,
        cardType: giftCard.card_type || 'value',
        servicePassName: giftCard.service_pass_name,
        visits: giftCard.original_visits,
        designUrl: designUrl,
        termsAndConditions: termsAndConditions,
        businessName: businessName,
        expiresAt: giftCard.expires_at,
        currencySymbol: currencySymbol,
        currencyCode: currency,
        language: language === 'de' ? 'de' : 'en',
      });
    } catch (error) {
      console.error('Error downloading gift card:', error);
      alert(t.downloadFailed);
    }
  };

  const isExpired = giftCard.expires_at && new Date(giftCard.expires_at) < new Date();
  const balancePercentage = isServicePass
    ? ((giftCard.remaining_visits || 0) / Math.max(1, giftCard.original_visits || 1)) * 100
    : (giftCard.current_balance_cents / Math.max(1, giftCard.original_value_cents)) * 100;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-800">{isServicePass ? t.passDetails : t.cardDetails}</h2>
          <button
            onClick={onClose}
            aria-label={t.close}
            title={t.close}
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
                  <span className="text-sm opacity-90">{isServicePass ? t.servicePass : t.valueCard}</span>
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
                  {(STATUS_KEYS[giftCard.status] ? t[STATUS_KEYS[giftCard.status]] : giftCard.status.replace('_', ' ')).toLocaleUpperCase(locale)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold">
                  {isServicePass
                    ? ((giftCard.remaining_visits || 0) === 1 ? t.visitLeft : fillText(t.visitsLeft, { count: giftCard.remaining_visits || 0 }))
                    : formatAmount(giftCard.current_balance_cents / 100)}
                </div>
                <div className="text-sm opacity-90">
                  {isServicePass
                    ? fillText(t.passOriginally, { name: giftCard.service_pass_name || t.servicePass, count: giftCard.original_visits || 0 })
                    : fillText(t.originalValue, { amount: formatAmount(giftCard.original_value_cents / 100) })}
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
                <span className="text-gray-600">{t.code}</span>
                <div className="font-mono font-medium text-gray-800 mt-1">{giftCard.code}</div>
              </div>
              <div>
                <span className="text-gray-600">{t.purchased}</span>
                <div className="font-medium text-gray-800 mt-1">
                  {new Date(giftCard.purchased_at).toLocaleDateString(locale, {
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
                  <span className="text-gray-600">{t.expires}</span>
                  <div
                    className={`font-medium mt-1 ${
                      isExpired ? 'text-red-600' : 'text-gray-800'
                    }`}
                  >
                    {new Date(giftCard.expires_at).toLocaleDateString(locale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {isExpired && t.expiredSuffix}
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
                <span>{t.contactInfo}</span>
              </h3>
              {!isEditingEmails ? (
                <button
                  onClick={() => setIsEditingEmails(true)}
                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  <span>{t.edit}</span>
                </button>
              ) : (
                <button
                  onClick={handleSaveEmails}
                  disabled={savingEmails}
                  className="flex items-center space-x-1 text-green-600 hover:text-green-700 text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingEmails ? t.saving : t.save}</span>
                </button>
              )}
            </div>

            {isEditingEmails ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.buyerName}
                    </label>
                    <input
                      type="text"
                      value={buyerName}
                      onChange={(e) => setBuyerName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder={t.buyerNamePlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t.buyerEmail}
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
                    {t.recipientEmail}
                  </label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    placeholder="recipient@example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {t.recipientHint}
                  </p>
                </div>
                <button
                  onClick={() => setIsEditingEmails(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  {t.cancel}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">{t.buyer}</div>
                    <div className="font-medium text-gray-800">
                      {buyerName || <span className="text-gray-400 italic">{t.noName}</span>}
                    </div>
                    <div className="text-sm text-gray-600">
                      {buyerEmail || <span className="text-gray-400 italic">{t.noEmail}</span>}
                    </div>
                  </div>
                  {buyerEmail && (
                    <button
                      onClick={() => handleSendEmail('buyer')}
                      disabled={sendingEmail !== null}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded text-sm disabled:opacity-50"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{sendingEmail === 'buyer' ? t.sending : t.send}</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide">{t.recipient}</div>
                    <div className="text-sm text-gray-600">
                      {recipientEmail || <span className="text-gray-400 italic">{t.noEmail}</span>}
                    </div>
                  </div>
                  {recipientEmail && (
                    <button
                      onClick={() => handleSendEmail('recipient')}
                      disabled={sendingEmail !== null}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded text-sm disabled:opacity-50"
                    >
                      <Mail className="w-4 h-4" />
                      <span>{sendingEmail === 'recipient' ? t.sending : t.send}</span>
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
                    <span>{sendingEmail === 'both' ? t.sending : t.sendBoth}</span>
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
              <span>{t.downloadPdf}</span>
            </button>
          </div>

          {giftCard.status === 'active' && !isExpired && !isServicePass && (
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
                <DollarSign className="w-5 h-5" />
                <span>{t.redeemHeading}</span>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {fillText(t.amount, { symbol: currencySymbol })}
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
                    {t.descriptionOptional}
                  </label>
                  <input
                    type="text"
                    value={redeemDescription}
                    onChange={(e) => setRedeemDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={t.descriptionPlaceholder}
                  />
                </div>
              </div>
              <button
                onClick={handleRedeem}
                disabled={redeeming || !redeemAmount}
                className="mt-4 w-full px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {redeeming ? t.processing : t.redeemAmount}
              </button>
            </div>
          )}

          {giftCard.status === 'active' && !isExpired && isServicePass && (
            <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-4">
              <h3 className="font-semibold text-violet-950">{t.visitRedemption}</h3>
              <p className="mt-1 text-sm leading-6 text-violet-800">
                {t.visitRedemptionHint}
              </p>
            </div>
          )}

          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center space-x-2">
              <Calendar className="w-5 h-5" />
              <span>{t.history}</span>
            </h3>
            {loading ? (
              <div className="text-center py-4 text-gray-500">{t.loading}</div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-4 text-gray-500">{t.noTransactions}</div>
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
                        {new Date(txn.created_at).toLocaleString(locale)}
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
                        {isServicePass && (txn.visit_count || 0) > 0
                          ? `${txn.transaction_type === 'redemption' ? '-' : '+'}${txn.visit_count === 1 ? t.visitOne : fillText(t.visitMany, { count: txn.visit_count ?? 0 })}`
                          : <>{txn.transaction_type === 'redemption' ? '-' : '+'}{formatAmount(Math.abs(txn.amount_cents / 100))}</>}
                      </div>
                      <div className="text-xs text-gray-500 capitalize">
                        {TRANSACTION_KEYS[txn.transaction_type] ? t[TRANSACTION_KEYS[txn.transaction_type]] : txn.transaction_type}
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
              <span>{deleting ? t.deleting : t.deleteCard}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
