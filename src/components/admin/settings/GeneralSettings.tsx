import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, AlertCircle, DollarSign, Crown, Image, ToggleLeft } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { usePremiumFeatures } from '../../../hooks/usePremiumFeatures';
import { CURRENCY_NAMES, CURRENCY_SYMBOLS } from '../../../lib/currency';
import { useCurrency } from '../../../lib/currencyContext';
import { BRAND_FAVICON, BRAND_LOGO, BRAND_NAME } from '../../../lib/brand';
import { adminAccessToken } from '../../../lib/functionAuth';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  upgradeFailed: string; logoPro: string; fileTooLarge: string; logoUploaded: string; logoUploadFailed: string;
  loginLogoUploaded: string; loginLogoUploadFailed: string; logoRemoved: string; logoRemoveFailed: string;
  loginLogoReset: string; loginLogoRemoveFailed: string; faviconPro: string; faviconTooLarge: string;
  faviconType: string; faviconUploaded: string; faviconUploadFailed: string; faviconRemoved: string;
  faviconRemoveFailed: string; ogPro: string; ogTooLarge: string; ogType: string; ogUploaded: string;
  imageUploadFailed: string; ogRemoved: string; imageRemoveFailed: string; saved: string; saveFailed: string;
  loading: string; notFound: string; proPlan: string; proPlanBody: string; standardPlan: string; standardLimits: string;
  standardUsage: string; businessInfo: string; businessName: string; brandLogo: string; uploadingLogo: string;
  brandLogoUpsell: string; logoPreview: string; resetDefault: string; brandLogoHelp: string; defaultLogoInUse: string;
  loginLogo: string; uploadingLoginLogo: string; loginLogoUpsell: string; processing: string; upgradeNow: string;
  loginLogoPreview: string; defaultLoginLogoAlt: string; defaultLogoLabel: string; loginLogoHelp: string;
  defaultLoginLogoInUse: string; currencySettings: string; currency: string; currencyHelp: string;
  featureToggles: string; enableBookings: string; enableBookingsHelp: string; enableGiftCards: string;
  enableGiftCardsHelp: string; bothDisabled: string; bothDisabledHelp: string; proFeatures: string;
  proOnly: string; hideBadge: string; hideBadgeHelp: string; customBranding: string; customBrandingHelp: string;
  pageTitle: string; pageTitlePlaceholder: string; pageTitleHelp: string; metaDescription: string;
  metaPlaceholder: string; metaHelp: string; favicon: string; faviconPreview: string; uploading: string;
  uploadFavicon: string; remove: string; faviconHint: string; ogImage: string; ogHelp: string; ogPreview: string;
  noImage: string; uploadImage: string; ogHint: string; saving: string; save: string;
}> = {
  en: {
    upgradeFailed: 'Failed to start upgrade process. Please try again or contact support.',
    logoPro: 'Custom logo upload is a Pro feature. Please upgrade to continue.',
    fileTooLarge: 'File size must be less than 2MB',
    logoUploaded: 'Logo uploaded successfully!', logoUploadFailed: 'Failed to upload logo. Please try again.',
    loginLogoUploaded: 'Login page logo uploaded successfully!', loginLogoUploadFailed: 'Failed to upload login logo. Please try again.',
    logoRemoved: 'Logo removed successfully!', logoRemoveFailed: 'Failed to remove logo. Please try again.',
    loginLogoReset: 'Login page logo reset to default!', loginLogoRemoveFailed: 'Failed to remove login logo. Please try again.',
    faviconPro: 'Custom favicon is a Pro feature. Please upgrade to continue.', faviconTooLarge: 'Favicon must be less than 500KB',
    faviconType: 'Please upload an image file (PNG, ICO, or SVG recommended)', faviconUploaded: 'Favicon uploaded successfully!',
    faviconUploadFailed: 'Failed to upload favicon. Please try again.', faviconRemoved: 'Favicon removed - will use the default {brand} icon',
    faviconRemoveFailed: 'Failed to remove favicon. Please try again.',
    ogPro: 'Custom social preview image is a Pro feature. Please upgrade to continue.',
    ogTooLarge: 'Social preview image must be less than 2MB', ogType: 'Please upload an image file (PNG or JPG recommended)',
    ogUploaded: 'Social preview image uploaded successfully!', imageUploadFailed: 'Failed to upload image. Please try again.',
    ogRemoved: 'Social preview image removed - will use default', imageRemoveFailed: 'Failed to remove image. Please try again.',
    saved: 'Settings saved successfully!', saveFailed: 'Failed to save settings. Please check the console for details.',
    loading: 'Loading...', notFound: 'Business not found', proPlan: 'Pro Plan', proPlanBody: 'You have access to all Pro features',
    standardPlan: 'Standard Plan', standardLimits: 'Limited to {staff} staff and {services} services',
    standardUsage: 'Currently using: {staff} staff, {services} services', businessInfo: 'Business Information',
    businessName: 'Business Name', brandLogo: 'Custom Brand Logo', uploadingLogo: 'Uploading logo...',
    brandLogoUpsell: 'Upgrade to Pro to upload your custom brand logo', logoPreview: 'Logo preview', resetDefault: 'Reset to Default',
    brandLogoHelp: 'Upload a custom logo for your brand (PNG, JPG, max 2MB) - shown in admin panel',
    defaultLogoInUse: 'Using default {brand} logo', loginLogo: 'Admin Login Page Logo', uploadingLoginLogo: 'Uploading login logo...',
    loginLogoUpsell: 'Upgrade to Pro to customize your login page logo', processing: 'Processing...', upgradeNow: 'Upgrade Now →',
    loginLogoPreview: 'Login logo preview', defaultLoginLogoAlt: 'Default login logo', defaultLogoLabel: 'Default {brand} logo',
    loginLogoHelp: 'Upload a logo specifically for your admin login page (PNG, JPG, max 2MB)',
    defaultLoginLogoInUse: 'Using default {brand} logo on login page', currencySettings: 'Currency Settings', currency: 'Currency',
    currencyHelp: 'This currency will be used throughout your booking system', featureToggles: 'Feature Toggles',
    enableBookings: 'Enable Booking Services', enableBookingsHelp: 'Allow customers to book appointments through your booking form',
    enableGiftCards: 'Enable Gift Card Sales', enableGiftCardsHelp: 'Allow customers to purchase gift cards through your booking form',
    bothDisabled: 'Warning: Both features are disabled',
    bothDisabledHelp: 'At least one feature should be enabled for your booking form to function properly.',
    proFeatures: 'Pro Features', proOnly: 'This is a Pro feature. Please upgrade to continue.',
    hideBadge: 'Hide "Powered by {brand}" badge', hideBadgeHelp: 'Remove the {brand} branding from your booking pages',
    customBranding: 'Custom Branding',
    customBrandingHelp: 'Customize the page title, favicon, and social media preview for your booking pages when using a custom domain.',
    pageTitle: 'Page Title (Browser Tab)', pageTitlePlaceholder: 'Your Business Name',
    pageTitleHelp: 'This will appear in the browser tab when customers visit your booking page',
    metaDescription: 'Meta Description (SEO & Social Preview)',
    metaPlaceholder: 'Book your appointment easily and manage your schedule with our online booking system.',
    metaHelp: 'This description appears when your link is shared on social media (WhatsApp, Facebook, etc.)',
    favicon: 'Favicon (Browser Tab Icon)', faviconPreview: 'Favicon preview', uploading: 'Uploading...', uploadFavicon: 'Upload Favicon',
    remove: 'Remove', faviconHint: 'Recommended: 32x32px or 64x64px PNG. Max 500KB.', ogImage: 'Social Preview Image',
    ogHelp: 'This image appears when your link is shared on WhatsApp, Facebook, Twitter, etc.', ogPreview: 'Social preview',
    noImage: 'No image uploaded', uploadImage: 'Upload Image', ogHint: 'Recommended: 1200x630px PNG or JPG. Max 2MB.',
    saving: 'Saving...', save: 'Save Changes',
  },
  de: {
    upgradeFailed: 'Upgrade konnte nicht gestartet werden. Bitte erneut versuchen oder den Support kontaktieren.',
    logoPro: 'Eigenes Logo ist eine Pro-Funktion. Bitte upgraden, um fortzufahren.',
    fileTooLarge: 'Die Datei muss kleiner als 2 MB sein',
    logoUploaded: 'Logo hochgeladen.', logoUploadFailed: 'Logo konnte nicht hochgeladen werden. Bitte erneut versuchen.',
    loginLogoUploaded: 'Logo der Login-Seite hochgeladen.', loginLogoUploadFailed: 'Login-Logo konnte nicht hochgeladen werden. Bitte erneut versuchen.',
    logoRemoved: 'Logo entfernt.', logoRemoveFailed: 'Logo konnte nicht entfernt werden. Bitte erneut versuchen.',
    loginLogoReset: 'Logo der Login-Seite auf Standard zurückgesetzt.', loginLogoRemoveFailed: 'Login-Logo konnte nicht entfernt werden. Bitte erneut versuchen.',
    faviconPro: 'Eigenes Favicon ist eine Pro-Funktion. Bitte upgraden, um fortzufahren.', faviconTooLarge: 'Das Favicon muss kleiner als 500 KB sein',
    faviconType: 'Bitte eine Bilddatei hochladen (empfohlen: PNG, ICO oder SVG)', faviconUploaded: 'Favicon hochgeladen.',
    faviconUploadFailed: 'Favicon konnte nicht hochgeladen werden. Bitte erneut versuchen.', faviconRemoved: 'Favicon entfernt – das Standard-Icon von {brand} wird verwendet',
    faviconRemoveFailed: 'Favicon konnte nicht entfernt werden. Bitte erneut versuchen.',
    ogPro: 'Eigenes Vorschaubild ist eine Pro-Funktion. Bitte upgraden, um fortzufahren.',
    ogTooLarge: 'Das Vorschaubild muss kleiner als 2 MB sein', ogType: 'Bitte eine Bilddatei hochladen (empfohlen: PNG oder JPG)',
    ogUploaded: 'Vorschaubild hochgeladen.', imageUploadFailed: 'Bild konnte nicht hochgeladen werden. Bitte erneut versuchen.',
    ogRemoved: 'Vorschaubild entfernt – der Standard wird verwendet', imageRemoveFailed: 'Bild konnte nicht entfernt werden. Bitte erneut versuchen.',
    saved: 'Einstellungen gespeichert.', saveFailed: 'Einstellungen konnten nicht gespeichert werden. Details in der Konsole.',
    loading: 'Wird geladen…', notFound: 'Unternehmen nicht gefunden', proPlan: 'Pro-Tarif', proPlanBody: 'Sie haben Zugriff auf alle Pro-Funktionen',
    standardPlan: 'Standard-Tarif', standardLimits: 'Begrenzt auf {staff} Mitarbeitende und {services} Leistungen',
    standardUsage: 'Aktuell genutzt: {staff} Mitarbeitende, {services} Leistungen', businessInfo: 'Unternehmensdaten',
    businessName: 'Name des Unternehmens', brandLogo: 'Eigenes Markenlogo', uploadingLogo: 'Logo wird hochgeladen…',
    brandLogoUpsell: 'Mit Pro können Sie Ihr eigenes Markenlogo hochladen', logoPreview: 'Logo-Vorschau', resetDefault: 'Auf Standard zurücksetzen',
    brandLogoHelp: 'Eigenes Logo für Ihre Marke hochladen (PNG, JPG, max. 2 MB) – wird im Admin-Bereich angezeigt',
    defaultLogoInUse: 'Standard-Logo von {brand} wird verwendet', loginLogo: 'Logo der Admin-Login-Seite', uploadingLoginLogo: 'Login-Logo wird hochgeladen…',
    loginLogoUpsell: 'Mit Pro können Sie das Logo der Login-Seite anpassen', processing: 'Wird verarbeitet…', upgradeNow: 'Jetzt upgraden →',
    loginLogoPreview: 'Vorschau Login-Logo', defaultLoginLogoAlt: 'Standard-Login-Logo', defaultLogoLabel: 'Standard-Logo von {brand}',
    loginLogoHelp: 'Eigenes Logo für Ihre Admin-Login-Seite hochladen (PNG, JPG, max. 2 MB)',
    defaultLoginLogoInUse: 'Standard-Logo von {brand} auf der Login-Seite', currencySettings: 'Währung', currency: 'Währung',
    currencyHelp: 'Diese Währung wird im gesamten Buchungssystem verwendet', featureToggles: 'Funktionen',
    enableBookings: 'Buchungen aktivieren', enableBookingsHelp: 'Kunden können über Ihr Buchungsformular Termine buchen',
    enableGiftCards: 'Gutscheinverkauf aktivieren', enableGiftCardsHelp: 'Kunden können über Ihr Buchungsformular Gutscheine kaufen',
    bothDisabled: 'Achtung: Beide Funktionen sind deaktiviert',
    bothDisabledHelp: 'Mindestens eine Funktion sollte aktiv sein, damit Ihr Buchungsformular funktioniert.',
    proFeatures: 'Pro-Funktionen', proOnly: 'Dies ist eine Pro-Funktion. Bitte upgraden, um fortzufahren.',
    hideBadge: 'Hinweis „Powered by {brand}“ ausblenden', hideBadgeHelp: 'Das {brand}-Branding von Ihren Buchungsseiten entfernen',
    customBranding: 'Eigenes Branding',
    customBrandingHelp: 'Seitentitel, Favicon und Social-Media-Vorschau Ihrer Buchungsseiten bei eigener Domain anpassen.',
    pageTitle: 'Seitentitel (Browser-Tab)', pageTitlePlaceholder: 'Name Ihres Unternehmens',
    pageTitleHelp: 'Erscheint im Browser-Tab, wenn Kunden Ihre Buchungsseite besuchen',
    metaDescription: 'Meta-Beschreibung (SEO & Social-Vorschau)',
    metaPlaceholder: 'Termine bequem online buchen und verwalten.',
    metaHelp: 'Diese Beschreibung erscheint, wenn Ihr Link in sozialen Medien geteilt wird (WhatsApp, Facebook usw.)',
    favicon: 'Favicon (Browser-Tab-Icon)', faviconPreview: 'Favicon-Vorschau', uploading: 'Wird hochgeladen…', uploadFavicon: 'Favicon hochladen',
    remove: 'Entfernen', faviconHint: 'Empfohlen: PNG mit 32×32 px oder 64×64 px. Max. 500 KB.', ogImage: 'Vorschaubild für soziale Medien',
    ogHelp: 'Dieses Bild erscheint, wenn Ihr Link auf WhatsApp, Facebook, Twitter usw. geteilt wird.', ogPreview: 'Social-Vorschau',
    noImage: 'Kein Bild hochgeladen', uploadImage: 'Bild hochladen', ogHint: 'Empfohlen: PNG oder JPG mit 1200×630 px. Max. 2 MB.',
    saving: 'Wird gespeichert…', save: 'Änderungen speichern',
  },
  th: {
    upgradeFailed: 'เริ่มการอัปเกรดไม่สำเร็จ กรุณาลองอีกครั้งหรือติดต่อฝ่ายสนับสนุน',
    logoPro: 'การอัปโหลดโลโก้เองเป็นฟีเจอร์ Pro กรุณาอัปเกรดเพื่อใช้งาน',
    fileTooLarge: 'ไฟล์ต้องมีขนาดไม่เกิน 2MB',
    logoUploaded: 'อัปโหลดโลโก้แล้ว', logoUploadFailed: 'อัปโหลดโลโก้ไม่สำเร็จ กรุณาลองอีกครั้ง',
    loginLogoUploaded: 'อัปโหลดโลโก้หน้าเข้าสู่ระบบแล้ว', loginLogoUploadFailed: 'อัปโหลดโลโก้หน้าเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง',
    logoRemoved: 'ลบโลโก้แล้ว', logoRemoveFailed: 'ลบโลโก้ไม่สำเร็จ กรุณาลองอีกครั้ง',
    loginLogoReset: 'รีเซ็ตโลโก้หน้าเข้าสู่ระบบเป็นค่าเริ่มต้นแล้ว', loginLogoRemoveFailed: 'ลบโลโก้หน้าเข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง',
    faviconPro: 'Favicon แบบกำหนดเองเป็นฟีเจอร์ Pro กรุณาอัปเกรดเพื่อใช้งาน', faviconTooLarge: 'Favicon ต้องมีขนาดไม่เกิน 500KB',
    faviconType: 'กรุณาอัปโหลดไฟล์รูปภาพ (แนะนำ PNG, ICO หรือ SVG)', faviconUploaded: 'อัปโหลด Favicon แล้ว',
    faviconUploadFailed: 'อัปโหลด Favicon ไม่สำเร็จ กรุณาลองอีกครั้ง', faviconRemoved: 'ลบ Favicon แล้ว จะใช้ไอคอนเริ่มต้นของ {brand}',
    faviconRemoveFailed: 'ลบ Favicon ไม่สำเร็จ กรุณาลองอีกครั้ง',
    ogPro: 'รูปพรีวิวโซเชียลแบบกำหนดเองเป็นฟีเจอร์ Pro กรุณาอัปเกรดเพื่อใช้งาน',
    ogTooLarge: 'รูปพรีวิวโซเชียลต้องมีขนาดไม่เกิน 2MB', ogType: 'กรุณาอัปโหลดไฟล์รูปภาพ (แนะนำ PNG หรือ JPG)',
    ogUploaded: 'อัปโหลดรูปพรีวิวโซเชียลแล้ว', imageUploadFailed: 'อัปโหลดรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
    ogRemoved: 'ลบรูปพรีวิวโซเชียลแล้ว จะใช้รูปเริ่มต้น', imageRemoveFailed: 'ลบรูปไม่สำเร็จ กรุณาลองอีกครั้ง',
    saved: 'บันทึกการตั้งค่าแล้ว', saveFailed: 'บันทึกการตั้งค่าไม่สำเร็จ ดูรายละเอียดในคอนโซล',
    loading: 'กำลังโหลด…', notFound: 'ไม่พบธุรกิจ', proPlan: 'แพ็กเกจ Pro', proPlanBody: 'คุณใช้ฟีเจอร์ Pro ได้ทั้งหมด',
    standardPlan: 'แพ็กเกจ Standard', standardLimits: 'จำกัดพนักงาน {staff} คน และบริการ {services} รายการ',
    standardUsage: 'ใช้งานอยู่: พนักงาน {staff} คน, บริการ {services} รายการ', businessInfo: 'ข้อมูลธุรกิจ',
    businessName: 'ชื่อธุรกิจ', brandLogo: 'โลโก้แบรนด์', uploadingLogo: 'กำลังอัปโหลดโลโก้…',
    brandLogoUpsell: 'อัปเกรดเป็น Pro เพื่ออัปโหลดโลโก้แบรนด์ของคุณ', logoPreview: 'ตัวอย่างโลโก้', resetDefault: 'คืนค่าเริ่มต้น',
    brandLogoHelp: 'อัปโหลดโลโก้แบรนด์ (PNG, JPG ไม่เกิน 2MB) แสดงในหน้าผู้ดูแล',
    defaultLogoInUse: 'ใช้โลโก้เริ่มต้นของ {brand}', loginLogo: 'โลโก้หน้าเข้าสู่ระบบผู้ดูแล', uploadingLoginLogo: 'กำลังอัปโหลดโลโก้หน้าเข้าสู่ระบบ…',
    loginLogoUpsell: 'อัปเกรดเป็น Pro เพื่อเปลี่ยนโลโก้หน้าเข้าสู่ระบบ', processing: 'กำลังดำเนินการ…', upgradeNow: 'อัปเกรดเลย →',
    loginLogoPreview: 'ตัวอย่างโลโก้หน้าเข้าสู่ระบบ', defaultLoginLogoAlt: 'โลโก้หน้าเข้าสู่ระบบเริ่มต้น', defaultLogoLabel: 'โลโก้เริ่มต้นของ {brand}',
    loginLogoHelp: 'อัปโหลดโลโก้สำหรับหน้าเข้าสู่ระบบผู้ดูแลโดยเฉพาะ (PNG, JPG ไม่เกิน 2MB)',
    defaultLoginLogoInUse: 'ใช้โลโก้เริ่มต้นของ {brand} ที่หน้าเข้าสู่ระบบ', currencySettings: 'สกุลเงิน', currency: 'สกุลเงิน',
    currencyHelp: 'สกุลเงินนี้จะใช้ทั่วทั้งระบบการจอง', featureToggles: 'เปิด–ปิดฟีเจอร์',
    enableBookings: 'เปิดรับการจอง', enableBookingsHelp: 'ให้ลูกค้าจองนัดหมายผ่านแบบฟอร์มการจอง',
    enableGiftCards: 'เปิดขายบัตรของขวัญ', enableGiftCardsHelp: 'ให้ลูกค้าซื้อบัตรของขวัญผ่านแบบฟอร์มการจอง',
    bothDisabled: 'คำเตือน: ปิดทั้งสองฟีเจอร์อยู่',
    bothDisabledHelp: 'ควรเปิดอย่างน้อยหนึ่งฟีเจอร์เพื่อให้แบบฟอร์มการจองทำงานได้',
    proFeatures: 'ฟีเจอร์ Pro', proOnly: 'นี่คือฟีเจอร์ Pro กรุณาอัปเกรดเพื่อใช้งาน',
    hideBadge: 'ซ่อนป้าย "Powered by {brand}"', hideBadgeHelp: 'ลบแบรนด์ {brand} ออกจากหน้าจอง',
    customBranding: 'แบรนด์ของคุณเอง',
    customBrandingHelp: 'ปรับชื่อหน้า, Favicon และพรีวิวโซเชียลของหน้าจองเมื่อใช้โดเมนของคุณเอง',
    pageTitle: 'ชื่อหน้า (แท็บเบราว์เซอร์)', pageTitlePlaceholder: 'ชื่อธุรกิจของคุณ',
    pageTitleHelp: 'แสดงในแท็บเบราว์เซอร์เมื่อลูกค้าเปิดหน้าจอง',
    metaDescription: 'คำอธิบายเมตา (SEO และพรีวิวโซเชียล)',
    metaPlaceholder: 'จองนัดหมายได้ง่าย ๆ และจัดการตารางผ่านระบบจองออนไลน์',
    metaHelp: 'คำอธิบายนี้จะแสดงเมื่อแชร์ลิงก์บนโซเชียลมีเดีย (WhatsApp, Facebook ฯลฯ)',
    favicon: 'Favicon (ไอคอนแท็บเบราว์เซอร์)', faviconPreview: 'ตัวอย่าง Favicon', uploading: 'กำลังอัปโหลด…', uploadFavicon: 'อัปโหลด Favicon',
    remove: 'ลบ', faviconHint: 'แนะนำ: PNG ขนาด 32x32px หรือ 64x64px ไม่เกิน 500KB', ogImage: 'รูปพรีวิวโซเชียล',
    ogHelp: 'รูปนี้จะแสดงเมื่อแชร์ลิงก์บน WhatsApp, Facebook, Twitter ฯลฯ', ogPreview: 'พรีวิวโซเชียล',
    noImage: 'ยังไม่ได้อัปโหลดรูป', uploadImage: 'อัปโหลดรูป', ogHint: 'แนะนำ: PNG หรือ JPG ขนาด 1200x630px ไม่เกิน 2MB',
    saving: 'กำลังบันทึก…', save: 'บันทึกการเปลี่ยนแปลง',
  },
};

interface Business {
  id: string;
  name: string;
  subdomain: string;
  custom_domain: string | null;
  logo_url: string | null;
  custom_logo_url: string | null;
  login_page_logo_url: string | null;
  hide_powered_by_badge: boolean;
  calendar_integration_enabled: boolean;
  plan_type: string;
  enable_gift_cards: boolean;
  enable_bookings: boolean;
  custom_page_title: string | null;
  custom_favicon_url: string | null;
  custom_og_image_url: string | null;
  custom_meta_description: string | null;
}

export default function GeneralSettings() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
  const premiumFeatures = usePremiumFeatures();
  const { currency, setCurrency: updateCurrency } = useCurrency();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingLoginLogo, setUploadingLoginLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [uploadingOgImage, setUploadingOgImage] = useState(false);
  const [localCurrency, setLocalCurrency] = useState<string>(currency);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, [businessId]);

  useEffect(() => {
    setLocalCurrency(currency);
  }, [currency]);

  const handleUpgrade = async () => {
    if (upgrading || !businessId) return;

    setUpgrading(true);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upgrade-subscription`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await adminAccessToken()}`,
        },
        body: JSON.stringify({
          business_id: businessId,
          plan_type: 'pro',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Stripe checkout error:', errorData);
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (!data.url) {
        throw new Error('No checkout URL returned');
      }

      window.location.href = data.url;
    } catch (error) {
      console.error('Upgrade error:', error);
      alert(t.upgradeFailed);
      setUpgrading(false);
    }
  };

  const fetchBusiness = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (data) {
      setBusiness(data);
    }

    setLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !business) return;

    if (!premiumFeatures.canUseCustomLogo) {
      alert(t.logoPro);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert(t.fileTooLarge);
      return;
    }

    setUploadingLogo(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;

        const { error: updateError } = await supabase
          .from('businesses')
          .update({ custom_logo_url: dataUrl })
          .eq('id', businessId);

        if (updateError) throw updateError;

        setBusiness({ ...business, custom_logo_url: dataUrl });
        setSavedMessage(t.logoUploaded);
        setTimeout(() => setSavedMessage(''), 3000);
        setUploadingLogo(false);
      };

      reader.onerror = () => {
        console.error('Error reading file');
        alert(t.logoUploadFailed);
        setUploadingLogo(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      alert(t.logoUploadFailed);
      setUploadingLogo(false);
    }
  };

  const handleLoginLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !business) return;

    if (!premiumFeatures.canUseCustomLogo) {
      alert(t.logoPro);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert(t.fileTooLarge);
      return;
    }

    setUploadingLoginLogo(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const dataUrl = reader.result as string;

        const { error: updateError } = await supabase
          .from('businesses')
          .update({ login_page_logo_url: dataUrl })
          .eq('id', businessId);

        if (updateError) throw updateError;

        setBusiness({ ...business, login_page_logo_url: dataUrl });
        setSavedMessage(t.loginLogoUploaded);
        setTimeout(() => setSavedMessage(''), 3000);
        setUploadingLoginLogo(false);
      };

      reader.onerror = () => {
        console.error('Error reading file');
        alert(t.loginLogoUploadFailed);
        setUploadingLoginLogo(false);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading login logo:', error);
      alert(t.loginLogoUploadFailed);
      setUploadingLoginLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!businessId || !business) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ custom_logo_url: BRAND_LOGO })
        .eq('id', businessId);

      if (error) throw error;

      setBusiness({ ...business, custom_logo_url: BRAND_LOGO });
      setSavedMessage(t.logoRemoved);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error removing logo:', error);
      alert(t.logoRemoveFailed);
    }
  };

  const handleRemoveLoginLogo = async () => {
    if (!businessId || !business) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ login_page_logo_url: null })
        .eq('id', businessId);

      if (error) throw error;

      setBusiness({ ...business, login_page_logo_url: null });
      setSavedMessage(t.loginLogoReset);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error removing login logo:', error);
      alert(t.loginLogoRemoveFailed);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !business) return;

    if (!premiumFeatures.isPro) {
      alert(t.faviconPro);
      return;
    }

    // Favicon should be small - max 500KB
    if (file.size > 500 * 1024) {
      alert(t.faviconTooLarge);
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert(t.faviconType);
      return;
    }

    setUploadingFavicon(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}/branding/favicon-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload to storage');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('businesses')
        .update({ custom_favicon_url: publicUrl })
        .eq('id', businessId);

      if (updateError) throw updateError;

      setBusiness({ ...business, custom_favicon_url: publicUrl });
      setSavedMessage(t.faviconUploaded);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error uploading favicon:', error);
      alert(t.faviconUploadFailed);
    } finally {
      setUploadingFavicon(false);
    }
  };

  const handleRemoveFavicon = async () => {
    if (!businessId || !business) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ custom_favicon_url: null })
        .eq('id', businessId);

      if (error) throw error;

      setBusiness({ ...business, custom_favicon_url: null });
      setSavedMessage(fillText(t.faviconRemoved, { brand: BRAND_NAME }));
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error removing favicon:', error);
      alert(t.faviconRemoveFailed);
    }
  };

  const handleOgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId || !business) return;

    if (!premiumFeatures.isPro) {
      alert(t.ogPro);
      return;
    }

    // OG images can be larger - max 2MB
    if (file.size > 2 * 1024 * 1024) {
      alert(t.ogTooLarge);
      return;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert(t.ogType);
      return;
    }

    setUploadingOgImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}/branding/og-image-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(fileName, file);

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(uploadError.message || 'Failed to upload to storage');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('businesses')
        .update({ custom_og_image_url: publicUrl })
        .eq('id', businessId);

      if (updateError) throw updateError;

      setBusiness({ ...business, custom_og_image_url: publicUrl });
      setSavedMessage(t.ogUploaded);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error uploading social preview image:', error);
      alert(t.imageUploadFailed);
    } finally {
      setUploadingOgImage(false);
    }
  };

  const handleRemoveOgImage = async () => {
    if (!businessId || !business) return;

    try {
      const { error } = await supabase
        .from('businesses')
        .update({ custom_og_image_url: null })
        .eq('id', businessId);

      if (error) throw error;

      setBusiness({ ...business, custom_og_image_url: null });
      setSavedMessage(t.ogRemoved);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error removing social preview image:', error);
      alert(t.imageRemoveFailed);
    }
  };


  const handleSave = async () => {
    if (!business) return;

    setSaving(true);
    setSavedMessage('');

    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          name: business.name,
          custom_domain: business.custom_domain,
          logo_url: business.logo_url,
          custom_logo_url: business.custom_logo_url,
          login_page_logo_url: business.login_page_logo_url,
          hide_powered_by_badge: business.hide_powered_by_badge,
          enable_gift_cards: business.enable_gift_cards,
          enable_bookings: business.enable_bookings,
          custom_page_title: business.custom_page_title,
          custom_favicon_url: business.custom_favicon_url,
          custom_og_image_url: business.custom_og_image_url,
          custom_meta_description: business.custom_meta_description,
          updated_at: new Date().toISOString(),
        })
        .eq('id', business.id);

      if (error) throw error;

      if (localCurrency !== currency) {
        await updateCurrency(localCurrency);
      }

      setSavedMessage(t.saved);
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert(t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (loading || premiumFeatures.isLoading) {
    return <div className="text-stone-600">{t.loading}</div>;
  }

  if (!business) {
    return <div className="text-stone-600">{t.notFound}</div>;
  }

  return (
    <div className="space-y-6">
      {premiumFeatures.isPro && (
        <div className="bg-gradient-to-r from-amber-50 to-amber-100 border border-amber-200 rounded-lg p-4 flex items-center space-x-3">
          <Crown className="w-6 h-6 text-amber-600" />
          <div>
            <h3 className="font-semibold text-amber-900">{t.proPlan}</h3>
            <p className="text-sm text-amber-800">{t.proPlanBody}</p>
          </div>
        </div>
      )}

      {!premiumFeatures.isPro && premiumFeatures.limits && (
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="w-6 h-6 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">{t.standardPlan}</h3>
                <p className="text-sm text-blue-800">{fillText(t.standardLimits, { staff: String(premiumFeatures.limits.maxStaff ?? 5), services: String(premiumFeatures.limits.maxServices ?? 20) })}</p>
                <p className="text-xs text-blue-700 mt-1">{fillText(t.standardUsage, { staff: String(premiumFeatures.limits.currentStaff ?? 0), services: String(premiumFeatures.limits.currentServices ?? 0) })}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4">{t.businessInfo}</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.businessName}
            </label>
            <input
              type="text"
              value={business.name}
              onChange={(e) => setBusiness({ ...business, name: e.target.value })}
              className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center space-x-2">
              <Image className="w-4 h-4" />
              <span>{t.brandLogo}</span>
              {!premiumFeatures.isPro && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center space-x-1">
                  <Crown className="w-3 h-3" />
                  <span>Pro</span>
                </span>
              )}
            </label>
            <div className="space-y-3">
              {premiumFeatures.isPro ? (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-stone-800 file:text-white hover:file:bg-stone-700"
                  />
                  {uploadingLogo && (
                    <p className="text-sm text-stone-600">{t.uploadingLogo}</p>
                  )}
                </>
              ) : (
                <div className="bg-stone-50 border border-stone-200 rounded p-4 text-center">
                  <Crown className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm text-stone-600">{t.brandLogoUpsell}</p>
                </div>
              )}
              {business.custom_logo_url && (
                <div className="flex items-center space-x-4">
                  <img
                    src={business.custom_logo_url}
                    alt={t.logoPreview}
                    className="h-16 object-contain border border-stone-200 rounded p-2 bg-white"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  {premiumFeatures.isPro && business.custom_logo_url !== BRAND_LOGO && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      {t.resetDefault}
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {premiumFeatures.isPro
                ? t.brandLogoHelp
                : fillText(t.defaultLogoInUse, { brand: BRAND_NAME })}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center space-x-2">
              <Image className="w-4 h-4" />
              <span>{t.loginLogo}</span>
              {!premiumFeatures.isPro && (
                <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center space-x-1">
                  <Crown className="w-3 h-3" />
                  <span>Pro</span>
                </span>
              )}
            </label>
            <div className="space-y-3">
              {premiumFeatures.isPro ? (
                <>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLoginLogoUpload}
                    className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-stone-800 file:text-white hover:file:bg-stone-700"
                  />
                  {uploadingLoginLogo && (
                    <p className="text-sm text-stone-600">{t.uploadingLoginLogo}</p>
                  )}
                </>
              ) : (
                <div className="bg-stone-50 border border-stone-200 rounded p-4 text-center">
                  <Crown className="w-8 h-8 text-stone-400 mx-auto mb-2" />
                  <p className="text-sm text-stone-600 mb-2">{t.loginLogoUpsell}</p>
                  <button
                    type="button"
                    className="text-sm text-amber-600 hover:text-amber-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleUpgrade}
                    disabled={upgrading}
                  >
                    {upgrading ? t.processing : t.upgradeNow}
                  </button>
                </div>
              )}
              {business.login_page_logo_url && (
                <div className="flex items-center space-x-4">
                  <div className="bg-stone-100 p-4 rounded border border-stone-200">
                    <img
                      src={business.login_page_logo_url}
                      alt={t.loginLogoPreview}
                      className="h-16 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                  {premiumFeatures.isPro && (
                    <button
                      type="button"
                      onClick={handleRemoveLoginLogo}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      {t.resetDefault}
                    </button>
                  )}
                </div>
              )}
              {!business.login_page_logo_url && (
                <div className="flex items-center space-x-4">
                  <div className="bg-stone-100 p-4 rounded border border-stone-200">
                    <img
                      src={BRAND_LOGO}
                      alt={t.defaultLoginLogoAlt}
                      className="h-16 object-contain"
                    />
                  </div>
                  <span className="text-sm text-stone-600">{fillText(t.defaultLogoLabel, { brand: BRAND_NAME })}</span>
                </div>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              {premiumFeatures.isPro
                ? t.loginLogoHelp
                : fillText(t.defaultLoginLogoInUse, { brand: BRAND_NAME })}
            </p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <DollarSign className="w-5 h-5" />
          <span>{t.currencySettings}</span>
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.currency}
            </label>
            <select
              value={localCurrency}
              onChange={(e) => setLocalCurrency(e.target.value)}
              className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800"
            >
              {Object.entries(CURRENCY_NAMES).map(([code, name]) => (
                <option key={code} value={code}>
                  {CURRENCY_SYMBOLS[code]} {name} ({code})
                </option>
              ))}
            </select>
            <p className="text-xs text-stone-500 mt-1">
              {t.currencyHelp}
            </p>
          </div>
        </div>
      </div>

      {savedMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800">{savedMessage}</span>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <ToggleLeft className="w-5 h-5" />
          <span>{t.featureToggles}</span>
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-stone-200 rounded">
            <div>
              <h4 className="font-medium text-stone-800">{t.enableBookings}</h4>
              <p className="text-sm text-stone-600">{t.enableBookingsHelp}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={business.enable_bookings}
                onChange={(e) => setBusiness({ ...business, enable_bookings: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-800"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 border border-stone-200 rounded">
            <div>
              <h4 className="font-medium text-stone-800">{t.enableGiftCards}</h4>
              <p className="text-sm text-stone-600">{t.enableGiftCardsHelp}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={business.enable_gift_cards}
                onChange={(e) => setBusiness({ ...business, enable_gift_cards: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-stone-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-stone-800"></div>
            </label>
          </div>

          {!business.enable_bookings && !business.enable_gift_cards && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded flex items-start space-x-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">{t.bothDisabled}</p>
                <p className="mt-1">{t.bothDisabledHelp}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-medium text-stone-800 mb-4 flex items-center space-x-2">
          <Crown className="w-5 h-5" />
          <span>{t.proFeatures}</span>
          {!premiumFeatures.isPro && (
            <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full flex items-center space-x-1">
              <Crown className="w-3 h-3" />
              <span>Pro</span>
            </span>
          )}
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-stone-200 rounded">
            <div>
              <h4 className="font-medium text-stone-800">{fillText(t.hideBadge, { brand: BRAND_NAME })}</h4>
              <p className="text-sm text-stone-600">{fillText(t.hideBadgeHelp, { brand: BRAND_NAME })}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={business.hide_powered_by_badge}
                onChange={(e) => {
                  if (!premiumFeatures.isPro) {
                    alert(t.proOnly);
                    return;
                  }
                  setBusiness({ ...business, hide_powered_by_badge: e.target.checked });
                }}
                disabled={!premiumFeatures.isPro}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
            </label>
          </div>

          {/* Custom Branding Section */}
          <div className="p-4 border border-stone-200 rounded space-y-4">
            <div>
              <h4 className="font-medium text-stone-800 mb-1">{t.customBranding}</h4>
              <p className="text-sm text-stone-600 mb-4">{t.customBrandingHelp}</p>
            </div>

            {/* Custom Page Title */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.pageTitle}
              </label>
              <input
                type="text"
                value={business.custom_page_title || ''}
                onChange={(e) => {
                  if (!premiumFeatures.isPro) {
                    alert(t.proOnly);
                    return;
                  }
                  setBusiness({ ...business, custom_page_title: e.target.value || null });
                }}
                disabled={!premiumFeatures.isPro}
                placeholder={business.name || t.pageTitlePlaceholder}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 disabled:bg-stone-100 disabled:cursor-not-allowed"
              />
              <p className="text-xs text-stone-500 mt-1">{t.pageTitleHelp}</p>
            </div>

            {/* Custom Meta Description */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.metaDescription}
              </label>
              <textarea
                value={business.custom_meta_description || ''}
                onChange={(e) => {
                  if (!premiumFeatures.isPro) {
                    alert(t.proOnly);
                    return;
                  }
                  setBusiness({ ...business, custom_meta_description: e.target.value || null });
                }}
                disabled={!premiumFeatures.isPro}
                placeholder={t.metaPlaceholder}
                rows={3}
                className="w-full px-4 py-2 border border-stone-200 rounded focus:outline-none focus:border-stone-800 disabled:bg-stone-100 disabled:cursor-not-allowed resize-none"
              />
              <p className="text-xs text-stone-500 mt-1">{t.metaHelp}</p>
            </div>

            {/* Custom Favicon Upload */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.favicon}
              </label>
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  {business.custom_favicon_url ? (
                    <div className="w-16 h-16 border border-stone-200 rounded flex items-center justify-center bg-stone-50">
                      <img 
                        src={business.custom_favicon_url} 
                        alt={t.faviconPreview} 
                        className="w-10 h-10 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = BRAND_FAVICON;
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 border border-dashed border-stone-300 rounded flex items-center justify-center bg-stone-50">
                      <Image className="w-6 h-6 text-stone-400" />
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <label className={`px-4 py-2 border border-stone-300 rounded cursor-pointer hover:bg-stone-50 transition-colors text-sm ${!premiumFeatures.isPro ? 'opacity-50 cursor-not-allowed' : ''}`}>
                      <input
                        type="file"
                        accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
                        onChange={handleFaviconUpload}
                        disabled={!premiumFeatures.isPro || uploadingFavicon}
                        className="hidden"
                      />
                      {uploadingFavicon ? t.uploading : t.uploadFavicon}
                    </label>
                    {business.custom_favicon_url && (
                      <button
                        onClick={handleRemoveFavicon}
                        disabled={!premiumFeatures.isPro}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm transition-colors disabled:opacity-50"
                      >
                        {t.remove}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 mt-2">{t.faviconHint}</p>
                </div>
              </div>
            </div>

            {/* Custom Social Preview Image Upload */}
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.ogImage}
              </label>
              <p className="text-xs text-stone-500 mb-3">{t.ogHelp}</p>
              <div className="space-y-3">
                {business.custom_og_image_url ? (
                  <div className="border border-stone-200 rounded overflow-hidden">
                    <img 
                      src={business.custom_og_image_url} 
                      alt={t.ogPreview} 
                      className="w-full max-w-md h-auto"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-full max-w-md h-40 border border-dashed border-stone-300 rounded flex items-center justify-center bg-stone-50">
                    <div className="text-center">
                      <Image className="w-10 h-10 text-stone-400 mx-auto mb-2" />
                      <p className="text-sm text-stone-500">{t.noImage}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <label className={`px-4 py-2 border border-stone-300 rounded cursor-pointer hover:bg-stone-50 transition-colors text-sm ${!premiumFeatures.isPro ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleOgImageUpload}
                      disabled={!premiumFeatures.isPro || uploadingOgImage}
                      className="hidden"
                    />
                    {uploadingOgImage ? t.uploading : t.uploadImage}
                  </label>
                  {business.custom_og_image_url && (
                    <button
                      onClick={handleRemoveOgImage}
                      disabled={!premiumFeatures.isPro}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded text-sm transition-colors disabled:opacity-50"
                    >
                      {t.remove}
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-500">{t.ogHint}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center space-x-2 px-6 py-3 bg-stone-800 text-white hover:bg-stone-700 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{saving ? t.saving : t.save}</span>
        </button>
      </div>
    </div>
  );
}
