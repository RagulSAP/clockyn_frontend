/**
 * Applies a crop (original-image pixels, see `cropGeometry.toSourceCrop`) to a picked photo with `expo-image-manipulator`
 * (native: platform codecs; web: canvas) and returns it as a new `PickedAttachment`.
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { PickedAttachment } from '../hooks/usePickAttachment';
import type { SourceCrop } from './cropGeometry';

/** JPEG quality of a cropped JPEG (0-1; the photo pickers use 0.8-0.85, a higher value would only bloat the file). PNG stays lossless. */
export const CROP_JPEG_QUALITY = 0.85;

const CROPPABLE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/bmp'];
const CROPPABLE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'bmp'];

const extOf = (name: string): string => (name.includes('.') ? (name.split('.').pop() ?? '') : '').toLowerCase();

/** A still photo the crop tool can handle. Not for documents, GIFs (a crop would flatten the animation) or SVG. */
export function canCropAttachment(att: Pick<PickedAttachment, 'type' | 'mimeType' | 'fileName'>): boolean {
  if (att.type !== 'image') return false;
  const mime = (att.mimeType ?? '').split(';')[0].trim().toLowerCase();
  if (mime.startsWith('image/')) return CROPPABLE_MIMES.includes(mime);
  return CROPPABLE_EXTENSIONS.includes(extOf(att.fileName));
}

/** `png` photos stay PNG; everything else (jpeg, webp, heic, ...) is written as JPEG. */
export function cropOutputFormat(att: Pick<PickedAttachment, 'mimeType' | 'fileName'>): { format: SaveFormat; mimeType: string; ext: string } {
  const mime = (att.mimeType ?? '').split(';')[0].trim().toLowerCase();
  const isPng = mime ? mime === 'image/png' : extOf(att.fileName) === 'png';
  return isPng ? { format: SaveFormat.PNG, mimeType: 'image/png', ext: 'png' } : { format: SaveFormat.JPEG, mimeType: 'image/jpeg', ext: 'jpg' };
}

/** Same file name stem with the extension of the output format (`photo.jpeg` stays `photo.jpeg`). */
export function croppedFileName(fileName: string, ext: string): string {
  const dot = fileName.lastIndexOf('.');
  const stem = (dot > 0 ? fileName.slice(0, dot) : fileName).trim() || 'photo';
  const current = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  if (ext === 'jpg' && current === 'jpeg') return `${stem}.jpeg`;
  return `${stem}.${ext}`;
}

/**
 * Crops `att` to `crop`. The result keeps `att.original ?? att` as its `original` so the crop can be undone, and carries the
 * cropped pixel size. Rejects when the manipulator fails (the caller keeps the original and shows a message).
 */
export async function cropAttachment(att: PickedAttachment, crop: SourceCrop): Promise<PickedAttachment> {
  const out = cropOutputFormat(att);
  const context = ImageManipulator.manipulate(att.uri).crop(crop);
  try {
    const ref = await context.renderAsync();
    try {
      const saved = await ref.saveAsync({ format: out.format, compress: out.format === SaveFormat.PNG ? 1 : CROP_JPEG_QUALITY });
      if (!saved?.uri) throw new Error('The cropped photo could not be saved');
      return {
        uri: saved.uri,
        fileName: croppedFileName(att.fileName, out.ext),
        mimeType: out.mimeType,
        type: 'image',
        width: saved.width ?? crop.width,
        height: saved.height ?? crop.height,
        original: att.original ?? att,
      };
    } finally {
      try {
        ref.release?.();
      } catch {
        /* already released */
      }
    }
  } finally {
    try {
      context.release?.();
    } catch {
      /* already released */
    }
  }
}
