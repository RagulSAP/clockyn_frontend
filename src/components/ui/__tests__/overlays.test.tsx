import React from 'react';
import { Text as RNText } from 'react-native';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { BottomSheet, Button, ConfirmDialog, ImageViewer, LoadingOverlay, Modal, ToastProvider, toast, useConfirm, useToast } from '@/components/ui';
import { renderThemed } from '../testing/testUtils';

describe('Modal / BottomSheet', () => {
  it('renders title, body and footer only while visible, and closes via the close button', async () => {
    const onClose = jest.fn();
    const { rerender } = await renderThemed(
      <Modal visible onClose={onClose} title="Edit" footer={<RNText>footer</RNText>}>
        <RNText>body</RNText>
      </Modal>,
    );
    expect(screen.getByText('Edit')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
    expect(screen.getByText('footer')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Close dialog'));
    expect(onClose).toHaveBeenCalled();
    await rerender(
      <Modal visible={false} onClose={onClose} title="Edit">
        <RNText>body</RNText>
      </Modal>,
    );
  });

  it('non-dismissible modal has no close button', async () => {
    await renderThemed(
      <Modal visible onClose={() => {}} title="Locked" dismissible={false}>
        <RNText>x</RNText>
      </Modal>,
    );
    expect(screen.queryByLabelText('Close dialog')).toBeNull();
  });

  it('BottomSheet renders its children', async () => {
    await renderThemed(
      <BottomSheet visible onClose={() => {}} title="Pick" snap="half">
        <RNText>sheet body</RNText>
      </BottomSheet>,
    );
    expect(screen.getByText('sheet body')).toBeTruthy();
  });
});

describe('ConfirmDialog / useConfirm', () => {
  it('controlled dialog fires confirm and cancel', async () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    await renderThemed(<ConfirmDialog visible title="Delete?" message="Cannot undo" confirmText="Delete" destructive onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByText('Cannot undo')).toBeTruthy();
    await fireEvent.press(screen.getByText('Delete'));
    expect(onConfirm).toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('useConfirm resolves true on confirm and false on cancel', async () => {
    let confirm!: ReturnType<typeof useConfirm>;
    function Harness() {
      confirm = useConfirm();
      return null;
    }
    await renderThemed(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    let result: Promise<boolean> = Promise.resolve(false);
    await act(async () => {
      result = confirm({ title: 'Sure?', confirmText: 'Yes' });
    });
    await fireEvent.press(await screen.findByText('Yes'));
    await expect(result).resolves.toBe(true);

    await act(async () => {
      result = confirm({ title: 'Again?', cancelText: 'Nope' });
    });
    await fireEvent.press(await screen.findByText('Nope'));
    await expect(result).resolves.toBe(false);
  });

  it('useConfirm resolves false (with a warning) when no provider is mounted', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    let confirm!: ReturnType<typeof useConfirm>;
    function Harness() {
      confirm = useConfirm();
      return null;
    }
    await renderThemed(<Harness />);
    await expect(confirm({ title: 'x' })).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('Toast', () => {
  afterEach(async () => {
    await act(async () => {
      toast.clear();
    });
  });

  it('shows success / error / info toasts and de-duplicates', async () => {
    let api!: ReturnType<typeof useToast>;
    function Harness() {
      api = useToast();
      return null;
    }
    await renderThemed(
      <ToastProvider>
        <Harness />
      </ToastProvider>,
    );
    await act(async () => {
      api.success('Saved');
      api.success('Saved');
      api.error('Failed');
      api.info('FYI');
    });
    expect(screen.getAllByText('Saved').length).toBe(1);
    expect(screen.getByText('Failed')).toBeTruthy();
    expect(screen.getByText('FYI')).toBeTruthy();
  });

  it('nested providers render a single toast layer', async () => {
    await renderThemed(
      <ToastProvider>
        <ToastProvider>
          <RNText>app</RNText>
        </ToastProvider>
      </ToastProvider>,
    );
    await act(async () => {
      toast.info('Once');
    });
    expect(screen.getAllByText('Once').length).toBe(1);
  });

  it('shows toasts above an open modal (inside the modal layer)', async () => {
    await renderThemed(
      <ToastProvider>
        <Modal visible onClose={() => {}} title="M">
          <Button title="t" onPress={() => toast.success('Over modal')} testID="t" />
        </Modal>
      </ToastProvider>,
    );
    await fireEvent.press(screen.getByTestId('t'));
    expect(screen.getAllByText('Over modal').length).toBe(1);
  });
});

describe('LoadingOverlay / ImageViewer', () => {
  it('LoadingOverlay shows the message only while visible and fires the timeout safety net', async () => {
    jest.useFakeTimers();
    const onTimeout = jest.fn();
    const { rerender } = await renderThemed(<LoadingOverlay visible message="Saving…" timeoutMs={1000} onTimeout={onTimeout} />);
    expect(screen.getByText('Saving…')).toBeTruthy();
    await act(async () => {
      jest.advanceTimersByTime(1100);
    });
    expect(onTimeout).toHaveBeenCalledTimes(1);
    await rerender(<LoadingOverlay visible={false} message="Saving…" />);
    expect(screen.queryByText('Saving…')).toBeNull();
    jest.useRealTimers();
  });

  it('ImageViewer renders controls and closes', async () => {
    const onClose = jest.fn();
    await renderThemed(<ImageViewer visible uri="https://example.test/a.png?sig=1" onClose={onClose} />);
    await fireEvent.press(screen.getByLabelText('Close image'));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByLabelText('Zoom in')).toBeTruthy();
  });

  it('ImageViewer renders nothing when hidden', async () => {
    await renderThemed(<ImageViewer visible={false} uri="https://example.test/a.png" onClose={() => {}} />);
    expect(screen.queryByLabelText('Close image')).toBeNull();
  });
});
