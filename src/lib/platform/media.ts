/**
 * Media — WEB / default implementation: `<input type="file">` (with `capture` for the camera).
 * The native implementation lives in `media.native.ts`.
 */
import { mimeFromFileName } from './fileNames';
import {
  DEFAULT_IMAGE_QUALITY,
  type PickDocumentOptions,
  type PickImageOptions,
  type PickedDocument,
  type PickedImage,
} from './media.types';

export * from './media.types';

/** Opens the browser file chooser. Resolves `null` when the user cancels. */
function chooseFile(opts: { accept?: string; capture?: 'environment' | 'user' }): Promise<File | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const input = document.createElement('input');
    input.type = 'file';
    if (opts.accept) input.accept = opts.accept;
    if (opts.capture) input.setAttribute('capture', opts.capture);
    input.style.display = 'none';
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onFocus);
      input.remove();
      resolve(file);
    };
    // Browsers without the `cancel` event: the window regains focus when the chooser closes.
    const onFocus = () => setTimeout(() => finish(input.files?.[0] ?? null), 1_000);

    input.addEventListener('change', () => finish(input.files?.[0] ?? null));
    input.addEventListener('cancel', () => finish(null));
    window.addEventListener('focus', onFocus);
    input.click();
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The selected file is not a readable image'));
    img.src = url;
  });
}

/** Longest side of a photo converted from HEIC / HEIF / an unknown format (never upscaled). */
const CONVERT_MAX_SIDE = 2048;
/** JPEG quality of such a conversion. */
const CONVERT_QUALITY = 0.85;

/** True for JPEG / PNG (uploaded as is); HEIC / HEIF / unknown types must be converted to JPEG. */
function isJpegOrPngFile(file: File): boolean {
  const type = (file.type || '').split(';')[0].trim().toLowerCase();
  if (type) return type === 'image/jpeg' || type === 'image/jpg' || type === 'image/png';
  return /\.(jpe?g|png)$/i.test(file.name || '');
}

/**
 * Re-encodes to JPEG at `quality` (also normalises formats/rotation); returns the original on any failure.
 * A HEIC / HEIF / unknown file is always converted (even when the JPEG is larger, the server cannot use HEIC) at
 * quality 0.85 with the longest side capped at 2048 px.
 */
async function recompress(file: File, img: HTMLImageElement, quality: number): Promise<File> {
  const mustConvert = !isJpegOrPngFile(file);
  if ((quality >= 1 && !mustConvert) || typeof document === 'undefined') return file;
  try {
    const scale = mustConvert ? Math.min(1, CONVERT_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight, 1)) : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', mustConvert ? CONVERT_QUALITY : quality));
    if (!blob || (!mustConvert && blob.size >= file.size)) return file; // never make a JPEG/PNG bigger
    const name = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

export async function pickImage(opts: PickImageOptions = {}): Promise<PickedImage | null> {
  const picked = await chooseFile({ accept: 'image/*', capture: opts.source === 'camera' ? 'environment' : undefined });
  if (!picked) return null;
  const sourceUrl = URL.createObjectURL(picked);
  let img: HTMLImageElement;
  try {
    img = await loadImage(sourceUrl);
  } catch (e) {
    URL.revokeObjectURL(sourceUrl);
    throw e;
  }
  const file = await recompress(picked, img, opts.quality ?? DEFAULT_IMAGE_QUALITY);
  let uri = sourceUrl;
  if (file !== picked) {
    URL.revokeObjectURL(sourceUrl);
    uri = URL.createObjectURL(file);
  }
  const fileName = file.name || `image_${Date.now()}.jpg`;
  return {
    uri,
    mimeType: file.type || mimeFromFileName(fileName),
    fileName,
    width: img.naturalWidth,
    height: img.naturalHeight,
    file,
  };
}

export async function pickDocument(opts: PickDocumentOptions = {}): Promise<PickedDocument | null> {
  const accept = Array.isArray(opts.type) ? opts.type.join(',') : opts.type;
  const file = await chooseFile({ accept: accept && accept !== '*/*' ? accept : undefined });
  if (!file) return null;
  return {
    uri: URL.createObjectURL(file),
    name: file.name,
    mimeType: file.type || mimeFromFileName(file.name),
    size: file.size,
    file,
  };
}
