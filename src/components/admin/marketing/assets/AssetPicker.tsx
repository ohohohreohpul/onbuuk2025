import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { useAdminText } from '../../../../lib/adminLanguage';
import type { Translations } from '../../../../lib/bookingLanguage';
import { ADMIN_MODAL, ADMIN_MODAL_BACKDROP, ADMIN_SECONDARY_BUTTON } from '../../adminUi';
import { AssetSource, ShopAsset, ensureHttpsImage, loadShopAssets, uploadImage } from './assetLibrary';

const TEXT: Translations<{
  title: string; close: string; upload: string; uploading: string; empty: string; loadFailed: string;
  uploadFailed: string; tooLarge: string; notImage: string; hint: string;
  upload_src: string; logo: string; giftCard: string; set: string; bookingPage: string; treatment: string;
}> = {
  en: {
    title: 'Choose an image', close: 'Close', upload: 'Upload image', uploading: 'Uploading…',
    empty: 'No images yet. Upload one from your computer.', loadFailed: 'Could not load your images.',
    uploadFailed: 'Upload failed.', tooLarge: 'The image is larger than 8 MB.', notImage: 'Please choose an image file.',
    hint: 'Images are made smaller automatically so the email loads fast.',
    upload_src: 'Uploaded', logo: 'Logo', giftCard: 'Gift card design', set: 'Voucher set', bookingPage: 'Booking page', treatment: 'Treatment',
  },
  de: {
    title: 'Bild auswählen', close: 'Schließen', upload: 'Bild hochladen', uploading: 'Wird hochgeladen…',
    empty: 'Noch keine Bilder. Laden Sie eines von Ihrem Computer hoch.', loadFailed: 'Bilder konnten nicht geladen werden.',
    uploadFailed: 'Hochladen fehlgeschlagen.', tooLarge: 'Das Bild ist größer als 8 MB.', notImage: 'Bitte eine Bilddatei wählen.',
    hint: 'Bilder werden automatisch verkleinert, damit die E-Mail schnell lädt.',
    upload_src: 'Hochgeladen', logo: 'Logo', giftCard: 'Gutschein-Design', set: 'Gutscheinset', bookingPage: 'Buchungsseite', treatment: 'Behandlung',
  },
  th: {
    title: 'เลือกรูปภาพ', close: 'ปิด', upload: 'อัปโหลดรูป', uploading: 'กำลังอัปโหลด…',
    empty: 'ยังไม่มีรูป อัปโหลดจากคอมพิวเตอร์ได้เลย', loadFailed: 'โหลดรูปภาพไม่สำเร็จ',
    uploadFailed: 'อัปโหลดไม่สำเร็จ', tooLarge: 'รูปมีขนาดเกิน 8 MB', notImage: 'กรุณาเลือกไฟล์รูปภาพ',
    hint: 'ระบบจะย่อรูปให้อัตโนมัติ เพื่อให้อีเมลโหลดเร็ว',
    upload_src: 'อัปโหลดแล้ว', logo: 'โลโก้', giftCard: 'ดีไซน์บัตรของขวัญ', set: 'ชุดบัตรของขวัญ', bookingPage: 'หน้าจอง', treatment: 'บริการ',
  },
};

const SOURCE_KEY: Record<AssetSource, 'upload_src' | 'logo' | 'giftCard' | 'set' | 'bookingPage' | 'treatment'> = {
  upload: 'upload_src', logo: 'logo', giftCard: 'giftCard', set: 'set', bookingPage: 'bookingPage', treatment: 'treatment',
};

interface AssetPickerProps {
  businessId: string;
  onPick: (url: string) => void;
  onClose: () => void;
}

export default function AssetPicker({ businessId, onPick, onClose }: AssetPickerProps) {
  const { t } = useAdminText(TEXT);
  const [assets, setAssets] = useState<ShopAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadShopAssets(businessId)
      .then(setAssets)
      .catch((loadError) => { console.error('Could not load shop images:', loadError); setError(t.loadFailed); })
      .finally(() => setLoading(false));
  }, [businessId, t.loadFailed]);

  const choose = async (url: string) => {
    setBusy(true);
    setError('');
    try {
      onPick(await ensureHttpsImage(businessId, url));
    } catch (pickError) {
      console.error('Could not prepare image:', pickError);
      setError(t.uploadFailed);
      setBusy(false);
    }
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      onPick(await uploadImage(businessId, file));
    } catch (uploadError) {
      console.error('Image upload failed:', uploadError);
      const reason = uploadError instanceof Error ? uploadError.message : '';
      setError(reason === 'too-large' ? t.tooLarge : reason === 'not-an-image' ? t.notImage : t.uploadFailed);
      setBusy(false);
    }
  };

  return (
    <div className={ADMIN_MODAL_BACKDROP} role="dialog" aria-modal="true" aria-labelledby="asset-picker-title">
      <div className={`${ADMIN_MODAL} flex max-h-[85vh] w-full max-w-2xl flex-col p-6`}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="asset-picker-title" className="text-lg font-semibold text-[#1A1714]">{t.title}</h2>
          <button type="button" onClick={onClose} aria-label={t.close} className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-900/[0.05] hover:text-stone-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy} className={ADMIN_SECONDARY_BUTTON}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {busy ? t.uploading : t.upload}
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
          <span className="text-xs text-stone-500">{t.hint}</span>
        </div>
        {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="-mx-1 overflow-y-auto px-1">
          {loading ? (
            <div className="py-12 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-stone-400" /></div>
          ) : assets.length === 0 ? (
            <p className="py-12 text-center text-sm text-stone-500">{t.empty}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {assets.map((asset) => (
                <li key={asset.url}>
                  <button type="button" onClick={() => choose(asset.url)} disabled={busy}
                    className="group block w-full overflow-hidden rounded-xl bg-[repeating-conic-gradient(#f1eee9_0%_25%,#faf8f5_0%_50%)] bg-[length:16px_16px] text-left ring-1 ring-stone-200/80 transition hover:ring-2 hover:ring-stone-900/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900/50 disabled:opacity-50">
                    <img src={asset.url} alt="" loading="lazy" className="aspect-square w-full object-contain p-1.5" />
                    <span className="block truncate bg-white px-2 py-1.5 text-[11px] text-stone-600">
                      <span className="font-medium text-stone-800">{t[SOURCE_KEY[asset.source]]}</span>
                      {asset.source === 'set' || asset.source === 'treatment' ? ` · ${asset.label}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
