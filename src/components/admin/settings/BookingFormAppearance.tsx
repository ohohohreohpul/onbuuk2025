import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Layout, Save, CheckCircle, AlertCircle, Type, Image as ImageIcon, Settings, Upload, ChevronDown, ChevronUp } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

const TEXT: Translations<{
  loading: string; loadFailedShort: string; heading: string; intro: string;
  loadFailed: string; noBusinessUpload: string; noBusinessSave: string; notLoaded: string; notAuthenticated: string;
  uploadFailed: string; saveFailed: string; saved: string; imageRemoved: string;
  imageUploaded: string; imageUploadedMobile: string; imageUploadedTablet: string; imageUploadedDesktop: string;
  stepContent: string; stepWelcome: string; stepService: string; stepDuration: string; stepSpecialist: string;
  stepDatetime: string; stepDetails: string; stepAddons: string; stepPayment: string;
  title: string; subtitle: string; buttonText: string; showBookingButton: string; bookingButtonText: string;
  showSignIn: string; showSignInHint: string; showGiftCardButton: string; giftCardButtonText: string;
  noticeHeading: string; noticeHint: string; noticeTitlePlaceholder: string; noticeTextPlaceholder: string;
  anySpecialistText: string; skipButtonText: string;
  images: string; imagesHint: string; fallbackImage: string; fallbackHint: string; mobileImage: string; mobileHint: string;
  tabletImage: string; tabletHint: string; desktopImage: string; desktopHint: string;
  altFallback: string; altMobile: string; altTablet: string; altDesktop: string; remove: string; uploading: string;
  layoutStyling: string; layoutStyle: string; layoutDefault: string; layoutVertical: string; layoutMinimal: string; layoutSplit: string; layoutGlass: string;
  sidebarImage: string; sidebarImageHint: string; sidebarImageAlt: string; replaceImage: string; uploadSidebar: string; sidebarRecommended: string;
  borderRadius: string; radiusNone: string; radiusSmall: string; radiusMedium: string; radiusLarge: string; radiusXl: string;
  spacing: string; spacingCompact: string; spacingNormal: string; spacingRelaxed: string;
  stepNumbers: string; stepNumbersHint: string; animations: string; animationsHint: string; enabled: string; disabled: string;
  saving: string; save: string;
}> = {
  en: {
    loading: 'Loading customization settings...', loadFailedShort: 'Failed to load customization',
    heading: 'Booking Form Customization', intro: 'Customize every aspect of your booking form',
    loadFailed: 'Failed to load customization settings', noBusinessUpload: 'Business ID not found. Please refresh the page and try again.',
    noBusinessSave: 'Business ID not found. Please refresh and try again.', notLoaded: 'Customization data not loaded. Please refresh and try again.',
    notAuthenticated: 'Not authenticated. Please log in again.', uploadFailed: 'Failed to upload image', saveFailed: 'Failed to save customization',
    saved: 'Booking form customization saved successfully!', imageRemoved: 'Image removed. Click "Save All Changes" to apply.',
    imageUploaded: 'Image uploaded! Click "Save All Changes" to apply.', imageUploadedMobile: 'Mobile image uploaded! Click "Save All Changes" to apply.',
    imageUploadedTablet: 'Tablet image uploaded! Click "Save All Changes" to apply.', imageUploadedDesktop: 'Desktop image uploaded! Click "Save All Changes" to apply.',
    stepContent: 'Step Content & Images', stepWelcome: 'Welcome Page', stepService: 'Service Selection', stepDuration: 'Duration Selection',
    stepSpecialist: 'Specialist Selection', stepDatetime: 'Date & Time Selection', stepDetails: 'Personal Details', stepAddons: 'Add-ons', stepPayment: 'Payment',
    title: 'Title', subtitle: 'Subtitle', buttonText: 'Button Text', showBookingButton: 'Show Booking Button', bookingButtonText: 'Booking Button Text',
    showSignIn: 'Show Customer Sign In', showSignInHint: 'Lets customers sign in to see their bookings and rewards.',
    showGiftCardButton: 'Show Gift Card Button', giftCardButtonText: 'Gift Card Button Text',
    noticeHeading: 'Notice on the welcome page', noticeHint: 'Shown in a highlighted box under the welcome text. Leave the text empty to hide it.',
    noticeTitlePlaceholder: 'Title, e.g. Important notice', noticeTextPlaceholder: 'Text',
    anySpecialistText: 'Any Specialist Text', skipButtonText: 'Skip Button Text',
    images: 'Background/Header Images', imagesHint: 'Upload optimized images for different screen sizes. Each variant will display on its target screen size.',
    fallbackImage: 'Fallback Image (All Devices)', fallbackHint: 'Recommended: 1920×1080px or larger',
    mobileImage: 'Mobile Image (Screens < 640px)', mobileHint: 'Recommended: 800×600px (portrait-friendly)',
    tabletImage: 'Tablet Image (Screens 640px - 1024px)', tabletHint: 'Recommended: 1200×900px',
    desktopImage: 'Desktop Image (Screens > 1024px)', desktopHint: 'Recommended: 1920×1080px (Full HD)',
    altFallback: '{step} fallback', altMobile: '{step} mobile', altTablet: '{step} tablet', altDesktop: '{step} desktop',
    remove: 'Remove', uploading: 'Uploading...',
    layoutStyling: 'Layout & Styling', layoutStyle: 'Layout Style', layoutDefault: 'Default Split', layoutVertical: 'Vertical Banner',
    layoutMinimal: 'Minimal', layoutSplit: 'Split Panel', layoutGlass: 'Glass (frosted panel over your photo)',
    sidebarImage: 'Sidebar Image', sidebarImageHint: 'This image appears on all booking steps in the sidebar', sidebarImageAlt: 'Global sidebar image',
    replaceImage: 'Replace Image', uploadSidebar: 'Click to upload sidebar image', sidebarRecommended: 'Recommended: 400x300px or larger',
    borderRadius: 'Border Radius', radiusNone: 'None', radiusSmall: 'Small', radiusMedium: 'Medium', radiusLarge: 'Large', radiusXl: 'Extra Large',
    spacing: 'Spacing', spacingCompact: 'Compact', spacingNormal: 'Normal', spacingRelaxed: 'Relaxed',
    stepNumbers: 'Show Step Numbers', stepNumbersHint: 'Display numbers in progress bar', animations: 'Animations', animationsHint: 'Enable smooth transitions',
    enabled: 'Enabled', disabled: 'Disabled', saving: 'Saving...', save: 'Save All Changes',
  },
  de: {
    loading: 'Darstellung wird geladen…', loadFailedShort: 'Darstellung konnte nicht geladen werden',
    heading: 'Darstellung des Buchungsformulars', intro: 'Jeden Bereich des Buchungsformulars anpassen',
    loadFailed: 'Einstellungen zur Darstellung konnten nicht geladen werden', noBusinessUpload: 'Betrieb nicht gefunden. Bitte die Seite neu laden und erneut versuchen.',
    noBusinessSave: 'Betrieb nicht gefunden. Bitte neu laden und erneut versuchen.', notLoaded: 'Daten nicht geladen. Bitte neu laden und erneut versuchen.',
    notAuthenticated: 'Nicht angemeldet. Bitte erneut anmelden.', uploadFailed: 'Bild konnte nicht hochgeladen werden', saveFailed: 'Darstellung konnte nicht gespeichert werden',
    saved: 'Darstellung des Buchungsformulars gespeichert', imageRemoved: 'Bild entfernt. Zum Übernehmen auf „Alle Änderungen speichern“ klicken.',
    imageUploaded: 'Bild hochgeladen. Zum Übernehmen auf „Alle Änderungen speichern“ klicken.', imageUploadedMobile: 'Smartphone-Bild hochgeladen. Zum Übernehmen auf „Alle Änderungen speichern“ klicken.',
    imageUploadedTablet: 'Tablet-Bild hochgeladen. Zum Übernehmen auf „Alle Änderungen speichern“ klicken.', imageUploadedDesktop: 'Desktop-Bild hochgeladen. Zum Übernehmen auf „Alle Änderungen speichern“ klicken.',
    stepContent: 'Inhalte & Bilder der Schritte', stepWelcome: 'Willkommensseite', stepService: 'Leistung wählen', stepDuration: 'Dauer wählen',
    stepSpecialist: 'Mitarbeiter wählen', stepDatetime: 'Datum & Uhrzeit wählen', stepDetails: 'Persönliche Daten', stepAddons: 'Zusatzleistungen', stepPayment: 'Zahlung',
    title: 'Titel', subtitle: 'Untertitel', buttonText: 'Button-Text', showBookingButton: 'Buchungs-Button anzeigen', bookingButtonText: 'Text des Buchungs-Buttons',
    showSignIn: 'Kunden-Anmeldung anzeigen', showSignInHint: 'Kunden können sich anmelden, um ihre Buchungen und Prämien zu sehen.',
    showGiftCardButton: 'Gutschein-Button anzeigen', giftCardButtonText: 'Text des Gutschein-Buttons',
    noticeHeading: 'Hinweis auf der Willkommensseite', noticeHint: 'Erscheint hervorgehoben unter dem Willkommenstext. Text leer lassen, um ihn auszublenden.',
    noticeTitlePlaceholder: 'Titel, z. B. Wichtiger Hinweis', noticeTextPlaceholder: 'Text',
    anySpecialistText: 'Text für „Beliebiger Mitarbeiter“', skipButtonText: 'Text des Überspringen-Buttons',
    images: 'Hintergrund-/Kopfbilder', imagesHint: 'Optimierte Bilder für verschiedene Bildschirmgrößen hochladen. Jede Variante erscheint auf der passenden Bildschirmgröße.',
    fallbackImage: 'Standardbild (alle Geräte)', fallbackHint: 'Empfohlen: 1920×1080px oder größer',
    mobileImage: 'Smartphone-Bild (Bildschirme < 640px)', mobileHint: 'Empfohlen: 800×600px (hochformattauglich)',
    tabletImage: 'Tablet-Bild (Bildschirme 640px – 1024px)', tabletHint: 'Empfohlen: 1200×900px',
    desktopImage: 'Desktop-Bild (Bildschirme > 1024px)', desktopHint: 'Empfohlen: 1920×1080px (Full HD)',
    altFallback: '{step} – Standardbild', altMobile: '{step} – Smartphone', altTablet: '{step} – Tablet', altDesktop: '{step} – Desktop',
    remove: 'Entfernen', uploading: 'Wird hochgeladen…',
    layoutStyling: 'Layout & Gestaltung', layoutStyle: 'Layout', layoutDefault: 'Standard (geteilt)', layoutVertical: 'Vertikales Banner',
    layoutMinimal: 'Minimal', layoutSplit: 'Geteiltes Panel', layoutGlass: 'Glas (mattes Panel über Ihrem Foto)',
    sidebarImage: 'Seitenleisten-Bild', sidebarImageHint: 'Dieses Bild erscheint bei allen Buchungsschritten in der Seitenleiste', sidebarImageAlt: 'Seitenleisten-Bild',
    replaceImage: 'Bild ersetzen', uploadSidebar: 'Klicken, um ein Seitenleisten-Bild hochzuladen', sidebarRecommended: 'Empfohlen: 400×300px oder größer',
    borderRadius: 'Eckenradius', radiusNone: 'Keiner', radiusSmall: 'Klein', radiusMedium: 'Mittel', radiusLarge: 'Groß', radiusXl: 'Sehr groß',
    spacing: 'Abstände', spacingCompact: 'Kompakt', spacingNormal: 'Normal', spacingRelaxed: 'Großzügig',
    stepNumbers: 'Schrittnummern anzeigen', stepNumbersHint: 'Nummern in der Fortschrittsanzeige zeigen', animations: 'Animationen', animationsHint: 'Weiche Übergänge aktivieren',
    enabled: 'Aktiv', disabled: 'Inaktiv', saving: 'Wird gespeichert…', save: 'Alle Änderungen speichern',
  },
  th: {
    loading: 'กำลังโหลดการตั้งค่าการแสดงผล…', loadFailedShort: 'โหลดการตั้งค่าการแสดงผลไม่สำเร็จ',
    heading: 'การแสดงผลแบบฟอร์มจอง', intro: 'ปรับแต่งทุกส่วนของแบบฟอร์มจอง',
    loadFailed: 'โหลดการตั้งค่าการแสดงผลไม่สำเร็จ', noBusinessUpload: 'ไม่พบข้อมูลร้าน กรุณารีเฟรชหน้าแล้วลองอีกครั้ง',
    noBusinessSave: 'ไม่พบข้อมูลร้าน กรุณารีเฟรชแล้วลองอีกครั้ง', notLoaded: 'ยังไม่ได้โหลดข้อมูล กรุณารีเฟรชแล้วลองอีกครั้ง',
    notAuthenticated: 'ยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบอีกครั้ง', uploadFailed: 'อัปโหลดรูปภาพไม่สำเร็จ', saveFailed: 'บันทึกการแสดงผลไม่สำเร็จ',
    saved: 'บันทึกการแสดงผลแบบฟอร์มจองแล้ว', imageRemoved: 'ลบรูปภาพแล้ว กด "บันทึกการเปลี่ยนแปลงทั้งหมด" เพื่อใช้งาน',
    imageUploaded: 'อัปโหลดรูปภาพแล้ว กด "บันทึกการเปลี่ยนแปลงทั้งหมด" เพื่อใช้งาน', imageUploadedMobile: 'อัปโหลดรูปสำหรับมือถือแล้ว กด "บันทึกการเปลี่ยนแปลงทั้งหมด" เพื่อใช้งาน',
    imageUploadedTablet: 'อัปโหลดรูปสำหรับแท็บเล็ตแล้ว กด "บันทึกการเปลี่ยนแปลงทั้งหมด" เพื่อใช้งาน', imageUploadedDesktop: 'อัปโหลดรูปสำหรับเดสก์ท็อปแล้ว กด "บันทึกการเปลี่ยนแปลงทั้งหมด" เพื่อใช้งาน',
    stepContent: 'เนื้อหาและรูปภาพของแต่ละขั้นตอน', stepWelcome: 'หน้าต้อนรับ', stepService: 'เลือกบริการ', stepDuration: 'เลือกระยะเวลา',
    stepSpecialist: 'เลือกพนักงาน', stepDatetime: 'เลือกวันและเวลา', stepDetails: 'ข้อมูลส่วนตัว', stepAddons: 'บริการเสริม', stepPayment: 'การชำระเงิน',
    title: 'หัวข้อ', subtitle: 'หัวข้อรอง', buttonText: 'ข้อความบนปุ่ม', showBookingButton: 'แสดงปุ่มจอง', bookingButtonText: 'ข้อความปุ่มจอง',
    showSignIn: 'แสดงการเข้าสู่ระบบของลูกค้า', showSignInHint: 'ให้ลูกค้าเข้าสู่ระบบเพื่อดูการจองและรางวัลของตนเอง',
    showGiftCardButton: 'แสดงปุ่มบัตรของขวัญ', giftCardButtonText: 'ข้อความปุ่มบัตรของขวัญ',
    noticeHeading: 'ประกาศในหน้าต้อนรับ', noticeHint: 'แสดงในกล่องเน้นใต้ข้อความต้อนรับ เว้นข้อความว่างไว้เพื่อซ่อน',
    noticeTitlePlaceholder: 'หัวข้อ เช่น ข้อมูลสำคัญ', noticeTextPlaceholder: 'ข้อความ',
    anySpecialistText: 'ข้อความ "พนักงานคนใดก็ได้"', skipButtonText: 'ข้อความปุ่มข้าม',
    images: 'รูปพื้นหลัง/ส่วนหัว', imagesHint: 'อัปโหลดรูปที่เหมาะกับขนาดหน้าจอต่าง ๆ แต่ละแบบจะแสดงบนหน้าจอขนาดที่กำหนด',
    fallbackImage: 'รูปหลัก (ทุกอุปกรณ์)', fallbackHint: 'แนะนำ: 1920×1080px หรือใหญ่กว่า',
    mobileImage: 'รูปสำหรับมือถือ (หน้าจอ < 640px)', mobileHint: 'แนะนำ: 800×600px (เหมาะกับแนวตั้ง)',
    tabletImage: 'รูปสำหรับแท็บเล็ต (หน้าจอ 640px – 1024px)', tabletHint: 'แนะนำ: 1200×900px',
    desktopImage: 'รูปสำหรับเดสก์ท็อป (หน้าจอ > 1024px)', desktopHint: 'แนะนำ: 1920×1080px (Full HD)',
    altFallback: '{step} – รูปหลัก', altMobile: '{step} – มือถือ', altTablet: '{step} – แท็บเล็ต', altDesktop: '{step} – เดสก์ท็อป',
    remove: 'ลบ', uploading: 'กำลังอัปโหลด…',
    layoutStyling: 'เลย์เอาต์และสไตล์', layoutStyle: 'รูปแบบเลย์เอาต์', layoutDefault: 'แบ่งสองฝั่ง (ค่าเริ่มต้น)', layoutVertical: 'แบนเนอร์แนวตั้ง',
    layoutMinimal: 'มินิมอล', layoutSplit: 'แผงแบ่งสองฝั่ง', layoutGlass: 'กระจก (แผงฝ้าบนรูปของคุณ)',
    sidebarImage: 'รูปแถบด้านข้าง', sidebarImageHint: 'รูปนี้จะแสดงในแถบด้านข้างของทุกขั้นตอนการจอง', sidebarImageAlt: 'รูปแถบด้านข้าง',
    replaceImage: 'เปลี่ยนรูป', uploadSidebar: 'คลิกเพื่ออัปโหลดรูปแถบด้านข้าง', sidebarRecommended: 'แนะนำ: 400×300px หรือใหญ่กว่า',
    borderRadius: 'ความโค้งของมุม', radiusNone: 'ไม่มี', radiusSmall: 'เล็ก', radiusMedium: 'กลาง', radiusLarge: 'ใหญ่', radiusXl: 'ใหญ่มาก',
    spacing: 'ระยะห่าง', spacingCompact: 'กะทัดรัด', spacingNormal: 'ปกติ', spacingRelaxed: 'โปร่ง',
    stepNumbers: 'แสดงหมายเลขขั้นตอน', stepNumbersHint: 'แสดงตัวเลขในแถบความคืบหน้า', animations: 'แอนิเมชัน', animationsHint: 'เปิดการเปลี่ยนหน้าแบบนุ่มนวล',
    enabled: 'เปิดใช้', disabled: 'ปิดใช้', saving: 'กำลังบันทึก…', save: 'บันทึกการเปลี่ยนแปลงทั้งหมด',
  },
};

type MessageKey = keyof typeof TEXT.en;

const UPLOAD_NOTICE: Record<'mobile' | 'tablet' | 'desktop', MessageKey> = {
  mobile: 'imageUploadedMobile', tablet: 'imageUploadedTablet', desktop: 'imageUploadedDesktop',
};

type LayoutType = 'default' | 'vertical' | 'minimal' | 'split-panel' | 'glass';

interface StepContent {
  title: string;
  subtitle: string;
  buttonText: string;
  [key: string]: any;
}

interface Colors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  error: string;
  warning: string;
}

interface Typography {
  fontFamily: string;
  headingSize: string;
  bodySize: string;
  headingWeight: string;
  bodyWeight: string;
}

interface Styling {
  borderRadius: string;
  spacing: string;
  shadowLevel: string;
  progressBarStyle: string;
  showStepNumbers: boolean;
  animationsEnabled: boolean;
  layout: LayoutType;
}

interface BookingFormCustomization {
  id?: string;
  business_id: string;
  welcome_step: StepContent;
  service_step: StepContent;
  duration_step: StepContent;
  specialist_step: StepContent;
  datetime_step: StepContent;
  details_step: StepContent;
  addons_step: StepContent;
  payment_step: StepContent;
  global_image_url: string | null;
  welcome_image_url: string | null;
  service_image_url: string | null;
  duration_image_url: string | null;
  specialist_image_url: string | null;
  datetime_image_url: string | null;
  details_image_url: string | null;
  addons_image_url: string | null;
  payment_image_url: string | null;
  colors: Colors;
  typography: Typography;
  styling: Styling;
}

const DEFAULT_CUSTOMIZATION: Omit<BookingFormCustomization, 'id' | 'business_id'> = {
  welcome_step: {
    title: "Welcome! Let's get you booked",
    subtitle: "Choose your preferred service and time",
    buttonText: "Get Started"
  },
  service_step: {
    title: "Choose Your Service",
    subtitle: "Select the service you would like to book",
    buttonText: "Continue"
  },
  duration_step: {
    title: "Select Duration",
    subtitle: "How long would you like your appointment?",
    buttonText: "Continue"
  },
  specialist_step: {
    title: "Choose Your Specialist",
    subtitle: "Select your preferred specialist or let us choose for you",
    buttonText: "Continue",
    anySpecialistText: "Any Available Specialist"
  },
  datetime_step: {
    title: "Select Date & Time",
    subtitle: "Choose your preferred appointment date and time",
    buttonText: "Continue"
  },
  details_step: {
    title: "Your Details",
    subtitle: "Please provide your contact information",
    buttonText: "Continue",
    labels: {
      name: "Full Name",
      email: "Email Address",
      phone: "Phone Number",
      notes: "Additional Notes (Optional)"
    }
  },
  addons_step: {
    title: "Enhance Your Experience",
    subtitle: "Add optional products or services",
    buttonText: "Continue",
    skipButtonText: "Skip Add-ons"
  },
  payment_step: {
    title: "Payment",
    subtitle: "Complete your booking",
    buttonText: "Confirm Booking"
  },
  global_image_url: null,
  welcome_image_url: null,
  service_image_url: null,
  duration_image_url: null,
  specialist_image_url: null,
  datetime_image_url: null,
  details_image_url: null,
  addons_image_url: null,
  payment_image_url: null,
  colors: {
    primary: "#2563eb",
    secondary: "#64748b",
    accent: "#3b82f6",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#1e293b",
    textSecondary: "#64748b",
    border: "#e2e8f0",
    success: "#22c55e",
    error: "#ef4444",
    warning: "#f59e0b"
  },
  typography: {
    fontFamily: "system-ui, -apple-system, sans-serif",
    headingSize: "2xl",
    bodySize: "base",
    headingWeight: "bold",
    bodyWeight: "normal"
  },
  styling: {
    borderRadius: "md",
    spacing: "normal",
    shadowLevel: "md",
    progressBarStyle: "steps",
    showStepNumbers: true,
    animationsEnabled: true,
    layout: "default"
  }
};

export default function BookingFormAppearance() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
  const [customization, setCustomization] = useState<BookingFormCustomization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<MessageKey | ''>('');
  const [error, setError] = useState<MessageKey | ''>('');
  const [uploadingImage, setUploadingImage] = useState<string | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    welcome: true,
    service: false,
    duration: false,
    specialist: false,
    datetime: false,
    details: false,
    addons: false,
    payment: false,
    colors: false,
    typography: false,
    styling: false
  });

  useEffect(() => {
    fetchCustomization();
  }, [businessId]);

  const fetchCustomization = async () => {
    if (!businessId) return;

    try {
      const { data, error: fetchError } = await supabase
        .from('booking_form_customization')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (data) {
        setCustomization(data);
      } else {
        setCustomization({
          ...DEFAULT_CUSTOMIZATION,
          business_id: businessId
        });
      }
    } catch (err) {
      console.error('Error fetching customization:', err);
      setError('loadFailed');
    }

    setLoading(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const updateStepContent = (step: string, field: string, value: any) => {
    if (!customization) return;

    setCustomization({
      ...customization,
      [`${step}_step`]: {
        ...customization[`${step}_step` as keyof BookingFormCustomization] as StepContent,
        [field]: value
      }
    });
  };

  const updateTypography = (field: string, value: string) => {
    if (!customization) return;

    setCustomization({
      ...customization,
      typography: {
        ...customization.typography,
        [field]: value
      }
    });
  };

  const updateStyling = (field: string, value: any) => {
    if (!customization) return;

    setCustomization({
      ...customization,
      styling: {
        ...customization.styling,
        [field]: value
      }
    });
  };

  const uploadImage = async (step: string, file: File, variant?: 'mobile' | 'tablet' | 'desktop') => {
    if (!businessId) {
      setError('noBusinessUpload');
      return;
    }

    const uploadKey = variant ? `${step}_${variant}` : step;
    setUploadingImage(uploadKey);
    setError('');

    try {
      const fileExt = file.name.split('.').pop();
      const variantSuffix = variant ? `-${variant}` : '';
      const fileName = `${businessId}/booking-form/${step}${variantSuffix}-${Date.now()}.${fileExt}`;

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

      if (customization) {
        const fieldName = variant ? `${step}_image_${variant}` : `${step}_image_url`;
        setCustomization({
          ...customization,
          [fieldName]: publicUrl
        });
        setSavedMessage(variant ? UPLOAD_NOTICE[variant] : 'imageUploaded');
        setTimeout(() => setSavedMessage(''), 5000);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      setError('uploadFailed');
    } finally {
      setUploadingImage(null);
    }
  };

  const handleSave = async () => {
    if (!businessId) {
      setError('noBusinessSave');
      return;
    }

    if (!customization) {
      setError('notLoaded');
      return;
    }

    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('notAuthenticated');
        return;
      }

      console.log('Saving customization for business:', businessId);
      const { id, ...dataToSave } = customization;

      if (id) {
        console.log('Updating existing customization:', id);
        const { error: updateError } = await supabase
          .from('booking_form_customization')
          .update(dataToSave)
          .eq('id', id);

        if (updateError) {
          console.error('Update error:', updateError);
          throw new Error(updateError.message || 'Failed to update customization');
        }
      } else {
        console.log('Creating new customization for business:', businessId);
        const { data, error: insertError } = await supabase
          .from('booking_form_customization')
          .insert([{ ...dataToSave, business_id: businessId }])
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          throw new Error(insertError.message || 'Failed to create customization. You may not have permission to modify this business.');
        }

        if (data) {
          setCustomization(data);
        }
      }

      setSavedMessage('saved');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError('saveFailed');
    } finally {
      setSaving(false);
    }
  };

  const renderStepEditor = (stepKey: string, stepName: string) => {
    if (!customization) return null;

    const stepData = customization[`${stepKey}_step` as keyof BookingFormCustomization] as StepContent;
    const imageUrl = customization[`${stepKey}_image_url` as keyof BookingFormCustomization] as string | null;
    const isExpanded = expandedSections[stepKey];

    return (
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleSection(stepKey)}
          className="w-full px-6 py-4 bg-stone-50 flex items-center justify-between hover:bg-stone-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Type className="w-5 h-5 text-stone-700" />
            <span className="font-semibold text-stone-900">{stepName}</span>
          </div>
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>

        {isExpanded && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.title}
              </label>
              <input
                type="text"
                value={stepData.title}
                onChange={(e) => updateStepContent(stepKey, 'title', e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.subtitle}
              </label>
              <input
                type="text"
                value={stepData.subtitle}
                onChange={(e) => updateStepContent(stepKey, 'subtitle', e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.buttonText}
              </label>
              <input
                type="text"
                value={stepData.buttonText}
                onChange={(e) => updateStepContent(stepKey, 'buttonText', e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              />
            </div>

            {stepKey === 'welcome' && (
              <>
                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <label className="text-sm font-medium text-stone-700">
                    {t.showBookingButton}
                  </label>
                  <input
                    type="checkbox"
                    checked={stepData.showBookingButton !== false}
                    onChange={(e) => updateStepContent(stepKey, 'showBookingButton', e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    {t.bookingButtonText}
                  </label>
                  <input
                    type="text"
                    value={stepData.bookingButtonText || ''}
                    onChange={(e) => updateStepContent(stepKey, 'bookingButtonText', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                    disabled={stepData.showBookingButton === false}
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <div>
                    <label className="text-sm font-medium text-stone-700">{t.showSignIn}</label>
                    <p className="text-xs text-stone-500">{t.showSignInHint}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={stepData.showAccountButton !== false}
                    onChange={(e) => updateStepContent(stepKey, 'showAccountButton', e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg">
                  <label className="text-sm font-medium text-stone-700">
                    {t.showGiftCardButton}
                  </label>
                  <input
                    type="checkbox"
                    checked={stepData.showGiftCardButton !== false}
                    onChange={(e) => updateStepContent(stepKey, 'showGiftCardButton', e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">
                    {t.giftCardButtonText}
                  </label>
                  <input
                    type="text"
                    value={stepData.giftCardButtonText || ''}
                    onChange={(e) => updateStepContent(stepKey, 'giftCardButtonText', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                    disabled={stepData.showGiftCardButton === false}
                  />
                </div>

                <div className="space-y-2 rounded-lg bg-stone-50 p-3">
                  <p className="text-sm font-medium text-stone-700">{t.noticeHeading}</p>
                  <p className="text-xs text-stone-500">{t.noticeHint}</p>
                  <input
                    type="text"
                    value={stepData.noticeTitle || ''}
                    onChange={(e) => updateStepContent(stepKey, 'noticeTitle', e.target.value)}
                    placeholder={t.noticeTitlePlaceholder}
                    maxLength={120}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                  <textarea
                    value={stepData.noticeText || ''}
                    onChange={(e) => updateStepContent(stepKey, 'noticeText', e.target.value)}
                    placeholder={t.noticeTextPlaceholder}
                    rows={4}
                    maxLength={1000}
                    className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                  />
                </div>
              </>
            )}

            {stepKey === 'specialist' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t.anySpecialistText}
                </label>
                <input
                  type="text"
                  value={stepData.anySpecialistText || ''}
                  onChange={(e) => updateStepContent(stepKey, 'anySpecialistText', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>
            )}

            {stepKey === 'addons' && (
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t.skipButtonText}
                </label>
                <input
                  type="text"
                  value={stepData.skipButtonText || ''}
                  onChange={(e) => updateStepContent(stepKey, 'skipButtonText', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                />
              </div>
            )}

            <div className="border border-stone-200 rounded-lg p-4 space-y-4">
              <label className="block text-sm font-medium text-stone-700">
                {t.images}
                <span className="block text-xs text-stone-500 mt-1">{t.imagesHint}</span>
              </label>

              {/* Fallback Image */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-2">
                  {t.fallbackImage}
                  <span className="block text-xs font-normal text-stone-500 mt-0.5">{t.fallbackHint}</span>
                </label>
                {imageUrl && (
                  <div className="mb-2 relative">
                    <img
                      src={imageUrl}
                      alt={fillText(t.altFallback, { step: stepName })}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setCustomization({
                        ...customization,
                        [`${stepKey}_image_url`]: null
                      })}
                      className="absolute top-1 right-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                      {t.remove}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(stepKey, file);
                    }}
                    disabled={uploadingImage === stepKey}
                    className="flex-1 text-xs"
                  />
                  {uploadingImage === stepKey && <span className="text-xs text-stone-600">{t.uploading}</span>}
                </div>
              </div>

              {/* Mobile Image */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-2">
                  {t.mobileImage}
                  <span className="block text-xs font-normal text-stone-500 mt-0.5">{t.mobileHint}</span>
                </label>
                {customization[`${stepKey}_image_mobile` as keyof typeof customization] && (
                  <div className="mb-2 relative">
                    <img
                      src={customization[`${stepKey}_image_mobile` as keyof typeof customization] as string}
                      alt={fillText(t.altMobile, { step: stepName })}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setCustomization({
                        ...customization,
                        [`${stepKey}_image_mobile`]: null
                      })}
                      className="absolute top-1 right-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                      {t.remove}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(stepKey, file, 'mobile');
                    }}
                    disabled={uploadingImage === `${stepKey}_mobile`}
                    className="flex-1 text-xs"
                  />
                  {uploadingImage === `${stepKey}_mobile` && <span className="text-xs text-stone-600">{t.uploading}</span>}
                </div>
              </div>

              {/* Tablet Image */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-2">
                  {t.tabletImage}
                  <span className="block text-xs font-normal text-stone-500 mt-0.5">{t.tabletHint}</span>
                </label>
                {customization[`${stepKey}_image_tablet` as keyof typeof customization] && (
                  <div className="mb-2 relative">
                    <img
                      src={customization[`${stepKey}_image_tablet` as keyof typeof customization] as string}
                      alt={fillText(t.altTablet, { step: stepName })}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setCustomization({
                        ...customization,
                        [`${stepKey}_image_tablet`]: null
                      })}
                      className="absolute top-1 right-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                      {t.remove}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(stepKey, file, 'tablet');
                    }}
                    disabled={uploadingImage === `${stepKey}_tablet`}
                    className="flex-1 text-xs"
                  />
                  {uploadingImage === `${stepKey}_tablet` && <span className="text-xs text-stone-600">{t.uploading}</span>}
                </div>
              </div>

              {/* Desktop Image */}
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-2">
                  {t.desktopImage}
                  <span className="block text-xs font-normal text-stone-500 mt-0.5">{t.desktopHint}</span>
                </label>
                {customization[`${stepKey}_image_desktop` as keyof typeof customization] && (
                  <div className="mb-2 relative">
                    <img
                      src={customization[`${stepKey}_image_desktop` as keyof typeof customization] as string}
                      alt={fillText(t.altDesktop, { step: stepName })}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => setCustomization({
                        ...customization,
                        [`${stepKey}_image_desktop`]: null
                      })}
                      className="absolute top-1 right-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
                    >
                      {t.remove}
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(stepKey, file, 'desktop');
                    }}
                    disabled={uploadingImage === `${stepKey}_desktop`}
                    className="flex-1 text-xs"
                  />
                  {uploadingImage === `${stepKey}_desktop` && <span className="text-xs text-stone-600">{t.uploading}</span>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-600">{t.loading}</div>
      </div>
    );
  }

  if (!customization) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-red-600">{t.loadFailedShort}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Layout className="w-8 h-8 text-stone-900" />
          <div>
            <h2 className="text-2xl font-bold text-stone-900">{t.heading}</h2>
            <p className="text-stone-600 text-sm">{t.intro}</p>
          </div>
        </div>
      </div>

      {savedMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <p className="text-green-800">{t[savedMessage]}</p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-red-800">{t[error]}</p>
        </div>
      )}

      <div className="space-y-8">
        <section>
          <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Type className="w-5 h-5" />
            {t.stepContent}
          </h3>
          <div className="space-y-3">
            {renderStepEditor('welcome', t.stepWelcome)}
            {renderStepEditor('service', t.stepService)}
            {renderStepEditor('duration', t.stepDuration)}
            {renderStepEditor('specialist', t.stepSpecialist)}
            {renderStepEditor('datetime', t.stepDatetime)}
            {renderStepEditor('details', t.stepDetails)}
            {renderStepEditor('addons', t.stepAddons)}
            {renderStepEditor('payment', t.stepPayment)}
          </div>
        </section>

        <section>
          <h3 className="text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t.layoutStyling}
          </h3>
          <div className="border border-stone-200 rounded-lg p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.layoutStyle}
              </label>
              <select
                value={customization.styling.layout}
                onChange={(e) => updateStyling('layout', e.target.value)}
                className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              >
                <option value="default">{t.layoutDefault}</option>
                <option value="vertical">{t.layoutVertical}</option>
                <option value="minimal">{t.layoutMinimal}</option>
                <option value="split-panel">{t.layoutSplit}</option>
                <option value="glass">{t.layoutGlass}</option>
              </select>
            </div>

            {/* Global Image for All Steps */}
            {(customization.styling.layout === 'split-panel' || customization.styling.layout === 'default') && (
              <div className="border border-stone-200 rounded-lg p-4 bg-stone-50">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-stone-900">{t.sidebarImage}</h4>
                    <p className="text-sm text-stone-600">{t.sidebarImageHint}</p>
                  </div>
                </div>
                
                {customization.global_image_url ? (
                  <div className="space-y-3">
                    <div className="relative rounded-lg overflow-hidden border border-stone-200">
                      <img 
                        src={customization.global_image_url} 
                        alt={t.sidebarImageAlt} 
                        className="w-full h-40 object-cover"
                      />
                    </div>
                    <div className="flex gap-2">
                      <label className="flex-1 cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadImage('global', file);
                          }}
                          disabled={uploadingImage === 'global'}
                        />
                        <div className="px-4 py-2 bg-stone-100 text-stone-700 rounded-lg text-sm text-center hover:bg-stone-200 transition-colors">
                          {uploadingImage === 'global' ? t.uploading : t.replaceImage}
                        </div>
                      </label>
                      <button
                        onClick={() => {
                          setCustomization({
                            ...customization,
                            global_image_url: null
                          });
                          setSavedMessage('imageRemoved');
                          setTimeout(() => setSavedMessage(''), 3000);
                        }}
                        className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200 transition-colors"
                      >
                        {t.remove}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadImage('global', file);
                      }}
                      disabled={uploadingImage === 'global'}
                    />
                    <div className="border-2 border-dashed border-stone-300 rounded-lg p-6 text-center hover:border-stone-400 transition-colors">
                      <div className="text-stone-500">
                        {uploadingImage === 'global' ? (
                          <span>{t.uploading}</span>
                        ) : (
                          <>
                            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm">{t.uploadSidebar}</p>
                            <p className="text-xs text-stone-400 mt-1">{t.sidebarRecommended}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </label>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t.borderRadius}
                </label>
                <select
                  value={customization.styling.borderRadius}
                  onChange={(e) => updateStyling('borderRadius', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                >
                  <option value="none">{t.radiusNone}</option>
                  <option value="sm">{t.radiusSmall}</option>
                  <option value="md">{t.radiusMedium}</option>
                  <option value="lg">{t.radiusLarge}</option>
                  <option value="xl">{t.radiusXl}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">
                  {t.spacing}
                </label>
                <select
                  value={customization.styling.spacing}
                  onChange={(e) => updateStyling('spacing', e.target.value)}
                  className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                >
                  <option value="compact">{t.spacingCompact}</option>
                  <option value="normal">{t.spacingNormal}</option>
                  <option value="relaxed">{t.spacingRelaxed}</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border border-stone-200 rounded-lg">
              <div>
                <h4 className="font-medium text-stone-900">{t.stepNumbers}</h4>
                <p className="text-sm text-stone-600">{t.stepNumbersHint}</p>
              </div>
              <button
                onClick={() => updateStyling('showStepNumbers', !customization.styling.showStepNumbers)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  customization.styling.showStepNumbers
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {customization.styling.showStepNumbers ? t.enabled : t.disabled}
              </button>
            </div>

            <div className="flex items-center justify-between p-4 border border-stone-200 rounded-lg">
              <div>
                <h4 className="font-medium text-stone-900">{t.animations}</h4>
                <p className="text-sm text-stone-600">{t.animationsHint}</p>
              </div>
              <button
                onClick={() => updateStyling('animationsEnabled', !customization.styling.animationsEnabled)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  customization.styling.animationsEnabled
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {customization.styling.animationsEnabled ? t.enabled : t.disabled}
              </button>
            </div>
          </div>
        </section>
      </div>

      <div className="flex justify-end mt-8 pt-8 border-t border-stone-200">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-5 h-5" />
          {saving ? t.saving : t.save}
        </button>
      </div>
    </div>
  );
}
