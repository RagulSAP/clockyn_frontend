import { canCropAttachment, cropAttachment, cropOutputFormat, croppedFileName } from '../cropImage';
import type { PickedAttachment } from '../../hooks/usePickAttachment';

const mockSave = jest.fn();
const mockRender = jest.fn();
const mockCrop = jest.fn();
const mockManipulate = jest.fn();
const mockRelease = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) },
}));

beforeEach(() => {
  mockRelease.mockReset();
  mockSave.mockReset().mockResolvedValue({ uri: 'file:///out.jpg', width: 800, height: 600 });
  mockRender.mockReset().mockImplementation(async () => ({ saveAsync: mockSave, release: mockRelease }));
  mockCrop.mockReset().mockImplementation(() => ({ renderAsync: mockRender, release: mockRelease }));
  mockManipulate.mockReset().mockImplementation(() => ({ crop: mockCrop, release: mockRelease }));
});

const att = (over: Partial<PickedAttachment> = {}): PickedAttachment => ({ uri: 'file:///in.jpg', fileName: 'IMG_1.jpg', mimeType: 'image/jpeg', type: 'image', ...over });

describe('canCropAttachment', () => {
  it('accepts still photos by mime type or, without one, by extension', () => {
    expect(canCropAttachment(att())).toBe(true);
    expect(canCropAttachment(att({ mimeType: 'image/png', fileName: 'a.png' }))).toBe(true);
    expect(canCropAttachment(att({ mimeType: 'image/webp', fileName: 'a.webp' }))).toBe(true);
    expect(canCropAttachment(att({ mimeType: '', fileName: 'a.HEIC' }))).toBe(true);
  });
  it('rejects documents, GIFs and SVG', () => {
    expect(canCropAttachment(att({ type: 'file', mimeType: 'application/pdf', fileName: 'a.pdf' }))).toBe(false);
    expect(canCropAttachment(att({ mimeType: 'image/gif', fileName: 'a.gif' }))).toBe(false);
    expect(canCropAttachment(att({ mimeType: '', fileName: 'a.gif' }))).toBe(false);
    expect(canCropAttachment(att({ mimeType: 'image/svg+xml', fileName: 'a.svg' }))).toBe(false);
  });
});

describe('output format and name', () => {
  it('keeps PNG as PNG, writes everything else as JPEG', () => {
    expect(cropOutputFormat(att({ mimeType: 'image/png' }))).toMatchObject({ format: 'png', mimeType: 'image/png', ext: 'png' });
    expect(cropOutputFormat(att({ mimeType: '', fileName: 'x.png' }))).toMatchObject({ ext: 'png' });
    expect(cropOutputFormat(att({ mimeType: 'image/webp' }))).toMatchObject({ format: 'jpeg', mimeType: 'image/jpeg', ext: 'jpg' });
    expect(cropOutputFormat(att({ mimeType: 'image/heic' }))).toMatchObject({ ext: 'jpg' });
  });
  it('keeps the file name stem', () => {
    expect(croppedFileName('IMG_1.jpg', 'jpg')).toBe('IMG_1.jpg');
    expect(croppedFileName('photo.jpeg', 'jpg')).toBe('photo.jpeg');
    expect(croppedFileName('shot.webp', 'jpg')).toBe('shot.jpg');
    expect(croppedFileName('my.holiday.png', 'png')).toBe('my.holiday.png');
    expect(croppedFileName('noext', 'jpg')).toBe('noext.jpg');
  });
});

describe('cropAttachment', () => {
  const crop = { originX: 10, originY: 20, width: 800, height: 600 };

  it('crops the original pixels and returns a new attachment that remembers the original', async () => {
    const source = att({ width: 4000, height: 3000 });
    const out = await cropAttachment(source, crop);
    expect(mockManipulate).toHaveBeenCalledWith('file:///in.jpg');
    expect(mockCrop).toHaveBeenCalledWith(crop);
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
    expect(out).toMatchObject({ uri: 'file:///out.jpg', fileName: 'IMG_1.jpg', mimeType: 'image/jpeg', type: 'image', width: 800, height: 600 });
    expect(out.original).toBe(source);
    expect(mockRelease).toHaveBeenCalled();
  });

  it('a second crop keeps pointing at the very first original', async () => {
    const first = att({ uri: 'file:///first.jpg' });
    const once = await cropAttachment(first, crop);
    const twice = await cropAttachment(once, crop);
    expect(twice.original).toBe(first);
  });

  it('rejects (and still releases) when the manipulator fails', async () => {
    mockRender.mockRejectedValue(new Error('decode failed'));
    await expect(cropAttachment(att(), crop)).rejects.toThrow('decode failed');
    expect(mockRelease).toHaveBeenCalled();
  });

  it('rejects when nothing was saved', async () => {
    mockSave.mockResolvedValue({});
    await expect(cropAttachment(att(), crop)).rejects.toThrow();
  });
});
