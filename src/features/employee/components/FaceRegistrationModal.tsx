import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal as RNModal, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { faceApi } from '@/api';
import { Button, Icon, Text } from '@/components/ui';
import { getErrorMessage } from '@/lib/api/errors';
import { hapticNotification } from '@/lib/platform/haptics';
import { openAppSettings } from '@/lib/platform/permissions';
import { darkColors, radii, spacing } from '@/theme';
import type { FaceFailureInfo } from '@/types/api/face';

import { FACE_TIPS, TIPS_AFTER_FAILURES, failureInfoOf, registrationFailureText } from '../utils/faceGuidance';
import { FACE_CAPTURE_OPTIONS, prepareFacePhoto } from '../utils/prepareFacePhoto';
import {
  CAM,
  CameraAccessDenied,
  CameraTopBar,
  FaceTipsSheet,
  HintPill,
  OvalOverlay,
  ShutterButton,
  ShutterFlash,
  ovalFrameStyle,
  useOvalGeometry,
  useShake,
  useShutterFlash,
} from './faceCaptureParts';

type Step = 'guide' | 'capturing' | 'preview' | 'uploading' | 'success';

export const FACE_PHOTO_COUNT = 4;
const CAPTURE_GAP_MS = 900;
const RETRY_GAP_MS = 800;
/** v1 retried a failing capture forever (silent stall); now it gives up after this many attempts per photo. */
const MAX_CAPTURE_ATTEMPTS = 3;

/** Instruction shown before photo n (index 0-3). Instructions only — nothing verifies the pose. */
export const CAPTURE_INSTRUCTIONS = ['Look straight at the camera', 'Tilt your head slightly left', 'Tilt your head slightly right', 'Look straight again'] as const;

/** Server message (+ structured `code` / `reason` of the 400 body when the server sends them) -> user text of a failed registration. */
export function registrationFailureMessage(message: string | undefined, info?: FaceFailureInfo): string {
  return registrationFailureText(message, info);
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface FaceRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  orgId: string;
  /** Called after the user taps "Get Started" on the success panel. */
  onSuccess: () => void;
}

/** First-time face enrolment: 4 guided photos, a confirmation preview, then `POST /face/register`. */
export function FaceRegistrationModal({ visible, ...rest }: FaceRegistrationModalProps) {
  // The session mounts fresh every time the modal opens, so all state starts clean (no reset effects).
  return visible ? <FaceRegistrationSession {...rest} /> : null;
}

function FaceRegistrationSession({ onClose, userId, orgId, onSuccess }: Omit<FaceRegistrationModalProps, 'visible'>) {
  const [permission, requestCameraPermission] = useCameraPermissions();
  const geometry = useOvalGeometry();
  const flash = useShutterFlash();
  const { translateX, shake } = useShake();
  const cameraRef = useRef<CameraView>(null);
  const generation = useRef(0);
  const shouldStop = useRef(false);
  const asked = useRef(false);
  const [step, setStep] = useState<Step>('guide');
  const [captured, setCaptured] = useState<string[]>([]);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [camReady, setCamReady] = useState(false);
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [hint, setHint] = useState('');
  const [failure, setFailure] = useState('');
  const [askedDone, setAskedDone] = useState(false);
  const [showTips, setShowTips] = useState(false);
  /** Consecutive failed registration attempts; every `TIPS_AFTER_FAILURES`-th one opens the tips sheet. */
  const failures = useRef(0);

  const doReset = useCallback(() => {
    generation.current += 1;
    shouldStop.current = true;
    setStep('guide');
    setCaptured([]);
    setPreviewUri(null);
    setCamReady(false);
    setHint('');
  }, []);

  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      void requestCameraPermission()
        .catch(() => undefined)
        .finally(() => setAskedDone(true));
    }
  }, [permission, requestCameraPermission]);

  // Closing (or unmounting) stops a running capture sequence and drops late results.
  useEffect(
    () => () => {
      shouldStop.current = true;
      generation.current += 1;
    },
    [],
  );

  const close = useCallback(() => {
    failures.current = 0;
    setShowTips(false);
    doReset();
    onClose();
  }, [doReset, onClose]);

  const startCapture = useCallback(async () => {
    if (!cameraRef.current || !camReady) return;
    const gen = generation.current;
    shouldStop.current = false;
    setFailure('');
    setStep('capturing');
    const taken: string[] = [];
    for (let idx = 0; idx < FACE_PHOTO_COUNT; idx += 1) {
      let uri: string | undefined;
      let attempts = 0;
      while (!uri) {
        if (shouldStop.current || gen !== generation.current) return;
        try {
          flash.fire();
          const photo = await cameraRef.current?.takePictureAsync(FACE_CAPTURE_OPTIONS);
          if (!photo?.uri) throw new Error('no photo');
          // Same capture options + on-device downscale as the punch camera (falls back to the original on failure).
          uri = await prepareFacePhoto(photo);
        } catch {
          attempts += 1;
          if (attempts >= MAX_CAPTURE_ATTEMPTS) {
            if (gen !== generation.current) return;
            shake();
            hapticNotification('error');
            setCaptured([]);
            setCamReady(false);
            setStep('guide');
            setHint('Camera error — please try again');
            return;
          }
          await sleep(RETRY_GAP_MS);
        }
      }
      taken.push(uri);
      if (gen !== generation.current) return;
      setCaptured([...taken]);
      if (idx < FACE_PHOTO_COUNT - 1) await sleep(CAPTURE_GAP_MS);
    }
    if (gen !== generation.current) return;
    shouldStop.current = true;
    setPreviewUri(taken[FACE_PHOTO_COUNT - 1]);
    setStep('preview');
  }, [camReady, flash, shake]);

  const retake = useCallback(() => {
    generation.current += 1;
    shouldStop.current = false;
    setCaptured([]);
    setPreviewUri(null);
    setHint('');
    setCamReady(false);
    setStep('guide');
  }, []);

  const confirmRegister = useCallback(async () => {
    if (captured.length < FACE_PHOTO_COUNT || step === 'uploading') return;
    const gen = generation.current;
    setStep('uploading');
    try {
      await faceApi.registerFace({ userId, orgId, faceUris: captured });
      // The first photo also becomes the profile photo; this must never block or fail the registration.
      void faceApi
        .saveProfilePhoto(userId, { uri: captured[0], fileName: 'profile.jpg', mimeType: 'image/jpeg' })
        .catch(() => console.warn('[face] profile photo upload failed'));
      hapticNotification('success');
      failures.current = 0;
      if (gen === generation.current) setStep('success');
    } catch (e) {
      if (gen !== generation.current) return;
      const serverMessage = e instanceof Error ? e.message : undefined;
      doReset();
      shouldStop.current = false;
      setFailure(registrationFailureMessage(serverMessage ?? getErrorMessage(e, 'Check your connection and try again.'), failureInfoOf(e)));
      failures.current += 1;
      if (failures.current % TIPS_AFTER_FAILURES === 0) setShowTips(true);
    }
  }, [captured, step, userId, orgId, doReset]);

  const finish = useCallback(() => {
    failures.current = 0;
    setShowTips(false);
    doReset();
    onClose();
    onSuccess();
  }, [doReset, onClose, onSuccess]);

  const denied = !!permission && !permission.granted && (!permission.canAskAgain || askedDone);
  const showCamera = (step === 'guide' || step === 'capturing') && !!permission?.granted;
  const accent = CAM.text;
  const instruction = CAPTURE_INSTRUCTIONS[Math.min(captured.length, FACE_PHOTO_COUNT - 1)];

  return (
    <RNModal visible animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root} testID="face-registration-modal">
        {denied ? (
          <CameraAccessDenied
            message="Camera permission is needed to capture photos for face registration. Please enable it in your device settings."
            onOpenSettings={openAppSettings}
            onClose={close}
          />
        ) : (
          <>
            {showCamera ? (
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                onCameraReady={() => setCamReady(true)}
                onMountError={() => {
                  shake();
                  setHint('Camera error — close and retry');
                }}
              />
            ) : null}
            {step === 'preview' && previewUri ? (
              <View style={ovalFrameStyle(geometry)}>
                <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Captured photo preview" />
              </View>
            ) : null}
            {step !== 'uploading' && step !== 'success' ? <OvalOverlay geometry={geometry} color={accent} pulse={step === 'guide'} /> : null}
            {step !== 'success' ? (
              <CameraTopBar
                onClose={close}
                chipLabel={step === 'preview' ? 'CONFIRM PHOTO' : 'FACE REGISTRATION'}
                chipColor={accent}
                onFlip={step === 'guide' || step === 'capturing' ? () => setFacing((f) => (f === 'front' ? 'back' : 'front')) : undefined}
              />
            ) : null}

            {step === 'guide' || step === 'capturing' ? (
              <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
                <View style={[styles.labelWrap, { top: Math.max(geometry.top - 44, spacing.huge) }]}>
                  {step === 'capturing' ? (
                    <HintPill text={instruction} />
                  ) : (
                    <Text variant="callout" color={CAM.text} align="center">
                      Position your face in the oval
                    </Text>
                  )}
                </View>
                <View style={[styles.bottomWrap, { top: geometry.top + geometry.height + spacing.lg }]}>
                  {failure ? <HintPill text={`Registration Failed — ${failure}`} error /> : null}
                  {hint ? <HintPill text={hint} error /> : null}
                  <View style={styles.dots} accessibilityLabel={`${captured.length} of ${FACE_PHOTO_COUNT} photos taken`}>
                    {Array.from({ length: FACE_PHOTO_COUNT }, (_, i) => (
                      <View
                        key={i}
                        style={[
                          styles.dot,
                          i < captured.length ? { backgroundColor: accent, borderColor: accent } : { borderColor: CAM.textSoft },
                          i === captured.length && step === 'capturing' ? { borderColor: CAM.text } : null,
                        ]}
                      >
                        {i < captured.length ? <Icon name="check" size={12} color={darkColors.background} /> : null}
                      </View>
                    ))}
                  </View>
                  <ShutterButton
                    onPress={() => void startCapture()}
                    disabled={!camReady || step === 'capturing'}
                    color={accent}
                    label={step === 'capturing' ? `${captured.length}/${FACE_PHOTO_COUNT}` : <Icon name="camera" size={26} color={darkColors.background} />}
                    testID="face-start-capture"
                  />
                  <Text variant="caption" color={CAM.textSoft}>
                    {step === 'capturing' ? 'Hold still…' : camReady ? 'Tap to start — 4 photos will be taken' : 'Starting camera…'}
                  </Text>
                </View>
              </Animated.View>
            ) : null}

            {step === 'preview' ? (
              <View style={[styles.bottomWrap, { top: geometry.top + geometry.height + spacing.lg }]}>
                <Text variant="title3" color={CAM.text} align="center">
                  Does this look clear?
                </Text>
                <Text variant="caption" color={CAM.textSoft} align="center">
                  Your face should be well-lit and centred
                </Text>
                <View style={styles.thumbs}>
                  {captured.map((uri, i) => (
                    <Image key={uri + i} source={{ uri }} style={styles.thumb} accessibilityLabel={`Photo ${i + 1}`} />
                  ))}
                </View>
                <View style={styles.previewActions}>
                  <Button title="Retake" variant="secondary" onPress={retake} style={styles.previewButton} />
                  <Button title="Register Face" onPress={() => void confirmRegister()} style={styles.previewButton} testID="face-register" />
                </View>
              </View>
            ) : null}

            {step === 'uploading' ? (
              <View style={styles.center} testID="face-uploading">
                <View style={styles.loadingDots}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.loadingDot, { backgroundColor: accent, opacity: 1 - i * 0.25 }]} />
                  ))}
                </View>
                <Text variant="title3" color={CAM.text}>
                  Registering your face…
                </Text>
              </View>
            ) : null}

            {step === 'success' ? (
              <View style={styles.center} testID="face-registered">
                <View style={[styles.resultIcon, { backgroundColor: CAM.success }]}>
                  <Icon name="check" size={44} color={darkColors.background} />
                </View>
                <Text variant="title1" color={CAM.text} align="center">
                  Face Registered
                </Text>
                <Text variant="body" color={CAM.textSoft} align="center" style={{ maxWidth: 340 }}>
                  You can now punch in using face verification.
                </Text>
                <Button title="Get Started" size="lg" onPress={finish} style={styles.resultButton} testID="face-get-started" />
              </View>
            ) : null}
            {showTips && step === 'guide' ? <FaceTipsSheet tips={FACE_TIPS} message={failure ? `Registration Failed — ${failure}` : undefined} onDismiss={() => setShowTips(false)} /> : null}
            <ShutterFlash opacity={flash.opacity} />
          </>
        )}
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CAM.backdrop },
  labelWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bottomWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  dots: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  thumbs: { flexDirection: 'row', gap: spacing.sm },
  thumb: { width: 44, height: 56, borderRadius: radii.sm },
  previewActions: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch', maxWidth: 420, width: '100%' },
  previewButton: { flex: 1 },
  center: { position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0, backgroundColor: CAM.dim, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl },
  loadingDots: { flexDirection: 'row', gap: spacing.sm },
  loadingDot: { width: 12, height: 12, borderRadius: 6 },
  resultIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  resultButton: { alignSelf: 'stretch', maxWidth: 360, width: '100%', marginTop: spacing.md },
});
