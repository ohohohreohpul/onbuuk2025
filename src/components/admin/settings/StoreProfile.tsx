import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Save, Store, AlertCircle, CheckCircle, Link as LinkIcon } from 'lucide-react';
import { useTenant } from '../../../lib/tenantContext';
import { RESERVED_SUBDOMAINS, shopUrl, toSubdomainLabel } from '../../../lib/tenantHost';
import BookingLanguageSetting from './BookingLanguageSetting';
import { useAdminText } from '../../../lib/adminLanguage';
import { fillText, type Translations } from '../../../lib/bookingLanguage';

const RESERVED_ROUTES = RESERVED_SUBDOMAINS;

const TEXT: Translations<{
  reserved: string; taken: string; saved: string; saveFailed: string; loading: string; title: string; subtitle: string;
  complete: string; completeTitle: string; completeBody: string; basicInfo: string; businessName: string;
  namePlaceholder: string; businessType: string; typeSalon: string; typeSpa: string; typeMassage: string;
  typeBarber: string; typeNail: string; typeWellness: string; typeOther: string; phone: string; address: string;
  addressPlaceholder: string; urlTitle: string; permalink: string; permalinkPlaceholder: string; checking: string;
  reservedShort: string; takenShort: string; available: string; yourUrl: string; copied: string; copy: string;
  saving: string; save: string;
}> = {
  en: {
    reserved: 'This permalink is reserved by the system. Please choose a different one.',
    taken: 'This permalink is already taken. Please choose another one.',
    saved: 'Store profile saved successfully!', saveFailed: 'Failed to save profile', loading: 'Loading...',
    title: 'Store Profile', subtitle: 'Manage your business information', complete: '{percent}% Complete',
    completeTitle: 'Complete Your Profile',
    completeBody: 'Fill out your store information to start accepting bookings. Your booking page will be available once your profile is complete.',
    basicInfo: 'Basic Information', businessName: 'Business Name', namePlaceholder: 'My Awesome Salon',
    businessType: 'Business Type', typeSalon: 'Salon', typeSpa: 'Spa', typeMassage: 'Massage Studio',
    typeBarber: 'Barbershop', typeNail: 'Nail Salon', typeWellness: 'Wellness Center', typeOther: 'Other',
    phone: 'Phone Number', address: 'Business Address', addressPlaceholder: '123 Main St, City, State 12345',
    urlTitle: 'Booking Page URL', permalink: 'Permalink', permalinkPlaceholder: 'your-business-name',
    checking: 'Checking availability...', reservedShort: 'This permalink is reserved by the system',
    takenShort: 'This permalink is already taken', available: 'This permalink is available',
    yourUrl: 'Your Booking Page URL', copied: 'URL copied to clipboard!', copy: 'Copy',
    saving: 'Saving...', save: 'Save Profile',
  },
  de: {
    reserved: 'Dieser Permalink ist vom System reserviert. Bitte einen anderen wählen.',
    taken: 'Dieser Permalink ist bereits vergeben. Bitte einen anderen wählen.',
    saved: 'Shop-Profil gespeichert.', saveFailed: 'Profil konnte nicht gespeichert werden', loading: 'Wird geladen…',
    title: 'Shop-Profil', subtitle: 'Angaben zu Ihrem Unternehmen verwalten', complete: '{percent} % vollständig',
    completeTitle: 'Profil vervollständigen',
    completeBody: 'Füllen Sie die Shop-Angaben aus, um Buchungen anzunehmen. Ihre Buchungsseite ist verfügbar, sobald das Profil vollständig ist.',
    basicInfo: 'Grunddaten', businessName: 'Name des Unternehmens', namePlaceholder: 'Mein Salon',
    businessType: 'Art des Unternehmens', typeSalon: 'Salon', typeSpa: 'Spa', typeMassage: 'Massagestudio',
    typeBarber: 'Barbershop', typeNail: 'Nagelstudio', typeWellness: 'Wellnesscenter', typeOther: 'Sonstiges',
    phone: 'Telefonnummer', address: 'Geschäftsadresse', addressPlaceholder: 'Musterstraße 1, 12345 Berlin',
    urlTitle: 'URL der Buchungsseite', permalink: 'Permalink', permalinkPlaceholder: 'ihr-unternehmen',
    checking: 'Verfügbarkeit wird geprüft…', reservedShort: 'Dieser Permalink ist vom System reserviert',
    takenShort: 'Dieser Permalink ist bereits vergeben', available: 'Dieser Permalink ist verfügbar',
    yourUrl: 'URL Ihrer Buchungsseite', copied: 'URL in die Zwischenablage kopiert.', copy: 'Kopieren',
    saving: 'Wird gespeichert…', save: 'Profil speichern',
  },
  th: {
    reserved: 'ลิงก์นี้ถูกสงวนไว้โดยระบบ กรุณาเลือกลิงก์อื่น',
    taken: 'ลิงก์นี้มีผู้ใช้แล้ว กรุณาเลือกลิงก์อื่น',
    saved: 'บันทึกข้อมูลร้านแล้ว', saveFailed: 'บันทึกข้อมูลร้านไม่สำเร็จ', loading: 'กำลังโหลด…',
    title: 'ข้อมูลร้าน', subtitle: 'จัดการข้อมูลธุรกิจของคุณ', complete: 'กรอกแล้ว {percent}%',
    completeTitle: 'กรอกข้อมูลร้านให้ครบ',
    completeBody: 'กรอกข้อมูลร้านเพื่อเริ่มรับการจอง หน้าจองจะเปิดใช้งานเมื่อกรอกข้อมูลครบแล้ว',
    basicInfo: 'ข้อมูลพื้นฐาน', businessName: 'ชื่อธุรกิจ', namePlaceholder: 'ร้านของฉัน',
    businessType: 'ประเภทธุรกิจ', typeSalon: 'ซาลอน', typeSpa: 'สปา', typeMassage: 'ร้านนวด',
    typeBarber: 'ร้านตัดผมชาย', typeNail: 'ร้านทำเล็บ', typeWellness: 'ศูนย์สุขภาพ', typeOther: 'อื่น ๆ',
    phone: 'เบอร์โทรศัพท์', address: 'ที่อยู่ธุรกิจ', addressPlaceholder: 'Musterstraße 1, 12345 Berlin',
    urlTitle: 'ลิงก์หน้าจอง', permalink: 'ลิงก์ถาวร (Permalink)', permalinkPlaceholder: 'your-business-name',
    checking: 'กำลังตรวจสอบ…', reservedShort: 'ลิงก์นี้ถูกสงวนไว้โดยระบบ',
    takenShort: 'ลิงก์นี้มีผู้ใช้แล้ว', available: 'ลิงก์นี้ใช้ได้',
    yourUrl: 'ลิงก์หน้าจองของคุณ', copied: 'คัดลอกลิงก์แล้ว', copy: 'คัดลอก',
    saving: 'กำลังบันทึก…', save: 'บันทึกข้อมูลร้าน',
  },
};

interface Business {
  id: string;
  name: string | null;
  business_type: string | null;
  phone: string | null;
  address: string | null;
  permalink: string;
  profile_completed: boolean;
}

export default function StoreProfile() {
  const { businessId } = useTenant();
  const { t } = useAdminText(TEXT);
  const [business, setBusiness] = useState<Business | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    business_type: 'salon',
    phone: '',
    address: '',
    permalink: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const [error, setError] = useState('');
  const [permalinkAvailable, setPermalinkAvailable] = useState(true);
  const [checkingPermalink, setCheckingPermalink] = useState(false);
  const [isReservedRoute, setIsReservedRoute] = useState(false);

  useEffect(() => {
    fetchBusiness();
  }, [businessId]);

  const fetchBusiness = async () => {
    if (!businessId) return;

    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', businessId)
      .single();

    if (data) {
      setBusiness(data);
      setFormData({
        name: data.name || '',
        business_type: data.business_type || 'salon',
        phone: data.phone || '',
        address: data.address || '',
        permalink: data.permalink || '',
      });
    }

    if (error) {
      console.error('Error fetching business:', error);
    }

    setLoading(false);
  };

  const checkPermalinkAvailability = async (permalink: string) => {
    if (!permalink || permalink === business?.permalink) {
      setPermalinkAvailable(true);
      return;
    }

    setCheckingPermalink(true);

    const { data } = await supabase
      .from('businesses')
      .select('id')
      .eq('permalink', permalink)
      .maybeSingle();

    setPermalinkAvailable(!data);
    setCheckingPermalink(false);
  };

  const handlePermalinkChange = (value: string) => {
    const sanitized = toSubdomainLabel(value);

    const isReserved = RESERVED_ROUTES.includes(sanitized);
    setIsReservedRoute(isReserved);

    setFormData({ ...formData, permalink: sanitized });

    if (!isReserved) {
      checkPermalinkAvailability(sanitized);
    } else {
      setPermalinkAvailable(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!businessId) return;
    if (isReservedRoute) {
      setError(t.reserved);
      return;
    }
    if (!permalinkAvailable) {
      setError(t.taken);
      return;
    }

    setSaving(true);
    setError('');
    setSavedMessage('');

    try {
      const isFirstCompletion = !business?.profile_completed && formData.name;

      const { error: updateError } = await supabase
        .from('businesses')
        .update({
          name: formData.name,
          business_type: formData.business_type,
          phone: formData.phone,
          address: formData.address,
          permalink: formData.permalink,
          profile_completed: isFirstCompletion ? true : business?.profile_completed,
        })
        .eq('id', businessId);

      if (updateError) throw updateError;

      localStorage.setItem('business_permalink', formData.permalink);

      setSavedMessage(t.saved);
      await fetchBusiness();

      setTimeout(() => setSavedMessage(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const getCompletionPercentage = () => {
    const fields = [formData.name, formData.business_type, formData.phone, formData.address, formData.permalink];
    const completed = fields.filter(f => f && f.trim() !== '').length;
    return Math.round((completed / fields.length) * 100);
  };

  const bookingUrl = shopUrl(formData.permalink);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-stone-600">{t.loading}</div>
      </div>
    );
  }

  const completionPercentage = getCompletionPercentage();

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Store className="w-8 h-8 text-stone-900" />
            <div>
              <h2 className="text-2xl font-bold text-stone-900">{t.title}</h2>
              <p className="text-stone-600 text-sm">{t.subtitle}</p>
            </div>
          </div>

          {!business?.profile_completed && (
            <div className="flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-lg border border-amber-200">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-medium text-amber-900">
                {fillText(t.complete, { percent: String(completionPercentage) })}
              </span>
            </div>
          )}
        </div>

        {!business?.profile_completed && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">{t.completeTitle}</h3>
                <p className="text-sm text-blue-800">
                  {t.completeBody}
                </p>
              </div>
            </div>
          </div>
        )}
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

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
          <h3 className="text-lg font-semibold text-stone-900">{t.basicInfo}</h3>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.businessName} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder={t.namePlaceholder}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.businessType} <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.business_type}
              onChange={(e) => setFormData({ ...formData, business_type: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent bg-white"
            >
              <option value="salon">{t.typeSalon}</option>
              <option value="spa">{t.typeSpa}</option>
              <option value="massage_studio">{t.typeMassage}</option>
              <option value="barbershop">{t.typeBarber}</option>
              <option value="nail_salon">{t.typeNail}</option>
              <option value="wellness_center">{t.typeWellness}</option>
              <option value="other">{t.typeOther}</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.phone} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder="+1 (555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.address} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
              placeholder={t.addressPlaceholder}
            />
          </div>
        </div>

        <BookingLanguageSetting />

        <div className="bg-white border border-stone-200 rounded-lg p-6 space-y-6">
          <h3 className="text-lg font-semibold text-stone-900">{t.urlTitle}</h3>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              {t.permalink} <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              <input
                type="text"
                required
                value={formData.permalink}
                onChange={(e) => handlePermalinkChange(e.target.value)}
                className="w-full px-4 py-3 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900 focus:border-transparent"
                placeholder={t.permalinkPlaceholder}
              />
              {checkingPermalink ? (
                <p className="text-sm text-stone-600">{t.checking}</p>
              ) : isReservedRoute ? (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {t.reservedShort}
                </p>
              ) : !permalinkAvailable ? (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {t.takenShort}
                </p>
              ) : formData.permalink ? (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  {t.available}
                </p>
              ) : null}
            </div>
          </div>

          {formData.permalink && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg p-4">
              <label className="block text-sm font-medium text-stone-700 mb-2">
                {t.yourUrl}
              </label>
              <div className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5 text-stone-400" />
                <code className="flex-1 text-sm text-stone-900 break-all">{bookingUrl}</code>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(bookingUrl);
                    setSavedMessage(t.copied);
                    setTimeout(() => setSavedMessage(''), 2000);
                  }}
                  className="px-3 py-1.5 bg-stone-900 text-white text-sm rounded hover:bg-stone-800 transition-colors"
                >
                  {t.copy}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !permalinkAvailable || isReservedRoute}
            className="flex items-center gap-2 px-6 py-3 bg-stone-900 text-white rounded-lg font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {saving ? t.saving : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}
