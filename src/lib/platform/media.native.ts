/**
 * Media — NATIVE implementation (expo-image-picker, expo-document-picker).
 */
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { mimeFromFileName } from './fileNames';
import { normalizePickedImage } from './imageNormalize';
import {
  DEFAULT_IMAGE_QUALITY,
  MediaPermissionError,
  type PickDocumentOptions,
  type PickImageOptions,
  type PickedDocument,
  type PickedImage,
} from './media.types';
import { requestPermission } from './permissions.native';

export * from './media.types';

export async function pickImage(opts: PickImageOptions = {}): Promise<PickedImage | null> {
  const source = opts.source ?? 'library';
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: opts.allowsEditing ?? false,
    quality: opts.quality ?? DEFAULT_IMAGE_QUALITY,
    exif: false,
  };
  let result: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    if (!(await requestPermission('camera'))) throw new MediaPermissionError('camera');
    result = await ImagePicker.launchCameraAsync(options);
  } else {
    // The system photo picker needs no runtime permission on current Android/iOS.
    result = await ImagePicker.launchImageLibraryAsync(options);
  }
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  const fileName = a.fileName ?? `image_${Date.now()}.jpg`;
  // iPhones may hand over HEIC / HEIF: every image leaves here as JPEG or PNG (the original on any failure).
  return normalizePickedImage({
    uri: a.uri,
    mimeType: a.mimeType ?? mimeFromFileName(fileName),
    fileName,
    width: a.width,
    height: a.height,
  });
}

export async function pickDocument(opts: PickDocumentOptions = {}): Promise<PickedDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: opts.type ?? '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const a = result.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType ?? mimeFromFileName(a.name), size: a.size };
}
