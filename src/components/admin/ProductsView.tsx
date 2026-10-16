import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, X, Package, LayoutList, LayoutGrid, Image } from 'lucide-react';
import { useTenant } from '../../lib/tenantContext';
import { useCurrency } from '../../lib/currencyContext';
import { useAdminText } from '../../lib/adminLanguage';
import { fillText, type Translations } from '../../lib/bookingLanguage';

const TEXT: Translations<{
  title: string; subtitle: string; allCategories: string; listView: string; gridView: string; addProduct: string;
  productCountOne: string; productCountMany: string; selectOneOnly: string; uncategorized: string; emptyTitle: string;
  emptyHint: string; emptyCategory: string; editProduct: string; newProduct: string; close: string; productName: string;
  productNamePlaceholder: string; description: string; descriptionPlaceholder: string; category: string;
  selectCategory: string; createCategory: string; newCategoryPlaceholder: string; backToCategories: string; price: string;
  exclusiveTitle: string; exclusiveHint: string; productImage: string; imageAlt: string; noImage: string; uploading: string;
  uploadImage: string; removeImage: string; imageHint: string; maxQuantity: string; maxQuantityPlaceholder: string;
  maxQuantityHint: string; statusTitle: string; statusHint: string; availableFor: string; allServices: string;
  allServicesHint: string; specificServices: string; specificServicesHint: string; noServices: string;
  updateProduct: string; createProduct: string; cancel: string; inactive: string; exclusive: string; edit: string;
  delete: string; maxPerBooking: string; maxShort: string; imageTooLarge: string; uploadFailed: string;
  businessNotFound: string; nameRequired: string; descriptionRequired: string; updateFailed: string; createFailed: string;
  saveFailed: string; unknownError: string; confirmDelete: string; deleteFailed: string;
}> = {
  en: {
    title: 'Add-on products', subtitle: 'Manage products that can be added to bookings', allCategories: 'All categories',
    listView: 'List view', gridView: 'Grid view', addProduct: 'Add product', productCountOne: '1 product',
    productCountMany: '{count} products', selectOneOnly: 'Select one only', uncategorized: 'Uncategorized',
    emptyTitle: 'No products yet', emptyHint: 'Create your first add-on product.', emptyCategory: 'No products in this category',
    editProduct: 'Edit product', newProduct: 'New product', close: 'Close', productName: 'Product name',
    productNamePlaceholder: 'e.g. Aromatherapy oil', description: 'Description', descriptionPlaceholder: 'Describe your product…',
    category: 'Category', selectCategory: 'Select a category…', createCategory: '+ Create new category',
    newCategoryPlaceholder: 'Enter new category name', backToCategories: '← Back to existing categories', price: 'Price',
    exclusiveTitle: 'Exclusive selection', exclusiveHint: 'Only one product from this category can be selected per booking',
    productImage: 'Product image (optional)', imageAlt: 'Product', noImage: 'No image', uploading: 'Uploading…',
    uploadImage: 'Upload image', removeImage: 'Remove image', imageHint: 'Max 2 MB. JPG, PNG or WebP recommended.',
    maxQuantity: 'Maximum quantity per booking', maxQuantityPlaceholder: 'Leave empty for unlimited',
    maxQuantityHint: 'How many times can this be added per booking?', statusTitle: 'Product status',
    statusHint: "Inactive products won't be shown to customers", availableFor: 'Available for', allServices: 'All services',
    allServicesHint: 'This product will be available for all services', specificServices: 'Specific services',
    specificServicesHint: 'Choose which services can offer this product', noServices: 'No services available',
    updateProduct: 'Update product', createProduct: 'Create product', cancel: 'Cancel', inactive: 'Inactive',
    exclusive: 'Exclusive', edit: 'Edit', delete: 'Delete', maxPerBooking: 'Max {count} per booking', maxShort: 'Max: {count}',
    imageTooLarge: 'The image must be smaller than 2 MB.', uploadFailed: 'Could not upload the image. Please try again.',
    businessNotFound: 'Business not found. Please refresh the page.', nameRequired: 'Please enter a product name.',
    descriptionRequired: 'Please enter a product description.', updateFailed: 'Could not update the product: {message}',
    createFailed: 'Could not create the product: {message}', saveFailed: 'An error occurred while saving the product: {message}',
    unknownError: 'Unknown error', confirmDelete: 'Are you sure you want to delete this product?',
    deleteFailed: 'Could not delete the product: {message}',
  },
  de: {
    title: 'Zusatzprodukte', subtitle: 'Produkte verwalten, die zu Buchungen hinzugefügt werden können', allCategories: 'Alle Kategorien',
    listView: 'Listenansicht', gridView: 'Rasteransicht', addProduct: 'Produkt hinzufügen', productCountOne: '1 Produkt',
    productCountMany: '{count} Produkte', selectOneOnly: 'Nur eine Auswahl', uncategorized: 'Ohne Kategorie',
    emptyTitle: 'Noch keine Produkte', emptyHint: 'Legen Sie Ihr erstes Zusatzprodukt an.', emptyCategory: 'Keine Produkte in dieser Kategorie',
    editProduct: 'Produkt bearbeiten', newProduct: 'Neues Produkt', close: 'Schließen', productName: 'Produktname',
    productNamePlaceholder: 'z. B. Aromaöl', description: 'Beschreibung', descriptionPlaceholder: 'Produkt beschreiben…',
    category: 'Kategorie', selectCategory: 'Kategorie auswählen…', createCategory: '+ Neue Kategorie anlegen',
    newCategoryPlaceholder: 'Name der neuen Kategorie', backToCategories: '← Zurück zu bestehenden Kategorien', price: 'Preis',
    exclusiveTitle: 'Exklusive Auswahl', exclusiveHint: 'Pro Buchung kann nur ein Produkt dieser Kategorie gewählt werden',
    productImage: 'Produktbild (optional)', imageAlt: 'Produkt', noImage: 'Kein Bild', uploading: 'Wird hochgeladen…',
    uploadImage: 'Bild hochladen', removeImage: 'Bild entfernen', imageHint: 'Max. 2 MB. JPG, PNG oder WebP empfohlen.',
    maxQuantity: 'Höchstmenge pro Buchung', maxQuantityPlaceholder: 'Leer lassen für unbegrenzt',
    maxQuantityHint: 'Wie oft kann das Produkt pro Buchung hinzugefügt werden?', statusTitle: 'Produktstatus',
    statusHint: 'Inaktive Produkte werden Kunden nicht angezeigt', availableFor: 'Verfügbar für', allServices: 'Alle Leistungen',
    allServicesHint: 'Dieses Produkt ist für alle Leistungen verfügbar', specificServices: 'Bestimmte Leistungen',
    specificServicesHint: 'Wählen Sie, bei welchen Leistungen das Produkt angeboten wird', noServices: 'Keine Leistungen vorhanden',
    updateProduct: 'Produkt speichern', createProduct: 'Produkt anlegen', cancel: 'Abbrechen', inactive: 'Inaktiv',
    exclusive: 'Exklusiv', edit: 'Bearbeiten', delete: 'Löschen', maxPerBooking: 'Max. {count} pro Buchung', maxShort: 'Max.: {count}',
    imageTooLarge: 'Das Bild muss kleiner als 2 MB sein.', uploadFailed: 'Bild konnte nicht hochgeladen werden. Bitte erneut versuchen.',
    businessNotFound: 'Unternehmen nicht gefunden. Bitte Seite neu laden.', nameRequired: 'Bitte einen Produktnamen eingeben.',
    descriptionRequired: 'Bitte eine Produktbeschreibung eingeben.', updateFailed: 'Produkt konnte nicht gespeichert werden: {message}',
    createFailed: 'Produkt konnte nicht angelegt werden: {message}', saveFailed: 'Beim Speichern des Produkts ist ein Fehler aufgetreten: {message}',
    unknownError: 'Unbekannter Fehler', confirmDelete: 'Dieses Produkt wirklich löschen?',
    deleteFailed: 'Produkt konnte nicht gelöscht werden: {message}',
  },
  th: {
    title: 'สินค้าเสริม', subtitle: 'จัดการสินค้าที่เพิ่มในการจองได้', allCategories: 'ทุกหมวดหมู่',
    listView: 'มุมมองรายการ', gridView: 'มุมมองตาราง', addProduct: 'เพิ่มสินค้า', productCountOne: '1 สินค้า',
    productCountMany: '{count} สินค้า', selectOneOnly: 'เลือกได้เพียงหนึ่ง', uncategorized: 'ไม่มีหมวดหมู่',
    emptyTitle: 'ยังไม่มีสินค้า', emptyHint: 'สร้างสินค้าเสริมรายการแรกของคุณ', emptyCategory: 'ไม่มีสินค้าในหมวดหมู่นี้',
    editProduct: 'แก้ไขสินค้า', newProduct: 'สินค้าใหม่', close: 'ปิด', productName: 'ชื่อสินค้า',
    productNamePlaceholder: 'เช่น น้ำมันอโรมา', description: 'รายละเอียด', descriptionPlaceholder: 'อธิบายสินค้าของคุณ…',
    category: 'หมวดหมู่', selectCategory: 'เลือกหมวดหมู่…', createCategory: '+ สร้างหมวดหมู่ใหม่',
    newCategoryPlaceholder: 'ใส่ชื่อหมวดหมู่ใหม่', backToCategories: '← กลับไปที่หมวดหมู่ที่มีอยู่', price: 'ราคา',
    exclusiveTitle: 'เลือกได้รายการเดียว', exclusiveHint: 'ลูกค้าเลือกสินค้าในหมวดหมู่นี้ได้เพียงหนึ่งรายการต่อการจอง',
    productImage: 'รูปสินค้า (ไม่บังคับ)', imageAlt: 'สินค้า', noImage: 'ไม่มีรูปภาพ', uploading: 'กำลังอัปโหลด…',
    uploadImage: 'อัปโหลดรูปภาพ', removeImage: 'ลบรูปภาพ', imageHint: 'ไม่เกิน 2 MB แนะนำ JPG, PNG หรือ WebP',
    maxQuantity: 'จำนวนสูงสุดต่อการจอง', maxQuantityPlaceholder: 'เว้นว่างไว้หากไม่จำกัด',
    maxQuantityHint: 'เพิ่มสินค้านี้ได้กี่ครั้งต่อการจอง', statusTitle: 'สถานะสินค้า',
    statusHint: 'สินค้าที่ปิดใช้งานจะไม่แสดงให้ลูกค้าเห็น', availableFor: 'ใช้ได้กับ', allServices: 'ทุกบริการ',
    allServicesHint: 'สินค้านี้ใช้ได้กับทุกบริการ', specificServices: 'บางบริการ',
    specificServicesHint: 'เลือกบริการที่จะเสนอสินค้านี้', noServices: 'ยังไม่มีบริการ',
    updateProduct: 'บันทึกสินค้า', createProduct: 'สร้างสินค้า', cancel: 'ยกเลิก', inactive: 'ปิดใช้งาน',
    exclusive: 'เลือกได้รายการเดียว', edit: 'แก้ไข', delete: 'ลบ', maxPerBooking: 'สูงสุด {count} ต่อการจอง', maxShort: 'สูงสุด: {count}',
    imageTooLarge: 'รูปภาพต้องมีขนาดไม่เกิน 2 MB', uploadFailed: 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง',
    businessNotFound: 'ไม่พบข้อมูลร้าน กรุณารีเฟรชหน้า', nameRequired: 'กรุณาใส่ชื่อสินค้า',
    descriptionRequired: 'กรุณาใส่รายละเอียดสินค้า', updateFailed: 'อัปเดตสินค้าไม่สำเร็จ: {message}',
    createFailed: 'สร้างสินค้าไม่สำเร็จ: {message}', saveFailed: 'เกิดข้อผิดพลาดขณะบันทึกสินค้า: {message}',
    unknownError: 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ', confirmDelete: 'ต้องการลบสินค้านี้ใช่หรือไม่',
    deleteFailed: 'ลบสินค้าไม่สำเร็จ: {message}',
  },
};

interface Product {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string | null;
  is_active: boolean;
  display_order: number;
  max_quantity_per_booking: number | null;
  category: string | null;
  is_exclusive_in_category: boolean;
}

interface Service {
  id: string;
  name: string;
}

export default function ProductsView() {
  const { businessId } = useTenant();
  const { formatAmount } = useCurrency();
  const { t } = useAdminText(TEXT);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price_cents: 0,
    image_url: '',
    is_active: true,
    max_quantity_per_booking: 1,
    category: '',
    is_exclusive_in_category: false,
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isAvailableForAll, setIsAvailableForAll] = useState(true);
  const [existingCategories, setExistingCategories] = useState<string[]>([]);
  const [isCreatingNewCategory, setIsCreatingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (businessId) {
      fetchProducts();
      fetchServices();
    }
  }, [businessId]);

  const fetchProducts = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .order('category')
      .order('display_order')
      .order('name');

    if (data) {
      setProducts(data);
      
      // Extract unique categories
      const categories = data
        .map(p => p.category)
        .filter((cat): cat is string => cat !== null && cat !== '')
        .filter((cat, index, self) => self.indexOf(cat) === index)
        .sort();
      setExistingCategories(categories);
    }
    setLoading(false);
  };

  const fetchServices = async () => {
    if (!businessId) return;

    const { data } = await supabase
      .from('services')
      .select('id, name')
      .eq('business_id', businessId)
      .order('name');

    if (data) {
      setServices(data);
    }
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      description: '',
      price_cents: 0,
      image_url: '',
      is_active: true,
      max_quantity_per_booking: 1,
      category: '',
      is_exclusive_in_category: false,
    });
    setSelectedServices([]);
    setIsAvailableForAll(true);
    setIsCreatingNewCategory(false);
    setNewCategoryName('');
    setShowModal(true);
  };

  const openEditModal = async (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price_cents: product.price_cents,
      image_url: product.image_url || '',
      is_active: product.is_active,
      max_quantity_per_booking: product.max_quantity_per_booking ?? 1,
      category: product.category || '',
      is_exclusive_in_category: product.is_exclusive_in_category || false,
    });
    setIsCreatingNewCategory(false);
    setNewCategoryName('');

    const { data: assignments } = await supabase
      .from('product_service_assignments')
      .select('service_id')
      .eq('product_id', product.id);

    if (assignments && assignments.length > 0) {
      const hasNullService = assignments.some((a) => a.service_id === null);
      if (hasNullService) {
        setIsAvailableForAll(true);
        setSelectedServices([]);
      } else {
        setIsAvailableForAll(false);
        setSelectedServices(assignments.map((a) => a.service_id).filter((id): id is string => id !== null));
      }
    } else {
      setIsAvailableForAll(true);
      setSelectedServices([]);
    }

    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !businessId) return;

    if (file.size > 2 * 1024 * 1024) {
      alert(t.imageTooLarge);
      return;
    }

    setUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${businessId}/products/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('business-assets')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('business-assets')
        .getPublicUrl(fileName);

      setFormData({ ...formData, image_url: publicUrl });
    } catch (error) {
      console.error('Error uploading image:', error);
      alert(t.uploadFailed);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      alert(t.businessNotFound);
      return;
    }

    const categoryToSave = isCreatingNewCategory ? newCategoryName.trim() : formData.category;

    // Validation
    if (!formData.name.trim()) {
      alert(t.nameRequired);
      return;
    }
    if (!formData.description.trim()) {
      alert(t.descriptionRequired);
      return;
    }

    try {
      if (editingProduct) {
        const { error: updateError } = await supabase
          .from('products')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            price_cents: formData.price_cents,
            image_url: formData.image_url || null,
            is_active: formData.is_active,
            max_quantity_per_booking: formData.max_quantity_per_booking || null,
            category: categoryToSave || null,
            is_exclusive_in_category: formData.is_exclusive_in_category,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (updateError) {
          console.error('Update error:', updateError);
          alert(fillText(t.updateFailed, { message: updateError.message }));
          return;
        }

        const { error: deleteError } = await supabase
          .from('product_service_assignments')
          .delete()
          .eq('product_id', editingProduct.id);

        if (deleteError) {
          console.error('Delete assignments error:', deleteError);
        }

        if (isAvailableForAll) {
          const { error: assignError } = await supabase.from('product_service_assignments').insert({
            product_id: editingProduct.id,
            service_id: null,
            business_id: businessId,
          });
          if (assignError) console.error('Assignment error:', assignError);
        } else if (selectedServices.length > 0) {
          const assignments = selectedServices.map((serviceId) => ({
            product_id: editingProduct.id,
            service_id: serviceId,
            business_id: businessId,
          }));
          const { error: assignError } = await supabase.from('product_service_assignments').insert(assignments);
          if (assignError) console.error('Assignment error:', assignError);
        }
      } else {
        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert({
            business_id: businessId,
            name: formData.name.trim(),
            description: formData.description.trim(),
            price_cents: formData.price_cents,
            image_url: formData.image_url || null,
            is_active: formData.is_active,
            max_quantity_per_booking: formData.max_quantity_per_booking || null,
            category: categoryToSave || null,
            is_exclusive_in_category: formData.is_exclusive_in_category,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          alert(fillText(t.createFailed, { message: insertError.message }));
          return;
        }

        if (newProduct) {
          if (isAvailableForAll) {
            const { error: assignError } = await supabase.from('product_service_assignments').insert({
              product_id: newProduct.id,
              service_id: null,
              business_id: businessId,
            });
            if (assignError) console.error('Assignment error:', assignError);
          } else if (selectedServices.length > 0) {
            const assignments = selectedServices.map((serviceId) => ({
              product_id: newProduct.id,
              service_id: serviceId,
              business_id: businessId,
            }));
            const { error: assignError } = await supabase.from('product_service_assignments').insert(assignments);
            if (assignError) console.error('Assignment error:', assignError);
          }
        }
      }

      setShowModal(false);
      await fetchProducts();
    } catch (error: any) {
      console.error('Error saving product:', error);
      alert(fillText(t.saveFailed, { message: error?.message || t.unknownError }));
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm(t.confirmDelete)) return;

    const { error } = await supabase.from('products').delete().eq('id', productId);

    if (error) {
      console.error('Error deleting product:', error);
      alert(fillText(t.deleteFailed, { message: error.message }));
      return;
    }
    fetchProducts();
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Group products by category
  const groupedProducts = products.reduce((acc, product) => {
    const category = product.category || t.uncategorized;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products.filter(p => (p.category || t.uncategorized) === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-gray-300 border-t-[#1A1714] rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header - Matches ServicesView */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#1A1714] mb-1">{t.title}</h1>
          <p className="text-gray-600">{t.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A1714] focus:border-transparent transition-all"
          >
            <option value="all">{t.allCategories}</option>
            {existingCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title={t.listView}
              aria-label={t.listView}
            >
              <LayoutList className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              title={t.gridView}
              aria-label={t.gridView}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={openCreateModal}
            className="flex items-center space-x-2 px-5 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">{t.addProduct}</span>
          </button>
        </div>
      </div>

      {/* Products Display */}
      {selectedCategory === 'all' ? (
        <div className="space-y-8">
          {Object.entries(groupedProducts).sort(([a], [b]) => a.localeCompare(b)).map(([category, categoryProducts]) => (
            <div key={category} className="space-y-4">
              {/* Category Header - Matches ServicesView */}
              <button
                onClick={() => toggleCategoryCollapse(category)}
                className="flex items-center justify-between w-full p-5 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 transition-all border-l-4 border-[#1A1714] rounded-r-lg shadow-sm"
              >
                <div className="flex items-center space-x-3">
                  <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">{category}</h2>
                  <span className="text-sm px-3 py-1 bg-white rounded-full text-gray-600 font-medium shadow-sm">
                    {categoryProducts.length === 1 ? t.productCountOne : fillText(t.productCountMany, { count: categoryProducts.length })}
                  </span>
                  {categoryProducts.some(p => p.is_exclusive_in_category) && (
                    <span className="text-xs px-2 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                      {t.selectOneOnly}
                    </span>
                  )}
                </div>
                <span className="text-gray-500 text-lg">
                  {collapsedCategories.has(category) ? '▼' : '▲'}
                </span>
              </button>

              {!collapsedCategories.has(category) && (
                viewMode === 'list' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {categoryProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        formatAmount={formatAmount}
                        onEdit={() => openEditModal(product)}
                        onDelete={() => deleteProduct(product.id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {categoryProducts.map((product) => (
                      <ProductGridCard
                        key={product.id}
                        product={product}
                        formatAmount={formatAmount}
                        onEdit={() => openEditModal(product)}
                        onDelete={() => deleteProduct(product.id)}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          ))}

          {products.length === 0 && (
            <div className="text-center py-16 bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-xl font-medium text-gray-700 mb-2">{t.emptyTitle}</p>
              <p className="text-gray-500 mb-6">{t.emptyHint}</p>
              <button
                onClick={openCreateModal}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#1A1714] text-white rounded-lg hover:bg-[#2E2926] transition-all"
              >
                <Plus className="w-5 h-5" />
                <span>{t.addProduct}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {viewMode === 'list' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  formatAmount={formatAmount}
                  onEdit={() => openEditModal(product)}
                  onDelete={() => deleteProduct(product.id)}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map((product) => (
                <ProductGridCard
                  key={product.id}
                  product={product}
                  formatAmount={formatAmount}
                  onEdit={() => openEditModal(product)}
                  onDelete={() => deleteProduct(product.id)}
                />
              ))}
            </div>
          )}

          {filteredProducts.length === 0 && (
            <div className="text-center py-16 bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-xl font-medium text-gray-700">{t.emptyCategory}</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal - Matches ServicesView styling */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold tracking-tight text-[#1A1714]">
                {editingProduct ? t.editProduct : t.newProduct}
              </h2>
              <button onClick={() => setShowModal(false)} title={t.close} aria-label={t.close} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Product Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.productName}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#1A1714] focus:ring-1 focus:ring-[#1A1714]"
                  placeholder={t.productNamePlaceholder}
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.description}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#1A1714] focus:ring-1 focus:ring-[#1A1714] resize-none"
                  placeholder={t.descriptionPlaceholder}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.category}</label>
                  {!isCreatingNewCategory ? (
                    <div className="space-y-2">
                      <select
                        value={formData.category}
                        onChange={(e) => {
                          if (e.target.value === '__create_new__') {
                            setIsCreatingNewCategory(true);
                            setFormData({ ...formData, category: '' });
                          } else {
                            setFormData({ ...formData, category: e.target.value });
                          }
                        }}
                        className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#1A1714] focus:ring-1 focus:ring-[#1A1714]"
                      >
                        <option value="">{t.selectCategory}</option>
                        {existingCategories.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                        <option value="__create_new__">{t.createCategory}</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#1A1714] focus:ring-1 focus:ring-[#1A1714]"
                        placeholder={t.newCategoryPlaceholder}
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsCreatingNewCategory(false);
                          setNewCategoryName('');
                        }}
                        className="text-sm text-gray-600 hover:text-gray-800"
                      >
                        {t.backToCategories}
                      </button>
                    </div>
                  )}
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t.price}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price_cents / 100}
                    onChange={(e) =>
                      setFormData({ ...formData, price_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })
                    }
                    className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#1A1714] focus:ring-1 focus:ring-[#1A1714]"
                    required
                  />
                </div>
              </div>

              {/* Exclusive Selection in Category */}
              {(formData.category || isCreatingNewCategory) && (
                <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200">
                  <div>
                    <p className="font-medium text-gray-700">{t.exclusiveTitle}</p>
                    <p className="text-sm text-gray-500">
                      {t.exclusiveHint}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_exclusive_in_category}
                      onChange={(e) => setFormData({ ...formData, is_exclusive_in_category: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              )}

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t.productImage}</label>
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    {formData.image_url ? (
                      <div className="w-24 h-24 border border-gray-200 overflow-hidden">
                        <img src={formData.image_url} alt={t.imageAlt} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 border border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                        <span className="text-xs text-gray-400 text-center px-2">{t.noImage}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="block">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                      <span className="inline-flex items-center px-4 py-2 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                        <Image className="w-4 h-4 mr-2" />
                        {uploadingImage ? t.uploading : t.uploadImage}
                      </span>
                    </label>
                    {formData.image_url && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, image_url: '' })}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        {t.removeImage}
                      </button>
                    )}
                    <p className="text-xs text-gray-500">{t.imageHint}</p>
                  </div>
                </div>
              </div>

              {/* Max Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t.maxQuantity}
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_quantity_per_booking || ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      max_quantity_per_booking: parseInt(e.target.value) || 1,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-200 focus:outline-none focus:border-[#1A1714] focus:ring-1 focus:ring-[#1A1714]"
                  placeholder={t.maxQuantityPlaceholder}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t.maxQuantityHint}
                </p>
              </div>

              {/* Active Status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200">
                <div>
                  <p className="font-medium text-gray-700">{t.statusTitle}</p>
                  <p className="text-sm text-gray-500">{t.statusHint}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1A1714]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1A1714]"></div>
                </label>
              </div>

              {/* Service Availability */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-4">{t.availableFor}</h3>
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-3 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      checked={isAvailableForAll}
                      onChange={() => setIsAvailableForAll(true)}
                      className="w-4 h-4 text-[#1A1714] focus:ring-[#1A1714]"
                    />
                    <div>
                      <p className="font-medium text-gray-700">{t.allServices}</p>
                      <p className="text-xs text-gray-500">{t.allServicesHint}</p>
                    </div>
                  </label>
                  <label className="flex items-center space-x-3 p-3 border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      checked={!isAvailableForAll}
                      onChange={() => setIsAvailableForAll(false)}
                      className="w-4 h-4 text-[#1A1714] focus:ring-[#1A1714]"
                    />
                    <div>
                      <p className="font-medium text-gray-700">{t.specificServices}</p>
                      <p className="text-xs text-gray-500">{t.specificServicesHint}</p>
                    </div>
                  </label>

                  {!isAvailableForAll && (
                    <div className="ml-7 space-y-2 mt-3 max-h-48 overflow-y-auto border border-gray-200 p-3">
                      {services.map((service) => (
                        <label key={service.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedServices.includes(service.id)}
                            onChange={() => toggleServiceSelection(service.id)}
                            className="w-4 h-4 text-[#1A1714] rounded focus:ring-[#1A1714]"
                          />
                          <span className="text-sm text-gray-700">{service.name}</span>
                        </label>
                      ))}
                      {services.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-2">{t.noServices}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-[#1A1714] text-white hover:bg-[#2E2926] transition-colors font-medium"
                >
                  {editingProduct ? t.updateProduct : t.createProduct}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-6 py-3 border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {t.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Product Card Component (List View) - Matches ServicesView card style
function ProductCard({ 
  product, 
  formatAmount, 
  onEdit, 
  onDelete 
}: { 
  product: Product; 
  formatAmount: (amount: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useAdminText(TEXT);
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl p-6 hover:border-gray-300 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-3 flex-1">
          {product.image_url && (
            <div className="flex-shrink-0 w-14 h-14 bg-gray-100 rounded-lg overflow-hidden">
              <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            {product.category && (
              <p className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1">{product.category}</p>
            )}
            <h3 className="text-lg font-semibold tracking-tight text-[#1A1714] mb-1">
              {product.name}
              {!product.is_active && (
                <span className="ml-2 text-xs px-3 py-1 bg-gray-100 text-gray-500 rounded-full font-medium">
                  {t.inactive}
                </span>
              )}
              {product.is_exclusive_in_category && (
                <span className="ml-2 text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">
                  {t.exclusive}
                </span>
              )}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">{product.description}</p>
          </div>
        </div>
        <div className="flex space-x-2 ml-4">
          <button
            onClick={onEdit}
            title={t.edit}
            aria-label={t.edit}
            className="p-2 text-gray-500 hover:text-[#1A1714] hover:bg-gray-100 rounded-lg transition-all"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            title={t.delete}
            aria-label={t.delete}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <div className="flex justify-between items-center py-2.5 px-3 bg-gray-50 rounded-lg">
          <span className="text-gray-700 font-medium">{t.price}</span>
          <span className="text-gray-900 font-semibold text-lg">{formatAmount(product.price_cents / 100)}</span>
        </div>
        {product.max_quantity_per_booking && (
          <p className="text-xs text-gray-500 mt-2 text-center">
            {fillText(t.maxPerBooking, { count: product.max_quantity_per_booking })}
          </p>
        )}
      </div>
    </div>
  );
}

// Product Grid Card Component
function ProductGridCard({ 
  product, 
  formatAmount, 
  onEdit, 
  onDelete 
}: { 
  product: Product; 
  formatAmount: (amount: number) => string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useAdminText(TEXT);
  return (
    <div className="bg-white/70 backdrop-blur-xl border border-stone-200/70 rounded-2xl overflow-hidden transition-all group hover:border-gray-300 hover:shadow-lg rounded-xl">
      {product.image_url ? (
        <div className="relative aspect-[4/3] bg-gray-100">
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
            <button
              onClick={onEdit}
              title={t.edit}
              aria-label={t.edit}
              className="p-2 bg-white rounded-lg shadow-lg text-gray-600 hover:text-[#1A1714]"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onDelete}
              title={t.delete}
              aria-label={t.delete}
              className="p-2 bg-white rounded-lg shadow-lg text-red-600 hover:text-red-800"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
          {!product.is_active && (
            <div className="absolute top-2 left-2">
              <span className="text-xs px-2 py-1 bg-gray-800/70 text-white rounded-full">{t.inactive}</span>
            </div>
          )}
          {product.is_exclusive_in_category && (
            <div className="absolute bottom-2 left-2">
              <span className="text-xs px-2 py-1 bg-amber-500/90 text-white rounded-full">{t.exclusive}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="relative p-4 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              {product.category && (
                <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{product.category}</p>
              )}
              <h3 className="text-base font-semibold text-gray-900">{product.name}</h3>
            </div>
            <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={onEdit}
                title={t.edit}
                aria-label={t.edit}
                className="p-1.5 text-gray-500 hover:text-[#1A1714] hover:bg-gray-100 rounded"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onDelete}
                title={t.delete}
                aria-label={t.delete}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            {!product.is_active && (
              <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{t.inactive}</span>
            )}
            {product.is_exclusive_in_category && (
              <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">{t.exclusive}</span>
            )}
          </div>
        </div>
      )}
      <div className="p-4">
        {product.image_url && (
          <>
            {product.category && (
              <p className="text-xs text-gray-500 mb-1 uppercase tracking-wider">{product.category}</p>
            )}
            <h3 className="text-base font-semibold text-gray-900 mb-1">{product.name}</h3>
          </>
        )}
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <span className="text-lg font-semibold tracking-tight text-[#1A1714]">{formatAmount(product.price_cents / 100)}</span>
          {product.max_quantity_per_booking && (
            <span className="text-xs text-gray-500">{fillText(t.maxShort, { count: product.max_quantity_per_booking })}</span>
          )}
        </div>
      </div>
    </div>
  );
}
