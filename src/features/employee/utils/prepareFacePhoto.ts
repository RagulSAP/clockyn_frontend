/**
 * Capture options and on-device downscaling of face photos (shared by punch and registration so both produce the same
 * kind of image: same quality, same orientation handling, same mirroring).
 */
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { CameraPictureOptions } from 'expo-camera';

/** Longest side of the uploaded photo, in pixels (tune here). Photos already smaller are never upscaled. */
export const FACE_PHOTO_MAX_SIDE = 720;
/** JPEG quality of the uploaded photo (0-1). */
export const FACE_PHOTO_JPEG_QUALITY = 0.85;
/** JPEG quality asked from the camera (the downscale re-encodes at `FACE_PHOTO_JPEG_QUALITY`). */
export const FACE_CAPTURE_QUALITY = 0.9;

/**
 * Options of every face `takePictureAsync`:
 * - no `skipProcessing`: with it the native camera ignores `quality` and may hand back an un-rotated image (EXIF
 *   orientation); without it the file is upright and `quality` applies;
 * - `imageType: 'jpg'`: on web the default is PNG (lossless, large, `quality` ignored); native ignores the option;
 * - no `mirror` / `isImageMirror`: the saved image is never mirrored, in registration and at punch time alike (the live
 *   preview of the front camera is mirrored like a mirror, the file is not).
 */
export const FACE_CAPTURE_OPTIONS: CameraPictureOptions = {
  quality: FACE_CAPTURE_QUALITY,
  imageType: 'jpg',
  skipProcessing: false,
  exif: false,
};

export interface FacePhotoInput {
  uri: string;
  /** Pixel size reported by the camera; without both the photo is uploaded as captured. */
  width?: number;
  height?: number;
}

/** Target size for a photo, or `null` when it already fits (or its size is unknown). */
export function targetSize(width: number | undefined, height: number | undefined, maxSide: number = FACE_PHOTO_MAX_SIDE): { width?: number; height?: number } | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  if (Math.max(width, height) <= maxSide) return null;
  return width >= height ? { width: maxSide } : { height: maxSide };
}

/**
 * Downscales a captured photo (longest side `FACE_PHOTO_MAX_SIDE`, JPEG `FACE_PHOTO_JPEG_QUALITY`) so the upload is a
 * fraction of the camera's full-size file. Never throws: when resizing is impossible or fails, the original photo is
 * returned (a large upload beats a failed punch).
 */
export async function prepareFacePhoto(photo: FacePhotoInput): Promise<string> {
  const size = targetSize(photo.width, photo.height);
  if (!size) return photo.uri;
  try {
    const ref = await ImageManipulator.manipulate(photo.uri).resize(size).renderAsync();
    const out = await ref.saveAsync({ compress: FACE_PHOTO_JPEG_QUALITY, format: SaveFormat.JPEG });
    return out.uri || photo.uri;
  } catch {
    return photo.uri;
  }
}
