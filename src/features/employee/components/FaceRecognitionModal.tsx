import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal as RNModal, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { faceApi } from '@/api';
import { Button, Icon, Spinner, Text } from '@/components/ui';
import { isApiError } from '@/lib/api/errors';
import { formatTime12 } from '@/lib/datetime';
import { hapticNotification } from '@/lib/platform/haptics';
import { openAppSettings } from '@/lib/platform/permissions';
import { darkColors, radii, spacing } from '@/theme';
import type { PunchAction, PunchResult } from '@/types/api/face';

import { FACE_TIPS, HOLD_STILL_MS, TIPS_AFTER_FAILURES, isHolidayFailure, isNoFaceFailure, isNoFaceMessage, noFaceText, punchFailureText } from '../utils/faceGuidance';
import { FACE_CAPTURE_OPTIONS, prepareFacePhoto } from '../utils/prepareFacePhoto';
import { warmFace } from '../utils/warmFace';
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

/** `holding` = the short "hold still" moment between the tap and the shutter. */
type Phase = 'idle' | 'holding' | 'processing' | 'success' | 'holiday';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface FaceRecognitionModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  orgId: string;
  action: PunchAction;
  /** Coordinates the geofence check passed with; sent with the punch (no second GPS fix). */
  coords?: { latitude: number; longitude: number };
  /** Called with the server response as soon as a punch is accepted (before the user taps Done). */
  onSuccess?: (result: PunchResult, action: PunchAction) => void;
}

export { isNoFaceMessage };

/**
 * Full-screen face punch camera. Flow: tap -> short "hold still" -> capture one selfie -> downscale -> `POST /face/punch`
 * -> result. `no face` / `image_unreadable` retries the photo, holiday shows "No Attendance Needed", face mismatch
 * (`no_match`) and other business failures show an inline hint and return to the camera to retry. After
 * `TIPS_AFTER_FAILURES` failed attempts in a row a tips sheet is shown.
 */
export function FaceRecognitionModal({ visible, ...rest }: FaceRecognitionModalProps) {
  // The session mounts fresh every time the modal opens, so all state starts clean (no reset effects).
  return visible ? <FaceRecognitionSession {...rest} /> : null;
}

function FaceRecognitionSession({ onClose, userId, orgId, action, coords, onSuccess }: Omit<FaceRecognitionModalProps, 'visible'>) {
  const [permission, requestCameraPermission] = useCameraPermissions();
  const geometry = useOvalGeometry();
  const flash = useShutterFlash();
  const { translateX, shake } = useShake();
  const cameraRef = useRef<CameraView>(null);
  const generation = useRef(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [hint, setHint] = useState('');
  const [result, setResult] = useState<{ time?: string; message?: string }>({});
  const [camReady, setCamReady] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [askedDone, setAskedDone] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const failures = useRef(0);

  const accent = action === 'punch_in' ? CAM.success : CAM.warning;

  useEffect(() => {
    warmFace(userId);
  }, [userId]);

  const asked = useRef(false);
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked.current) {
      asked.current = true;
      void requestCameraPermission()
        .catch(() => undefined)
        .finally(() => setAskedDone(true));
    }
  }, [permission, requestCameraPermission]);

  // Results of a request that finishes after the modal was closed are not shown (the punch itself still counts).
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  const close = onClose;

  const fail = useCallback(
    (text: string) => {
      shake();
      hapticNotification('error');
      setHint(text);
      setPhase('idle');
      setCapturedUri(null);
      setCamReady(false);
      failures.current += 1;
      if (failures.current % TIPS_AFTER_FAILURES === 0) setShowTips(true);
    },
    [shake],
  );

  const submit = useCallback(
    async (uri: string) => {
      const gen = generation.current;
      const alive = () => generation.current === gen;
      const base = { userId, orgId, action, faceUri: uri, latitude: coords?.latitude, longitude: coords?.longitude };
      const accepted = (r: PunchResult, withTime: boolean) => {
        hapticNotification('success');
        onSuccess?.(r, action);
        if (!alive()) return;
        setResult({ time: withTime ? r.time : undefined });
        setPhase('success');
      };

      let first: PunchResult;
      try {
        first = await faceApi.punch(base);
      } catch (e) {
        if (alive()) fail(isApiError(e) && !e.isNetwork && e.message ? e.message : 'Connection error — check your network');
        return;
      }
      if (first.success) {
        accepted(first, true);
        return;
      }
      if (isHolidayFailure(first)) {
        if (!alive()) return;
        setResult({ message: first.message });
        setPhase('holiday');
        return;
      }
      if (isNoFaceFailure(first)) {
        if (alive()) fail(noFaceText(first));
        return;
      }
      // Face did not match (no_match) or any other business failure: prompt the user to retry.
      if (alive()) fail(punchFailureText(first));
    },
    [userId, orgId, action, coords, onSuccess, fail],
  );

  const capture = useCallback(async () => {
    const camera = cameraRef.current;
    if (!camera || !camReady || phase !== 'idle') return;
    const gen = generation.current;
    setHint('');
    setPhase('holding');
    await sleep(HOLD_STILL_MS);
    if (generation.current !== gen) return;
    flash.fire();
    try {
      const photo = await camera.takePictureAsync(FACE_CAPTURE_OPTIONS);
      if (!photo?.uri) {
        shake();
        setHint('Capture failed — tap to retry');
        setPhase('idle');
        return;
      }
      setCapturedUri(photo.uri);
      setPhase('processing');
      // Downscale on the device (falls back to the original photo if that fails).
      await submit(await prepareFacePhoto(photo));
    } catch {
      shake();
      setHint('Camera error — close and retry');
      setPhase('idle');
      setCapturedUri(null);
      setCamReady(false);
    }
  }, [camReady, phase, flash, shake, submit]);

  const denied = !!permission && !permission.granted && (!permission.canAskAgain || askedDone);
  const showCamera = (phase === 'idle' || phase === 'holding') && !!permission?.granted;
  const resultPhase = phase === 'success' || phase === 'holiday';
  const title = action === 'punch_in' ? 'Punched In!' : 'Punched Out!';

  return (
    <RNModal visible animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root} testID="face-recognition-modal">
        {denied ? (
          <CameraAccessDenied
            message="Camera permission is needed to capture your face for attendance verification. Please enable it in your device settings."
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
            {phase === 'processing' && capturedUri ? (
              <View style={ovalFrameStyle(geometry)}>
                <Image source={{ uri: capturedUri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityLabel="Captured photo" />
              </View>
            ) : null}
            {!resultPhase ? <OvalOverlay geometry={geometry} color={hint ? CAM.danger : accent} pulse={phase === 'idle'} /> : null}
            {resultPhase ? null : (
              <CameraTopBar
                onClose={close}
                chipLabel={action === 'punch_in' ? 'PUNCH IN' : 'PUNCH OUT'}
                chipColor={accent}
                onFlip={phase === 'idle' && !showTips ? () => setFacing((f) => (f === 'front' ? 'back' : 'front')) : undefined}
              />
            )}

            {phase === 'idle' || phase === 'holding' || phase === 'processing' ? (
              <Animated.View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
                <View style={[styles.labelWrap, { top: Math.max(geometry.top - 44, spacing.huge) }]}>
                  <Text variant="callout" color={CAM.text} align="center">
                    {phase === 'processing' ? 'Verifying your identity…' : phase === 'holding' ? 'Hold still…' : 'Look directly at the camera'}
                  </Text>
                </View>
                <View style={[styles.bottomWrap, { top: geometry.top + geometry.height + spacing.lg }]}>
                  {hint ? <HintPill text={hint} error /> : null}
                  {phase === 'processing' ? (
                    <View style={styles.processing}>
                      <Spinner color={CAM.text} />
                      <Text variant="caption" color={CAM.textSoft}>
                        Please wait a moment
                      </Text>
                    </View>
                  ) : (
                    <>
                      <ShutterButton onPress={() => void capture()} disabled={!camReady || phase === 'holding'} color={accent} label={<Icon name="camera" size={26} color={darkColors.background} />} testID="face-capture" />
                      <Text variant="caption" color={CAM.textSoft}>
                        {phase === 'holding' ? 'Keep your face in the oval' : camReady ? 'Tap to capture & verify' : 'Starting camera…'}
                      </Text>
                    </>
                  )}
                </View>
              </Animated.View>
            ) : null}

            {resultPhase ? (
              <View style={styles.result} testID="face-result">
                <View style={[styles.resultIcon, { backgroundColor: phase === 'holiday' ? CAM.info : accent }]}>
                  <Icon name={phase === 'holiday' ? 'calendar-days' : 'check'} size={44} color={darkColors.background} />
                </View>
                <Text variant="title1" color={CAM.text} align="center">
                  {phase === 'holiday' ? 'No Attendance Needed' : title}
                </Text>
                {phase === 'holiday' ? (
                  <Text variant="body" color={CAM.textSoft} align="center" style={styles.resultText}>
                    {result.message}
                  </Text>
                ) : result.time ? (
                  <View style={styles.timeChip}>
                    <Icon name="clock" size={16} color={CAM.text} />
                    <Text variant="bodyStrong" color={CAM.text}>
                      {formatTime12(result.time)}
                    </Text>
                  </View>
                ) : null}
                <Button title={phase === 'holiday' ? 'Got it' : 'Done'} onPress={close} size="lg" style={styles.resultButton} testID="face-done" />
              </View>
            ) : null}
            {showTips && phase === 'idle' ? <FaceTipsSheet tips={FACE_TIPS} message={hint} onDismiss={() => setShowTips(false)} /> : null}
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
  bottomWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: spacing.md },
  processing: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md },
  result: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: CAM.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  resultIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  resultText: { maxWidth: 360 },
  timeChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, backgroundColor: CAM.chip },
  resultButton: { alignSelf: 'stretch', maxWidth: 360, width: '100%', marginTop: spacing.md },
});
