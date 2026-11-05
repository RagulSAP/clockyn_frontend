import {
  PICKED_JPEG_QUALITY,
  PICKED_MAX_SIDE,
  isJpegOrPng,
  jpegFileName,
  normalizePickedImage,
  resizeTarget,
  withExtension,
} from '../imageNormalize';
import type { PickedImage } from '../media.types';

const mockSave = jest.fn();
const mockResize = jest.fn();
const mockRender = jest.fn();
const mockManipulate = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) },
}));

beforeEach(() => {
  mockSave.mockReset().mockResolvedValue({ uri: 'file:///out.jpg', width: 2048, height: 1536 });
  mockRender.mockReset().mockImplementation(async () => ({ saveAsync: mockSave }));
  mockResize.mockReset().mockImplementation(() => ({ renderAsync: mockRender }));
  mockManipulate.mockReset().mockImplementation(() => ({ resize: mockResize, renderAsync: mockRender }));
});

const heic = (over: Partial<PickedImage> = {}): PickedImage => ({
  uri: 'file:///cache/IMG_0001.heic',
  mimeType: 'image/heic',
  fileName: 'IMG_0001.HEIC',
  width: 4032,
  height: 3024,
  ...over,
});

describe('isJpegOrPng', () => {
  it('keeps JPEG and PNG, converts HEIC / HEIF / unknown', () => {
    expect(isJpegOrPng({ mimeType: 'image/jpeg' })).toBe(true);
    expect(isJpegOrPng({ mimeType: 'image/jpg' })).toBe(true);
    expect(isJpegOrPng({ mimeType: 'IMAGE/PNG; charset=x' })).toBe(true);
    expect(isJpegOrPng({ mimeType: 'image/heic' })).toBe(false);
    expect(isJpegOrPng({ mimeType: 'image/heif' })).toBe(false);
    expect(isJpegOrPng({ mimeType: 'image/webp' })).toBe(false);
  });
  it('falls back to the uri / file name extension when there is no mime type', () => {
    expect(isJpegOrPng({ uri: 'file:///a/b.JPG?x=1' })).toBe(true);
    expect(isJpegOrPng({ fileName: 'a.png' })).toBe(true);
    expect(isJpegOrPng({ uri: 'file:///a/b.heic' })).toBe(false);
    expect(isJpegOrPng({ uri: 'file:///a/noext' })).toBe(false);
  });
});

describe('resizeTarget', () => {
  it('caps the longest side and never upscales', () => {
    expect(resizeTarget(4032, 3024)).toEqual({ width: PICKED_MAX_SIDE });
    expect(resizeTarget(3024, 4032)).toEqual({ height: PICKED_MAX_SIDE });
    expect(resizeTarget(2048, 1000)).toBeNull();
    expect(resizeTarget(800, 600)).toBeNull();
    expect(resizeTarget(undefined, 4000)).toBeNull();
    expect(resizeTarget(0, 0)).toBeNull();
  });
});

describe('naming', () => {
  it('replaces the extension and handles odd names', () => {
    expect(jpegFileName('IMG_0001.HEIC')).toBe('IMG_0001.jpg');
    expect(jpegFileName('photo.final.heif')).toBe('photo.final.jpg');
    expect(jpegFileName('noext')).toBe('noext.jpg');
    expect(jpegFileName('')).toBe('image.jpg');
    expect(jpegFileName(undefined)).toBe('image.jpg');
    expect(withExtension('a.jpg', 'png')).toBe('a.png');
  });
});

describe('normalizePickedImage', () => {
  it('converts HEIC to a JPEG: 0.85, longest side 2048, .jpg name, image/jpeg', async () => {
    const out = await normalizePickedImage(heic());
    expect(mockManipulate).toHaveBeenCalledWith('file:///cache/IMG_0001.heic');
    expect(mockResize).toHaveBeenCalledWith({ width: 2048 });
    expect(mockSave).toHaveBeenCalledWith({ compress: PICKED_JPEG_QUALITY, format: 'jpeg' });
    expect(PICKED_JPEG_QUALITY).toBe(0.85);
    expect(out).toEqual({
      uri: 'file:///out.jpg',
      mimeType: 'image/jpeg',
      fileName: 'IMG_0001.jpg',
      width: 2048,
      height: 1536,
    });
  });

  it('caps a portrait HEIC by its height and skips resizing a small one (no upscale)', async () => {
    await normalizePickedImage(heic({ width: 3024, height: 4032 }));
    expect(mockResize).toHaveBeenCalledWith({ height: 2048 });
    mockResize.mockClear();
    mockSave.mockResolvedValueOnce({ uri: 'file:///small.jpg', width: 800, height: 600 });
    const out = await normalizePickedImage(heic({ width: 800, height: 600 }));
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockRender).toHaveBeenCalled();
    expect(out.uri).toBe('file:///small.jpg');
  });

  it('converts when the mime type is missing and the extension is not jpg/png', async () => {
    const out = await normalizePickedImage(heic({ mimeType: '' }));
    expect(out.mimeType).toBe('image/jpeg');
    expect(out.fileName).toBe('IMG_0001.jpg');
  });

  it('passes JPEG and PNG through untouched', async () => {
    const jpeg: PickedImage = { uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileName: 'a.jpg', width: 5000, height: 4000 };
    const png: PickedImage = { uri: 'file:///a.png', mimeType: 'image/png', fileName: 'a.png', width: 5000, height: 4000 };
    expect(await normalizePickedImage(jpeg)).toBe(jpeg);
    expect(await normalizePickedImage(png)).toBe(png);
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('only fixes a stale .heic name when the picker already transcoded to JPEG / PNG', async () => {
    const j = await normalizePickedImage({ uri: 'file:///t.jpg', mimeType: 'image/jpeg', fileName: 'IMG_9.HEIC' });
    expect(j.fileName).toBe('IMG_9.jpg');
    expect(j.uri).toBe('file:///t.jpg');
    const p = await normalizePickedImage({ uri: 'file:///t.png', mimeType: 'image/png', fileName: 'IMG_9.heif' });
    expect(p.fileName).toBe('IMG_9.png');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('returns the original when the manipulator fails (save, render or load)', async () => {
    const src = heic();
    mockSave.mockRejectedValueOnce(new Error('boom'));
    expect(await normalizePickedImage(src)).toBe(src);
    mockManipulate.mockImplementationOnce(() => {
      throw new Error('no module');
    });
    expect(await normalizePickedImage(src)).toBe(src);
    mockSave.mockResolvedValueOnce({ uri: '' });
    expect(await normalizePickedImage(src)).toBe(src);
  });
});
