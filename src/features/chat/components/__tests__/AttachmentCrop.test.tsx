import React, { useEffect, useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme';
import type { PickedAttachment } from '../../hooks/usePickAttachment';
import { AttachmentPreview } from '../AttachmentPreview';

const mockCrop = jest.fn();
const mockRender = jest.fn();
const mockSave = jest.fn();
const mockManipulate = jest.fn();

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg', PNG: 'png' },
  ImageManipulator: { manipulate: (...a: unknown[]) => mockManipulate(...a) },
}));

beforeEach(() => {
  mockSave.mockReset().mockResolvedValue({ uri: 'file:///cache/cropped-1.jpg', width: 2000, height: 2000 });
  mockRender.mockReset().mockImplementation(async () => ({ saveAsync: mockSave, release: jest.fn() }));
  mockCrop.mockReset().mockImplementation(() => ({ renderAsync: mockRender, release: jest.fn() }));
  mockManipulate.mockReset().mockImplementation(() => ({ crop: mockCrop, release: jest.fn() }));
});

const photo = (over: Partial<PickedAttachment> = {}): PickedAttachment => ({
  uri: 'file:///cache/site-photo.jpg',
  fileName: 'site-photo.jpg',
  mimeType: 'image/jpeg',
  type: 'image',
  width: 4000,
  height: 2000,
  ...over,
});

/** Holds the pending attachment like the Composer does (cropping replaces it). */
function Harness({ initial, onCancel = jest.fn(), onSend = jest.fn(), changeable = true }: { initial: PickedAttachment | null; onCancel?: () => void; onSend?: () => void; changeable?: boolean }) {
  const [pending, setPending] = useState<PickedAttachment | null>(initial);
  return (
    <ThemeProvider>
      <AttachmentPreview
        attachment={pending}
        onCancel={() => {
          onCancel();
          setPending(null);
        }}
        onSend={onSend}
        onChange={changeable ? setPending : undefined}
      />
    </ThemeProvider>
  );
}

async function show(props: React.ComponentProps<typeof Harness>) {
  await render(<Harness {...props} />);
}

/** Lays the crop surface out at 400 x 500 (the photo area is that minus 22 px of handle room on each side: 356 x 456). */
async function layoutSurface() {
  await fireEvent(await screen.findByTestId('attachment-crop-surface'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 500 } } });
}

/** expo-image hands its `source` on as an array. */
const uriOf = (source: unknown): string | undefined => (Array.isArray(source) ? source[0] : (source as { uri?: string }))?.uri;
const imageUri = () => uriOf(screen.getByTestId('attachment-preview-image').props.source);

describe('Crop button', () => {
  it('shows for a photo and has an accessible name', async () => {
    await show({ initial: photo() });
    expect(screen.getByTestId('attachment-preview-crop')).toBeTruthy();
    expect(screen.getByLabelText('Crop photo')).toBeTruthy();
  });

  it('is hidden for documents, GIFs and when the owner cannot take a change', async () => {
    await show({ initial: { uri: 'file:///a.pdf', fileName: 'a.pdf', mimeType: 'application/pdf', type: 'file' } });
    expect(screen.queryByTestId('attachment-preview-crop')).toBeNull();
  });

  it('is hidden for an animated GIF', async () => {
    await show({ initial: photo({ uri: 'file:///a.gif', fileName: 'a.gif', mimeType: 'image/gif' }) });
    expect(screen.getByTestId('attachment-preview-image')).toBeTruthy();
    expect(screen.queryByTestId('attachment-preview-crop')).toBeNull();
  });

  it('is hidden without onChange', async () => {
    await show({ initial: photo(), changeable: false });
    expect(screen.queryByTestId('attachment-preview-crop')).toBeNull();
  });
});

describe('crop step', () => {
  it('opens with the photo, the four presets and Cancel / Reset / Done; Cancel returns to the preview with the same photo', async () => {
    await show({ initial: photo() });
    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    expect(screen.getByTestId('attachment-crop')).toBeTruthy();
    for (const k of ['free', '1x1', '4x3', '16x9']) expect(screen.getByTestId(`attachment-crop-aspect-${k}`)).toBeTruthy();
    expect(screen.getByTestId('attachment-crop-done')).toBeTruthy();
    expect(screen.getByTestId('attachment-crop-reset')).toBeTruthy();
    await layoutSurface();
    expect(screen.getByTestId('attachment-crop-rect')).toBeTruthy();
    expect(screen.getAllByTestId(/attachment-crop-handle-/)).toHaveLength(4);
    expect(screen.getByTestId('attachment-crop-size')).toHaveTextContent('4000 × 2000 px');

    await fireEvent.press(screen.getByTestId('attachment-crop-cancel'));
    expect(screen.queryByTestId('attachment-crop')).toBeNull();
    expect(imageUri()).toBe('file:///cache/site-photo.jpg');
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('Done on the untouched full frame just closes the step (nothing is re-encoded)', async () => {
    await show({ initial: photo() });
    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    await layoutSurface();
    await fireEvent.press(screen.getByTestId('attachment-crop-done'));
    expect(screen.queryByTestId('attachment-crop')).toBeNull();
    expect(mockManipulate).not.toHaveBeenCalled();
  });

  it('a preset reshapes the rectangle and Done crops ORIGINAL pixels (1:1 on a 2:1 photo = the middle square)', async () => {
    await show({ initial: photo() });
    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    await layoutSurface();
    await fireEvent.press(screen.getByTestId('attachment-crop-aspect-1x1'));
    expect(screen.getByTestId('attachment-crop-size')).toHaveTextContent('2000 × 2000 px');
    await fireEvent.press(screen.getByTestId('attachment-crop-done'));

    await waitFor(() => expect(screen.queryByTestId('attachment-crop')).toBeNull());
    expect(mockManipulate).toHaveBeenCalledWith('file:///cache/site-photo.jpg');
    const crop = mockCrop.mock.calls[0][0] as { originX: number; originY: number; width: number; height: number };
    expect(crop.originY).toBe(0);
    expect(crop.height).toBe(2000);
    expect(Math.abs(crop.width - 2000)).toBeLessThanOrEqual(2);
    expect(Math.abs(crop.originX - 1000)).toBeLessThanOrEqual(2); // centred: (4000 - 2000) / 2
    expect(mockSave).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
    // the preview shows the cropped file now, still the same pick (modal never closed)
    expect(imageUri()).toBe('file:///cache/cropped-1.jpg');
    expect(screen.getByTestId('attachment-preview-name')).toHaveTextContent('site-photo.jpg');
  });

  it('Send after a crop hands the cropped file on, with the original kept for Reset', async () => {
    const onSend = jest.fn();
    function Probe() {
      const [pending, setPending] = useState<PickedAttachment | null>(photo());
      return (
        <ThemeProvider>
          <AttachmentPreview attachment={pending} onCancel={() => setPending(null)} onSend={() => onSend(pending)} onChange={setPending} />
        </ThemeProvider>
      );
    }
    await render(<Probe />);
    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    await layoutSurface();
    await fireEvent.press(screen.getByTestId('attachment-crop-aspect-16x9'));
    await fireEvent.press(screen.getByTestId('attachment-crop-done'));
    await waitFor(() => expect(imageUri()).toBe('file:///cache/cropped-1.jpg'));
    await fireEvent.press(screen.getByTestId('attachment-preview-send'));
    const sent = onSend.mock.calls[0][0] as PickedAttachment;
    expect(sent).toMatchObject({ uri: 'file:///cache/cropped-1.jpg', fileName: 'site-photo.jpg', mimeType: 'image/jpeg', type: 'image' });
    expect(sent.original?.uri).toBe('file:///cache/site-photo.jpg');
  });

  it('can crop again (from the cropped file) and Reset restores the original photo', async () => {
    await show({ initial: photo() });
    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    await layoutSurface();
    await fireEvent.press(screen.getByTestId('attachment-crop-aspect-1x1'));
    await fireEvent.press(screen.getByTestId('attachment-crop-done'));
    await waitFor(() => expect(imageUri()).toBe('file:///cache/cropped-1.jpg'));

    mockSave.mockResolvedValue({ uri: 'file:///cache/cropped-2.jpg', width: 1500, height: 1500 });
    await fireEvent.press(screen.getByTestId('attachment-preview-crop')); // second crop works on the cropped file
    await layoutSurface();
    expect(screen.getByTestId('attachment-crop-size')).toHaveTextContent('2000 × 2000 px');
    await fireEvent.press(screen.getByTestId('attachment-crop-aspect-4x3'));
    await fireEvent.press(screen.getByTestId('attachment-crop-done'));
    await waitFor(() => expect(imageUri()).toBe('file:///cache/cropped-2.jpg'));
    expect(mockManipulate).toHaveBeenLastCalledWith('file:///cache/cropped-1.jpg');

    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    await layoutSurface();
    await fireEvent.press(screen.getByTestId('attachment-crop-reset'));
    // back on the original, in the crop step with the full frame
    await layoutSurface();
    expect(uriOf(screen.getByTestId('attachment-crop-image').props.source)).toBe('file:///cache/site-photo.jpg');
    expect(screen.getByTestId('attachment-crop-size')).toHaveTextContent('4000 × 2000 px');
    await fireEvent.press(screen.getByTestId('attachment-crop-cancel'));
    expect(imageUri()).toBe('file:///cache/site-photo.jpg');
  });

  it('a PNG stays PNG (lossless) and a WebP is written as JPEG', async () => {
    mockSave.mockResolvedValue({ uri: 'file:///cache/c.png', width: 2000, height: 2000 });
    await show({ initial: photo({ uri: 'file:///a.png', fileName: 'diagram.png', mimeType: 'image/png' }) });
    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    await layoutSurface();
    await fireEvent.press(screen.getByTestId('attachment-crop-aspect-1x1'));
    await fireEvent.press(screen.getByTestId('attachment-crop-done'));
    await waitFor(() => expect(imageUri()).toBe('file:///cache/c.png'));
    expect(mockSave).toHaveBeenCalledWith({ format: 'png', compress: 1 });
    expect(screen.getByTestId('attachment-preview-name')).toHaveTextContent('diagram.png');
  });

  it('a manipulator failure shows an inline message and keeps the original', async () => {
    mockRender.mockRejectedValue(new Error('boom'));
    await show({ initial: photo() });
    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    await layoutSurface();
    await fireEvent.press(screen.getByTestId('attachment-crop-aspect-1x1'));
    await fireEvent.press(screen.getByTestId('attachment-crop-done'));
    expect(await screen.findByTestId('attachment-crop-error')).toHaveTextContent(/Could not crop this photo/);
    expect(screen.getByTestId('attachment-crop')).toBeTruthy(); // still in the crop step: retry or Cancel
    await fireEvent.press(screen.getByTestId('attachment-crop-cancel'));
    expect(imageUri()).toBe('file:///cache/site-photo.jpg');
  });

  it('a crop that finishes after the pick was discarded does not bring the preview back', async () => {
    let finish: (v: unknown) => void = () => undefined;
    mockSave.mockImplementation(() => new Promise((r) => (finish = r)));
    let discard: () => void = () => undefined;
    function Probe() {
      const [pending, setPending] = useState<PickedAttachment | null>(photo());
      useEffect(() => {
        discard = () => setPending(null);
      });
      return (
        <ThemeProvider>
          <AttachmentPreview attachment={pending} onCancel={() => setPending(null)} onSend={jest.fn()} onChange={setPending} />
        </ThemeProvider>
      );
    }
    await render(<Probe />);
    await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
    await layoutSurface();
    await fireEvent.press(screen.getByTestId('attachment-crop-aspect-1x1'));
    await fireEvent.press(screen.getByTestId('attachment-crop-done'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    await act(async () => discard()); // hardware back / Cancel elsewhere while the crop runs
    expect(screen.queryByTestId('attachment-preview')).toBeNull();
    await act(async () => finish({ uri: 'file:///cache/late.jpg', width: 10, height: 10 }));
    expect(screen.queryByTestId('attachment-preview')).toBeNull();
  });
});

describe('Escape (web) while cropping', () => {
  it('closes the crop step first and only then discards the pick', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require('react-native');
    const originalOS = Platform.OS;
    const g = globalThis as unknown as { document?: unknown };
    const originalDoc = g.document;
    const listeners = new Set<(e: { key: string }) => void>();
    g.document = {
      addEventListener: (_t: string, fn: (e: { key: string }) => void) => listeners.add(fn),
      removeEventListener: (_t: string, fn: (e: { key: string }) => void) => listeners.delete(fn),
    };
    const escape = () => act(async () => [...listeners].forEach((fn) => fn({ key: 'Escape' })));
    Platform.OS = 'web';
    try {
      const onCancel = jest.fn();
      await show({ initial: photo(), onCancel });
      await fireEvent.press(screen.getByTestId('attachment-preview-crop'));
      expect(screen.getByTestId('attachment-crop')).toBeTruthy();
      await escape();
      expect(screen.queryByTestId('attachment-crop')).toBeNull();
      expect(onCancel).not.toHaveBeenCalled();
      expect(screen.getByTestId('attachment-preview')).toBeTruthy();
      await escape();
      expect(onCancel).toHaveBeenCalledTimes(1);
    } finally {
      Platform.OS = originalOS;
      g.document = originalDoc;
    }
  });
});
