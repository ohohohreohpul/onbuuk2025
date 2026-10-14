import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ADMIN_ATTRIBUTION } from '../../lib/attribution';
import { supabase } from '../../lib/supabase';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import { toLocalDateString } from '../../lib/localDateTime';
import { useAdminText } from '../../lib/adminLanguage';
import { Translations, fillText } from '../../lib/bookingLanguage';

const TEXT: Translations<{
  title: string; close: string; serviceDetails: string; service: string; selectService: string;
  durationPrice: string; selectDuration: string; durationOption: string; specialist: string; selectSpecialist: string;
  next: string; back: string; dateTime: string; date: string; availableTimes: string; noSlots: string;
  customerInfo: string; existingCustomer: string; newCustomer: string; selectCustomerLabel: string; selectCustomer: string;
  name: string; namePlaceholder: string; email: string; phone: string; phonePlaceholder: string;
  notes: string; notesPlaceholder: string; creating: string; createBooking: string;
  errorSelectCustomer: string; errorCustomerFields: string; errorCreate: string;
}> = {
  en: {
    title: 'Create Booking', close: 'Close', serviceDetails: 'Service Details', service: 'Service', selectService: 'Select a service',
    durationPrice: 'Duration & Price', selectDuration: 'Select duration', durationOption: '{minutes} minutes - {price}',
    specialist: 'Specialist', selectSpecialist: 'Select a specialist',
    next: 'Next', back: 'Back', dateTime: 'Date & Time', date: 'Date', availableTimes: 'Available Times',
    noSlots: 'No available slots for this date',
    customerInfo: 'Customer Information', existingCustomer: 'Existing Customer', newCustomer: 'New Customer',
    selectCustomerLabel: 'Select Customer', selectCustomer: 'Select a customer',
    name: 'Name', namePlaceholder: 'Customer name', email: 'Email', phone: 'Phone', phonePlaceholder: 'Phone number',
    notes: 'Notes (Optional)', notesPlaceholder: 'Any special requests or notes', creating: 'Creating...', createBooking: 'Create Booking',
    errorSelectCustomer: 'Please select a customer', errorCustomerFields: 'All customer fields are required',
    errorCreate: 'Failed to create booking',
  },
  de: {
    title: 'Buchung erstellen', close: 'Schließen', serviceDetails: 'Leistung', service: 'Leistung', selectService: 'Leistung auswählen',
    durationPrice: 'Dauer & Preis', selectDuration: 'Dauer auswählen', durationOption: '{minutes} Minuten – {price}',
    specialist: 'Therapeut:in', selectSpecialist: 'Therapeut:in auswählen',
    next: 'Weiter', back: 'Zurück', dateTime: 'Datum & Uhrzeit', date: 'Datum', availableTimes: 'Verfügbare Zeiten',
    noSlots: 'An diesem Datum sind keine Zeiten frei',
    customerInfo: 'Kundendaten', existingCustomer: 'Bestehender Kunde', newCustomer: 'Neuer Kunde',
    selectCustomerLabel: 'Kunde auswählen', selectCustomer: 'Kunde auswählen',
    name: 'Name', namePlaceholder: 'Name des Kunden', email: 'E-Mail', phone: 'Telefon', phonePlaceholder: 'Telefonnummer',
    notes: 'Notizen (optional)', notesPlaceholder: 'Besondere Wünsche oder Notizen', creating: 'Wird erstellt...', createBooking: 'Buchung erstellen',
    errorSelectCustomer: 'Bitte einen Kunden auswählen', errorCustomerFields: 'Alle Kundenfelder sind Pflichtfelder',
    errorCreate: 'Buchung konnte nicht erstellt werden',
  },
  th: {
    title: 'สร้างการจอง', close: 'ปิด', serviceDetails: 'รายละเอียดบริการ', service: 'บริการ', selectService: 'เลือกบริการ',
    durationPrice: 'ระยะเวลาและราคา', selectDuration: 'เลือกระยะเวลา', durationOption: '{minutes} นาที - {price}',
    specialist: 'พนักงานบริการ', selectSpecialist: 'เลือกพนักงานบริการ',
    next: 'ถัดไป', back: 'ย้อนกลับ', dateTime: 'วันและเวลา', date: 'วันที่', availableTimes: 'เวลาที่ว่าง',
    noSlots: 'ไม่มีเวลาว่างในวันนี้',
    customerInfo: 'ข้อมูลลูกค้า', existingCustomer: 'ลูกค้าเดิม', newCustomer: 'ลูกค้าใหม่',
    selectCustomerLabel: 'เลือกลูกค้า', selectCustomer: 'เลือกลูกค้า',
    name: 'ชื่อ', namePlaceholder: 'ชื่อลูกค้า', email: 'อีเมล', phone: 'โทรศัพท์', phonePlaceholder: 'เบอร์โทรศัพท์',
    notes: 'หมายเหตุ (ไม่บังคับ)', notesPlaceholder: 'คำขอพิเศษหรือหมายเหตุ', creating: 'กำลังสร้าง...', createBooking: 'สร้างการจอง',
    errorSelectCustomer: 'กรุณาเลือกลูกค้า', errorCustomerFields: 'กรุณากรอกข้อมูลลูกค้าให้ครบทุกช่อง',
    errorCreate: 'สร้างการจองไม่สำเร็จ',
  },
};

interface Service {
  id: string;
  name: string;
  category: string;
}

interface ServiceDuration {
  id: string;
  duration_minutes: number;
  price_cents: number;
}

interface Specialist {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  email: string;
  name: string;
  phone: string;
}

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preselectedDate?: string;
}

export default function CreateBookingModal({ isOpen, onClose, onSuccess, preselectedDate }: CreateBookingModalProps) {
  const { t } = useAdminText(TEXT);
  const { businessId } = useTenant();
  const { formatPrice } = useCurrency();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [services, setServices] = useState<Service[]>([]);
  const [durations, setDurations] = useState<ServiceDuration[]>([]);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    serviceId: '',
    durationId: '',
    specialistId: '',
    customerType: 'existing',
    customerId: '',
    newCustomerName: '',
    newCustomerEmail: '',
    newCustomerPhone: '',
    date: preselectedDate || toLocalDateString(new Date()),
    time: '',
    notes: ''
  });

  useEffect(() => {
    if (isOpen && businessId) {
      loadServices();
      loadSpecialists();
      loadCustomers();
    }
  }, [isOpen, businessId]);

  useEffect(() => {
    if (formData.serviceId) {
      loadDurations(formData.serviceId);
    }
  }, [formData.serviceId]);

  useEffect(() => {
    if (formData.date && formData.durationId && formData.specialistId) {
      loadAvailableSlots();
    }
  }, [formData.date, formData.durationId, formData.specialistId]);

  const loadServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('id, name, category')
      .eq('business_id', businessId)
      .order('name');
    if (data) setServices(data);
  };

  const loadDurations = async (serviceId: string) => {
    const { data } = await supabase
      .from('service_durations')
      .select('id, duration_minutes, price_cents')
      .eq('service_id', serviceId)
      .order('duration_minutes');
    if (data) setDurations(data);
  };

  const loadSpecialists = async () => {
    const { data } = await supabase
      .from('specialists')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name');
    if (data) setSpecialists(data);
  };

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, email, name, phone')
      .eq('business_id', businessId)
      .order('name');
    if (data) setCustomers(data);
  };

  const loadAvailableSlots = async () => {
    const duration = durations.find(d => d.id === formData.durationId);
    if (!duration) return;

    const slots: string[] = [];
    const startHour = 9;
    const endHour = 21;

    for (let hour = startHour; hour < endHour; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('start_time, total_duration_minutes')
      .eq('specialist_id', formData.specialistId)
      .eq('booking_date', formData.date);

    const available = slots.filter(slot => {
      return !existingBookings?.some(booking => {
        const bookingStart = booking.start_time;
        const bookingDuration = booking.total_duration_minutes || 60;
        const bookingEnd = addMinutes(bookingStart, bookingDuration);
        const slotEnd = addMinutes(slot, duration.duration_minutes);

        return (slot >= bookingStart && slot < bookingEnd) ||
               (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
               (slot <= bookingStart && slotEnd >= bookingEnd);
      });
    });

    setAvailableSlots(available);
  };

  const addMinutes = (time: string, minutes: number): string => {
    const [hours, mins] = time.split(':').map(Number);
    const totalMinutes = hours * 60 + mins + minutes;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      let customerEmail = '';
      let customerName = '';
      let customerPhone = '';

      if (formData.customerType === 'existing') {
        const customer = customers.find(c => c.id === formData.customerId);
        if (!customer) {
          setError(t.errorSelectCustomer);
          setLoading(false);
          return;
        }
        customerEmail = customer.email;
        customerName = customer.name;
        customerPhone = customer.phone;
      } else {
        if (!formData.newCustomerName || !formData.newCustomerEmail || !formData.newCustomerPhone) {
          setError(t.errorCustomerFields);
          setLoading(false);
          return;
        }
        customerEmail = formData.newCustomerEmail;
        customerName = formData.newCustomerName;
        customerPhone = formData.newCustomerPhone;

        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('email', customerEmail)
          .eq('business_id', businessId)
          .maybeSingle();

        if (!existingCustomer) {
          await supabase.from('customers').insert({
            business_id: businessId,
            email: customerEmail,
            name: customerName,
            phone: customerPhone
          });
        }
      }

      const duration = durations.find(d => d.id === formData.durationId);

      const { error: bookingError } = await supabase.from('bookings').insert({
        ...ADMIN_ATTRIBUTION,
        business_id: businessId,
        service_id: formData.serviceId,
        duration_id: formData.durationId,
        specialist_id: formData.specialistId,
        customer_email: customerEmail,
        customer_name: customerName,
        customer_phone: customerPhone,
        booking_date: formData.date,
        start_time: formData.time,
        total_duration_minutes: duration?.duration_minutes,
        total_price_cents: duration?.price_cents || 0,
        status: 'confirmed',
        payment_status: 'pending',
        notes: formData.notes
      });

      if (bookingError) throw bookingError;

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || t.errorCreate);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      serviceId: '',
      durationId: '',
      specialistId: '',
      customerType: 'existing',
      customerId: '',
      newCustomerName: '',
      newCustomerEmail: '',
      newCustomerPhone: '',
      date: preselectedDate || toLocalDateString(new Date()),
      time: '',
      notes: ''
    });
    setStep(1);
    setError('');
    setDurations([]);
    setAvailableSlots([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-stone-200 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-light text-stone-900">{t.title}</h2>
          <button onClick={handleClose} aria-label={t.close} title={t.close} className="text-stone-400 hover:text-stone-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex items-center justify-between mb-6">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-600'
                }`}>
                  {s}
                </div>
                {s < 3 && <div className={`flex-1 h-1 mx-2 ${step > s ? 'bg-stone-900' : 'bg-stone-200'}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-stone-900">{t.serviceDetails}</h3>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.service}</label>
                <select
                  value={formData.serviceId}
                  onChange={(e) => setFormData({ ...formData, serviceId: e.target.value, durationId: '' })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                >
                  <option value="">{t.selectService}</option>
                  {services.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} ({service.category})
                    </option>
                  ))}
                </select>
              </div>

              {formData.serviceId && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">{t.durationPrice}</label>
                  <select
                    value={formData.durationId}
                    onChange={(e) => setFormData({ ...formData, durationId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                  >
                    <option value="">{t.selectDuration}</option>
                    {durations.map(duration => (
                      <option key={duration.id} value={duration.id}>
                        {fillText(t.durationOption, { minutes: duration.duration_minutes, price: formatPrice(duration.price_cents) })}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.specialist}</label>
                <select
                  value={formData.specialistId}
                  onChange={(e) => setFormData({ ...formData, specialistId: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                >
                  <option value="">{t.selectSpecialist}</option>
                  {specialists.map(specialist => (
                    <option key={specialist.id} value={specialist.id}>
                      {specialist.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  disabled={!formData.serviceId || !formData.durationId || !formData.specialistId}
                  className="px-6 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.next}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-stone-900">{t.dateTime}</h3>

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.date}</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value, time: '' })}
                  min={toLocalDateString(new Date())}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                />
              </div>

              {availableSlots.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">{t.availableTimes}</label>
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                    {availableSlots.map(slot => (
                      <button
                        key={slot}
                        onClick={() => setFormData({ ...formData, time: slot })}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                          formData.time === slot
                            ? 'bg-stone-900 text-white border-stone-900'
                            : 'bg-white text-stone-700 border-stone-300 hover:border-stone-900'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {availableSlots.length === 0 && formData.date && (
                <p className="text-sm text-stone-500">{t.noSlots}</p>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-6 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50"
                >
                  {t.back}
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={!formData.time}
                  className="px-6 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t.next}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-stone-900">{t.customerInfo}</h3>

              <div className="flex space-x-4">
                <button
                  onClick={() => setFormData({ ...formData, customerType: 'existing' })}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                    formData.customerType === 'existing'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  {t.existingCustomer}
                </button>
                <button
                  onClick={() => setFormData({ ...formData, customerType: 'new' })}
                  className={`flex-1 px-4 py-2 rounded-lg border transition-colors ${
                    formData.customerType === 'new'
                      ? 'bg-stone-900 text-white border-stone-900'
                      : 'bg-white text-stone-700 border-stone-300'
                  }`}
                >
                  {t.newCustomer}
                </button>
              </div>

              {formData.customerType === 'existing' ? (
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-2">{t.selectCustomerLabel}</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                  >
                    <option value="">{t.selectCustomer}</option>
                    {customers.map(customer => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} ({customer.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">{t.name}</label>
                    <input
                      type="text"
                      value={formData.newCustomerName}
                      onChange={(e) => setFormData({ ...formData, newCustomerName: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                      placeholder={t.namePlaceholder}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">{t.email}</label>
                    <input
                      type="email"
                      value={formData.newCustomerEmail}
                      onChange={(e) => setFormData({ ...formData, newCustomerEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 mb-2">{t.phone}</label>
                    <input
                      type="tel"
                      value={formData.newCustomerPhone}
                      onChange={(e) => setFormData({ ...formData, newCustomerPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                      placeholder={t.phonePlaceholder}
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t.notes}</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-stone-900"
                  rows={3}
                  placeholder={t.notesPlaceholder}
                />
              </div>

              <div className="flex justify-between pt-4">
                <button
                  onClick={() => setStep(2)}
                  className="px-6 py-2 border border-stone-300 text-stone-700 rounded-lg hover:bg-stone-50"
                  disabled={loading}
                >
                  {t.back}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading || (formData.customerType === 'existing' ? !formData.customerId : !formData.newCustomerName || !formData.newCustomerEmail || !formData.newCustomerPhone)}
                  className="px-6 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? t.creating : t.createBooking}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
