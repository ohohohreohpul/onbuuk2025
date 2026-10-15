import { supabase } from '../../../../lib/supabase';

/** Where an image in the picker comes from (used to group and label it). */
export type AssetSource = 'upload' | 'logo' | 'giftCard' | 'set' | 'bookingPage' | 'treatment';

export interface ShopAsset {
  url: string;
  source: AssetSource;
  label: string;
}

const BUCKET = 'business-assets';
const UPLOAD_MAX_PX = 1200;
const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
const JPEG_QUALITY = 0.85;
const IMAGE_COLUMNS = ['global_image_url', 'welcome_image_url', 'sidebar_image_url'] as const;

const isHttps = (url: unknown): url is string => typeof url === 'string' && url.startsWith('https://');
const folder = (businessId: string) => `${businessId}/marketing`;

function publicUrl(path: string): string {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Everything the shop already has in Zenno that can go into an email. */
export async function loadShopAssets(businessId: string): Promise<ShopAsset[]> {
  const [uploads, business, giftSettings, sets, booking, services] = await Promise.all([
    supabase.storage.from(BUCKET).list(folder(businessId), { limit: 100, sortBy: { column: 'created_at', order: 'desc' } }),
    supabase.from('businesses').select('custom_logo_url').eq('id', businessId).maybeSingle(),
    supabase.from('gift_card_settings').select('design_url').eq('business_id', businessId).maybeSingle(),
    supabase.from('gift_card_packages').select('name, cover_url').eq('business_id', businessId),
    supabase.from('booking_form_customization').select(IMAGE_COLUMNS.join(', ')).eq('business_id', businessId).maybeSingle(),
    supabase.from('services').select('name, image_url').eq('business_id', businessId).not('image_url', 'is', null),
  ]);

  const assets: ShopAsset[] = [];
  for (const file of uploads.data ?? []) {
    if (file.name && !file.name.startsWith('.')) {
      assets.push({ url: publicUrl(`${folder(businessId)}/${file.name}`), source: 'upload', label: file.name });
    }
  }
  if (isHttps(business.data?.custom_logo_url)) assets.push({ url: business.data.custom_logo_url, source: 'logo', label: 'Logo' });
  const design = giftSettings.data?.design_url;
  if (isHttps(design) || (typeof design === 'string' && design.startsWith('data:image/'))) {
    assets.push({ url: design, source: 'giftCard', label: 'Gutschein' });
  }
  for (const set of sets.data ?? []) {
    if (isHttps(set.cover_url)) assets.push({ url: set.cover_url, source: 'set', label: set.name });
  }
  const bookingRow = (booking.data ?? {}) as Record<string, unknown>;
  for (const column of IMAGE_COLUMNS) {
    if (isHttps(bookingRow[column])) assets.push({ url: bookingRow[column] as string, source: 'bookingPage', label: column });
  }
  for (const service of services.data ?? []) {
    if (isHttps(service.image_url)) assets.push({ url: service.image_url, source: 'treatment', label: service.name });
  }
  // The same picture can be used in several places; show it once.
  return assets.filter((asset, index) => assets.findIndex((other) => other.url === asset.url) === index);
}

/** Scale an image down so emails stay light; PNG keeps transparency (logos), photos become JPEG. */
async function shrink(blob: Blob): Promise<{ blob: Blob; extension: 'png' | 'jpg' }> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, UPLOAD_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const keepAlpha = blob.type === 'image/png' || blob.type === 'image/webp' || blob.type === 'image/gif';
  const type = keepAlpha ? 'image/png' : 'image/jpeg';
  const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, JPEG_QUALITY));
  if (!result) throw new Error('Could not process the image');
  return { blob: result, extension: keepAlpha ? 'png' : 'jpg' };
}

async function store(businessId: string, blob: Blob): Promise<string> {
  const { blob: small, extension } = await shrink(blob);
  const path = `${folder(businessId)}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, small, {
    contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
    cacheControl: '31536000',
  });
  if (error) throw error;
  return publicUrl(path);
}

/** Upload a file from the computer; returns its public https URL. */
export async function uploadImage(businessId: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('not-an-image');
  if (file.size > UPLOAD_MAX_BYTES) throw new Error('too-large');
  return store(businessId, file);
}

/** Emails need https images: a picture stored inline (data: URL) is uploaded once first. */
export async function ensureHttpsImage(businessId: string, url: string): Promise<string> {
  if (isHttps(url)) return url;
  const blob = await (await fetch(url)).blob();
  return store(businessId, blob);
}
