/** `pickImage` (native): every picked / captured image leaves as JPEG / PNG; non-image documents are unaffected. */
import { pickDocument, pickImage } from '../media.native';

const mockLibrary = jest.fn();
const mockCamera = jest.fn();
const mockSave = jest.fn();
const mockManipulate = jest.fn();

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a),
  launchCameraAsync: (...a: unknown[]) => mockCamera(...a),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: async () => ({
    canceled: false,
    assets: [{ uri: 'file:///d.pdf', name: 'd.pdf', mimeType: 'application/pdf', size: 10 }],
  }),
}));
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) },
}));
jest.mock('../permissions.native', () => ({ requestPermission: async () => true }));

const asset = (over: Record<string, unknown> = {}) => ({
  canceled: false,
  assets: [{ uri: 'file:///p.heic', fileName: 'IMG_1.HEIC', mimeType: 'image/heic', width: 4000, height: 3000, ...over }],
});

beforeEach(() => {
  mockSave.mockReset().mockResolvedValue({ uri: 'file:///p.jpg', width: 2048, height: 1536 });
  mockManipulate.mockReset().mockImplementation(() => ({
    resize: () => ({ renderAsync: async () => ({ saveAsync: mockSave }) }),
    renderAsync: async () => ({ saveAsync: mockSave }),
  }));
  mockLibrary.mockReset().mockResolvedValue(asset());
  mockCamera.mockReset().mockResolvedValue(asset());
});

describe('pickImage (native)', () => {
  it('converts a HEIC library pick to a .jpg / image/jpeg file', async () => {
    const img = await pickImage();
    expect(img).toEqual({ uri: 'file:///p.jpg', mimeType: 'image/jpeg', fileName: 'IMG_1.jpg', width: 2048, height: 1536 });
  });

  it('converts a HEIC camera capture too', async () => {
    const img = await pickImage({ source: 'camera' });
    expect(mockCamera).toHaveBeenCalled();
    expect(img?.mimeType).toBe('image/jpeg');
    expect(img?.fileName).toBe('IMG_1.jpg');
  });

  it('passes a JPEG / PNG pick through without touching the manipulator', async () => {
    mockLibrary.mockResolvedValueOnce(asset({ uri: 'file:///p.jpg', fileName: 'p.jpg', mimeType: 'image/jpeg' }));
    expect(await pickImage()).toEqual({ uri: 'file:///p.jpg', mimeType: 'image/jpeg', fileName: 'p.jpg', width: 4000, height: 3000 });
    mockLibrary.mockResolvedValueOnce(asset({ uri: 'file:///p.png', fileName: 'p.png', mimeType: 'image/png' }));
    expect((await pickImage())?.mimeType).toBe('image/png');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('keeps the original HEIC pick when the conversion fails (the server still takes it)', async () => {
    mockSave.mockRejectedValueOnce(new Error('boom'));
    const img = await pickImage();
    expect(img).toEqual({ uri: 'file:///p.heic', mimeType: 'image/heic', fileName: 'IMG_1.HEIC', width: 4000, height: 3000 });
  });

  it('a cancelled pick is still null', async () => {
    mockLibrary.mockResolvedValueOnce({ canceled: true, assets: [] });
    expect(await pickImage()).toBeNull();
  });
});

describe('pickDocument (native)', () => {
  it('is unaffected (non-image files are never converted)', async () => {
    expect(await pickDocument()).toEqual({ uri: 'file:///d.pdf', name: 'd.pdf', mimeType: 'application/pdf', size: 10 });
    expect(mockManipulate).not.toHaveBeenCalled();
  });
});
