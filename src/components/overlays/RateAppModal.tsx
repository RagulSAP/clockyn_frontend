import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, View } from 'react-native';

import { Button, Icon, Modal, Text } from '@/components/ui';
import { brand } from '@/config/brand';
import { getRateStoreUrl, markRateAppDone, openRateStore, snoozeRateApp } from '@/lib/rateApp';
import { spacing, useTheme } from '@/theme';

export type RateAppModalProps = {
  visible: boolean;
  /** Called after the modal has persisted its outcome (snooze / done); the parent hides it. */
  onClose: () => void;
};

const STARS = [1, 2, 3, 4, 5] as const;
const CLOSE_AFTER_SUBMIT_MS = 800;

/** Primary button label by selection (v1 copy). */
export function rateCtaLabel(selected: number): string {
  if (selected === 0) return 'Rate Us';
  return selected >= 4 ? 'Love it — Rate on Store' : 'Submit Rating';
}

function Star({ index, selected, onPress }: { index: number; selected: boolean; onPress: (n: number) => void }) {
  const { colors } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  const wasSelected = useRef(selected);

  // Cascade bounce when this star becomes part of the selection (staggered by its position).
  useEffect(() => {
    if (selected && !wasSelected.current) {
      Animated.sequence([
        Animated.delay((index - 1) * 60),
        Animated.timing(scale, { toValue: 1.35, duration: 120, useNativeDriver: Platform.OS !== 'web' }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }),
      ]).start();
    }
    wasSelected.current = selected;
  }, [selected, index, scale]);

  return (
    <Pressable
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={`Rate ${index} ${index === 1 ? 'star' : 'stars'}`}
      accessibilityState={{ selected }}
      style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}
      testID={`rate-star-${index}`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Text style={{ fontSize: 36, lineHeight: 42, color: selected ? colors.warning : colors.borderStrong }}>{selected ? '★' : '☆'}</Text>
      </Animated.View>
    </Pressable>
  );
}

/**
 * "Enjoying Clockyn?" prompt. Stars are cosmetic (they only change the button label — the count is not stored or
 * sent anywhere, v1). "Rate on Store" marks the prompt done and opens the listing; "Maybe later", the close
 * button, Esc, the scrim and Android back all snooze it for 14 days. With no store URL configured the store
 * button is hidden (nothing to rate on).
 */
export function RateAppModal({ visible, onClose }: RateAppModalProps) {
  const { colors } = useTheme();
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStore = getRateStoreUrl().length > 0;

  // Every showing starts fresh (adjusting state during render, not in an effect).
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setSelected(0);
      setSubmitted(false);
    }
  }

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const later = useCallback(async () => {
    await snoozeRateApp();
    onClose();
  }, [onClose]);

  const submit = useCallback(async () => {
    if (selected === 0 || submitted) return;
    setSubmitted(true);
    await markRateAppDone();
    await openRateStore();
    closeTimer.current = setTimeout(onClose, CLOSE_AFTER_SUBMIT_MS);
  }, [selected, submitted, onClose]);

  const handleClose = useCallback(() => {
    if (submitted) {
      if (closeTimer.current) clearTimeout(closeTimer.current);
      onClose();
      return;
    }
    void later();
  }, [submitted, onClose, later]);

  const footer = submitted ? undefined : (
    <View style={{ gap: spacing.sm }}>
      {hasStore ? (
        <Button
          title={rateCtaLabel(selected)}
          onPress={() => void submit()}
          disabled={selected === 0}
          icon="star"
          fullWidth
          testID="rate-cta"
        />
      ) : null}
      <Button title="Maybe later" variant="ghost" onPress={() => void later()} fullWidth testID="rate-later" />
    </View>
  );

  return (
    <Modal visible={visible} onClose={handleClose} title={submitted ? undefined : `Enjoying ${brand.name}?`} size="sm" footer={footer} testID="rate-app-modal">
      {submitted ? (
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
          <Icon name="party-popper" size={44} color="primary" />
          <Text variant="title2" align="center">
            Thank you!
          </Text>
          <Text color="textSecondary" align="center">
            Your review means a lot to us.
          </Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="heart" size={30} color="danger" />
          </View>
          <Text color="textSecondary" align="center">
            Tap a star to rate us — it helps us improve and reach more teams!
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center' }} accessibilityRole="radiogroup">
            {STARS.map((n) => (
              <Star key={n} index={n} selected={n <= selected} onPress={setSelected} />
            ))}
          </View>
          {!hasStore ? (
            <Text variant="caption" color="textMuted" align="center">
              The store link is not available right now.
            </Text>
          ) : null}
        </View>
      )}
    </Modal>
  );
}
