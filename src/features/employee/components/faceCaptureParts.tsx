/** Shared building blocks of the two face-capture modals: oval guide, shutter flash, error shake, top bar, hint pill. */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, Mask, Rect } from 'react-native-svg';

import { Button, Icon, Text, type IconName } from '@/components/ui';
import { withAlpha } from '@/components/ui/internal/color';
import { darkColors, lightColors, radii, spacing } from '@/theme';

const nativeDriver = Platform.OS !== 'web';

/** Camera screens are always dark, whatever the app theme: built from the colour tokens of both palettes. */
export const CAM = {
  backdrop: darkColors.background,
  dim: darkColors.overlay,
  text: lightColors.surface,
  textSoft: withAlpha(lightColors.surface, 0.78),
  chip: withAlpha(lightColors.surface, 0.16),
  danger: darkColors.danger,
  success: darkColors.success,
  warning: darkColors.warning,
  info: darkColors.info,
} as const;

export interface OvalGeometry {
  /** Oval box. */
  width: number;
  height: number;
  /** Top of the oval within the screen. */
  top: number;
  screenWidth: number;
  screenHeight: number;
}

/** Oval of the guide: 76 % of the screen width (capped for desktop browsers), 1.22 x as tall. */
export function useOvalGeometry(): OvalGeometry {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    let w = Math.round(Math.min(width * 0.76, 340));
    let h = Math.round(w * 1.22);
    const maxH = Math.round(height * 0.58);
    if (h > maxH) {
      h = maxH;
      w = Math.round(h / 1.22);
    }
    return { width: w, height: h, top: Math.round(height * 0.17), screenWidth: width, screenHeight: height };
  }, [width, height]);
}

/** Dimmed surround with an oval cut-out and a (pulsing) ring. */
export function OvalOverlay({ geometry, color, pulse }: { geometry: OvalGeometry; color: string; pulse?: boolean }) {
  const { width, height, top, screenWidth, screenHeight } = geometry;
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (!pulse) {
      opacity.setValue(1);
      return undefined;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.3, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
        Animated.timing(opacity, { toValue: 0.95, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: nativeDriver }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, opacity]);

  const cx = screenWidth / 2;
  const cy = top + height / 2;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={screenWidth} height={screenHeight} style={StyleSheet.absoluteFill}>
        <Defs>
          <Mask id="oval-cutout">
            <Rect x={0} y={0} width={screenWidth} height={screenHeight} fill="white" />
            <Ellipse cx={cx} cy={cy} rx={width / 2} ry={height / 2} fill="black" />
          </Mask>
        </Defs>
        <Rect x={0} y={0} width={screenWidth} height={screenHeight} fill={CAM.dim} mask="url(#oval-cutout)" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity }]}>
        <Svg width={screenWidth} height={screenHeight}>
          <Ellipse cx={cx} cy={cy} rx={width / 2} ry={height / 2} stroke={color} strokeWidth={3} fill="none" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/** Photo frozen inside the oval while a request is in flight. */
export function ovalFrameStyle(geometry: OvalGeometry): ViewStyle {
  return {
    position: 'absolute',
    top: geometry.top,
    left: (geometry.screenWidth - geometry.width) / 2,
    width: geometry.width,
    height: geometry.height,
    borderRadius: geometry.width / 2,
    overflow: 'hidden',
  };
}

/** White shutter flash (0.65 -> 0 over 220 ms). */
export function useShutterFlash(): { opacity: Animated.Value; fire: () => void } {
  const [opacity] = useState(() => new Animated.Value(0));
  const fire = useCallback(() => {
    opacity.setValue(0.65);
    Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: nativeDriver }).start();
  }, [opacity]);
  return { opacity, fire };
}

export function ShutterFlash({ opacity }: { opacity: Animated.Value }) {
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: CAM.text, opacity }]} />;
}

/** Horizontal error shake (14, -11, 8, 0 px x 60 ms). */
export function useShake(): { translateX: Animated.Value; shake: () => void } {
  const [translateX] = useState(() => new Animated.Value(0));
  const shake = useCallback(() => {
    const step = (toValue: number) => Animated.timing(translateX, { toValue, duration: 60, useNativeDriver: nativeDriver });
    Animated.sequence([step(14), step(-11), step(8), step(0)]).start();
  }, [translateX]);
  return { translateX, shake };
}

export interface TopBarProps {
  onClose: () => void;
  closeLabel?: string;
  chipLabel: string;
  chipColor: string;
  onFlip?: () => void;
}

/** Close (✕) · action chip · flip camera. */
export function CameraTopBar({ onClose, chipLabel, chipColor, onFlip }: TopBarProps) {
  return (
    <View style={styles.topBar}>
      <RoundIconButton icon="x" label="Close" onPress={onClose} />
      <View style={[styles.chip, { backgroundColor: chipColor }]}>
        <Text variant="micro" color={darkColors.background} style={{ letterSpacing: 0.8 }}>
          {chipLabel}
        </Text>
      </View>
      {onFlip ? <RoundIconButton icon="refresh" label="Flip camera" onPress={onFlip} /> : <View style={styles.roundSpacer} />}
    </View>
  );
}

export function RoundIconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.roundButton}>
      <Icon name={icon} size={20} color={CAM.text} />
    </Pressable>
  );
}

/** Instruction / error line over the camera. */
export function HintPill({ text, error }: { text: string; error?: boolean }) {
  return (
    <View style={[styles.hint, { backgroundColor: error ? CAM.danger : CAM.chip }]}>
      <Text variant="callout" color={error ? darkColors.background : CAM.text} align="center">
        {text}
      </Text>
    </View>
  );
}

/** In-modal tips sheet shown after repeated failed attempts (no nested RN Modal: web support is poor). */
export function FaceTipsSheet({ tips, message, onDismiss }: { tips: readonly string[]; message?: string; onDismiss: () => void }) {
  return (
    <View style={styles.tipsBackdrop} testID="face-tips">
      <View style={styles.tipsCard}>
        {message ? (
          <Text variant="bodyStrong" color={CAM.danger} align="center">
            {message}
          </Text>
        ) : null}
        <Text variant="title3" color={CAM.text} align="center">
          Tips for a clear photo
        </Text>
        {tips.map((tip) => (
          <View key={tip} style={styles.tipRow}>
            <Icon name="check" size={16} color={CAM.success} />
            <Text variant="callout" color={CAM.text} style={styles.tipText}>
              {tip}
            </Text>
          </View>
        ))}
        <Button title="Try again" onPress={onDismiss} size="lg" fullWidth testID="face-tips-dismiss" />
      </View>
    </View>
  );
}

/** Big round shutter / start button. */
export function ShutterButton({
  onPress,
  disabled,
  color,
  label,
  testID,
}: {
  onPress: () => void;
  disabled?: boolean;
  color: string;
  label: React.ReactNode;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel="Capture"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={[styles.shutterOuter, { borderColor: CAM.text, opacity: disabled ? 0.4 : 1 }]}
    >
      <View style={[styles.shutterInner, { backgroundColor: color }]}>{typeof label === 'string' ? <Text variant="title3" color={darkColors.background}>{label}</Text> : label}</View>
    </Pressable>
  );
}

/** Shown instead of the camera when the permission was refused for good. */
export function CameraAccessDenied({ message, onOpenSettings, onClose }: { message: string; onOpenSettings: () => void; onClose: () => void }) {
  return (
    <View style={styles.deniedWrap}>
      <View style={styles.deniedIcon}>
        <Icon name="camera" size={34} color={CAM.text} />
      </View>
      <Text variant="title2" color={CAM.text} align="center">
        Camera Access Required
      </Text>
      <Text variant="body" color={CAM.textSoft} align="center" style={{ maxWidth: 360 }}>
        {message}
      </Text>
      <View style={{ gap: spacing.sm, alignSelf: 'stretch', maxWidth: 360, width: '100%' }}>
        {Platform.OS === 'web' ? null : <Button title="Open Settings" onPress={onOpenSettings} fullWidth />}
        <Button title="Not now" variant="ghost" onPress={onClose} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
  },
  roundSpacer: { width: 40, height: 40 },
  roundButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: CAM.chip },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radii.pill },
  hint: { alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.pill, maxWidth: '90%' },
  shutterOuter: { width: 82, height: 82, borderRadius: 41, borderWidth: 4, alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  tipsBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: CAM.dim, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  tipsCard: { alignSelf: 'stretch', maxWidth: 380, width: '100%', gap: spacing.md, padding: spacing.xl, borderRadius: radii.lg, backgroundColor: CAM.backdrop, borderWidth: 1, borderColor: CAM.chip },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tipText: { flex: 1 },
  deniedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, gap: spacing.lg },
  deniedIcon: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: CAM.chip },
});
