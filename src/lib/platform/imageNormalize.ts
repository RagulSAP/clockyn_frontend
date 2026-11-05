/**
 * Every picked / captured photo leaves the media helper as JPEG or PNG (NATIVE implementation helper).
 *
 * iPhones often hand the image picker a HEIC / HEIF file, which the backend (and the Android/web viewers) do not take.
 * `normalizePickedImage` re-encodes anything that is not already JPEG/PNG to JPEG (quality 0.85, longest side capped at
 * 2048 px, EXIF orientation applied by the manipulator, never upscaled). It never throws: on any failure the original
 * photo is returned (the server still accepts HEIC from older builds).
 *
 * Pure logic (`isJpegOrPng`, `resizeTarget`, `jpegFileName`) is exported for unit tests.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { extensionOf } from './fileNames';
import type { PickedImage } from './media.types';

/** JPEG quality of a converted photo (0-1). */
export const PICKED_JPEG_QUALITY = 0.85;
/** Longest side of a converted photo, in pixels. Smaller photos are never upscaled. */
export const PICKED_MAX_SIDE = 2048;

const KEEP_MIMES = ['image/jpeg', 'image/jpg', 'image/png'];
const KEEP_EXTENSIONS = ['jpg', 'jpeg', 'png'];

/** Lower-cased mime without parameters, or '' when absent. */
function cleanMime(mime?: string | null): string {
  return (mime ?? '').split(';')[0].trim().toLowerCase();
}

/** Extension of a uri / file name ignoring any query string or fragment. */
function extOf(name?: string | null): string {
  return extensionOf((name ?? '').split(/[?#]/)[0]);
}

/**
 * True when the picked asset is already JPEG or PNG and can be uploaded as is. The mime type decides when the picker
 * gave one; otherwise the extension of the file uri, then of the file name. HEIC / HEIF / unknown -> false.
 */
export function isJpegOrPng(asset: { mimeType?: string | null; uri?: string | null; fileName?: string | null }): boolean {
  const mime = cleanMime(asset.mimeType);
  if (mime) return KEEP_MIMES.includes(mime);
  const ext = extOf(asset.uri) || extOf(asset.fileName);
  return KEEP_EXTENSIONS.includes(ext);
}

/** Resize argument capping the longest side at `maxSide` (never upscales); `null` when it fits or the size is unknown. */
export function resizeTarget(
  width: number | undefined,
  height: number | undefined,
  maxSide: number = PICKED_MAX_SIDE,
): { width?: number; height?: number } | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  if (Math.max(width, height) <= maxSide) return null;
  return width >= height ? { width: maxSide } : { height: maxSide };
}

/** `name` with its extension replaced by `ext` (a name without extension gets one); empty names become `image`. */
export function withExtension(name: string | null | undefined, ext: string): string {
  const raw = (name ?? '').trim();
  const dot = raw.lastIndexOf('.');
  const stem = (dot > 0 ? raw.slice(0, dot) : raw).trim() || 'image';
  return `${stem}.${ext}`;
}

/** `IMG_0001.HEIC` -> `IMG_0001.jpg`. */
export function jpegFileName(name: string | null | undefined): string {
  return withExtension(name, 'jpg');
}

/**
 * Returns `picked` unchanged when it is JPEG/PNG (only a stale `.heic` file name is corrected to the real type);
 * otherwise a JPEG re-encode with `fileName` ending `.jpg` and `mimeType` `image/jpeg`.
 */
export async function normalizePickedImage(picked: PickedImage): Promise<PickedImage> {
  if (isJpegOrPng(picked)) {
    const ext = extOf(picked.fileName);
    if (ext === 'heic' || ext === 'heif') {
      // The picker already transcoded the file (JPEG/PNG bytes) but kept the original HEIC name.
      return { ...picked, fileName: withExtension(picked.fileName, cleanMime(picked.mimeType) === 'image/png' ? 'png' : 'jpg') };
    }
    return picked;
  }
  try {
    const size = resizeTarget(picked.width, picked.height);
    let context = ImageManipulator.manipulate(picked.uri);
    if (size) context = context.resize(size);
    const ref = await context.renderAsync();
    const out = await ref.saveAsync({ compress: PICKED_JPEG_QUALITY, format: SaveFormat.JPEG });
    if (!out?.uri) return picked;
    return {
      ...picked,
      uri: out.uri,
      mimeType: 'image/jpeg',
      fileName: jpegFileName(picked.fileName),
      width: out.width ?? picked.width,
      height: out.height ?? picked.height,
    };
  } catch {
    return picked;
  }
}
