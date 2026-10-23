import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { ADMIN_SECONDARY_BUTTON, ADMIN_TERTIARY_BUTTON } from '../adminUi';
import { uploadImage } from '../marketing/assets/assetLibrary';
import type { ReceptionistText } from './receptionistText';

interface ChatAvatarPickerProps {
  businessId: string;
  avatarUrl: string | null;
  color: string;
  t: ReceptionistText;
  onSave: (url: string | null) => Promise<void>;
}

/** The round picture in the website chat header: an uploaded photo, or the shop logo when empty. */
export default function ChatAvatarPicker({ businessId, avatarUrl, color, t, onSave }: ChatAvatarPickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      await onSave(await uploadImage(businessId, file));
    } catch (uploadError) {
      console.error('Chat picture upload failed:', uploadError);
      setError(t.avatarFailed);
    } finally {
      setIsUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="text-sm text-stone-600">
      <span>{t.avatar}</span>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-white shadow-sm" style={{ background: color }}>
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs font-semibold">Logo</span>}
        </div>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={isUploading} className={ADMIN_SECONDARY_BUTTON}>
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {t.avatarUpload}
        </button>
        {avatarUrl && (
          <button type="button" onClick={() => onSave(null)} disabled={isUploading} className={ADMIN_TERTIARY_BUTTON}>{t.avatarUseLogo}</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      </div>
      <p className="mt-1 text-xs text-stone-500">{t.avatarHint}</p>
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}
