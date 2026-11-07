import React from 'react';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { faceApi } from '@/api';
import { ApiError } from '@/lib/api/errors';

import { FaceRecognitionModal, isNoFaceMessage } from '../components/FaceRecognitionModal';
import { CAPTURE_INSTRUCTIONS, FaceRegistrationModal, registrationFailureMessage } from '../components/FaceRegistrationModal';
import { renderScreen } from './harness';

jest.mock('@/api', () => ({
  faceApi: { punch: jest.fn(), registerFace: jest.fn(), saveProfilePhoto: jest.fn() },
}));

const mockTakePicture = jest.fn();
jest.mock('expo-camera', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react') as typeof React;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const CameraView = R.forwardRef(function CameraView(props: { onCameraReady?: () => void }, ref: React.Ref<unknown>) {
    R.useImperativeHandle(ref, () => ({ takePictureAsync: (...a: unknown[]) => mockTakePicture(...a) }));
    R.useEffect(() => {
      props.onCameraReady?.();
    }, []);
    return <View testID="camera-view" />;
  });
  return { CameraView, useCameraPermissions: () => [{ granted: true, canAskAgain: true, status: 'granted' }, jest.fn(async () => ({ granted: true }))] };
});

const punch = faceApi.punch as jest.Mock;

const result = (over: Record<string, unknown>) => ({ success: false, message: '', faceMismatch: false, isHoliday: false, raw: {}, ...over });

async function renderRecognition(props: Partial<React.ComponentProps<typeof FaceRecognitionModal>> = {}) {
  const onClose = jest.fn();
  const onSuccess = jest.fn();
  await renderScreen(<FaceRecognitionModal visible onClose={onClose} userId="u1" orgId="org1" action="punch_in" coords={{ latitude: 1, longitude: 2 }} onSuccess={onSuccess} {...props} />);
  return { onClose, onSuccess };
}

async function capture() {
  await waitFor(() => expect(screen.getByTestId('face-capture').props.accessibilityState.disabled).toBe(false));
  await act(async () => {
    await fireEvent.press(screen.getByTestId('face-capture'));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTakePicture.mockResolvedValue({ uri: 'file:///face.jpg' });
});

describe('isNoFaceMessage / registrationFailureMessage', () => {
  it('matches "no face" case-insensitively', () => {
    expect(isNoFaceMessage('No face detected')).toBe(true);
    expect(isNoFaceMessage('Face not recognized')).toBe(false);
  });
  it('maps registration failures to the v1 texts', () => {
    expect(registrationFailureMessage('No face detected in photo 2')).toBe('Face not visible in some photos. Ensure good lighting and try again.');
    expect(registrationFailureMessage('Server busy')).toBe('Server busy');
    expect(registrationFailureMessage(undefined)).toBe('Please try again.');
  });
});

describe('FaceRecognitionModal', () => {
  it('punches in with the checked coordinates and shows "Punched In!" with the time', async () => {
    punch.mockResolvedValueOnce(result({ success: true, time: '09:15' }));
    const { onSuccess, onClose } = await renderRecognition();
    await capture();
    expect(await screen.findByText('Punched In!')).toBeTruthy();
    expect(screen.getByText('09:15 AM')).toBeTruthy();
    expect(punch).toHaveBeenCalledTimes(1);
    expect(punch).toHaveBeenCalledWith({ userId: 'u1', orgId: 'org1', action: 'punch_in', faceUri: 'file:///face.jpg', latitude: 1, longitude: 2 });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess.mock.calls[0][1]).toBe('punch_in');
    await fireEvent.press(screen.getByTestId('face-done'));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows an accepted punch as a normal punch even when the server flags a face mismatch (no admin review any more)', async () => {
    punch.mockResolvedValueOnce(result({ success: true, time: '18:00', faceMismatch: true }));
    await renderRecognition({ action: 'punch_out' });
    await capture();
    expect(await screen.findByText('Punched Out!')).toBeTruthy();
    expect(screen.queryByText('Sent for admin review')).toBeNull();
  });

  it('a "no face" failure restores the camera with a hint and sends NO second request', async () => {
    punch.mockResolvedValueOnce(result({ message: 'No face detected' }));
    const { onSuccess } = await renderRecognition();
    await capture();
    expect(await screen.findByText('We couldn’t see your face — fill the oval')).toBeTruthy();
    expect(punch).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('a photo that does not match asks to try again, sends NO second request and no admin review', async () => {
    punch.mockResolvedValueOnce(result({ code: 'no_match', message: 'Face not recognized' }));
    const { onSuccess } = await renderRecognition();
    await capture();
    expect(await screen.findByText('Photo is not matching — please try again')).toBeTruthy();
    expect(punch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Sent for admin review')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('any other failure shows the server message and sends NO second request', async () => {
    punch.mockResolvedValueOnce(result({ message: 'Maximum 3 punch-in session(s) allowed per day.' }));
    const { onSuccess } = await renderRecognition();
    await capture();
    expect(await screen.findByText('Maximum 3 punch-in session(s) allowed per day.')).toBeTruthy();
    expect(punch).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows the holiday result and does not call onSuccess', async () => {
    punch.mockResolvedValueOnce(result({ isHoliday: true, message: 'Today is a holiday (Diwali). Attendance is not required.' }));
    const { onSuccess } = await renderRecognition();
    await capture();
    expect(await screen.findByText('No Attendance Needed')).toBeTruthy();
    expect(screen.getByText('Today is a holiday (Diwali). Attendance is not required.')).toBeTruthy();
    expect(screen.getByText('Got it')).toBeTruthy();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('shows a connection hint on a network error and a server message on an HTTP error (plan block)', async () => {
    punch.mockRejectedValueOnce(new ApiError({ status: 0, message: 'Network connection failed.', isNetwork: true }));
    await renderRecognition();
    await capture();
    expect(await screen.findByText('Connection error — check your network')).toBeTruthy();
  });

  it('shows the plan-block message instead of force-retrying on a 403', async () => {
    punch.mockRejectedValueOnce(new ApiError({ status: 403, message: 'Your plan has expired. Please contact your admin.', detail: 'Your plan has expired. Please contact your admin.' }));
    await renderRecognition();
    await capture();
    expect(await screen.findByText('Your plan has expired. Please contact your admin.')).toBeTruthy();
    expect(punch).toHaveBeenCalledTimes(1);
  });
});

describe('FaceRegistrationModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('takes four guided photos, previews, registers and sets the first photo as the profile photo', async () => {
    let n = 0;
    mockTakePicture.mockImplementation(async () => ({ uri: `file:///f${n++}.jpg` }));
    (faceApi.registerFace as jest.Mock).mockResolvedValue({ message: 'ok' });
    (faceApi.saveProfilePhoto as jest.Mock).mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    await renderScreen(<FaceRegistrationModal visible onClose={onClose} userId="u1" orgId="org1" onSuccess={onSuccess} />);

    expect(screen.getByText('Position your face in the oval')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Tap to start — 4 photos will be taken')).toBeTruthy());
    await act(async () => {
      await fireEvent.press(screen.getByTestId('face-start-capture'));
    });
    expect(CAPTURE_INSTRUCTIONS).toHaveLength(4);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(900 * 4);
    });
    expect(mockTakePicture).toHaveBeenCalledTimes(4);
    expect(await screen.findByText('Does this look clear?')).toBeTruthy();
    expect(screen.getByText('Your face should be well-lit and centred')).toBeTruthy();

    await act(async () => {
      await fireEvent.press(screen.getByTestId('face-register'));
    });
    expect(faceApi.registerFace).toHaveBeenCalledWith({ userId: 'u1', orgId: 'org1', faceUris: ['file:///f0.jpg', 'file:///f1.jpg', 'file:///f2.jpg', 'file:///f3.jpg'] });
    expect(faceApi.saveProfilePhoto).toHaveBeenCalledWith('u1', expect.objectContaining({ uri: 'file:///f0.jpg' }));
    expect(await screen.findByText('Face Registered')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('face-get-started'));
    expect(onClose).toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('a refused registration goes back to the guide with the mapped message and discards the photos', async () => {
    let n = 0;
    mockTakePicture.mockImplementation(async () => ({ uri: `file:///f${n++}.jpg` }));
    (faceApi.registerFace as jest.Mock).mockRejectedValue(new ApiError({ status: 200, message: 'No face detected in photo 3' }));
    await renderScreen(<FaceRegistrationModal visible onClose={jest.fn()} userId="u1" orgId="org1" onSuccess={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Tap to start — 4 photos will be taken')).toBeTruthy());
    await act(async () => {
      await fireEvent.press(screen.getByTestId('face-start-capture'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(900 * 4);
    });
    await act(async () => {
      await fireEvent.press(await screen.findByTestId('face-register'));
    });
    expect(await screen.findByText(/Face not visible in some photos/)).toBeTruthy();
    expect(screen.queryByText('Does this look clear?')).toBeNull();
    expect(faceApi.saveProfilePhoto).not.toHaveBeenCalled();
  });

  it('gives up with a message when the camera keeps failing (v1 stalled forever)', async () => {
    mockTakePicture.mockRejectedValue(new Error('camera busy'));
    await renderScreen(<FaceRegistrationModal visible onClose={jest.fn()} userId="u1" orgId="org1" onSuccess={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Tap to start — 4 photos will be taken')).toBeTruthy());
    await act(async () => {
      await fireEvent.press(screen.getByTestId('face-start-capture'));
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(800 * 5);
    });
    expect(await screen.findByText('Camera error — please try again')).toBeTruthy();
    expect(mockTakePicture).toHaveBeenCalledTimes(3);
  });

  describe('tips sheet after repeated failed registrations (FA-4)', () => {
    async function captureAndRegister() {
      await waitFor(() => expect(screen.getByText('Tap to start — 4 photos will be taken')).toBeTruthy());
      await act(async () => {
        await fireEvent.press(screen.getByTestId('face-start-capture'));
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(900 * 4);
      });
      await act(async () => {
        await fireEvent.press(await screen.findByTestId('face-register'));
      });
      // With the tips sheet open the message appears twice (hint pill + sheet), so look for any match.
      await screen.findAllByText(/Registration Failed/);
    }

    beforeEach(() => {
      let n = 0;
      mockTakePicture.mockImplementation(async () => ({ uri: `file:///f${n++}.jpg` }));
      (faceApi.registerFace as jest.Mock).mockRejectedValue(new ApiError({ status: 200, message: 'No face detected in photo 3' }));
    });

    const modal = (visible = true) => <FaceRegistrationModal visible={visible} onClose={jest.fn()} userId="u1" orgId="org1" onSuccess={jest.fn()} />;

    it('shows the tips with the last guidance message after the second consecutive failure and dismisses them', async () => {
      await renderScreen(modal());
      await captureAndRegister();
      expect(screen.queryByTestId('face-tips')).toBeNull();
      await captureAndRegister();
      expect(screen.getByTestId('face-tips')).toBeTruthy();
      expect(screen.getByText('Tips for a clear photo')).toBeTruthy();
      expect(screen.getAllByText(/Registration Failed — Face not visible in some photos/).length).toBeGreaterThan(0);
      await fireEvent.press(screen.getByTestId('face-tips-dismiss'));
      expect(screen.queryByTestId('face-tips')).toBeNull();
    });

    it('keeps counting after a dismissal: tips again on the fourth failure, not the third', async () => {
      await renderScreen(modal());
      await captureAndRegister();
      await captureAndRegister();
      await fireEvent.press(screen.getByTestId('face-tips-dismiss'));
      await captureAndRegister();
      expect(screen.queryByTestId('face-tips')).toBeNull();
      await captureAndRegister();
      expect(screen.getByTestId('face-tips')).toBeTruthy();
    });

    it('closing the modal resets the failure count', async () => {
      const view = await renderScreen(modal());
      await captureAndRegister();
      await view.rerender(modal(false));
      await view.rerender(modal(true));
      await captureAndRegister();
      expect(screen.queryByTestId('face-tips')).toBeNull();
    });
  });
});
