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
  Search,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import { POSView } from './POSView';
import { downloadGiftCardPDF } from '../../lib/giftCardPdfGenerator';
import { GiftCardDetailModal } from './GiftCardDetailModal';
import { ImportGiftCardsModal } from './ImportGiftCardsModal';
import GiftCardOrdersPanel from './giftCardOrders/GiftCardOrdersPanel';
import GiftCardPromoSettings from './giftCardOrders/GiftCardPromoSettings';
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
import { filterGiftCards } from './giftCards/filterGiftCards';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, Translations } from '../../lib/bookingLanguage';

type LoyaltyText = {
  msgPassRequired: string; msgVisitsRange: string; msgPriceInvalid: string; msgPassCreateError: string; msgPassAdded: string;
  msgPassUpdateError: string; msgPassAlreadySold: string; msgPassDeleteError: string; msgSaveError: string; msgLoyaltySaved: string;
  msgGiftCardSaved: string; msgEmailRequired: string; msgEmailInvalid: string; msgChoosePass: string; msgValueInvalid: string;
  msgCodeError: string; msgCreateError: string; msgPassCreated: string; msgCardCreated: string; msgPdfDownloaded: string;
  msgPdfError: string; msgNoRecipient: string; msgSending: string; msgErrorDetail: string; msgEmailSent: string; msgEmailError: string;
  unknownError: string; msgDeletedOne: string; msgDeletedMany: string; msgDeleteError: string; msgArtworkTooLarge: string;
  msgArtworkReadError: string;
  pageTitle: string; pageSubtitle: string; tabLoyalty: string; tabGiftSetup: string; tabGiftCards: string; tabOrders: string; tabPos: string;
  pointsProgram: string; pointsProgramHint: string; enabled: string; disabled: string; enableLoyaltyAria: string;
  pointsPerSpent: string; pointsPerSpentHint: string; pointsForReward: string; pointsForRewardHint: string; welcomeBonus: string;
  welcomeBonusHint: string; pointsExpireAfter: string; never: string; days: string; noExpiryHint: string; customerExample: string;
  examplePoints: string; exampleEarned: string; exampleUnlock: string; exampleWelcome: string; saving: string; saveLoyalty: string;
  giftRules: string; giftRulesHint: string; enableGiftAria: string; suggestedValues: string; suggestedValuesHint: string; addValue: string;
  suggestedValueAria: string; removeValueAria: string; customValue: string; customValueHint: string; allowCustomAria: string;
  minimum: string; maximum: string; expiry: string; neverExpires: string; expiryHint: string; codeFormat: string; codeFormatHint: string;
  fmtStandard: string; fmtNumeric6: string; fmtAlnum6: string; fmtPrefix: string; codePrefix: string; codePreview: string; saveGiftRules: string;
  servicePasses: string; visitBased: string; servicePassesHint: string; redemptionNote1: string; redemptionNote2: string;
  customerShop: string; noPassesYet: string; noPassesHint: string; forSale: string; paused: string; serviceFallback: string;
  minutes: string; visitOne: string; visitMany: string; passExpires: string; passDefaultExpiry: string; pause: string; resume: string;
  deleteAria: string; createPass: string; createPassHint: string; passName: string; passNamePlaceholder: string; service: string;
  chooseService: string; duration: string; chooseDuration: string; durationOption: string; visits: string; salePrice: string;
  expiryDays: string; defaultPlaceholder: string; customerDescription: string; optional: string; descriptionPlaceholder: string;
  creating: string; addPass: string;
  pdfDesign: string; pdfDesignHint: string; artwork: string; artworkAlt: string; noArtwork: string; artworkHint: string; reading: string;
  chooseImage: string; removeArtwork: string; terms: string; termsPlaceholder: string; termsHint: string; savePdf: string;
  activeCodes: string; totalIssued: string; outstandingBalance: string; outstandingBalanceNote: string; passVisitsRemaining: string;
  passVisitsNote: string; lifetimeSales: string; lifetimeSalesNote: string; issueHeading: string; issueHint: string; importCsv: string;
  valueCard: string; servicePass: string; amount: string; passOffer: string; chooseAPass: string; recipientEmail: string; buyer: string; buyerPlaceholder: string; colBuyer: string;
  issuePass: string; createCard: string; allCards: string; allCardsHint: string; searchCards: string; noMatch: string; deleteSelected: string; deselectAll: string;
  selectAll: string; colCode: string; colProduct: string; colSoldFor: string; colRemaining: string; colStatus: string;
  colPurchased: string; colRecipient: string; noCards: string; noCardsHint: string; deselectCard: string; selectCard: string;
  viewDetails: string; viewAria: string; downloadPdf: string; downloadAria: string; emailRecipient: string; emailAria: string;
  statusActive: string; statusFullyRedeemed: string; statusExpired: string; statusCancelled: string; statusPendingPayment: string;
  deleteTitle: string; deleteBodyOne: string; deleteBodyMany: string; cannotUndo: string; cancel: string; deleting: string; deleteCount: string;
};

const TEXT: Translations<LoyaltyText> = {
  en: {
    msgPassRequired: 'Name, service, and duration are required', msgVisitsRange: 'Visits must be a whole number between 1 and 100',
    msgPriceInvalid: 'Enter a valid package sale price', msgPassCreateError: 'Error creating service pass: {error}',
    msgPassAdded: 'Service pass added to the customer shop', msgPassUpdateError: 'Error updating service pass: {error}',
    msgPassAlreadySold: 'This pass has already been sold. Pause it instead of deleting it.',
    msgPassDeleteError: 'Error deleting service pass: {error}', msgSaveError: 'Error saving settings',
    msgLoyaltySaved: 'Loyalty settings saved successfully!', msgGiftCardSaved: 'Gift card settings saved successfully!',
    msgEmailRequired: 'Recipient email is required', msgEmailInvalid: 'Please enter a valid recipient email',
    msgChoosePass: 'Choose a service pass to issue', msgValueInvalid: 'Enter a valid gift-card value',
    msgCodeError: 'Error generating gift card code', msgCreateError: 'Error creating gift card',
    msgPassCreated: 'Service pass created: {code}', msgCardCreated: 'Gift card created: {code}',
    msgPdfDownloaded: 'Gift card PDF downloaded!', msgPdfError: 'Error downloading gift card',
    msgNoRecipient: 'No recipient email address for this gift card', msgSending: 'Sending gift card email...',
    msgErrorDetail: 'Error: {error}', msgEmailSent: 'Gift card email sent successfully!', msgEmailError: 'Error sending email: {error}',
    unknownError: 'Unknown error', msgDeletedOne: 'Deleted 1 gift card', msgDeletedMany: 'Deleted {count} gift cards',
    msgDeleteError: 'Error deleting gift cards. Please try again.', msgArtworkTooLarge: 'Error: artwork must be smaller than 5 MB',
    msgArtworkReadError: 'Error: failed to read artwork',
    pageTitle: 'Vouchers', pageSubtitle: 'Sell, look up and redeem vouchers and multi-visit cards.',
    tabLoyalty: 'Loyalty program', tabGiftSetup: 'Gift-card setup', tabGiftCards: 'Gift cards', tabOrders: 'Orders & sets', tabPos: 'Point of sale',
    pointsProgram: 'Points program',
    pointsProgramHint: 'Reward completed bookings automatically and let customers redeem points on future visits.',
    enabled: 'Enabled', disabled: 'Disabled', enableLoyaltyAria: 'Enable loyalty points',
    pointsPerSpent: 'Points per {amount} spent', pointsPerSpentHint: 'Awarded after a booking is completed.',
    pointsForReward: 'Points for {amount} reward', pointsForRewardHint: 'Sets the redemption value of each point.',
    welcomeBonus: 'Welcome bonus', welcomeBonusHint: 'Points granted when a customer joins.',
    pointsExpireAfter: 'Points expire after', never: 'Never', days: 'days', noExpiryHint: 'Leave empty for no expiry.',
    customerExample: 'Customer example', examplePoints: '{count} points', exampleEarned: 'earned on a {amount} completed visit',
    exampleUnlock: '{points} points unlock {amount} off.', exampleWelcome: 'New members start with {points} points.',
    saving: 'Saving…', saveLoyalty: 'Save loyalty program',
    giftRules: 'Gift-card rules', giftRulesHint: 'Choose values, expiry, and how new gift-card codes are generated.',
    enableGiftAria: 'Enable gift cards', suggestedValues: 'Suggested values',
    suggestedValuesHint: 'Customers can choose these values at checkout.', addValue: 'Add value',
    suggestedValueAria: 'Suggested gift-card value {index}', removeValueAria: 'Remove {amount} value',
    customValue: 'Let customers choose a custom value', customValueHint: 'Set a safe minimum and maximum for checkout.',
    allowCustomAria: 'Allow custom gift-card values', minimum: 'Minimum ({symbol})', maximum: 'Maximum ({symbol})',
    expiry: 'Expiry', neverExpires: 'Never expires', expiryHint: 'Days until expiry; leave empty for no expiry.',
    codeFormat: 'Code format', codeFormatHint: 'Only new cards use the selected format.',
    fmtStandard: 'Standard (current)', fmtNumeric6: '6-Digit Numeric', fmtAlnum6: '6-Character Alphanumeric',
    fmtPrefix: 'Custom Prefix + 6 Digits', codePrefix: 'Code prefix', codePreview: 'Preview: {code}', saveGiftRules: 'Save gift-card rules',
    servicePasses: 'Service passes', visitBased: 'Visit based',
    servicePassesHint: "Sell one visit or a multi-visit package for an exact service and duration. The sale price can be different from the service's current price.",
    redemptionNote1: 'One redemption covers one service unit.', redemptionNote2: 'Add-ons and a second guest remain payable.',
    customerShop: 'Customer shop', noPassesYet: 'No service passes yet', noPassesHint: 'Create the first offer with the form beside this panel.',
    forSale: 'For sale', paused: 'Paused', serviceFallback: 'Service', minutes: '{count} min', visitOne: '1 visit', visitMany: '{count} visits',
    passExpires: 'Expires {days} days after purchase', passDefaultExpiry: 'Uses the default gift-card expiry',
    pause: 'Pause', resume: 'Resume', deleteAria: 'Delete {name}',
    createPass: 'Create a service pass', createPassHint: 'This becomes a purchasable option next to value gift cards.',
    passName: 'Pass name', passNamePlaceholder: '5 × Thai Massage · 60 min', service: 'Service', chooseService: 'Choose service',
    duration: 'Duration', chooseDuration: 'Choose duration', durationOption: '{minutes} min · {amount} standard', visits: 'Visits',
    salePrice: 'Sale price ({symbol})', expiryDays: 'Expiry days', defaultPlaceholder: 'Default',
    customerDescription: 'Customer description', optional: '(optional)', descriptionPlaceholder: 'A simple note shown before purchase.',
    creating: 'Creating…', addPass: 'Add service pass',
    pdfDesign: 'PDF design', pdfDesignHint: 'Add branded artwork and the terms printed beside each gift-card QR code.',
    artwork: 'Gift-card artwork', artworkAlt: 'Gift-card design', noArtwork: 'No artwork uploaded', artworkHint: 'Portrait 3:4 works best.',
    reading: 'Reading…', chooseImage: 'Choose image', removeArtwork: 'Remove artwork', terms: 'Terms and conditions',
    termsPlaceholder: 'Enter the terms printed on gift-card PDFs…', termsHint: 'These appear beside the QR code on the generated PDF.',
    savePdf: 'Save PDF design',
    activeCodes: 'Active codes', totalIssued: '{count} total issued', outstandingBalance: 'Outstanding balance',
    outstandingBalanceNote: 'Value customers can redeem', passVisitsRemaining: 'Pass visits remaining',
    passVisitsNote: 'Service visits still owed', lifetimeSales: 'Lifetime sales value', lifetimeSalesNote: 'Cards and passes issued',
    issueHeading: 'Issue a card or pass', issueHint: 'Create one manually or import existing value cards.', importCsv: 'Import CSV',
    valueCard: 'Value card', servicePass: 'Service pass', amount: 'Amount ({symbol})', passOffer: 'Pass offer', chooseAPass: 'Choose a pass',
    recipientEmail: 'Recipient email', buyer: 'Buyer (optional)', buyerPlaceholder: 'Name or email', colBuyer: 'Buyer', issuePass: 'Issue pass', createCard: 'Create card',
    allCards: 'All cards and passes', allCardsHint: 'Money balances and visit entitlements in one place.', searchCards: 'Search code, name or email', noMatch: 'No card matches “{query}”.',
    deleteSelected: 'Delete selected ({count})', deselectAll: 'Deselect all gift cards', selectAll: 'Select all gift cards',
    colCode: 'Code', colProduct: 'Product', colSoldFor: 'Sold for', colRemaining: 'Remaining', colStatus: 'Status',
    colPurchased: 'Purchased', colRecipient: 'Recipient', noCards: 'No cards or passes yet',
    noCardsHint: 'Create the first one above or import value cards from CSV.', deselectCard: 'Deselect {code}', selectCard: 'Select {code}',
    viewDetails: 'View Details', viewAria: 'View {code}', downloadPdf: 'Download PDF', downloadAria: 'Download {code}',
    emailRecipient: 'Email to recipient', emailAria: 'Email {code}',
    statusActive: 'Active', statusFullyRedeemed: 'Fully redeemed', statusExpired: 'Expired', statusCancelled: 'Cancelled',
    statusPendingPayment: 'Awaiting payment',
    deleteTitle: 'Delete selected gift cards?', deleteBodyOne: '1 card and its transaction history will be removed.',
    deleteBodyMany: '{count} cards and their transaction history will be removed.', cannotUndo: 'This cannot be undone.',
    cancel: 'Cancel', deleting: 'Deleting…', deleteCount: 'Delete {count}',
  },
  de: {
    msgPassRequired: 'Name, Leistung und Dauer sind erforderlich', msgVisitsRange: 'Besuche müssen eine ganze Zahl zwischen 1 und 100 sein',
    msgPriceInvalid: 'Bitte einen gültigen Verkaufspreis eingeben', msgPassCreateError: 'Fehler beim Anlegen des Behandlungsgutscheins: {error}',
    msgPassAdded: 'Behandlungsgutschein zum Kundenshop hinzugefügt', msgPassUpdateError: 'Fehler beim Aktualisieren des Behandlungsgutscheins: {error}',
    msgPassAlreadySold: 'Diese Karte wurde bereits verkauft. Pausieren statt löschen.',
    msgPassDeleteError: 'Fehler beim Löschen des Behandlungsgutscheins: {error}', msgSaveError: 'Fehler beim Speichern der Einstellungen',
    msgLoyaltySaved: 'Treue-Einstellungen gespeichert.', msgGiftCardSaved: 'Gutschein-Einstellungen gespeichert.',
    msgEmailRequired: 'E-Mail-Adresse des Empfängers ist erforderlich', msgEmailInvalid: 'Bitte eine gültige E-Mail-Adresse des Empfängers eingeben',
    msgChoosePass: 'Bitte einen Behandlungsgutschein zum Ausstellen wählen', msgValueInvalid: 'Bitte einen gültigen Gutscheinwert eingeben',
    msgCodeError: 'Fehler beim Erzeugen des Gutscheincodes', msgCreateError: 'Fehler beim Anlegen des Gutscheins',
    msgPassCreated: 'Behandlungsgutschein ausgestellt: {code}', msgCardCreated: 'Gutschein ausgestellt: {code}',
    msgPdfDownloaded: 'Gutschein-PDF heruntergeladen.', msgPdfError: 'Fehler beim Herunterladen des Gutscheins',
    msgNoRecipient: 'Für diesen Gutschein ist keine E-Mail-Adresse hinterlegt', msgSending: 'Gutschein-E-Mail wird gesendet…',
    msgErrorDetail: 'Fehler: {error}', msgEmailSent: 'Gutschein-E-Mail gesendet.', msgEmailError: 'Fehler beim Senden der E-Mail: {error}',
    unknownError: 'Unbekannter Fehler', msgDeletedOne: '1 Gutschein gelöscht', msgDeletedMany: '{count} Gutscheine gelöscht',
    msgDeleteError: 'Fehler beim Löschen der Gutscheine. Bitte erneut versuchen.', msgArtworkTooLarge: 'Fehler: Das Motiv muss kleiner als 5 MB sein',
    msgArtworkReadError: 'Fehler: Das Motiv konnte nicht gelesen werden',
    pageTitle: 'Gutscheine', pageSubtitle: 'Gutscheine und Mehrfachkarten verkaufen, nachschlagen und einlösen.',
    tabLoyalty: 'Treueprogramm', tabGiftSetup: 'Gutschein-Einstellungen', tabGiftCards: 'Gutscheine', tabOrders: 'Bestellungen & Sets', tabPos: 'Kasse',
    pointsProgram: 'Punkteprogramm',
    pointsProgramHint: 'Abgeschlossene Buchungen automatisch belohnen; Kunden lösen Punkte bei späteren Besuchen ein.',
    enabled: 'Aktiviert', disabled: 'Deaktiviert', enableLoyaltyAria: 'Treuepunkte aktivieren',
    pointsPerSpent: 'Punkte pro {amount} Umsatz', pointsPerSpentHint: 'Werden nach Abschluss einer Buchung gutgeschrieben.',
    pointsForReward: 'Punkte für {amount} Prämie', pointsForRewardHint: 'Legt den Einlösewert jedes Punkts fest.',
    welcomeBonus: 'Willkommensbonus', welcomeBonusHint: 'Punkte, die Kunden bei der Anmeldung erhalten.',
    pointsExpireAfter: 'Punkte verfallen nach', never: 'Nie', days: 'Tagen', noExpiryHint: 'Leer lassen für keinen Verfall.',
    customerExample: 'Kundenbeispiel', examplePoints: '{count} Punkte', exampleEarned: 'für einen abgeschlossenen Besuch über {amount}',
    exampleUnlock: '{points} Punkte ergeben {amount} Rabatt.', exampleWelcome: 'Neue Mitglieder starten mit {points} Punkten.',
    saving: 'Speichern…', saveLoyalty: 'Treueprogramm speichern',
    giftRules: 'Gutschein-Regeln', giftRulesHint: 'Werte, Gültigkeit und Format neuer Gutscheincodes festlegen.',
    enableGiftAria: 'Gutscheine aktivieren', suggestedValues: 'Vorgeschlagene Werte',
    suggestedValuesHint: 'Kunden können diese Werte beim Kauf wählen.', addValue: 'Wert hinzufügen',
    suggestedValueAria: 'Vorgeschlagener Gutscheinwert {index}', removeValueAria: 'Wert {amount} entfernen',
    customValue: 'Kunden einen eigenen Wert wählen lassen', customValueHint: 'Sinnvolles Minimum und Maximum für den Kauf festlegen.',
    allowCustomAria: 'Eigene Gutscheinwerte erlauben', minimum: 'Minimum ({symbol})', maximum: 'Maximum ({symbol})',
    expiry: 'Gültigkeit', neverExpires: 'Unbegrenzt gültig', expiryHint: 'Tage bis zum Ablauf; leer lassen für unbegrenzte Gültigkeit.',
    codeFormat: 'Code-Format', codeFormatHint: 'Nur neue Gutscheine verwenden das gewählte Format.',
    fmtStandard: 'Standard (aktuell)', fmtNumeric6: '6 Ziffern', fmtAlnum6: '6 Zeichen alphanumerisch',
    fmtPrefix: 'Eigenes Präfix + 6 Ziffern', codePrefix: 'Code-Präfix', codePreview: 'Vorschau: {code}', saveGiftRules: 'Gutschein-Regeln speichern',
    servicePasses: 'Behandlungsgutscheine', visitBased: 'Nach Besuchen',
    servicePassesHint: 'Einen Besuch oder ein Paket mit mehreren Besuchen für eine bestimmte Leistung und Dauer verkaufen. Der Verkaufspreis kann vom aktuellen Preis der Leistung abweichen.',
    redemptionNote1: 'Eine Einlösung deckt eine Leistungseinheit ab.', redemptionNote2: 'Zusatzleistungen und eine zweite Person bleiben kostenpflichtig.',
    customerShop: 'Kundenshop', noPassesYet: 'Noch keine Behandlungsgutscheine', noPassesHint: 'Das erste Angebot über das Formular nebenan anlegen.',
    forSale: 'Im Verkauf', paused: 'Pausiert', serviceFallback: 'Leistung', minutes: '{count} Min.', visitOne: '1 Besuch', visitMany: '{count} Besuche',
    passExpires: 'Gültig bis {days} Tage nach Kauf', passDefaultExpiry: 'Verwendet die Standard-Gültigkeit für Gutscheine',
    pause: 'Pausieren', resume: 'Fortsetzen', deleteAria: '{name} löschen',
    createPass: 'Behandlungsgutschein anlegen', createPassHint: 'Wird neben Wertgutscheinen als kaufbare Option angeboten.',
    passName: 'Name der Karte', passNamePlaceholder: '5 × Thai-Massage · 60 Min.', service: 'Leistung', chooseService: 'Leistung wählen',
    duration: 'Dauer', chooseDuration: 'Dauer wählen', durationOption: '{minutes} Min. · {amount} regulär', visits: 'Besuche',
    salePrice: 'Verkaufspreis ({symbol})', expiryDays: 'Gültigkeit (Tage)', defaultPlaceholder: 'Standard',
    customerDescription: 'Beschreibung für Kunden', optional: '(optional)', descriptionPlaceholder: 'Ein kurzer Hinweis, der vor dem Kauf angezeigt wird.',
    creating: 'Wird angelegt…', addPass: 'Behandlungsgutschein hinzufügen',
    pdfDesign: 'PDF-Design', pdfDesignHint: 'Eigenes Motiv und die Bedingungen hinzufügen, die neben dem QR-Code jedes Gutscheins gedruckt werden.',
    artwork: 'Gutscheinmotiv', artworkAlt: 'Gutscheindesign', noArtwork: 'Kein Motiv hochgeladen', artworkHint: 'Hochformat 3:4 eignet sich am besten.',
    reading: 'Wird gelesen…', chooseImage: 'Bild wählen', removeArtwork: 'Motiv entfernen', terms: 'Geschäftsbedingungen',
    termsPlaceholder: 'Bedingungen für die Gutschein-PDFs eingeben…', termsHint: 'Erscheinen neben dem QR-Code im erzeugten PDF.',
    savePdf: 'PDF-Design speichern',
    activeCodes: 'Aktive Codes', totalIssued: '{count} insgesamt ausgestellt', outstandingBalance: 'Offenes Guthaben',
    outstandingBalanceNote: 'Von Kunden einlösbarer Wert', passVisitsRemaining: 'Offene Besuche',
    passVisitsNote: 'Noch ausstehende Leistungsbesuche', lifetimeSales: 'Gesamtumsatz', lifetimeSalesNote: 'Ausgestellte Gutscheine und Karten',
    issueHeading: 'Gutschein oder Karte ausstellen', issueHint: 'Manuell anlegen oder bestehende Wertgutscheine importieren.', importCsv: 'CSV importieren',
    valueCard: 'Wertgutschein', servicePass: 'Behandlungsgutschein', amount: 'Betrag ({symbol})', passOffer: 'Kartenangebot', chooseAPass: 'Karte wählen',
    recipientEmail: 'E-Mail des Empfängers', buyer: 'Käufer (optional)', buyerPlaceholder: 'Name oder E-Mail', colBuyer: 'Käufer', issuePass: 'Karte ausstellen', createCard: 'Gutschein ausstellen',
    allCards: 'Alle Gutscheine und Karten', allCardsHint: 'Guthaben und Besuchsansprüche an einem Ort.', searchCards: 'Code, Name oder E-Mail suchen', noMatch: 'Kein Gutschein passt zu „{query}“.',
    deleteSelected: 'Auswahl löschen ({count})', deselectAll: 'Auswahl aller Gutscheine aufheben', selectAll: 'Alle Gutscheine auswählen',
    colCode: 'Code', colProduct: 'Produkt', colSoldFor: 'Verkauft für', colRemaining: 'Verbleibend', colStatus: 'Status',
    colPurchased: 'Gekauft', colRecipient: 'Empfänger', noCards: 'Noch keine Gutscheine oder Karten',
    noCardsHint: 'Oben den ersten anlegen oder Wertgutscheine per CSV importieren.', deselectCard: '{code} abwählen', selectCard: '{code} auswählen',
    viewDetails: 'Details anzeigen', viewAria: '{code} anzeigen', downloadPdf: 'PDF herunterladen', downloadAria: '{code} herunterladen',
    emailRecipient: 'Per E-Mail an Empfänger senden', emailAria: '{code} per E-Mail senden',
    statusActive: 'Aktiv', statusFullyRedeemed: 'Vollständig eingelöst', statusExpired: 'Abgelaufen', statusCancelled: 'Storniert',
    statusPendingPayment: 'Zahlung ausstehend',
    deleteTitle: 'Ausgewählte Gutscheine löschen?', deleteBodyOne: '1 Gutschein und sein Transaktionsverlauf werden entfernt.',
    deleteBodyMany: '{count} Gutscheine und ihr Transaktionsverlauf werden entfernt.', cannotUndo: 'Dies kann nicht rückgängig gemacht werden.',
    cancel: 'Abbrechen', deleting: 'Wird gelöscht…', deleteCount: '{count} löschen',
  },
  th: {
    msgPassRequired: 'ต้องระบุชื่อ บริการ และระยะเวลา', msgVisitsRange: 'จำนวนครั้งต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 100',
    msgPriceInvalid: 'กรุณาใส่ราคาขายแพ็กเกจที่ถูกต้อง', msgPassCreateError: 'สร้างบัตรบริการไม่สำเร็จ: {error}',
    msgPassAdded: 'เพิ่มบัตรบริการในร้านค้าลูกค้าแล้ว', msgPassUpdateError: 'อัปเดตบัตรบริการไม่สำเร็จ: {error}',
    msgPassAlreadySold: 'บัตรบริการนี้ขายไปแล้ว ให้หยุดขายแทนการลบ',
    msgPassDeleteError: 'ลบบัตรบริการไม่สำเร็จ: {error}', msgSaveError: 'บันทึกการตั้งค่าไม่สำเร็จ',
    msgLoyaltySaved: 'บันทึกการตั้งค่าสะสมแต้มแล้ว', msgGiftCardSaved: 'บันทึกการตั้งค่าบัตรของขวัญแล้ว',
    msgEmailRequired: 'ต้องระบุอีเมลผู้รับ', msgEmailInvalid: 'กรุณาใส่อีเมลผู้รับที่ถูกต้อง',
    msgChoosePass: 'กรุณาเลือกบัตรบริการที่จะออกบัตร', msgValueInvalid: 'กรุณาใส่มูลค่าบัตรของขวัญที่ถูกต้อง',
    msgCodeError: 'สร้างโค้ดบัตรของขวัญไม่สำเร็จ', msgCreateError: 'สร้างบัตรของขวัญไม่สำเร็จ',
    msgPassCreated: 'ออกบัตรบริการแล้ว: {code}', msgCardCreated: 'ออกบัตรของขวัญแล้ว: {code}',
    msgPdfDownloaded: 'ดาวน์โหลด PDF บัตรของขวัญแล้ว', msgPdfError: 'ดาวน์โหลดบัตรของขวัญไม่สำเร็จ',
    msgNoRecipient: 'บัตรของขวัญนี้ไม่มีอีเมลผู้รับ', msgSending: 'กำลังส่งอีเมลบัตรของขวัญ…',
    msgErrorDetail: 'ข้อผิดพลาด: {error}', msgEmailSent: 'ส่งอีเมลบัตรของขวัญแล้ว', msgEmailError: 'ส่งอีเมลไม่สำเร็จ: {error}',
    unknownError: 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ', msgDeletedOne: 'ลบบัตรของขวัญ 1 ใบแล้ว', msgDeletedMany: 'ลบบัตรของขวัญ {count} ใบแล้ว',
    msgDeleteError: 'ลบบัตรของขวัญไม่สำเร็จ กรุณาลองอีกครั้ง', msgArtworkTooLarge: 'ข้อผิดพลาด: ไฟล์ภาพต้องเล็กกว่า 5 MB',
    msgArtworkReadError: 'ข้อผิดพลาด: อ่านไฟล์ภาพไม่ได้',
    pageTitle: 'บัตรของขวัญ', pageSubtitle: 'ขาย ค้นหา และใช้บัตรของขวัญและบัตรหลายครั้ง',
    tabLoyalty: 'โปรแกรมสะสมแต้ม', tabGiftSetup: 'ตั้งค่าบัตรของขวัญ', tabGiftCards: 'บัตรของขวัญ', tabOrders: 'คำสั่งซื้อและชุด', tabPos: 'จุดขาย',
    pointsProgram: 'โปรแกรมแต้ม',
    pointsProgramHint: 'ให้แต้มอัตโนมัติเมื่อการจองเสร็จสิ้น และให้ลูกค้าใช้แต้มในการมาครั้งต่อไป',
    enabled: 'เปิดใช้งาน', disabled: 'ปิดใช้งาน', enableLoyaltyAria: 'เปิดใช้งานแต้มสะสม',
    pointsPerSpent: 'แต้มต่อการใช้จ่าย {amount}', pointsPerSpentHint: 'ได้รับหลังการจองเสร็จสิ้น',
    pointsForReward: 'แต้มสำหรับรางวัล {amount}', pointsForRewardHint: 'กำหนดมูลค่าการแลกของแต่ละแต้ม',
    welcomeBonus: 'โบนัสต้อนรับ', welcomeBonusHint: 'แต้มที่ลูกค้าได้รับเมื่อสมัครสมาชิก',
    pointsExpireAfter: 'แต้มหมดอายุหลังจาก', never: 'ไม่หมดอายุ', days: 'วัน', noExpiryHint: 'เว้นว่างหากไม่มีวันหมดอายุ',
    customerExample: 'ตัวอย่างสำหรับลูกค้า', examplePoints: '{count} แต้ม', exampleEarned: 'ได้รับจากการใช้บริการ {amount} ที่เสร็จสิ้น',
    exampleUnlock: '{points} แต้ม แลกส่วนลด {amount}', exampleWelcome: 'สมาชิกใหม่เริ่มต้นด้วย {points} แต้ม',
    saving: 'กำลังบันทึก…', saveLoyalty: 'บันทึกโปรแกรมสะสมแต้ม',
    giftRules: 'กฎบัตรของขวัญ', giftRulesHint: 'เลือกมูลค่า วันหมดอายุ และรูปแบบโค้ดบัตรของขวัญใหม่',
    enableGiftAria: 'เปิดใช้งานบัตรของขวัญ', suggestedValues: 'มูลค่าแนะนำ',
    suggestedValuesHint: 'ลูกค้าเลือกมูลค่าเหล่านี้ได้ตอนชำระเงิน', addValue: 'เพิ่มมูลค่า',
    suggestedValueAria: 'มูลค่าบัตรของขวัญแนะนำ {index}', removeValueAria: 'ลบมูลค่า {amount}',
    customValue: 'ให้ลูกค้ากำหนดมูลค่าเอง', customValueHint: 'กำหนดขั้นต่ำและสูงสุดที่เหมาะสมสำหรับการชำระเงิน',
    allowCustomAria: 'อนุญาตให้กำหนดมูลค่าบัตรของขวัญเอง', minimum: 'ขั้นต่ำ ({symbol})', maximum: 'สูงสุด ({symbol})',
    expiry: 'วันหมดอายุ', neverExpires: 'ไม่มีวันหมดอายุ', expiryHint: 'จำนวนวันจนหมดอายุ เว้นว่างหากไม่มีวันหมดอายุ',
    codeFormat: 'รูปแบบโค้ด', codeFormatHint: 'ใช้รูปแบบที่เลือกกับบัตรใหม่เท่านั้น',
    fmtStandard: 'มาตรฐาน (ปัจจุบัน)', fmtNumeric6: 'ตัวเลข 6 หลัก', fmtAlnum6: 'ตัวอักษรและตัวเลข 6 ตัว',
    fmtPrefix: 'คำนำหน้าเอง + ตัวเลข 6 หลัก', codePrefix: 'คำนำหน้าโค้ด', codePreview: 'ตัวอย่าง: {code}', saveGiftRules: 'บันทึกกฎบัตรของขวัญ',
    servicePasses: 'บัตรบริการ', visitBased: 'นับตามครั้ง',
    servicePassesHint: 'ขายแบบครั้งเดียวหรือแพ็กเกจหลายครั้งสำหรับบริการและระยะเวลาที่กำหนด ราคาขายอาจต่างจากราคาบริการปัจจุบันได้',
    redemptionNote1: 'ใช้ 1 ครั้งครอบคลุมบริการ 1 หน่วย', redemptionNote2: 'บริการเสริมและผู้รับบริการคนที่สองต้องชำระเพิ่ม',
    customerShop: 'ร้านค้าลูกค้า', noPassesYet: 'ยังไม่มีบัตรบริการ', noPassesHint: 'สร้างข้อเสนอแรกด้วยแบบฟอร์มด้านข้าง',
    forSale: 'เปิดขาย', paused: 'หยุดขาย', serviceFallback: 'บริการ', minutes: '{count} นาที', visitOne: '1 ครั้ง', visitMany: '{count} ครั้ง',
    passExpires: 'หมดอายุ {days} วันหลังซื้อ', passDefaultExpiry: 'ใช้วันหมดอายุเริ่มต้นของบัตรของขวัญ',
    pause: 'หยุดขาย', resume: 'เปิดขายอีกครั้ง', deleteAria: 'ลบ {name}',
    createPass: 'สร้างบัตรบริการ', createPassHint: 'จะแสดงเป็นตัวเลือกให้ซื้อถัดจากบัตรของขวัญแบบมูลค่า',
    passName: 'ชื่อบัตรบริการ', passNamePlaceholder: 'นวดไทย 5 ครั้ง · 60 นาที', service: 'บริการ', chooseService: 'เลือกบริการ',
    duration: 'ระยะเวลา', chooseDuration: 'เลือกระยะเวลา', durationOption: '{minutes} นาที · ราคาปกติ {amount}', visits: 'จำนวนครั้ง',
    salePrice: 'ราคาขาย ({symbol})', expiryDays: 'จำนวนวันก่อนหมดอายุ', defaultPlaceholder: 'ค่าเริ่มต้น',
    customerDescription: 'คำอธิบายสำหรับลูกค้า', optional: '(ไม่บังคับ)', descriptionPlaceholder: 'ข้อความสั้นๆ ที่แสดงก่อนซื้อ',
    creating: 'กำลังสร้าง…', addPass: 'เพิ่มบัตรบริการ',
    pdfDesign: 'ดีไซน์ PDF', pdfDesignHint: 'เพิ่มภาพของแบรนด์และเงื่อนไขที่พิมพ์ข้าง QR โค้ดของบัตรของขวัญแต่ละใบ',
    artwork: 'ภาพบัตรของขวัญ', artworkAlt: 'ดีไซน์บัตรของขวัญ', noArtwork: 'ยังไม่ได้อัปโหลดภาพ', artworkHint: 'แนวตั้ง 3:4 เหมาะที่สุด',
    reading: 'กำลังอ่าน…', chooseImage: 'เลือกรูปภาพ', removeArtwork: 'ลบภาพ', terms: 'ข้อกำหนดและเงื่อนไข',
    termsPlaceholder: 'ใส่เงื่อนไขที่จะพิมพ์บน PDF บัตรของขวัญ…', termsHint: 'แสดงข้าง QR โค้ดใน PDF ที่สร้างขึ้น',
    savePdf: 'บันทึกดีไซน์ PDF',
    activeCodes: 'โค้ดที่ใช้งานได้', totalIssued: 'ออกบัตรแล้วทั้งหมด {count} ใบ', outstandingBalance: 'ยอดคงเหลือค้าง',
    outstandingBalanceNote: 'มูลค่าที่ลูกค้าใช้ได้', passVisitsRemaining: 'จำนวนครั้งคงเหลือ',
    passVisitsNote: 'ครั้งบริการที่ยังค้างอยู่', lifetimeSales: 'ยอดขายทั้งหมด', lifetimeSalesNote: 'บัตรของขวัญและบัตรบริการที่ออกแล้ว',
    issueHeading: 'ออกบัตรของขวัญหรือบัตรบริการ', issueHint: 'สร้างเองหรือนำเข้าบัตรมูลค่าที่มีอยู่', importCsv: 'นำเข้า CSV',
    valueCard: 'บัตรมูลค่า', servicePass: 'บัตรบริการ', amount: 'จำนวนเงิน ({symbol})', passOffer: 'ข้อเสนอบัตรบริการ', chooseAPass: 'เลือกบัตรบริการ',
    recipientEmail: 'อีเมลผู้รับ', buyer: 'ผู้ซื้อ (ไม่บังคับ)', buyerPlaceholder: 'ชื่อหรืออีเมล', colBuyer: 'ผู้ซื้อ', issuePass: 'ออกบัตรบริการ', createCard: 'ออกบัตรของขวัญ',
    allCards: 'บัตรทั้งหมด', allCardsHint: 'ยอดเงินคงเหลือและสิทธิ์จำนวนครั้งในที่เดียว', searchCards: 'ค้นหารหัส ชื่อ หรืออีเมล', noMatch: 'ไม่พบบัตรที่ตรงกับ “{query}”',
    deleteSelected: 'ลบที่เลือก ({count})', deselectAll: 'ยกเลิกการเลือกบัตรทั้งหมด', selectAll: 'เลือกบัตรทั้งหมด',
    colCode: 'โค้ด', colProduct: 'สินค้า', colSoldFor: 'ราคาขาย', colRemaining: 'คงเหลือ', colStatus: 'สถานะ',
    colPurchased: 'วันที่ซื้อ', colRecipient: 'ผู้รับ', noCards: 'ยังไม่มีบัตร',
    noCardsHint: 'สร้างใบแรกด้านบน หรือนำเข้าบัตรมูลค่าจาก CSV', deselectCard: 'ยกเลิกการเลือก {code}', selectCard: 'เลือก {code}',
    viewDetails: 'ดูรายละเอียด', viewAria: 'ดู {code}', downloadPdf: 'ดาวน์โหลด PDF', downloadAria: 'ดาวน์โหลด {code}',
    emailRecipient: 'ส่งอีเมลถึงผู้รับ', emailAria: 'ส่งอีเมล {code}',
    statusActive: 'ใช้งานได้', statusFullyRedeemed: 'ใช้ครบแล้ว', statusExpired: 'หมดอายุ', statusCancelled: 'ยกเลิกแล้ว',
    statusPendingPayment: 'รอชำระเงิน',
    deleteTitle: 'ลบบัตรของขวัญที่เลือก?', deleteBodyOne: 'บัตร 1 ใบและประวัติธุรกรรมจะถูกลบ',
    deleteBodyMany: 'บัตร {count} ใบและประวัติธุรกรรมจะถูกลบ', cannotUndo: 'ไม่สามารถย้อนกลับได้',
    cancel: 'ยกเลิก', deleting: 'กำลังลบ…', deleteCount: 'ลบ {count} ใบ',
  },
};

const STATUS_KEYS: Record<string, keyof LoyaltyText> = {
  active: 'statusActive',
  fully_redeemed: 'statusFullyRedeemed',
  expired: 'statusExpired',
  cancelled: 'statusCancelled',
  pending_payment: 'statusPendingPayment',
};

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

const CODE_FORMAT_OPTIONS: { value: GiftCardCodeFormat; labelKey: keyof LoyaltyText; example: string }[] = [
  { value: 'standard', labelKey: 'fmtStandard', example: 'ABCD-EFGH-JKLM-NPQR' },
  { value: 'numeric_6', labelKey: 'fmtNumeric6', example: '482917' },
  { value: 'alphanumeric_6', labelKey: 'fmtAlnum6', example: 'A3K8F2' },
  { value: 'prefix_numeric', labelKey: 'fmtPrefix', example: 'SPA-483921' },
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
  purchased_by_name?: string | null;
  purchased_by_email?: string | null;
}

/** One optional "buyer" field: an email goes to purchased_by_email, anything else is the name. */
function buyerFields(value: string): { purchased_by_name: string | null; purchased_by_email: string | null } {
  const buyer = value.trim();
  if (!buyer) return { purchased_by_name: null, purchased_by_email: null };
  return buyer.includes('@') ? { purchased_by_name: null, purchased_by_email: buyer } : { purchased_by_name: buyer, purchased_by_email: null };
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
  const { businessId, language } = useTenant();
  const { currency, currencySymbol, formatAmount } = useCurrency();
  const { t, locale } = useAdminText(TEXT);
  const [activeTab, setActiveTab] = useState<'loyalty' | 'giftcards' | 'manage' | 'orders' | 'pos'>('manage');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessageText] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);
  const setMessage = (text: string, isError = false) => {
    setMessageText(text);
    setMessageIsError(isError);
  };
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
  const [newGiftCardBuyer, setNewGiftCardBuyer] = useState('');
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
  const [cardQuery, setCardQuery] = useState('');
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
      setMessage(t.msgPassRequired, true);
      return;
    }
    if (!Number.isInteger(visitCount) || visitCount < 1 || visitCount > 100) {
      setMessage(t.msgVisitsRange, true);
      return;
    }
    if (!priceCents || priceCents <= 0) {
      setMessage(t.msgPriceInvalid, true);
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
      setMessage(fillText(t.msgPassCreateError, { error: error.message }), true);
    } else {
      setMessage(t.msgPassAdded);
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
      setMessage(fillText(t.msgPassUpdateError, { error: error.message }), true);
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
        ? t.msgPassAlreadySold
        : fillText(t.msgPassDeleteError, { error: error.message }), true);
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
      setMessage(t.msgSaveError, true);
      console.error(error);
    } else {
      setMessage(t.msgLoyaltySaved);
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
        // Only the fields this screen edits; the promotion is saved separately.
        enabled: giftCardSettings.enabled,
        preset_amounts_cents: giftCardSettings.preset_amounts_cents,
        allow_custom_amount: giftCardSettings.allow_custom_amount,
        min_custom_amount_cents: giftCardSettings.min_custom_amount_cents,
        max_custom_amount_cents: giftCardSettings.max_custom_amount_cents,
        expiry_days: giftCardSettings.expiry_days,
        design_url: giftCardSettings.design_url,
        terms_and_conditions: giftCardSettings.terms_and_conditions,
        code_format: giftCardSettings.code_format,
        code_prefix: giftCardSettings.code_prefix,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'business_id' });

    if (error) {
      setMessage(t.msgSaveError, true);
      console.error(error);
    } else {
      setMessage(t.msgGiftCardSaved);
      setTimeout(() => setMessage(''), 3000);
    }

    setSaving(false);
  };

  const createGiftCard = async () => {
    const trimmedEmail = newGiftCardEmail.trim();
    if (!trimmedEmail) {
      setMessage(t.msgEmailRequired, true);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setMessage(t.msgEmailInvalid, true);
      return;
    }

    setCreatingGiftCard(true);
    setMessage('');

    const selectedOffer = servicePassOffers.find((offer) => offer.id === newServicePassOfferId);
    const amountCents = newGiftCardType === 'service_pass'
      ? selectedOffer?.price_cents || 0
      : Math.round(parseFloat(newGiftCardAmount) * 100);

    if (newGiftCardType === 'service_pass' && !selectedOffer) {
      setMessage(t.msgChoosePass, true);
      setCreatingGiftCard(false);
      return;
    }

    if (newGiftCardType === 'value' && (!amountCents || amountCents <= 0)) {
      setMessage(t.msgValueInvalid, true);
      setCreatingGiftCard(false);
      return;
    }

    // Generate code using the database function
    const { data: codeData, error: codeError } = await supabase
      .rpc('generate_gift_card_code', { p_business_id: businessId });

    if (codeError || !codeData) {
      setMessage(t.msgCodeError, true);
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
          ...buyerFields(newGiftCardBuyer),
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
          ...buyerFields(newGiftCardBuyer),
          expires_at: expiresAt,
        };

    const { data: createdCard, error } = await supabase
      .from('gift_cards')
      .insert(cardPayload)
      .select('id')
      .single();

    if (error) {
      setMessage(t.msgCreateError, true);
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
      setMessage(fillText(newGiftCardType === 'service_pass' ? t.msgPassCreated : t.msgCardCreated, { code }));
      setNewGiftCardAmount('50');
      setNewGiftCardEmail('');
      setNewGiftCardBuyer('');
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
        currencyCode: currency,
        language: language === 'de' ? 'de' : 'en',
      });
      setMessage(t.msgPdfDownloaded);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error downloading gift card:', error);
      setMessage(t.msgPdfError, true);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleEmailGiftCard = async (card: GiftCard) => {
    if (!card.purchased_for_email) {
      setMessage(t.msgNoRecipient, true);
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    try {
      setMessage(t.msgSending);
      
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
        setMessage(fillText(t.msgErrorDetail, { error: error.message }), true);
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      if (data?.error) {
        console.error('Email service error:', data.error);
        setMessage(fillText(t.msgErrorDetail, { error: String(data.error) }), true);
        setTimeout(() => setMessage(''), 5000);
        return;
      }

      setMessage(t.msgEmailSent);
      setTimeout(() => setMessage(''), 3000);
    } catch (error: any) {
      console.error('Error emailing gift card:', error);
      setMessage(fillText(t.msgEmailError, { error: error.message || t.unknownError }), true);
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

  const visibleCards = filterGiftCards(giftCards, cardQuery);
  const allVisibleSelected = visibleCards.length > 0 && visibleCards.every((card) => selectedCardIds.has(card.id));

  const toggleSelectAll = () => {
    setSelectedCardIds(allVisibleSelected ? new Set() : new Set(visibleCards.map((card) => card.id)));
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

      setMessage(idsToDelete.length === 1 ? t.msgDeletedOne : fillText(t.msgDeletedMany, { count: idsToDelete.length }));
      setSelectedCardIds(new Set());
      setShowDeleteConfirm(false);
      await loadGiftCards();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting gift cards:', error);
      setMessage(t.msgDeleteError, true);
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
          <h1 className="mb-1 text-2xl font-semibold tracking-tight text-[#1A1714]">{t.pageTitle}</h1>
          <p className="text-sm text-stone-500">{t.pageSubtitle}</p>
        </div>
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
            { id: 'manage' as const, label: t.tabGiftCards, icon: CreditCard },
            { id: 'orders' as const, label: t.tabOrders, icon: Gift },
            { id: 'pos' as const, label: t.tabPos, icon: DollarSign },
            { id: 'giftcards' as const, label: t.tabGiftSetup, icon: Gift },
            { id: 'loyalty' as const, label: t.tabLoyalty, icon: Award },
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
                <h2 className="font-semibold text-[#1A1714]">{t.pointsProgram}</h2>
                <p className="mt-1 max-w-xl text-sm text-stone-500">{t.pointsProgramHint}</p>
              </div>
            </div>
            <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-3">
              <span className="text-sm font-medium text-stone-600">{loyaltySettings.enabled ? t.enabled : t.disabled}</span>
              <input
                type="checkbox"
                checked={loyaltySettings.enabled}
                onChange={(event) => setLoyaltySettings({ ...loyaltySettings, enabled: event.target.checked })}
                className="peer sr-only"
                aria-label={t.enableLoyaltyAria}
              />
              <span className="relative h-6 w-11 rounded-full bg-stone-200 ring-1 ring-stone-900/[0.06] transition peer-focus-visible:ring-4 peer-focus-visible:ring-stone-900/10 peer-checked:bg-[#1A1714] peer-checked:after:translate-x-5 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition" />
            </label>
          </div>

          <div className="grid gap-6 p-6 lg:grid-cols-[1fr_320px]">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">{fillText(t.pointsPerSpent, { amount: `${currencySymbol}1` })}</span>
                <input
                  type="number"
                  min="0"
                  value={loyaltySettings.points_per_dollar_spent}
                  onChange={(event) => setLoyaltySettings({ ...loyaltySettings, points_per_dollar_spent: Number(event.target.value) || 0 })}
                  className={ADMIN_INPUT}
                />
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">{t.pointsPerSpentHint}</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">{fillText(t.pointsForReward, { amount: `${currencySymbol}1` })}</span>
                <input
                  type="number"
                  min="1"
                  value={loyaltySettings.points_redemption_value}
                  onChange={(event) => setLoyaltySettings({ ...loyaltySettings, points_redemption_value: Math.max(1, Number(event.target.value) || 1) })}
                  className={ADMIN_INPUT}
                />
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">{t.pointsForRewardHint}</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">{t.welcomeBonus}</span>
                <input
                  type="number"
                  min="0"
                  value={loyaltySettings.welcome_bonus_points}
                  onChange={(event) => setLoyaltySettings({ ...loyaltySettings, welcome_bonus_points: Number(event.target.value) || 0 })}
                  className={ADMIN_INPUT}
                />
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">{t.welcomeBonusHint}</span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">{t.pointsExpireAfter}</span>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    value={loyaltySettings.points_expiry_days || ''}
                    onChange={(event) => setLoyaltySettings({ ...loyaltySettings, points_expiry_days: event.target.value ? Number(event.target.value) : null })}
                    placeholder={t.never}
                    className={`${ADMIN_INPUT} pr-16`}
                  />
                  <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-stone-400">{t.days}</span>
                </div>
                <span className="mt-1.5 block text-xs leading-5 text-stone-400">{t.noExpiryHint}</span>
              </label>
            </div>

            <aside className="rounded-2xl bg-[#1A1714] p-5 text-white shadow-[0_12px_36px_rgba(26,23,20,0.16)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{t.customerExample}</p>
              <p className="mt-5 text-3xl font-semibold tracking-tight">
                {fillText(t.examplePoints, { count: 100 * loyaltySettings.points_per_dollar_spent })}
              </p>
              <p className="mt-1 text-sm leading-6 text-white/60">{fillText(t.exampleEarned, { amount: `${currencySymbol}100` })}</p>
              <div className="my-5 h-px bg-white/10" />
              <p className="text-sm text-white/70">
                {fillText(t.exampleUnlock, { points: loyaltySettings.points_redemption_value, amount: formatAmount(1) })}
              </p>
              {loyaltySettings.welcome_bonus_points > 0 && (
                <p className="mt-2 text-sm text-white/70">{fillText(t.exampleWelcome, { points: loyaltySettings.welcome_bonus_points })}</p>
              )}
            </aside>
          </div>

          <div className="flex justify-end border-t border-stone-200/70 bg-white/30 px-6 py-4">
            <button type="button" onClick={saveLoyaltySettings} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
              <Save className="h-4 w-4" />
              {saving ? t.saving : t.saveLoyalty}
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
                  <h2 className="font-semibold text-[#1A1714]">{t.giftRules}</h2>
                  <p className="mt-1 text-sm text-stone-500">{t.giftRulesHint}</p>
                </div>
              </div>
              <label className="relative inline-flex shrink-0 cursor-pointer items-center gap-3">
                <span className="text-sm font-medium text-stone-600">{giftCardSettings.enabled ? t.enabled : t.disabled}</span>
                <input
                  type="checkbox"
                  checked={giftCardSettings.enabled}
                  onChange={(e) => setGiftCardSettings({ ...giftCardSettings, enabled: e.target.checked })}
                  className="peer sr-only"
                  aria-label={t.enableGiftAria}
                />
                <span className="relative h-6 w-11 rounded-full bg-stone-200 ring-1 ring-stone-900/[0.06] transition peer-focus-visible:ring-4 peer-focus-visible:ring-stone-900/10 peer-checked:bg-[#1A1714] peer-checked:after:translate-x-5 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition" />
              </label>
            </div>

            <div className="space-y-8 p-6">
              <div>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700">{t.suggestedValues}</label>
                    <p className="mt-1 text-xs text-stone-400">{t.suggestedValuesHint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGiftCardSettings({
                      ...giftCardSettings,
                      preset_amounts_cents: [...giftCardSettings.preset_amounts_cents, 2500],
                    })}
                    className={ADMIN_SECONDARY_BUTTON}
                  >
                    <Plus className="h-4 w-4" /> {t.addValue}
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
                        aria-label={fillText(t.suggestedValueAria, { index: index + 1 })}
                      />
                      <button
                        type="button"
                        onClick={() => setGiftCardSettings({
                          ...giftCardSettings,
                          preset_amounts_cents: giftCardSettings.preset_amounts_cents.filter((_, itemIndex) => itemIndex !== index),
                        })}
                        className="rounded-lg p-2 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                        aria-label={fillText(t.removeValueAria, { amount: formatAmount(amount / 100) })}
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
                    <h3 className="text-sm font-semibold text-[#1A1714]">{t.customValue}</h3>
                    <p className="mt-1 text-xs text-stone-400">{t.customValueHint}</p>
                  </div>
                  <label className="relative inline-flex shrink-0 cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={giftCardSettings.allow_custom_amount}
                      onChange={(event) => setGiftCardSettings({ ...giftCardSettings, allow_custom_amount: event.target.checked })}
                      className="peer sr-only"
                      aria-label={t.allowCustomAria}
                    />
                    <span className="relative h-6 w-11 rounded-full bg-stone-200 ring-1 ring-stone-900/[0.06] transition peer-checked:bg-[#1A1714] peer-checked:after:translate-x-5 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition" />
                  </label>
                </div>

                {giftCardSettings.allow_custom_amount && (
                  <div className="mt-5 grid gap-4 border-t border-stone-200/70 pt-5 sm:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">{fillText(t.minimum, { symbol: currencySymbol })}</span>
                      <input
                        type="number"
                        value={giftCardSettings.min_custom_amount_cents / 100}
                        onChange={(event) => setGiftCardSettings({ ...giftCardSettings, min_custom_amount_cents: Math.round((Number(event.target.value) || 0) * 100) })}
                        className={ADMIN_INPUT}
                        min="1"
                      />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">{fillText(t.maximum, { symbol: currencySymbol })}</span>
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
                  <span className="mb-2 block text-sm font-medium text-stone-700">{t.expiry}</span>
                  <input
                    type="number"
                    value={giftCardSettings.expiry_days || ''}
                    onChange={(event) => setGiftCardSettings({ ...giftCardSettings, expiry_days: event.target.value ? Number(event.target.value) : null })}
                    className={ADMIN_INPUT}
                    placeholder={t.neverExpires}
                    min="1"
                  />
                  <span className="mt-1.5 block text-xs text-stone-400">{t.expiryHint}</span>
                </label>
                <div>
                  <span className="mb-2 block text-sm font-medium text-stone-700">{t.codeFormat}</span>
                  <p className="mb-3 text-xs text-stone-400">{t.codeFormatHint}</p>
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
                        <span className="block text-sm font-medium">{t[option.labelKey]}</span>
                        <span className={`mt-1 block font-mono text-xs ${giftCardSettings.code_format === option.value ? 'text-white/55' : 'text-stone-400'}`}>{option.example}</span>
                      </label>
                    ))}
                  </div>

                  {giftCardSettings.code_format === 'prefix_numeric' && (
                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-medium text-stone-700">{t.codePrefix}</span>
                      <input
                        type="text"
                        value={giftCardSettings.code_prefix || ''}
                        onChange={(event) => setGiftCardSettings({ ...giftCardSettings, code_prefix: event.target.value.toUpperCase().slice(0, 10) })}
                        placeholder="SPA"
                        className={ADMIN_INPUT}
                      />
                      <span className="mt-1.5 block text-xs text-stone-400">{fillText(t.codePreview, { code: `${(giftCardSettings.code_prefix || 'GC').toUpperCase()}-483921` })}</span>
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-stone-200/70 bg-white/30 px-6 py-4">
              <button type="button" onClick={saveGiftCardSettings} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
                <Save className="h-4 w-4" />
                {saving ? t.saving : t.saveGiftRules}
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
                    <h2 className="font-semibold text-[#1A1714]">{t.servicePasses}</h2>
                    <span className={`${ADMIN_STATUS_PILL} bg-violet-50 text-violet-700`}>{t.visitBased}</span>
                  </div>
                  <p className="mt-1 max-w-2xl text-sm text-stone-500">
                    {t.servicePassesHint}
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-stone-200/70 bg-white/55 px-4 py-3 text-xs leading-5 text-stone-500">
                {t.redemptionNote1}<br />{t.redemptionNote2}
              </div>
            </div>

            <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(380px,0.95fr)]">
              <div>
                <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">{t.customerShop}</p>
                {servicePassOffers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stone-300/80 bg-white/35 px-6 py-10 text-center">
                    <Package className="mx-auto h-7 w-7 text-stone-300" strokeWidth={1.5} />
                    <p className="mt-3 text-sm font-medium text-stone-700">{t.noPassesYet}</p>
                    <p className="mt-1 text-xs text-stone-400">{t.noPassesHint}</p>
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
                                  {offer.is_active ? t.forSale : t.paused}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-stone-500">
                                {service?.name || t.serviceFallback} · {fillText(t.minutes, { count: duration?.duration_minutes || '—' })}
                              </p>
                              {offer.description && <p className="mt-2 text-xs leading-5 text-stone-400">{offer.description}</p>}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-lg font-semibold tracking-tight text-[#1A1714]">{formatAmount(offer.price_cents / 100)}</p>
                              <p className="text-xs text-stone-400">{offer.visit_count === 1 ? t.visitOne : fillText(t.visitMany, { count: offer.visit_count })}</p>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200/60 pt-3">
                            <div className="flex items-center gap-1.5 text-xs text-stone-400">
                              <Clock className="h-3.5 w-3.5" />
                              {offer.expiry_days ? fillText(t.passExpires, { days: offer.expiry_days }) : t.passDefaultExpiry}
                            </div>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => toggleServicePassOffer(offer)} className={ADMIN_TERTIARY_BUTTON}>
                                {offer.is_active ? t.pause : t.resume}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteServicePassOffer(offer.id)}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                                aria-label={fillText(t.deleteAria, { name: offer.name })}
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
                  <h3 className="font-semibold text-[#1A1714]">{t.createPass}</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-400">{t.createPassHint}</p>
                </div>
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-stone-700">{t.passName}</span>
                    <input
                      type="text"
                      value={newServicePass.name}
                      onChange={(event) => setNewServicePass({ ...newServicePass, name: event.target.value })}
                      className={ADMIN_INPUT}
                      placeholder={t.passNamePlaceholder}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">{t.service}</span>
                      <select
                        value={newServicePass.service_id}
                        onChange={(event) => setNewServicePass({ ...newServicePass, service_id: event.target.value, duration_id: '' })}
                        className={ADMIN_INPUT}
                      >
                        <option value="">{t.chooseService}</option>
                        {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">{t.duration}</span>
                      <select
                        value={newServicePass.duration_id}
                        onChange={(event) => setNewServicePass({ ...newServicePass, duration_id: event.target.value })}
                        className={ADMIN_INPUT}
                        disabled={!newServicePass.service_id}
                      >
                        <option value="">{t.chooseDuration}</option>
                        {durations
                          .filter((duration) => duration.service_id === newServicePass.service_id)
                          .map((duration) => (
                            <option key={duration.id} value={duration.id}>
                              {fillText(t.durationOption, { minutes: duration.duration_minutes, amount: formatAmount(duration.price_cents / 100) })}
                            </option>
                          ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">{t.visits}</span>
                      <input type="number" min="1" max="100" step="1" value={newServicePass.visit_count} onChange={(event) => setNewServicePass({ ...newServicePass, visit_count: event.target.value })} className={ADMIN_INPUT} />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">{fillText(t.salePrice, { symbol: currencySymbol })}</span>
                      <input type="number" min="0.01" step="0.01" value={newServicePass.price} onChange={(event) => setNewServicePass({ ...newServicePass, price: event.target.value })} className={ADMIN_INPUT} placeholder="250.00" />
                    </label>
                    <label>
                      <span className="mb-2 block text-sm font-medium text-stone-700">{t.expiryDays}</span>
                      <input type="number" min="1" step="1" value={newServicePass.expiry_days} onChange={(event) => setNewServicePass({ ...newServicePass, expiry_days: event.target.value })} className={ADMIN_INPUT} placeholder={t.defaultPlaceholder} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-stone-700">{t.customerDescription} <span className="font-normal text-stone-400">{t.optional}</span></span>
                    <textarea value={newServicePass.description} onChange={(event) => setNewServicePass({ ...newServicePass, description: event.target.value })} rows={2} className={`${ADMIN_INPUT} resize-y`} placeholder={t.descriptionPlaceholder} />
                  </label>
                  <button type="button" onClick={createServicePassOffer} disabled={savingServicePass} className={`${ADMIN_PRIMARY_BUTTON} w-full`}>
                    <Plus className="h-4 w-4" />
                    {savingServicePass ? t.creating : t.addPass}
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
                <h2 className="font-semibold text-[#1A1714]">{t.pdfDesign}</h2>
                <p className="mt-1 text-sm text-stone-500">{t.pdfDesignHint}</p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
              <div>
                <label className="mb-2 block text-sm font-medium text-stone-700">{t.artwork}</label>
                <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-stone-900/[0.025]">
                  {giftCardSettings.design_url ? (
                    <img src={giftCardSettings.design_url} alt={t.artworkAlt} className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[3/4] flex-col items-center justify-center px-6 text-center">
                      <ImageIcon className="h-7 w-7 text-stone-300" strokeWidth={1.5} />
                      <p className="mt-3 text-sm font-medium text-stone-600">{t.noArtwork}</p>
                      <p className="mt-1 text-xs leading-5 text-stone-400">{t.artworkHint}</p>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex gap-2">
                  <label className={`${ADMIN_SECONDARY_BUTTON} flex-1 cursor-pointer`}>
                    <Upload className="h-4 w-4" />
                    {uploadingDesign ? t.reading : t.chooseImage}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;

                        if (file.size > 5 * 1024 * 1024) {
                          setMessage(t.msgArtworkTooLarge, true);
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
                            setMessage(t.msgArtworkReadError, true);
                            setUploadingDesign(false);
                          };
                          reader.readAsDataURL(file);
                        } catch (error) {
                          console.error('Error uploading design:', error);
                          setMessage(t.msgArtworkReadError, true);
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
                      aria-label={t.removeArtwork}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">{t.terms}</span>
                <textarea
                  value={giftCardSettings.terms_and_conditions || ''}
                  onChange={(event) => setGiftCardSettings({ ...giftCardSettings, terms_and_conditions: event.target.value })}
                  rows={11}
                  className={`${ADMIN_INPUT} resize-y leading-6`}
                  placeholder={t.termsPlaceholder}
                />
                <span className="mt-1.5 block text-xs text-stone-400">{t.termsHint}</span>
              </label>
            </div>

            <div className="mt-6 flex justify-end border-t border-stone-200/70 pt-5">
              <button type="button" onClick={saveGiftCardSettings} disabled={saving} className={ADMIN_PRIMARY_BUTTON}>
                <Save className="h-4 w-4" />
                {saving ? t.saving : t.savePdf}
              </button>
            </div>
          </section>

          <GiftCardPromoSettings />
        </div>
      )}

      {activeTab === 'manage' && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: t.activeCodes, value: activeGiftCards.toString(), note: fillText(t.totalIssued, { count: giftCards.length }) },
              { label: t.outstandingBalance, value: formatAmount(outstandingBalance / 100), note: t.outstandingBalanceNote },
              { label: t.passVisitsRemaining, value: outstandingVisits.toString(), note: t.passVisitsNote },
              { label: t.lifetimeSales, value: formatAmount(issuedValue / 100), note: t.lifetimeSalesNote },
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
                <h2 className="font-semibold text-[#1A1714]">{t.issueHeading}</h2>
                <p className="mt-1 text-sm text-stone-500">{t.issueHint}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className={ADMIN_SECONDARY_BUTTON}
              >
                <Upload className="h-4 w-4" /> {t.importCsv}
              </button>
            </div>

            <div className="mt-5 flex w-fit rounded-xl bg-stone-900/[0.045] p-1">
              {([
                ['value', t.valueCard],
                ['service_pass', t.servicePass],
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
                  <span className="mb-2 block text-sm font-medium text-stone-700">{fillText(t.amount, { symbol: currencySymbol })}</span>
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
                  <span className="mb-2 block text-sm font-medium text-stone-700">{t.passOffer}</span>
                  <select value={newServicePassOfferId} onChange={(event) => setNewServicePassOfferId(event.target.value)} className={ADMIN_INPUT}>
                    <option value="">{t.chooseAPass}</option>
                    {servicePassOffers.filter((offer) => offer.is_active).map((offer) => (
                      <option key={offer.id} value={offer.id}>{offer.name} · {formatAmount(offer.price_cents / 100)}</option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span className="mb-2 block text-sm font-medium text-stone-700">{t.buyer}</span>
                <input value={newGiftCardBuyer} onChange={(event) => setNewGiftCardBuyer(event.target.value)} className={ADMIN_INPUT} placeholder={t.buyerPlaceholder} maxLength={200} />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-stone-700">{t.recipientEmail}</span>
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
                {creatingGiftCard ? t.creating : newGiftCardType === 'service_pass' ? t.issuePass : t.createCard}
              </button>
            </div>
          </section>

          <section className={`${ADMIN_SURFACE} overflow-hidden`}>
            <div className="flex flex-col justify-between gap-4 border-b border-stone-200/70 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-[#1A1714]">{t.allCards}</h2>
                <p className="mt-1 text-xs text-stone-400">{t.allCardsHint}</p>
              </div>
              <label className="relative w-full sm:ml-auto sm:w-72">
                <span className="sr-only">{t.searchCards}</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
                <input type="search" value={cardQuery} onChange={(event) => setCardQuery(event.target.value)} placeholder={t.searchCards} className={`${ADMIN_INPUT} pl-10`} />
              </label>
              {selectedCardIds.size > 0 && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
                >
                  <Trash2 className="h-4 w-4" /> {fillText(t.deleteSelected, { count: selectedCardIds.size })}
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
                        aria-label={allVisibleSelected ? t.deselectAll : t.selectAll}
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="h-4 w-4 text-[#1A1714]" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </th>
                    {[t.colCode, t.colProduct, t.colSoldFor, t.colRemaining, t.colStatus, t.colPurchased, t.colBuyer, t.colRecipient, ''].map((heading, index) => (
                      <th key={index} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 last:text-right">{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/60">
                  {giftCards.length > 0 && visibleCards.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-sm text-stone-500">{fillText(t.noMatch, { query: cardQuery.trim() })}</td>
                    </tr>
                  ) : giftCards.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-14 text-center">
                        <Gift className="mx-auto h-6 w-6 text-stone-300" strokeWidth={1.5} />
                        <p className="mt-3 text-sm font-medium text-stone-600">{t.noCards}</p>
                        <p className="mt-1 text-xs text-stone-400">{t.noCardsHint}</p>
                      </td>
                    </tr>
                  ) : (
                    visibleCards.map((card) => (
                      <tr key={card.id} className={`transition-colors hover:bg-white/60 ${selectedCardIds.has(card.id) ? 'bg-stone-900/[0.035]' : ''}`}>
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => toggleSelectCard(card.id)}
                            className="rounded-lg p-1 text-stone-400 transition hover:bg-stone-900/[0.05] hover:text-[#1A1714]"
                            aria-label={fillText(selectedCardIds.has(card.id) ? t.deselectCard : t.selectCard, { code: card.code })}
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
                          <span className="text-sm font-medium text-[#1A1714]">{card.card_type === 'service_pass' ? card.service_pass_name || t.servicePass : t.valueCard}</span>
                          {card.card_type === 'service_pass' && <span className="mt-0.5 block text-xs text-stone-400">{card.original_visits === 1 ? t.visitOne : fillText(t.visitMany, { count: card.original_visits ?? 0 })}</span>}
                        </td>
                        <td className="px-4 py-3.5 text-sm text-stone-600">{formatAmount((card.purchase_price_cents ?? card.original_value_cents) / 100)}</td>
                        <td className="px-4 py-3.5 text-sm font-medium text-[#1A1714]">
                          {card.card_type === 'service_pass'
                            ? (card.remaining_visits === 1 ? t.visitOne : fillText(t.visitMany, { count: card.remaining_visits || 0 }))
                            : formatAmount(card.current_balance_cents / 100)}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`${ADMIN_STATUS_PILL} ${
                            card.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                            card.status === 'fully_redeemed' ? 'bg-stone-900/[0.05] text-stone-600' :
                            card.status === 'pending_payment' ? 'bg-amber-50 text-amber-800' :
                            'bg-red-50 text-red-700'
                          }`}>
                            {STATUS_KEYS[card.status] ? t[STATUS_KEYS[card.status]] : card.status.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-sm text-stone-500">
                          {new Date(card.purchased_at).toLocaleDateString(locale)}
                        </td>
                        <td className="max-w-[200px] px-4 py-3.5 text-sm text-stone-600">
                          {card.purchased_by_name || card.purchased_by_email ? (
                            <>
                              {card.purchased_by_name && <span className="block truncate font-medium text-stone-700">{card.purchased_by_name}</span>}
                              {card.purchased_by_email && <span className="block truncate text-xs text-stone-500">{card.purchased_by_email}</span>}
                            </>
                          ) : <span className="text-stone-400">–</span>}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-3.5 text-sm text-stone-500">
                          {card.purchased_for_email || '–'}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedGiftCard(card)}
                              className={ADMIN_TERTIARY_BUTTON}
                              title={t.viewDetails}
                              aria-label={fillText(t.viewAria, { code: card.code })}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadGiftCard(card)}
                              className={ADMIN_TERTIARY_BUTTON}
                              title={t.downloadPdf}
                              aria-label={fillText(t.downloadAria, { code: card.code })}
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            {card.purchased_for_email && (
                              <button
                                type="button"
                                onClick={() => handleEmailGiftCard(card)}
                                className={ADMIN_TERTIARY_BUTTON}
                                title={t.emailRecipient}
                                aria-label={fillText(t.emailAria, { code: card.code })}
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

      {activeTab === 'orders' && (
        <GiftCardOrdersPanel
          businessName={businessName}
          designUrl={giftCardSettings.design_url}
          termsAndConditions={giftCardSettings.terms_and_conditions}
        />
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
                <h3 id="delete-gift-cards-title" className="font-semibold text-[#1A1714]">{t.deleteTitle}</h3>
                <p className="mt-1 text-sm text-stone-500">{selectedCardIds.size === 1 ? t.deleteBodyOne : fillText(t.deleteBodyMany, { count: selectedCardIds.size })}</p>
              </div>
            </div>
            <div className="rounded-xl border border-red-200/80 bg-red-50/70 p-3 text-sm text-red-700">{t.cannotUndo}</div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className={ADMIN_SECONDARY_BUTTON}
              >
                {t.cancel}
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
                    {t.deleting}
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    {fillText(t.deleteCount, { count: selectedCardIds.size })}
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
