import { FACE_CAPTURE_OPTIONS, FACE_PHOTO_JPEG_QUALITY, FACE_PHOTO_MAX_SIDE, prepareFacePhoto, targetSize } from '../prepareFacePhoto';

const mockSave = jest.fn();
const mockResize = jest.fn();
const mockManipulate = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) },
}));

beforeEach(() => {
  mockSave.mockReset().mockResolvedValue({ uri: 'file:///small.jpg', width: 540, height: 720 });
  mockResize.mockReset().mockImplementation(() => ({ renderAsync: async () => ({ saveAsync: mockSave }) }));
  mockManipulate.mockReset().mockImplementation(() => ({ resize: mockResize }));
});

describe('capture options', () => {
  it('asks for high-quality, processed (upright), unmirrored JPEG', () => {
    expect(FACE_CAPTURE_OPTIONS.quality).toBeGreaterThanOrEqual(0.85);
    expect(FACE_CAPTURE_OPTIONS.skipProcessing).toBe(false);
    expect(FACE_CAPTURE_OPTIONS.imageType).toBe('jpg');
    expect(FACE_CAPTURE_OPTIONS.mirror).toBeUndefined();
  });
});

describe('targetSize', () => {
  it('resizes the longest side only and never upscales', () => {
    expect(targetSize(3000, 4000)).toEqual({ height: FACE_PHOTO_MAX_SIDE });
    expect(targetSize(4000, 3000)).toEqual({ width: FACE_PHOTO_MAX_SIDE });
    expect(targetSize(600, 720)).toBeNull();
    expect(targetSize(undefined, 4000)).toBeNull();
  });
});

describe('prepareFacePhoto', () => {
  it('downsizes a large photo to ~720 px JPEG 0.85', async () => {
    const uri = await prepareFacePhoto({ uri: 'file:///big.jpg', width: 3000, height: 4000 });
    expect(uri).toBe('file:///small.jpg');
    expect(mockManipulate).toHaveBeenCalledWith('file:///big.jpg');
    expect(mockResize).toHaveBeenCalledWith({ height: 720 });
    expect(mockSave).toHaveBeenCalledWith({ compress: FACE_PHOTO_JPEG_QUALITY, format: 'jpeg' });
  });

  it('returns the original photo when it is already small or its size is unknown', async () => {
    expect(await prepareFacePhoto({ uri: 'a', width: 400, height: 500 })).toBe('a');
    expect(await prepareFacePhoto({ uri: 'b' })).toBe('b');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('falls back to the original photo when resizing throws', async () => {
    mockSave.mockRejectedValueOnce(new Error('boom'));
    expect(await prepareFacePhoto({ uri: 'file:///big.jpg', width: 3000, height: 4000 })).toBe('file:///big.jpg');
    mockManipulate.mockImplementationOnce(() => {
      throw new Error('no module');
    });
    expect(await prepareFacePhoto({ uri: 'c', width: 3000, height: 4000 })).toBe('c');
  });
});
